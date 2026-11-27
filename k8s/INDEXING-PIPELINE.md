# Indexing pipeline with a message bus (RabbitMQ)

The extension for the exam project. The exam description lists it twice: indexing "can be seen as a
pipeline" (a y-scale), and "a service bus is introduced, for example RabbitMQ". It also closes the one
architecture principle this project had skipped, *asynchronous design* (see [DECISIONS.md](DECISIONS.md)).

## Before and after

Before, the indexer was one process: it walked the folder, tokenised every file and wrote the index, one
document after another. It could not be scaled, because it handed out document and word ids from counters
in its own memory.

After, the same work is three stages connected by queues. Each stage is its own Deployment (or Job), is
scaled on its own, and can fail without taking the others down.

```
                       RabbitMQ (namespace messaging)
                 ┌──────────────────────────────────────────┐
 indexer Job     │  searchv2.documents.discovered           │        indexer-tokenizer (x N)
 (stage 1)  ────►│  { Url, CreatedAt }                      │───────►  read file, extract words
 crawler +       │                                          │              │
 coordinator     │  searchv2.documents.tokenized            │◄─────────────┘
                 │  { Url, CreatedAt, Words[] }             │
                 │                                          │───────►  indexer-writer (x N)
                 │  searchv2.documents.failed  (dead letters)│          one transaction per document
                 └──────────────────────────────────────────┘                    │
                                                                                  ▼
                                                                  PostgreSQL: document, word, occ
```

| Stage | Runs as | What it does | Scaled by |
| --- | --- | --- | --- |
| 1. Crawler and coordinator | Job `indexer` (role `pipeline`) | Empties the queues, recreates the index tables, publishes one `DocumentDiscovered` message per file (path and date only, never the content), then waits until every document is stored or dead-lettered and prints the result. | one instance |
| 2. Tokenizer | Deployment `indexer-tokenizer` (role `tokenizer`) | Reads the file, extracts the distinct normalised words (the same code the batch indexer uses) and publishes `DocumentTokenized`. | `kubectl scale`, stateless |
| 3. Writer | Deployment `indexer-writer` (role `writer`) | Writes the document, its words and occurrences to PostgreSQL in one transaction. | `kubectl scale`, safe in parallel |

One image, `searchv2-indexer`, runs in four roles chosen by its first argument: `batch` (the original
single-process indexer, still the default, used by docker compose), `pipeline`, `tokenizer` and `writer`.

## Decisions and why

* **Messages carry a path, not the document.** A message stays a few hundred bytes, so the broker is not
  a file store. The cost is that every tokenizer must see the files: they read the same read-only `hostPath`
  volume as before (see [DECISIONS.md](DECISIONS.md) for what replaces it in production). A worker only
  reads files inside the document folder, so a forged message cannot make it read another path.
* **The database assigns the ids.** The old indexer numbered documents and words from in-memory counters, so
  two instances would hand out the same ids. The tables now use identity columns, and a word is inserted with
  `INSERT ... ON CONFLICT (name) DO NOTHING` followed by a lookup, so any number of writers can add words
  at the same time without duplicates. The batch indexer still works against the same schema because the
  identity columns accept explicit ids. SearchAPI is unchanged: it reads the same three tables.
* **At-least-once delivery, so every write is idempotent.** A message is acknowledged only after the
  transaction has committed. If a worker dies, the broker delivers the message to another worker, so a
  document can arrive twice. The writer looks the document up by its unique `url`, deletes its old
  occurrences and writes them again, so the second delivery changes nothing. This was tested by killing
  workers during a run (see Results).
* **No deadlocks between writers.** Two transactions inserting the same words in different orders can wait
  on each other. Words are sent and inserted in a fixed order, and a test runs eight writers on overlapping
  vocabularies at the same time.
* **Retry once, then dead-letter.** A message whose handler throws is requeued once after a pause. If it
  fails again it goes to `searchv2.documents.failed` with its history, and the pipeline does not stop. A
  broken file therefore costs one document, not the run, and an operator can look at the message.
* **How the coordinator knows it is finished.** It counts: the run is complete when the documents in the
  database plus the messages in the failed queue equal the number of documents published. Counting the
  database is more reliable than asking the broker, because messages that a worker has received but not yet
  acknowledged are invisible in the queue counts. If nothing moves for two minutes (for example because no
  worker is running) it fails with a message saying so, instead of waiting forever.
* **Why RabbitMQ.** The exam names it, it needs one small container, and its queue model (competing
  consumers on a durable queue, dead-letter exchanges) is exactly what this pipeline needs. Kafka would add a
  cluster and a log to manage for a workload with no need to replay messages. A cloud bus (Azure Service Bus,
  SQS) would behave the same but needs an account.

## Run it

`./k8s/start.sh` starts RabbitMQ, the two worker Deployments (2 replicas each) and then runs the indexer
Job, which is how the cluster gets its index. Replacing the index later is the same procedure as before
([README.md](README.md), "Reindex safely"): stop the API, run the Job, restart Redis, start the API. The Job is
now the pipeline coordinator, so the workers must be running.

```sh
# Scale a stage on its own
kubectl --context searchv2 -n searchv2 scale deployment/indexer-writer --replicas=4
kubectl --context searchv2 -n searchv2 scale deployment/indexer-tokenizer --replicas=2

# Watch the queues: RabbitMQ web UI (user searchv2, password in the rabbitmq-credentials Secret)
kubectl --context searchv2 -n messaging port-forward service/rabbitmq 15672:15672
kubectl --context searchv2 -n messaging get secret rabbitmq-credentials -o jsonpath='{.data.password}' | base64 --decode; echo

# Measure a full reindex with different worker counts (REPLACES the index; stop the API first)
./k8s/pipeline-scaling.sh 1:1 2:2 4:4        # TOKENIZERS:WRITERS
```

The Grafana dashboard has two panels for it, "Indexing queues: messages waiting" and "Indexing workers
connected". A queue that keeps growing marks the slow stage: `discovered` growing means too few tokenizers,
`tokenized` growing means too few writers.

## Results

3,034 documents (the `seData/medium` set used everywhere else), one Minikube node, the whole system on one
laptop. Time is what the Job reports, from clearing the index to the last document stored.
Raw output: `pipeline-scaling-output.txt`.

| Tokenizers | Writers | Seconds | Documents/s |
| --- | --- | --- | --- |
| 1 | 1 | 24.6 | 123 |
| 2 | 2 | 12.7 | 238 |
| 4 | 4 | 10.4 | 291 |
| 8 | 8 | 8.4 | 363 |
| 1 | 4 | 9.5 | 321 |
| 4 | 1 | 23.5 | 129 |

What this shows:

* **It scales, with diminishing returns.** Two of each is twice as fast as one; eight of each is about three
  times as fast. The workers share one laptop and one PostgreSQL pod, so the curve flattens.
* **The writers are the bottleneck stage.** One tokenizer with four writers (9.5 s) is almost as fast as four
  and four, while four tokenizers with one writer (23.5 s) is no faster than one and one. Tokenising is cheap;
  the database write is the slow part. That is the value of making them separate stages: add writers, not
  tokenizers.
* **A resource limit can hide all of this.** A first set of runs, with PostgreSQL limited to 1 CPU, showed no
  gain from more workers (21.4 s with 1+1, 16.8 s with 2+2, 20.1 s with 4+4; see
  `pipeline-scaling-output-database-cpu-limit-1.txt`). The database pod was being throttled: its CPU
  counters showed it throttled in 884 of 4,045 scheduling periods, 135 s in total. Removing the CPU limit
  (memory limit kept, like the other manifests) gave the table above. The same limit probably explains part of
  the "the database is the bottleneck" finding in [PERFORMANCE-TEST.md](PERFORMANCE-TEST.md), which was
  measured with an even smaller one (the chart's default 150m CPU).

## Failures

Tested on the live cluster:

| What happens | Result |
| --- | --- |
| A writer pod and a tokenizer pod are force-deleted in the middle of a run | The run still finished: 3,034 documents, 0 failed, 13.5 s instead of 12.7 s. The index was identical to a clean run: the same 25,258 words and 462,828 occurrences, and no duplicate documents. |
| A message the tokenizer cannot process (a path outside the document folder) | Logged "will retry", retried once, logged "giving up", and arrived in `searchv2.documents.failed` with its history (`rejected` from the discovered queue). The pipeline kept going. The alert `IndexingMessagesFailed` is on that queue. |

Not tested: RabbitMQ itself restarting during a run. The queues are on an `emptyDir`, so a restarted broker
loses the waiting messages and the coordinator would stop with "no progress" after two minutes. The fix is to
run the Job again, which is cheap because the index is derived data.

## Alerts

Three rules were added to `observability/alerts.yaml` (see [README.md](README.md), "Alerting"):
`RabbitMqDown`, `IndexingMessagesFailed` (anything in the dead-letter queue for a minute) and
`IndexingWorkersMissing` (messages waiting in a work queue but no consumer for two minutes).

## What is not done

* **Search during a reindex.** The index is empty and then fills up, so a search while the Job runs returns
  partial results. The procedure stops the API first, as before. A real system would write to a new set of
  tables and switch when it is complete.
* **One broker, no persistence.** One RabbitMQ pod on an `emptyDir`. Production would use a quorum-queue
  cluster with a persistent volume, so the queues survive a broker restart.
* **No autoscaling.** The worker counts are set by hand. Scaling on the queue length (KEDA, or an HPA on a
  custom metric) is the natural next step and is not built.
* **Only `.txt` files.** Another document type would be a new stage between discovery and tokenising that
  turns the file into text; the messages and queues would not change.
* **Incremental updates.** A run still replaces the whole index. The idempotent write makes re-indexing a
  single document possible (publish one message), but nothing triggers it.
* **Application metrics.** The workers log to standard output only; the queue metrics come from RabbitMQ.
