# Project definition: SearchV2 operating environment (draft)

> **Status: draft.** This text was reconstructed from what the repository actually implements. The
> teachers have approved the project scope and allow changes until the exam, so it is a summary of what was
> built, not the approval document. If you keep an approved definition, compare the two and note any
> differences.

## System

The course's internal search engine (documents, an inverted index in PostgreSQL, a search API and a
web GUI), built in .NET with C#. The project is a walking skeleton: the focus is the architecture and
the operating environment, not how a document is ranked.

## Features that are implemented

| Area | What | Where |
| --- | --- | --- |
| Scaling on the x-axis | Two `search-api` replicas behind a Kubernetes Service | `k8s/apps.yaml` |
| Container platform | Kubernetes (Minikube) with one start command | `k8s/start.sh`, `k8s/README.md` |
| Monitoring | OpenTelemetry, Prometheus, Loki, Grafana dashboard and alert rules | `k8s/observability/` |
| Caching | Redis result cache with a memory limit, eviction, expiry and fallback | `k8s/CACHING.md` |
| Databases | PostgreSQL in the cluster; z-axis (sharding) design for the index | `k8s/DATABASE-SCALING.md` |
| Fault tolerance and performance | Rolling updates, rollback demo, load test with results | `k8s/rollback-demo.sh`, `k8s/PERFORMANCE-TEST.md` |
| Extension: indexing pipeline | Indexing as three stages (crawler, tokenizers, writers) over a RabbitMQ message bus, each stage scaled independently | `k8s/INDEXING-PIPELINE.md` |
| Design to be disabled | `SearchCache` feature flag, switched without a new image | `k8s/README.md` |

## Out of scope (decided)

Synonym search (termnet), snippets, an explicit relevance score, search agents, and the console search
program.

## How it affects the architecture

The search API is stateless so it can be cloned; shared state is in Redis (cache) and PostgreSQL
(index). Documents are indexed by a pipeline: a Job publishes one message per document to RabbitMQ,
tokenizer workers extract the words, and writer workers store them in PostgreSQL; both worker types scale
independently. The database can be split on the z-axis by
document, with a router in the API; this is a documented design, not implemented code. Architecture
is shown with UML class, object and deployment diagrams (`uml/`) and C4 container diagrams
(`c4reference/`). Decisions and their reasons are in `k8s/DECISIONS.md`.
