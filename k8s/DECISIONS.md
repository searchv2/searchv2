# Architecture decisions and principles

Short notes on the choices behind the Kubernetes deployment, written to answer the questions the exam
is likely to ask. Each note says what was chosen, why, what it costs and what would change in
production. The reasons come from how the system is built and measured; read them through and make
sure you agree with every one, because you have to defend them orally.

Related documents: [README.md](README.md) (how it runs), [CACHING.md](CACHING.md),
[DATABASE-SCALING.md](DATABASE-SCALING.md), [PERFORMANCE-TEST.md](PERFORMANCE-TEST.md) and the
decision log in [../c4reference/kubernetes-startup-c4.md](../c4reference/kubernetes-startup-c4.md).

## Architecture principles (module 1)

The course names five principles and lets the architect choose which to follow.

| Principle | Followed? | Evidence |
| --- | --- | --- |
| Scale out, not up | Yes | Two `search-api` replicas behind one Service (`apps.yaml`, `replicas: 2`); the pods have small CPU and memory requests, and the performance test shows the API is not the bottleneck. |
| Stateless systems | The API, yes; the GUI, no | `search-api` keeps no state: results come from PostgreSQL, cached results from Redis, and the feature flag from a mounted file. Any replica can answer any request (`X-Served-By` shows which one did). Blazor Server keeps a circuit in memory per user, so it runs as one replica (`replicas: 1`). |
| Asynchronous design | Yes, for indexing; no, for search | Indexing is a pipeline of three stages joined by RabbitMQ queues ([INDEXING-PIPELINE.md](INDEXING-PIPELINE.md)). A search stays a synchronous request, see "Synchronous and asynchronous design" below. |
| Design to be monitored | Yes | OpenTelemetry in both apps, Collector, Prometheus, Loki, a provisioned Grafana dashboard and alert rules (`observability/`, README "Alerting"). |
| Design to be disabled | Yes | The `SearchCache` feature flag turns the cache off without a rollback or a new image (README "Disabling a feature"). |

Descoped on purpose: ranking, snippets and synonyms. That keeps the focus on scaling, caching, monitoring,
the message-driven indexing pipeline and operation.

## Database in Kubernetes or not (module 11)

**Chosen:** PostgreSQL runs in the cluster, installed with the Bitnami Helm chart (a single
StatefulSet pod with a 2 GiB PersistentVolumeClaim).

**Why:** the exam environment is one laptop. A managed database would need an account, money and a
network path from Minikube, and the point of the project is to show the operating environment, so
having the database inside it keeps the demo self-contained and lets the performance test measure
the database path. Helm gives a versioned, repeatable install (`helm history`, `helm rollback`).

**Cost (the slide's list):** you own upgrades, backups and failover; persistence depends on the
PersistentVolume; performance is shared with every other pod on the node; and scaling the database
is manual work (see [DATABASE-SCALING.md](DATABASE-SCALING.md)).

**In production:** use a managed PostgreSQL service (or an operator with replicas, backups and
failover) and keep only stateless pods in the cluster. The API only needs a connection string and a
password Secret, so the change would not touch the application code.

**Image version.** The PostgreSQL and exporter images use Bitnami's `latest` tag, because Bitnami no
longer publishes versioned tags on Docker Hub, and the image is pulled once and cached on the laptop.
The risk is a major-version jump (for example 18 to 19) on a cluster that already holds data: PostgreSQL
will not start on a data directory from an older major version, and the fix is a dump and restore, or
re-running the indexer. The index is derived data, so this is cheap here. In production, pin the image
by version or digest from a registry you control.

## Backup and recovery of the database

The index is **derived data**: it is built from the document files by the indexer. If the database
is lost, recovery is to run the indexer Job again (about 34 s for the medium data set according to
the course reference table; the README gives the measured time for this setup). The documents
themselves are the source of truth and live outside the database. Because of that, no backup job is
configured. If the data ever stopped being derivable (for example user accounts or saved searches),
a scheduled `pg_dump` to a persistent volume or object storage would be needed first.

## Synchronous and asynchronous design (module 1)

**Chosen:** search is synchronous; indexing is asynchronous.

*Search* is a synchronous request: the browser calls the Blazor server, which calls the API, which answers
from Redis or PostgreSQL. A user is waiting for the answer, so there is nothing to hand off to a queue, and
the measured latency (p95 14 ms to 42 ms depending on load, 27 November run) is within the target.

*Indexing* is the opposite. Nobody waits for one document, the work is heavy, and its stages have different
costs, so it runs as a pipeline of three stages (crawler, tokenizer, writer) that talk through RabbitMQ
queues instead of calling each other. The queue decouples the stages: each is scaled on its own (the writers
turned out to be the slow stage), a crashed worker's message goes to another worker, and a bad document is
parked in a dead-letter queue instead of stopping the run. The cost is a broker to operate and the need to
make every step idempotent, because delivery is at-least-once. Design, measurements and failure tests are in
[INDEXING-PIPELINE.md](INDEXING-PIPELINE.md).

**Where more asynchronous design would fit:** search agents that must be notified when a newly indexed document
matches a stored query would be another consumer on the same bus. Not built.

## Plain manifests and OpenTelemetry instead of the guide's Helm charts (modules 8 and 9)

**Chosen:** the monitoring stack is plain Kubernetes manifests (Prometheus, Loki, Grafana and an
OpenTelemetry Collector), put together with Kustomize. The course guide installs `loki-stack` and
`kube-prometheus-stack` with Helm.

**Why:**
- The applications send metrics and logs with OpenTelemetry to one Collector, so there is a single
  place to change the backends and the code does not depend on Prometheus or Loki directly. The guide's
  charts expect Prometheus scraping and Promtail reading container logs instead.
- The two guide charts bring dozens of components (Alertmanager, node exporters, operators and
  custom resources). Four small manifests are easy to read, to explain object by object, and to start
  on a laptop within the 6 GiB given to Minikube.
- Kustomize's generated ConfigMaps change name when the configuration changes, so a configuration
  change rolls the pods.

**Cost:** more is written by hand (dashboards, alert rules, retention); there is no Alertmanager;
upgrades are manual. **In production:** the charts are a reasonable choice, together with
Alertmanager for notifications, longer retention (about two weeks, as the slide suggests; here it is
24 h) and storage that survives pod restarts.

## The document volume is a `hostPath` (module 11)

**Chosen:** `start.sh` copies the documents into the Minikube node at `/data/searchv2-docs`, and the
indexer and the API mount that folder read-only.

**Why:** with one node, the simplest volume that both pods can read is a folder on the node, and the
API needs the original files for case-sensitive search. **Limit:** the data is tied to one node, so
this breaks as soon as a second node exists (the pods may be scheduled on a node without the
folder); the README states this.

**In production:** object storage (such as S3 or Azure Blob) read through its API, or a shared
volume (NFS or a managed file service, `ReadWriteMany`). Better still, the indexer could store the
text it needs in the database, so the API would not need the files at all.

## Build versus buy (module 8)

Apply the four questions (is it core to what makes us different, do we have the skills, what does it
cost over time, what is the risk of owning it) to each part:

| Part | Decision | Reason |
| --- | --- | --- |
| Search engine, indexer, GUI | Build | This is the course case and the thing being examined; there is nothing to differentiate if it were bought. |
| PostgreSQL, Redis | Buy (use open source) | A database and a cache are commodities. Writing our own would take years to match; the interesting parts are how we use them. |
| Prometheus, Loki, Grafana | Buy (open source, self-run) | Standard tools with a ready ecosystem. Operating them is the cost (retention, storage, upgrades). |
| OpenTelemetry | Buy (standard) | A vendor-neutral standard, so the backends can be exchanged without touching the code. |
| Kubernetes | Buy (Minikube locally) | The course requires a container platform; in production a managed cluster takes over the control plane. |

## Redis is not scaled out (module 10)

**Chosen:** one Redis pod, limited to 64 MB with `allkeys-lru` eviction, no persistence
([CACHING.md](CACHING.md)).

**Why this is enough:** the cache only holds results that can be recalculated. If Redis restarts or is
lost, the API falls back to PostgreSQL (counted in `searchv2.cache_errors`) and searches are slower
for a short while, but nothing is lost. The measured hit ratio (80 %) shows that the cache already absorbs most queries without more nodes. Its
throughput gain is small (about 7 % once PostgreSQL is not CPU limited), so it is justified as protection for
the database, not as a speed-up.

**How it would scale:**
1. *Replicas with Sentinel (high availability):* a primary plus replicas and Sentinel promote a replica
   if the primary dies, so the cache survives a failure. This does not add capacity for writes.
2. *Redis Cluster (z-axis):* keys are spread over shards by hash slot, so memory and throughput grow
   with the number of shards. The cache keys are hashes of the request, so they spread evenly.
3. *Read replicas:* only useful if reads were the limit, which they are not here.

The cost of a cluster is the operating overhead and a client that knows the topology; it only pays
off when one node's memory or CPU becomes the limit, which a 64 MB cache on this data set is far from.
