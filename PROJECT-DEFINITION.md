# Project definition: SearchV2 operating environment (draft)

> **Status: unconfirmed draft.** The course required an approved one-page project definition by
> 2026-11-17. This text was reconstructed from what the repository actually implements, so it can be
> checked against the version you handed in. If an approved definition exists, replace this file with
> it, and note any differences from what was built.

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
| Design to be disabled | `SearchCache` feature flag, switched without a new image | `k8s/README.md` |

## Out of scope (decided)

Synonym search (termnet), snippets, an explicit relevance score, an asynchronous indexing pipeline or
service bus, and the console search program.

## How it affects the architecture

The search API is stateless so it can be cloned; shared state is in Redis (cache) and PostgreSQL
(index). Documents are indexed once by a batch Job. The database can be split on the z-axis by
document, with a router in the API; this is a documented design, not implemented code. Architecture
is shown with UML class, object and deployment diagrams (`uml/`) and C4 container diagrams
(`c4reference/`). Decisions and their reasons are in `k8s/DECISIONS.md`.
