# Caching in searchv2

Short write-up of the caching position (exam project: "forholder jer til brug af caching"). The implementation is `SearchAPI/Api/Controllers/SearchController.cs` and `k8s/redis.yaml`.

## Architecture

A shared **application-level cache** in Redis, used **cache-aside**, in front of PostgreSQL:

1. The controller hashes the request (query words and case flag, SHA-256) into the key `search:<hash>` (the client adds the prefix `SearchV2_`).
2. Hit: return the stored JSON. Miss: run the search against PostgreSQL, store the result, return it.
3. Both API replicas use the same Redis (one pod in the `caching` namespace), so one replica's miss warms the other. A per-pod in-memory cache would split the hit ratio across replicas and would break "scale out, not up".

The API itself stays stateless: Redis holds only data that can be recomputed.

## What is cached, and what is not

Cached:

- **Search results for repeated queries** (the full result including hits, ignored words and timing). This is the only thing cached today and the one that matters: it skips the three database round trips of a search.
- *Candidates, not implemented:* document details by id (`GetDocDetails`) and the word-to-id lookup (`GetWordIds`). Both are small, read-mostly and identical across queries, but they are cheap queries, so a result cache gives most of the benefit.

Not cached:

- **The index while it is rebuilt.** The indexer drops and recreates the tables, so anything cached from the old index is wrong. Redis is restarted after indexing (`start.sh`) and the API is scaled to zero during a reindex.
- **Anything that must be current**, and requests while the `SearchCache` flag is off (see "Disabling a feature" in `README.md`).

## Write and read strategy

Cache-aside (lazy loading). The application is the only writer to the cache and only fills it after a miss; there is no write-through or write-back, because the cached data is derived from a database that only the indexer writes. The cost is that the first request for every query is slow and that the cache can be stale after reindexing (below).

## Eviction, TTL and invalidation

| Setting | Value | Why |
| --- | --- | --- |
| `maxmemory` | 64 MB (container limit 128 MiB) | Bounded memory; Redis evicts instead of being OOM-killed. |
| `maxmemory-policy` | `allkeys-lru` | Every key is a result cache entry with no special value, so evict the least recently used; popular queries stay. |
| Sliding expiration | 1 minute | Keeps queries that are being repeated warm. |
| Absolute expiration | 5 minutes | Without it a query repeated at least once a minute never expires, so a stale result could live forever. Five minutes is the maximum staleness during normal operation. |
| Persistence | none (`--save ""`, `--appendonly no`) | It is a cache; a restart just empties it. |
| Invalidation | restart Redis after reindexing | The index only changes through the indexer batch job, so a flush at the end of it is exact and simple. No per-key invalidation is needed. |

## Failure behaviour

A cache is an optimisation, so it must not take search down:

- The controller catches Redis errors (read, write, and unreadable entries) and answers from PostgreSQL. Each failure is counted in `searchv2.cache_errors` and logged as a warning.
- The connection uses `AbortOnConnectFail=false` and 1 s timeouts, so a Redis outage does not stop the API from starting. **Measured with Redis scaled to zero: every search still succeeds, but takes about 4 s instead of about 0.05 s**, because each request tries Redis for the read and again for the write before falling back. Remaining weakness: a circuit breaker (skip the cache for some seconds after a failure) would remove that delay; it is not implemented.
- Covered by `SearchCacheTests` (failing cache, corrupt entry).
- With the flag switched off, Redis is not touched at all.

## Metrics

On the Grafana dashboard: **Cache hit ratio** (hits / (hits + misses)) and **Cache hits, misses and errors per second**, from `searchv2.cache_hits`, `searchv2.cache_misses` and `searchv2.cache_errors`. Redis' own metrics (memory, evictions) are not exported; there is no exporter.

## Expected hit ratio

Measured in the load test (`PERFORMANCE-TEST.md`): about **80 %**, with a workload of 50 repeating queries (skewed) and 20 % one-off queries, so the figure is largely set by that mix and is not a prediction for real traffic. On 26 November the cache looked worth 3.4 times the throughput (135 against 40 req/s at 16 workers), but that run had a CPU limit that throttled PostgreSQL. Re-run without the limit on 27 November (`PERFORMANCE-TEST.md`, section D): 556 req/s with the cache and 521 without, p95 42 ms against 44 ms, so the speed gain is about 7 %. The hit ratio was 80 % (55,233 hits, 13,951 misses). So in this system the cache is justified as protection for PostgreSQL (it answers four queries in five), not as a speed-up; it would matter more with a larger index or more traffic. A rough sizing check: one entry is a few KB, so 64 MB holds on the order of 10,000 distinct queries, far more than the five-minute TTL lets accumulate at this traffic, so evictions should be rare (Redis' eviction counter is not monitored, so this is not verified).

## Scaling Redis (not done)

One replica without persistence is enough for a cache of this size. If it had to grow: Redis replicas for read throughput, or Redis Cluster to shard the keys across nodes (the same hash-by-key idea as the z-axis in `DATABASE-SCALING.md`). A Redis outage already degrades gracefully, so high availability (Sentinel) is not required. Network Policies restricting access to the `searchv2` namespace are an optional hardening step.
