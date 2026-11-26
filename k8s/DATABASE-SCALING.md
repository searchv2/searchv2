# Scaling the PostgreSQL index (AKF cube)

This is a **design document**, not an implementation. The exam asks to *show how* the database can be scaled along the z-axis; x-axis read replicas are covered as a decision. Today PostgreSQL runs as one pod (`postgresql-db-0`, Bitnami chart, 2 GiB PVC, see `k8s/postgresql/custom-values.yaml`).

## What the workload looks like

| Fact | Where | Why it matters |
| --- | --- | --- |
| The API only **reads** the index; the indexer is the **only writer**, as a one-shot batch job that drops and recreates the tables. | `PostgresIndexStore.cs`, `k8s/README.md` | Reads and writes are cleanly separated, so replicas are easy and shards can be built independently. |
| Schema: `document(id, url, ...)`, `word(id, name UNIQUE)`, `occ(wordId, docId)` with indexes on `occ(wordId)` and `occ(docId, wordId)`. | `PostgresIndexStore.cs` | `occ` is by far the largest table (500 k rows for the teacher's medium set, 11 M for large, 65 M for xlarge). |
| The main query is `SELECT docId, COUNT(wordId) FROM occ WHERE wordId = ANY(@ids) GROUP BY docId ORDER BY count DESC`. | `PostgresDocumentIndex.GetDocuments` | The "score" is a per-document count. It needs no global statistics (no tf-idf), so it can be computed independently per document. |
| Teacher's reference search times: 51 ms (medium), 600 ms (large), 1 min 40 s (xlarge). | `testdata søgemaskine.png` | Search time grows with the size of `occ`. That is the motivation for splitting it. |
| Results are cached in Redis (cache-aside), which both API replicas share. | `SearchController.cs` | Repeated queries never reach the database, so a more expensive database query (scatter/gather) is paid only on cache misses. |

## X-axis: read replicas (clones of the database)

**Decision: documented design, not adopted for now.** It fits the workload well, but it only scales read *throughput*, not the size of the data, and the cache already absorbs repeated queries.

How it would be done (Bitnami chart, guide M12.01):

1. `architecture: replication` and `readReplicas.replicaCount: 2` in `custom-values.yaml`. The chart then creates a primary service (`postgresql-db-primary`) and a load-balanced read service (`postgresql-db-read`).
2. The indexer gets the primary service in its `SEARCH_DB_CONNECTION` (`k8s/indexer.yaml`). The API gets the read service (`k8s/apps.yaml`). Today both use `postgresql-db`.
3. Add the replication password to the Secret that `start.sh` generates.
4. Keep the chart's own PVC per pod. Do not copy the guide's shortcut of pointing all pods at one shared PVC.

Consequences to be able to explain:

- A read replica cannot be written to, because it only replays the primary's WAL stream. Writing through the read service fails.
- Replication is asynchronous unless `synchronousCommit` and `numSynchronousReplicas` are set. Synchronous commit makes a write wait for a replica (durable, slower writes). The indexer is a batch job, so write latency matters little; this is the cheap place to choose durability.
- Reindexing drops and recreates the tables, which is replicated like any write. Replicas can briefly lag or miss tables, so the existing rule of scaling the API to zero during reindexing still applies. Replication lag adds to the cache's staleness (TTL plus lag).
- Scaling the read StatefulSet from 2 to 4 pods is still the **x-axis** (more identical clones). Each replica holds a full copy, so the data size per node does not shrink.

## Z-axis: sharding the index

The z-axis splits *the same kind of data* over several databases by a lookup value, with a routing step in front. It is the answer to "the index no longer fits on, or is too slow on, one node".

### Option A: shard by document (hash of the document)

Each shard holds a slice of `document` and **all `occ` rows of those documents**.

- A query goes to **every** shard (scatter). Each shard runs the existing SQL unchanged on its slice. The API merges the answers (gather).
- Because every document lives on exactly one shard, the per-document counts are already complete. The merge is only a concatenation followed by a sort by count, with no re-aggregation. `GetDocDetails` and `GetMissingWords` also run per shard, on the document ids that shard returned.
- 100 % recall is preserved: every shard answers for its own documents.
- Query time is the time of the slowest shard, over roughly 1/N of `occ`.

### Option B: shard by word (hash of the word)

Each term, with its whole posting list, lives on one shard.

- A query goes only to the shards that own its words, which is cheaper for short queries.
- But a document's words are spread over several shards, so each shard returns partial counts and the router must **sum them per document**. That is a distributed `GROUP BY` and needs all partial lists for large result sets to travel over the network. Fetching missing words and document details needs more cross-shard round trips.
- Popular words (hot keys) make shards uneven, because the word distribution is heavily skewed.

### Choice: A, shard by document

| | A: by document | B: by word |
| --- | --- | --- |
| Query fan-out | all shards | only shards owning the query words |
| Merge | concatenate and sort | sum partial counts per document |
| Skew | even (hash of the document) | uneven (frequent words) |
| Existing SQL | unchanged per shard | needs changes |
| Fits the "score = count of matching words" design | exact | exact but needs a join step |

A is simpler, evenly balanced and keeps the current queries. Its price is that every search touches every shard. That price is acceptable because the shards run in parallel and the Redis cache removes repeated queries.

### Details of design A

**Routing key and mapping.** Use `shard = bucket(hash(url)) → shard`, where the hash is over the document's stable identity (its URL), not over the integer id. Use a fixed number of logical buckets (for example 64) that are mapped to physical shards in a small config table. Moving a bucket then moves a known set of documents, so adding a shard does not rehash everything (the downside of plain `hash % N`).

**The `word` table.** Every shard needs the word ids of the query, so `word` is a small, near-static dictionary that is **replicated to all shards** (a reference table) and keeps global ids. `GetWordIds` can then ask any one shard. Document ids stay globally unique if the indexer allocates them centrally (as it does now, in one process), so `occ` rows from different shards never clash.

**Who routes.** The router lives in the API as a `ShardedDocumentIndex` implementing the existing `IDocumentIndex` interface. It fans out to one `PostgresDocumentIndex` per shard and merges. This fits the onion layers in `uml/class-diagram.puml`: the controller and `SearchService` do not change. A separate proxy service would work (the AKF "reception"), but it adds a hop and another thing to scale and monitor.

**Deployment on Kubernetes.** Each shard is its own Bitnami release (`postgresql-shard-0`, `-1`, ...) with its own PVC in the `database` namespace. Each shard can itself get read replicas, which combines the x-axis (replicas) and z-axis (shards) as in the AKF cube.

**The indexer.** It chooses a shard per document and writes the `document` and `occ` rows there (one binary `COPY` stream per shard, which can run in parallel), and writes `word` to every shard. `PostgresIndexStore` would become one store per shard behind the existing `IIndexStore` interface. A reindex still rebuilds everything, so rebalancing is "change the bucket map and reindex" at this scale.

### Downsides to be able to name

- **Complex routing:** the router, the bucket map and the shard list become part of the system.
- **Heavy cross-shard queries:** every search is a scatter/gather. Latency is set by the slowest shard (tail latency), and an unavailable shard means missing results, which breaks the 100 % recall promise unless the API reports it.
- **More operations and monitoring:** N databases to back up, upgrade and watch. Per-shard metrics would be added to the dashboard (the existing `searchv2.database.operation.duration` would need a `shard` label).
- **Costly rebalancing:** adding a shard moves documents. Logical buckets limit the move; for a derived, rebuildable index, reindexing is the fallback.
- **Cross-shard consistency:** the word dictionary must be identical on all shards, and a reindex must finish on all of them before the API is scaled back up.

### Why not shard now

The index is derived data that the indexer can rebuild, the current data set (about 3,000 documents) is far below the sizes where search time becomes a problem, and Redis absorbs repeated queries. Sharding is the right answer for the xlarge case (65 M `occ` rows, about 100 s per search in the teacher's reference), not for this deployment. Before sharding, the cheaper steps are: x-axis replicas for throughput, and checking that the existing indexes are used (the `occ(wordId)` index).

### Optional: y-axis (functional split)

A y-axis split would separate by function or data type, for example the document metadata (`document`) from the inverted index (`word`, `occ`), or the index from a future search-history store. It is not needed for this design, and splitting `document` from `occ` would add a cross-database lookup for every result list.

## Summary for the exam

| Axis | What | Status |
| --- | --- | --- |
| X | Read replicas (`architecture: replication`), API on the read service, indexer on the primary | Designed above, not deployed |
| Y | Functional split (metadata vs. index) | Mentioned only |
| Z | Shard by document via logical buckets, scatter/gather in the API (`ShardedDocumentIndex`), `word` replicated | Designed above, not deployed |
