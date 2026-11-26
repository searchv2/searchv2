# Backlog: compliance with course requirements

Source material: `~/SchoolFiles/apip/CanvasFiles/`. Status legend: `[ ]` todo, `[~]` partial, `[x]` done, `[?]` to confirm or optional, `[-]` descoped (decided not relevant).
Work order was modules 7 → 12, then modules 1–6. The console search program is out of scope. See **Priorities** below for what to do first; the module sections are the detailed findings.

## Priorities

Decided scope: this is an exam about architecture and the big picture. The teachers will ask about caching strategy, scaling, the operating environment and similar choices, not about how a document is ranked. Termnet/synonyms, snippets and an explicit score are descoped; "design to be disabled" and the UML diagrams are required; asynchronous design is optional. Everything that exists must still work. Item names below refer to the module sections.

### Tier 1: must do (the exam asks for these)
1. **Design to be disabled** (module 8). **DONE** (code, tests and docs written; the live-cluster demo is part of item 8). Add a feature flag that can be switched off without a rollback or a new image: a ConfigMap read by the app, via .NET Feature Management or a plain config value. Good candidate flag: turn the Redis cache on/off. It ties into the caching story and also covers the "Redis is down" fallback. Document how the flag reaches the app (env var vs. mounted file) and demo it.
2. **UML diagrams** (modules 2 and 7): class diagram, object diagram and deployment diagram of the Kubernetes setup. Required explicitly in the exam description. **DONE:** four PlantUML diagrams in `uml/` (`class-diagram`, `class-diagram-indexer`, `object-diagram`, `deployment-diagram`), rendered to PNG and SVG. Layout can be tweaked if you want it neater for the exam.
3. **Z-axis database design** (module 12): write how the index could be sharded (by document hash vs. by word hash), how requests are routed, the cross-shard downsides. Required explicitly in the exam description. Also decide on x-axis read replicas (module 12); a documented design is the minimum, an implementation is a bonus. **DONE (design):** `k8s/DATABASE-SCALING.md` covers z-axis (shard by document via logical buckets, scatter/gather router in the API, replicated `word` table, downsides) and x-axis (read replicas, documented as a decision, not deployed).
4. **Caching position and hardening** (module 10): the short write-up (what is cached, what is not, cache-aside, eviction, TTL and invalidation, expected hit ratio), plus the small fixes behind it: set `maxmemory` and an eviction policy, add an absolute expiry, make a Redis outage fall back to the database, show the hit ratio on the dashboard. **DONE (code and docs; not yet run on the live cluster):** write-up in `k8s/CACHING.md`; `maxmemory 64mb` + `allkeys-lru` + resource limits in `k8s/redis.yaml`; 5-minute absolute expiry and Redis-error fallback in `SearchController` (tested); hit-ratio and hits/misses/errors panels in `searchv2.json`.
5. **Performance test** (module 9): a load script, a short written test design (success criteria, environment, metrics, load, evaluation), a run with the Grafana results, and a CPU metric. The exam description asks for tests that quantify the environment. **DONE:** `k8s/load-test.py`, design and results in `k8s/PERFORMANCE-TEST.md`, a CPU panel on the dashboard, a cache on/off comparison with Grafana screenshots in `k8s/perf-results/`. Finding: the bottleneck is the database path, not the API.
6. **C4 diagram completion and decision log** (module 7): add env vars, volumes and namespaces, and the 3–5 point decision log. **DONE:** tables and a five-point decision log beside the diagram in `c4reference/kubernetes-startup-c4.md`. You still have to complete the "use of AI" sentence (what you accepted or rejected) and be able to explain each element.
7. **Rollback demo** (module 8): `change-cause` annotations, a raised `revisionHistoryLimit`, and a short scripted or written failed-release-then-rollback demonstration.
8. **Verify that everything works** (module 11 doc hygiene): re-run `./k8s/start.sh` and `k8s/smoke-test.py`, then update the stale "Validation performed" section. Prepare a short demo script.

### Tier 2: should do (cheap and strengthens the story)
- **Decision notes** (a paragraph each): database in Kubernetes or not (module 11), synchronous vs. asynchronous design (module 1), why plain manifests plus OpenTelemetry instead of the guide's loki-stack/kube-prometheus-stack (modules 8–9), the `hostPath` document volume and what you would use in production (module 11), one build-vs-buy paragraph (module 8).
- **Principles checklist** (module 1): which architecture principles you follow, with evidence.
- **Alerting** (module 8): a handful of alert rules (5xx rate, p95 latency, API down) or an explicit statement that dashboards are the mechanism.
- **Database hardening** (module 11): pin the PostgreSQL image tag, add resource limits, optionally enable the metrics exporter, one sentence on backup ("the index is derived data; recovery is re-indexing").
- **Confirm the project definition** (section 0): the 2026-11-17 approval deadline has passed.
- **Redis not scaled out** (module 10): a note on how it would scale (replicas, Cluster).

### Tier 3: nice to have (drop first if time is short)
- Oral-exam preparation items marked "Be able to explain" in every module (pods/services, Secrets vs. ConfigMaps, Helm, volumes, cache types, the AKF axes). These are worth an hour of reading, not code.
- Ownership comments in YAML/code (`# egen`, `# AI`, `# docs`) and the exercise-only reflections from M8.02, M9.03, M11.01.
- The NordicSneak hit-ratio worksheet (M10.01), Network Policies for Redis, a Redis Helm chart/StatefulSet, HPA autoscaling.
- Versioned immutable ConfigMaps and the own-service Helm chart (module 8 extras), Helm demo commands.
- Data retention beyond 24 h, extra business metrics, version in the `X-Served-By` header, environment separation write-up, Docker image best-practice review, quality-gate/CI documentation.
- Spec-of-functions exercises (module 4), the y-axis split note, and a run on the `seData/large` data set.
- Implementing an asynchronous indexing pipeline or a RabbitMQ service bus (only if the project definition commits to it).

### Descoped (decided)
- Explicit 0–1 score, snippets and richer result items, synonym search/termnet.
- The console search program (already out of scope).

## 0. General requirements (exam project v1.0)

Source: `eksamensprojektet_v1_0.pdf` (module 5 folder). The project itself is not graded; it is the basis for the oral exam (week 51).

- [x] **Language:** developed in .NET with C# (all projects are .NET).
- [x] **Operating environment:** container-based on Kubernetes (Minikube) with the API scaled to 2 replicas (x-axis).
- [x] **Monitoring:** OpenTelemetry, Prometheus, Loki and Grafana (see module 8–9 findings for remaining gaps such as alerting and CPU).
- [x] **Fault tolerance / performance:** load test, design and results in `k8s/PERFORMANCE-TEST.md` (module 9).
- [x] **Databases:** z-axis design written in `k8s/DATABASE-SCALING.md` (module 12).
- [x] **Caching:** cache-aside with write-up and hardening done (`k8s/CACHING.md`); live-cluster check and measured hit ratio pending.
- [~] **Exam demo:** the system runs from one command (`k8s/start.sh`); needs a re-verification run and a short demo script (see Priorities).
- [x] **UML diagrams for the exam:** class, object and deployment diagrams exist in `uml/` (PlantUML sources plus PNG/SVG). The C4 diagram is separate.
- [ ] **Project definition:** max one page, approved by the teachers. The deadline for approval was 2026-11-17 (draft recommended 2026-11-03). Confirm whether this was done.
- [~] **Extension feature:** decided so far: termnet/synonyms and snippets are not relevant, and scoring is not needed. Asynchronous design (e.g. a service bus for indexing) is something to consider, but it is not decided. Confirm what the approved project definition says.

Examples of extensions named in the project description (choose what fits the project definition):
Termnet (synonym search, descoped), Indexing (pipeline / multiple databases / more document types), Snippets in results (descoped), Service bus (e.g. RabbitMQ, to consider), Search agents with notifications.

### Notes
- `spec of functions - jan 26.pdf` (module 4 folder) is a general note on pre/post-condition specifications and has 5 exercises (is-increasing, is-cube, minimum, date validation, array reverse). It is not specific to the search engine; assess it in the module 1–6 pass.

## Module 7: Intro to operations

Sources: `Opgavesæt M7.02 - C4 Container diagram`, `Læringsguide M7.03 - Intro til Minikube`, slides `Emne - Miljøbeskrivelser`, `Emne - Intro til operations`, `Emne - Intro til Kubernetes`, and the `Modul 7` overview. M7.01 (incident vs. problem management) is a group discussion task with no code deliverable; a personal note exists at `../problem-management.md`.

### M7.02: C4 container diagram (the only graded-style deliverable in this module)
The task asks for a C4 container diagram of the search engine as it is run in a Docker environment, built from `docker-compose.yaml`, plus a short decision log.

- [~] **Container diagram exists.** `c4reference/kubernetes-startup-c4.md` is the Mermaid C4 container diagram of the Kubernetes setup, which is the only target for now (decided: Kubernetes only, so `docker-compose.yml` is not documented and `search-system-c4.md` may be redundant or outdated; decide whether to keep it). Checked: it shows all nine deployed containers (Blazor, SearchAPI, indexer, Redis, PostgreSQL, collector, Prometheus, Loki, Grafana); `search-system-c4.md` is kept as the logical view and is linked from it.
- [x] **Environment variables, volumes and networks:** added as tables beside the diagram in `c4reference/kubernetes-startup-c4.md`. Original finding: **Diagram must describe containers, environment variables, volumes and networks** (task section 2). The current diagram shows containers and protocols but not env vars (e.g. `SEARCH_DB_CONNECTION`, `RedisConnectionString`, `OTEL_EXPORTER_OTLP_ENDPOINT`), volumes (the 2 GiB PostgreSQL PVC, the read-only `/data/docs` hostPath mount, Redis having none) or the network/namespace boundaries (partly shown as namespace boxes). Add these to the diagram or to a table beside it.
- [~] **Decision log (beslutningslog) of 3–5 points next to the diagram:** five points written; the AI-use note needs your own accepted/rejected remarks. Original finding: Not found in the repo. It should cover why the containers are split as they are, what lives in volumes and what may disappear on restart, and how networking is set up. Include a short note on what AI was used for and which suggestions were accepted or rejected.
- [x] **Tool:** Mermaid is accepted (confirmed by you). `c4reference/` has six PNGs, and three of them (`image.png`, `image-1.png`, `image-2.png`) are byte-for-byte the same size, so they are probably duplicates to clean up. I haven't opened them yet.
- [ ] **You must be able to explain every element in the diagram** (not a file; prepare for the oral exam).

### M7.03: Minikube / Kubernetes basics
The guide is a pair exercise on a throwaway hello-world app. The project-relevant parts are:

- [x] **Cluster runs on Minikube** (`k8s/start.sh`, profile `searchv2`; documented in `k8s/README.md`).
- [x] **Deployment from YAML with replicas.** `k8s/apps.yaml` has `search-api` with `replicas: 2`, and a Service for it.
- [x] **Namespaces per system.** `k8s/namespaces.yaml` defines `searchv2`, `devops`, `caching` and `database`.
- [~] **"Extra: your own service" with an API endpoint that shows version and IP to check load balancing.** `SearchAPI/Program.cs` sets an `X-Served-By` response header (pod hostname). There is no endpoint or header that exposes the version. Optional: add the version (it is already built as an image tag, 1.0.1).
- [ ] **Ownership marks in the YAML** (`# egen`, `# AI`, `# docs` comments on each line, from the "Ejerskab" box). Not present in `k8s/*.yaml`. Only needed if the teacher checks this; low priority.
- [ ] **Be able to explain** pod vs. deployment vs. service, NodePort vs. `minikube service`, and what happens when a pod dies (oral exam prep, no code change).

### Operating-environment slides (Emne - Miljøbeskrivelser / Intro til operations)
- [x] **UML deployment diagram.** `uml/deployment-diagram.puml` (Kubernetes, Modul 7 notation) with PNG/SVG.
- [~] **Environment separation (build/test/staging/production).** Slides describe it conceptually. The repo has a local Minikube setup only. Decide whether to document how the environments would map (even briefly) in the architecture notes, since this is an exam talking point rather than a code requirement.
- [~] **Docker image best practices** (refresher in the reading list). Each project has a Dockerfile and `k8s/Dockerfile` has multi-target builds. Not yet reviewed in detail (image size, non-root user, layer caching). Re-check when the other modules are done.

## Module 8: Deployment principles

Sources: `Opgave M8.01 - Build vs. buy`, `Opgave M8.02 - Rollback og Markdown i Kubernetes`, `Opgave M8.03 - Monitoring`, slides `Emne - Build vs Buy`, `Barrier Conditions & Rollback`, `Helm pakkestyring`, `Monitoring af applikationer`, and the `Modul 8` overview.
All three tasks are group/pair exercises on throwaway demo apps (Cloudify case, `hello-world`, `catalog-service`), not on the search engine. The backlog items below are therefore about applying the same principles to `searchv2`, which is what the exam asks you to be able to discuss and demo. Items copied straight from the exercises are marked "exercise-only".

### Rollback (M8.02, steps A–C; slides "Barrier Conditions & Rollback")
- [x] **Safe rolling updates.** `k8s/apps.yaml` uses `RollingUpdate` with `maxSurge: 1`, `maxUnavailable: 0` and readiness/liveness/startup probes on `/healthz` for both `search-api` and `blazor`.
- [x] **Rollback is documented.** `k8s/README.md` ("Updates and rollback") covers `set image`, `rollout status`, `rollout history` and `rollout undo`.
- [~] **Rollback history is retained but shallow.** `revisionHistoryLimit: 2` (the exercise uses 5). Consider raising it so more than one previous revision can be restored.
- [ ] **Record why each change was made.** The exercise annotates each release with `kubernetes.io/change-cause`, so `rollout history` is readable. Nothing in `k8s/` or the docs does this. Add it to the update procedure in `k8s/README.md`.
- [ ] **Demonstrate a failed release plus rollback on searchv2.** Not documented or tested: only the commands are listed. A short scripted or written demo (deploy a non-existent tag, show old pods keep serving, `rollout undo`) would back the exam demo. `k8s/REPORT.md` itself says rollback during active user traffic is untested.
- [ ] **Rollback window and database compatibility** (slide + exercise question). Rollbacks of the API are fine, but the indexer drops and recreates the index tables, so an old API version might meet a changed schema. Decide and write down how a rollback behaves if the index schema changed (the README already notes the API is scaled to zero during reindexing).

### Markdown / "design to be disabled" (M8.02, steps D–F)
- [x] **A way to disable a feature without a rollback or a new image.** Done: `SearchCache` flag in the `feature-flags` ConfigMap (`k8s/feature-flags.yaml`), read by SearchAPI through `Microsoft.FeatureManagement`; with the flag off `SearchController` skips Redis. Covered by `SearchCacheTests`. Not yet exercised in the live cluster (see Tier 1 item 8).
- [x] **Decide how the flag reaches the app.** Decided: mounted file (directory mount at `/config`) with `DOTNET_USE_POLLING_FILE_WATCHER=true`, because a ConfigMap update swaps a symlink that .NET does not otherwise notice (verified with a simulated swap). Env var vs. file and markdown vs. rollback are written up in `k8s/README.md` ("Disabling a feature").
- [ ] **Config rollback with the release** (exercise "Ekstra"): versioned, immutable ConfigMaps (e.g. `feature-flags-v1`) so `rollout undo` also rolls config back. Kustomize already generates hash-suffixed ConfigMaps for monitoring (see `k8s/README.md`), so this fits the existing approach. Optional.

### Secrets (M8.02 step E)
- [x] **Sensitive values in Secrets, not ConfigMaps.** `postgresql-credentials`, `redis-credentials` and `grafana-admin` are Kubernetes Secrets, used via `secretKeyRef` in `k8s/apps.yaml`, `k8s/indexer.yaml` and `k8s/observability.yaml`.
- [ ] **Be able to explain** that a Secret is base64-encoded, not encrypted, and the difference between ConfigMap and Secret. Optional hardening note for the architecture notes: secrets are created by `start.sh`/commands rather than stored in git (good), but encryption at rest is not enabled.

### Helm (M8.03; slide "Helm pakkestyring")
- [x] **Helm is used.** PostgreSQL is installed with `helm upgrade --install postgresql-db bitnami/postgresql --version 18.12.17` with values in `k8s/postgresql/custom-values.yaml`.
- [~] **The task deploys Loki+Grafana+Promtail with the `grafana/loki-stack` chart.** Your monitoring uses plain manifests plus Kustomize and an OpenTelemetry Collector instead, which is a valid choice (the `k8s/README.md` already notes it). Decide whether that needs justification in the decision notes.
- [ ] **Be able to explain** `helm upgrade --install`, `-n ... --create-namespace`, `helm history`/rollback, and how `values.yaml` makes config part of an upgradable release. Optional: show `helm list -n database` and a `helm rollback` in the demo.
- [ ] **Your own service as a Helm chart (optional).** `search-api` and `blazor` are plain manifests, not charts. Only needed if you want the "whole release rolls back as one" story.

### Monitoring (M8.03; slide "Monitoring af applikationer")
- [x] **Logs and metrics are collected and visualised.** `k8s/observability/` runs OpenTelemetry Collector, Prometheus, Loki and Grafana, and `searchv2.json` is a provisioned dashboard (requests/s, p95 latency, 5xx rate, memory per pod, DB operation duration, active searches, browser search duration, application logs).
- [x] **Apps are instrumented.** `SearchAPI` and `blazor-client-gui` use OpenTelemetry for metrics and logs (`Program.cs`).
- [ ] **Alerting / incident detection.** The slide's framework is "is there an incident → where → what" with 3–10 critical monitors. The dashboard shows data, but I found no alert rules (Prometheus alerting rules or Grafana alerts). Pick a handful of critical monitors (e.g. 5xx rate, p95 latency, API down) and add alert rules, or state in the notes that dashboards are the intended mechanism.
- [~] **Data retention strategy** (slide: keep raw data about two weeks). Retention is set explicitly but short: Loki `retention_period: 24h` (`k8s/observability/loki.yaml`) and Prometheus `--storage.tsdb.retention.time=24h` (`k8s/observability.yaml`). That is deliberate for a local Minikube setup; document the reasoning and what you would set in production (the slide suggests about two weeks).
- [?] **Business/user-experience metrics.** The dashboard has search duration and active searches, which is a good start. Consider one metric tied to the product (e.g. searches with zero results, cache hit rate). Optional.
- [ ] **Design a test for the demo service's error paths** (exercise-only, `ImageController` in CatalogService). Not applicable to searchv2 directly; the searchv2 equivalent is the performance test in module 9.

### Build vs. buy (M8.01)
- [ ] **M8.01 is a written case study** (Cloudify, Abbott & Fisher's four questions) with no code deliverable, and nothing in the repo is expected to change. Optional exam material: apply the four questions to your own choices (e.g. why PostgreSQL, Redis, Loki/Grafana and OpenTelemetry are bought/used while the search engine and indexer are built) in a short architecture-notes paragraph.

### Barrier conditions (slide)
- [~] **Quality gates before release.** The slide lists code review, unit tests and performance tests as barrier conditions. Unit-test projects exist (`SearchAPI.Tests`, `LoadBalancer.Tests`, `blazor-client-gui.Tests`) and `k8s/test-start.py`/`smoke-test.py` exist. No CI pipeline runs them (the only workflow in the repos is `claude.yml`, which does not run tests). Decide whether to document which gates you use and where.

## Module 9: Performance and metrics

Sources: `Opgavesæt M9.01 - Performance Test`, `Læringsguide M9.02 - Monitorering med Prometheus`, `Læringsguide M9.03 - Instrumentering af search engine`, slides `Emne - Performance`, `Emne - OpenTelemetry & Prometheus`, and the `Modul 9` overview.
M9.02 is an exercise on the teacher's demo project (`HNRK-JNSN/k8s-performance`), so the real project deliverables come from M9.01 (design the performance test) and M9.03 (instrument the search engine and stress-test it).

### M9.01: performance test design (Opgave A–C)
Task: pick at least one metric from each of five categories with a justification, then design the test(s).

- [~] **Metrics chosen and instrumented, one per category (A).** What exists today:
  - API requests: requests/s, p95 request duration and 5xx rate (ASP.NET Core metrics, dashboard panels).
  - Database: `searchv2_database_operation_duration` (`PostgresDocumentIndex.cs`), shown as average duration per operation.
  - System resources: process memory per pod (`dotnet_process_memory_working_set_bytes`). **No CPU metric on the dashboard.**
  - Application level: `searchv2.search.active` (concurrent searches) and the Redis cache counters `searchv2.cache_hits` / `searchv2.cache_misses` (`SearchController.cs`). The cache counters are **not on the dashboard**, so there is no hit-ratio panel.
  - User experience: `searchv2_search_interaction_duration` from the Blazor client (p50/p95).
- [x] **Written justification for each chosen metric (A):** table in `k8s/PERFORMANCE-TEST.md`. Original finding: The repo documents what each metric is (`k8s/REPORT.md`, `k8s/README.md`) but I found no short "why this metric" justification per category. Add it, ideally as a table.
- [~] **Add the missing metrics:** CPU panel and cache hit ratio panel added; database/Redis exporters still missing. Original finding: CPU usage (system resources) is the clearest gap, and a cache hit ratio panel would round out the application category. Optional: database connection/lock wait metrics, and Redis metrics.
- [x] **Written performance-test design (B):** `k8s/PERFORMANCE-TEST.md`. Original finding: Not found. It should state: success criteria (e.g. p95 under X ms at Y requests/s, error rate under Z%), the test environment (note: single-node Minikube with 4 CPUs and 6 GB, so say how it differs from production), how each metric is measured, how load is generated, and how results are evaluated. The slides add the A&F seven steps (success criteria, environment, define tests, execute, analyse, report, repeat) and mention endurance, load, most-used and component test types.
- [ ] **Be able to explain without notes (C):** two metrics and the bottleneck each can reveal, how the load test distinguishes a database bottleneck from an API one (the dashboard already separates DB operation duration from request duration, which is the right basis), and one design change you would make if CPU was high. Oral exam prep, no code.

### M9.02: Prometheus monitoring (teacher demo project)
- [x] **Observability stack running in the cluster.** Prometheus, Grafana, Loki and an OpenTelemetry Collector are deployed in the `devops` namespace.
- [~] **How it differs from the guide.** The guide uses Helm `kube-prometheus-stack` with a `ServiceMonitor`, `prometheus-community` charts and NLog→Loki. Your setup uses plain Prometheus scraping the collector's `:8889/metrics` endpoint, and OpenTelemetry for logs too. This is a valid design, but you should be able to explain "how does Prometheus find the service" for your own setup (static scrape of the collector, not a ServiceMonitor), and the guide's final question about where `/metrics` comes from. Add this to the decision notes.
- [x] **Prometheus data source in Grafana and a dashboard** are provisioned (`datasources.yaml`, `searchv2.json`), so those guide steps are covered. Nothing to do beyond being able to explain it.

### M9.03: instrumenting the search engine
- [x] **Containerised, deployed to Kubernetes, observability in place.** Covered in modules 7–8.
- [~] **OpenTelemetry instrumentation of the metrics from M9.01.** Done for the metrics listed above (custom meters in `SearchService.cs`, `PostgresDocumentIndex.cs`, `SearchController.cs`, `SearchInteractionMetrics.cs`; tests exist: `ActiveSearchMetricsTests`, `DatabaseMetricsTests`, `SearchInteractionMetricsTests`). Gap: the guide also asks for **NLog**; the project logs through OpenTelemetry/`ILogger` instead. Decide whether to keep that (and note why) or add NLog.
- [x] **Stress-test scripts:** `k8s/load-test.py`. Original finding: I found none (no k6/curl/bash load script or load-test doc). `k8s/smoke-test.py` only checks that metrics and logs appear after one search. Create a script (curl loop, or k6/hey/wrk) that sends a known number of search requests to the API.
- [x] **Verify that metric values are correct:** sent and counted requests matched exactly in both runs. Original finding: (the guide's "Verifikation"): run a load script with a known number of requests and compare it with the request counter in Prometheus; write down any difference and why. Needs the load script above.
- [x] **Run the stress tests and analyse in Grafana:** done, analysis in `k8s/PERFORMANCE-TEST.md`. Original finding: record what the graphs show and which bottleneck the data points to (or why none appears). This should result in a short written analysis document, and it feeds the exam demo.
- [ ] **Ownership marks in the code** (guide asks for a short comment on which instrumentation parts you wrote vs. AI/other sources). Not present; low priority unless the teacher checks.
- [ ] **Be able to add one extra metric without AI and find it in Grafana** (oral exam prep).

### Related
- [?] **Autoscaling.** The slides mention using Prometheus metrics for Kubernetes HPA. No HPA exists in `k8s/`. The exam project mentions scaling on the x-axis, which is already covered by 2 replicas. HPA is an optional extra.

## Module 10: Caching

Sources: `M10.01 - Caching` (NordicSneak Black Friday case), slides `Emne - Cache`, `Emne - Caching med Redis` (includes the M10.02 task: add a Redis server and an instrumentation class to your search engine), and the `Modul 10` overview.
M10.01 is a written group case with no code. M10.02 is the part that applies to `searchv2`, and the exam project also requires you to state your position on caching.

### M10.02: Redis cache and instrumentation in the search engine
- [x] **Redis server in the cluster.** `k8s/redis.yaml` runs Redis 7 in its own `caching` namespace with a Service, a readiness probe and a password from the `redis-credentials` Secret (no persistence on purpose: it only holds cached results).
- [x] **Cache used from C#.** `SearchAPI/Program.cs` registers `AddStackExchangeRedisCache` (endpoint, user and password from config/Secret). `SearchController.cs` implements cache-aside: look up a SHA-256 key of the request, return on hit, otherwise search, store with a 1-minute sliding expiration. Both API replicas share it. A test exists (`SearchAPI.Tests/SearchCacheTests.cs`).
- [x] **Instrumentation.** `searchv2.cache_hits` and `searchv2.cache_misses` counters exist (the slide's `Instrumentation` class is replaced by static counters in the controller, which is fine).
- [x] **Cache metrics:** hit ratio and hits/misses/errors panels added to the dashboard (Redis itself still has no exporter). Original finding: **Cache metrics are not visible anywhere.** The counters are not on the Grafana dashboard and I found no hit-ratio panel. Redis itself is not monitored (no memory, evictions or hit-rate from Redis, no exporter). This overlaps with the module 9 backlog item and is also what the M10.01 hit-ratio analysis needs.
- [x] **Eviction policy and memory limit:** `maxmemory 64mb`, `allkeys-lru`, pod limits (see `k8s/CACHING.md`). Original finding: **No eviction policy or memory limit set.** `redis.yaml` starts Redis with `--save "" --appendonly no` and nothing else: no `maxmemory`, no `maxmemory-policy`, and no resource requests/limits on the pod. The case asks you to choose an eviction policy (LRU/MRU/FIFO); for a result cache `allkeys-lru` with a `maxmemory` is the usual answer. Set it and document it.
- [x] **Staleness / invalidation:** absolute 5-minute expiry added, reindex-then-flush documented in `k8s/CACHING.md`. Original finding: The TTL is a *sliding* 1-minute expiration with no absolute expiry, so a query that is repeated at least once a minute never expires. After reindexing, stale results are only dropped because `k8s/start.sh` restarts Redis. Decide whether to add an absolute expiration (e.g. 5–10 minutes) so stale results can't live forever, and document the reindex-then-flush step (it is only in `start.sh` comments and the README). This is exactly the "last year's emergency cache" problem in the case.
- [x] **Behaviour when Redis is down:** falls back to the database, with tests. Original finding: **Behaviour when Redis is down.** `SearchController` has no try/catch around the cache calls, and `k8s/README.md` troubleshooting confirms it: "Search requests fail while Redis is unavailable". A cache should degrade gracefully (fall back to the database on a cache error); add a fallback and a test, or document it as an accepted trade-off.
- [~] **Redis is a single plain Deployment, not a Helm chart/StatefulSet.** The slides suggest the Bitnami Helm chart or a StatefulSet, plus Redis Cluster for horizontal scaling. One replica without persistence is fine for a cache, but a note on how it would scale (replicas for reads, Cluster for sharding keys) would support the exam's "caching" and scaling discussion.
- [ ] **Network Policies for Redis** are listed as a best practice on the slides; none exist in `k8s/`. Optional hardening: only the `searchv2` namespace may reach Redis.
- [x] **Secrets, not config, for the Redis password.** Done (see module 8).

### M10.01: caching analysis (written case, apply to the search engine)
- [x] **Short caching write-up (done: `k8s/CACHING.md`; the hit-ratio figure still needs the module 9 load test)** for the exam (required by the exam project: "forholder jer til brug af caching").** Not found as a document. Use the case's delivery list, but for searchv2:
  1. the caching architecture (shared Redis between API replicas, application-level cache-aside),
  2. three things that should be cached (search results for repeated queries, probably popular documents, the word-to-document lookups),
  3. two things that should not be cached (e.g. the live index state while reindexing, anything that must be current),
  4. the write/read strategy (cache-aside; there are no writes to the cache from the app besides the lazy fill, and the indexer is a batch job),
  5. the eviction policy and TTL (see above),
  6. a justification with numbers. The case's calculation (database load without cache, and the hit ratio needed to stay under capacity) should be redone with your own load-test figures from module 9, so the load script there is a prerequisite.
- [ ] **Be able to explain** cache vs. buffer, hit ratio, the four write strategies, cache-aside vs. read-through, LRU/MRU/FIFO, and why object, application and CDN caches differ (oral exam prep).
- [?] **Case calculation** (database lookups per second with and without cache, minimum hit ratio): this is a worksheet on NordicSneak's numbers (1,000 lookups/s vs. 400/s capacity, i.e. at least a 60% hit ratio), not on searchv2. Do it only if you want the exercise on record.

## Module 11: Databases 1 (volumes and databases in Kubernetes)

Sources: `Læringsguide M11.01 - K8s volumes`, `Guide M11.02 - Postgres med Helm`, slides `Emne - Volumes`, `Emne - Databaser i Kubernetes`, and the `Modul 11` overview.
M11.01 is a pair exercise on busybox pods (emptyDir vs. PersistentVolumeClaim). M11.02 is the step-by-step Helm install of PostgreSQL with `searcher`/`searchengine`, which is what your cluster already uses. The project-relevant requirement is the exam rule: if the system has a database server, show how it can scale on the z-axis (module 12 builds on this).

### M11.02: PostgreSQL with Helm
- [x] **PostgreSQL installed with the Bitnami Helm chart** as release `postgresql-db` in the `database` namespace (`k8s/start.sh`), with `k8s/postgresql/custom-values.yaml` (user `searcher`, database `searchengine`, 2 GiB persistence), exactly as the guide describes. It runs as StatefulSet pod `postgresql-db-0`.
- [x] **Passwords not in values files.** An existing Secret (`postgresql-credentials`, generated by `start.sh`) is used instead of the guide's plain-text passwords, and a copy of the `searcher` password is placed in the `searchv2` namespace for the apps.
- [x] **Apps reach the database through the internal Service** (`postgresql-db.database.svc.cluster.local`, see `k8s/apps.yaml`).
- [~] **Chart version is pinned, image is not.** The chart is pinned to `18.12.17`, but `custom-values.yaml` says the image is loaded from the host as `docker.io/bitnami/postgresql:latest`. A floating `latest` tag makes the database version unreproducible. Pin a specific PostgreSQL image tag.
- [ ] **No resource requests/limits and no readiness customisation for PostgreSQL** in `custom-values.yaml` (the apps have them, the database does not). Add at least memory limits, in line with the performance work in module 9.
- [ ] **No database monitoring.** The Bitnami chart can enable a Postgres metrics exporter (`metrics.enabled`) that Prometheus could scrape; it isn't enabled and nothing on the dashboard shows database-side health (connections, locks, cache hit ratio). The module 9 slides list these as database metrics.
- [ ] **No backup/restore procedure.** The guide's closing notes mention backup strategies, and the databases-in-K8s slide lists backups and upgrades as operational overhead you take on yourself. The index can be rebuilt from the documents with the indexer, so a documented statement like "the index is derived data; recovery is re-indexing" may be enough, but write it down (and optionally add a `pg_dump` step).
- [~] **Known gotcha already handled in the README:** the guide warns that `helm uninstall` leaves the old PVC, so changed auth values are ignored on reinstall. `k8s/README.md` mentions that changing the password later does not change it while the PVC exists, and its cleanup section deletes the namespaces. No action unless you want an explicit "reset database" command documented.

### M11.01: Kubernetes volumes
- [x] **Persistent storage for the database.** PostgreSQL uses a 2 GiB PersistentVolumeClaim that survives pod replacement and `minikube stop` (`k8s/README.md`, "Data lifecycle").
- [x] **Deliberate use of ephemeral volumes.** Prometheus, Loki and Grafana use `emptyDir` (acknowledged in `k8s/observability.yaml` and `k8s/README.md`), and Redis has no volume because it only holds cache data. This matches the case for ephemeral vs. persistent volumes.
- [~] **Document corpus uses a `hostPath` volume** (`/data/searchv2-docs`, mounted read-only in `search-api` and the indexer; the documents are tarred into the Minikube node by `start.sh`). The slides cover local persistent volumes and their limits (data bound to one node, hard to scale across nodes), and `k8s/README.md` already states multi-node needs a different storage design. Fine for a single-node cluster; say in the decision notes what you would use in production (e.g. object storage or a shared PersistentVolume/NFS, or baking documents into the indexing pipeline).
- [ ] **Be able to explain** emptyDir vs. PersistentVolumeClaim, what `ReadWriteOnce` means when several pods use the same volume (and why the guide's two pods can share it on one node), and the PV/PVC/StorageClass abstraction (oral exam prep).
- [ ] **Exercise-only items:** the guide's reflection (3–4 sentences on what happened to the data in step A vs. B, and what AI was used for) is meant to be saved alongside its YAML files. Not part of searchv2; do it only if the teacher wants it.

### Databases in Kubernetes (slides)
- [ ] **Decision note: run the database inside Kubernetes or not.** The slides list the downsides (complexity, performance, persistence, security, networking, scaling, operational overhead) and the Google reading ("to run or not to run a database on Kubernetes"). Add a short paragraph to the architecture notes saying why you run PostgreSQL in the cluster for this project, and when you would use a managed service instead. This is the likely exam question and ties into module 12 (replicas).

### Doc hygiene noticed while reading
- [ ] **Stale validation section.** `k8s/README.md` ("Validation performed") says the setup was validated on 19 October 2026 and explicitly "not a validation of the current Redis deployment". Re-run `./k8s/start.sh` plus `k8s/smoke-test.py` and update that section when the module work is done.

## Module 12: Databases 2 (splitting databases, read replicas)

Sources: `Læringsguide M12.01 - Postgres replicas i K8s`, slides `Emne - Splitting Databases` (AKF database scale cube: x, y and z splits), and the `Modul 12` overview (reading: A&F ch. 24 and "To run or not to run a database on Kubernetes").
This module is the direct basis for the exam rule: *if the system has a database server, show how it can be scaled along the z-axis*. The guide itself (M12.01) covers x-axis scaling with read replicas.

### M12.01: PostgreSQL with read replicas (x-axis)
The guide deploys the Bitnami chart with `architecture: replication` (one primary for reads/writes, two read-only replicas, synchronous commit with one synchronous replica) in a separate namespace, then verifies that writes to the primary propagate to the replicas.

- [x] **Decision: not adopted, design documented** in `k8s/DATABASE-SCALING.md`. (Original finding:) **Database runs as a single instance today.** `k8s/postgresql/custom-values.yaml` has no `architecture`, `readReplicas` or `replication` settings, so the chart default (standalone, one pod) applies. There is no x-axis scaling of the database.
- [x] **Decide whether to adopt replication for `searchv2`.** Decided: documented design only (`k8s/DATABASE-SCALING.md`). It fits the workload well: the API only reads the index and the indexer is the only writer (`k8s/README.md`: "Only the indexer changes the index tables"). To do it: set `architecture: replication` with `readReplicas.replicaCount` and the replication settings in the values file, give the indexer the primary Service and the API the read Service (they currently share one connection string, `SEARCH_DB_CONNECTION` in `k8s/apps.yaml`/`k8s/indexer.yaml`, pointing at `postgresql-db`), and add the replica credentials to the Secret handling in `start.sh`.
- [ ] **Do not copy the guide's storage setup.** The guide points the primary and the read replicas at the *same* existing PVC (`postgresql-local-pvc`, `ReadWriteOnce`). That is a shortcut for the exercise; with the real chart each pod normally gets its own volume from the StatefulSet. Keep your dynamic PVCs.
- [ ] **Check the indexer against replication.** The indexer drops and recreates the index tables (`PostgresIndexStore.cs`). That is replicated like any other write, but readers see a brief window with missing tables/lag, which the README handles by scaling the API to zero during reindexing. Decide if that still holds with replicas and whether replication lag matters for the cache (stale results for up to a minute plus lag).
- [ ] **Demonstrate it.** Show that writing through the read Service fails, that data written to the primary appears on replicas, and what happens when you scale the read StatefulSet from 2 to 4 (the guide's step B/C questions). Only needed if you adopt replication.
- [ ] **Be able to explain (the guide's three questions, no notes):**
  1. why you cannot write to a read replica,
  2. what `synchronousCommit: "on"` and `numSynchronousReplicas: 1` control and what they mean for a write to the primary (durability vs. write latency),
  3. what happens when the read StatefulSet is scaled from 2 to 4 and which AKF axis that is (x-axis).

### Z-axis database scaling (exam requirement)
- [x] **Write the z-axis design for `searchv2`.** Done in `k8s/DATABASE-SCALING.md`: document sharding chosen over word sharding. Nothing in the repo describes it. Per the slides, z-axis means splitting data by a lookup value or hash (unbiased by theme), with a routing mechanism to the right shard. For this index the natural options are:
  - partition by document (hash of document id), each shard holds a slice of `document` and the `occ` rows for those documents; a query is sent to every shard and the results are merged (scatter/gather), or
  - partition by word (hash of the word), so each term lives on one shard and a multi-word query hits only the shards for its terms, but results must be joined across shards.
  State which you would choose and why, how requests are routed (the API or a routing layer), and what the downsides are (cross-shard queries, rebalancing). The slides list: complex routing, heavy cross-shard queries, more operations/monitoring, costly migration on rebalancing.
- [x] **Relate it to the indexer.** Covered in `k8s/DATABASE-SCALING.md`. The indexer would need to assign each document to a shard and write there. Note how the existing schema (`document`, `word`, `occ`) maps onto shards, since `word.id` and `document.id` are plain integers today.
- [x] **Placement:** `k8s/DATABASE-SCALING.md`. put this in the architecture notes or the exam material. It is a design requirement, not necessarily code ("anvise hvorledes" = show/indicate how), so a documented design with a diagram may be enough unless the project definition promised an implementation.
- [?] **y-axis split (functional) for completeness.** The slides also describe y-axis splitting by function or data type. A possible split is index data vs. a separate store for document content or user/search-history data. Not required; mention in the notes only if it helps the z-axis argument.

### Exam-project link
- [?] **Module 12 agenda included "Eksamensprojekt".** The exam project description (read at the start) is covered in section 0. The project definition approval deadline of 2026-11-17 has passed, so confirm that it was submitted and approved and which extension feature it commits to; that decides how much of this module is code and how much is a design write-up.

## Modules 1–6 (quick pass)

Sources: slide decks `Modul 1`, `Modul 2`, `Modul 3` (two decks), `Modul 6`, the exam project description (module 5), `spec of functions` (module 4), `testdata søgemaskine.png` (module 6) and `seData.zip` (module 2). Modules 4 and 5 contain no slides, and module 6 has only the z-scale deck and the test-data table. This is a lighter check than modules 7–12.

### Module 1: architecture principles
The deck names five principles and says the architect chooses which to follow: *scale out not up*, *stateless systems*, *asynchronous design*, *design to be monitored*, *design to be disabled*. It also says you may define your own principles with the SMART criteria (specific, measurable, achievable, realistic, testable).
- [x] **Scale out, not up:** two API replicas behind a Service (`k8s/apps.yaml`).
- [~] **Stateless:** the API is stateless (shared Redis and PostgreSQL). The Blazor GUI keeps state in server circuits, so it runs as one replica (documented in `k8s/README.md`).
- [?] **Asynchronous design:** to consider. There is no queue or message bus; indexing is a one-shot batch job and searches are synchronous. Either write a short decision note (why synchronous is fine here, and where a message bus would go, e.g. a RabbitMQ queue between document discovery and indexing) or implement that as the extension. A note is enough if there is no time.
- [x] **Design to be monitored:** covered in modules 8–9.
- [x] **Design to be disabled:** done via the `SearchCache` feature flag (see module 8). Live-cluster check still pending.
- [ ] **Principles checklist for the exam.** Add a short table of the principles you follow and consciously skip, each with evidence from the repo. Optional: one self-defined principle written to the SMART criteria.

### Module 2: the case (an internal search engine)
Requirements stated in the deck, checked against the code:
- [x] **100% recall:** `Hits` counts every document containing at least one query word, and the Postgres query returns all of them (`PostgresDocumentIndex.cs`).
- [-] **Explicit 0–1 score.** Descoped: the exam is about architecture, not about how documents are ranked. Results are ordered by number of matching words, which is enough.
- [-] **Snippets and richer result items (title, date).** Descoped: not relevant to the architectural focus.
- [-] **Synonym search / termnet.** Descoped: not relevant for this project.
- [x] **Web frontend and inverted index** with `document`, `word`, `occ` tables (`PostgresIndexStore.cs`), matching the relational model in the deck. Only `.txt` is indexed, which the deck allows for version 1.
- [x] **UML class, object and deployment diagrams.** In `uml/` (`class-diagram`, `class-diagram-indexer`, `object-diagram`, `deployment-diagram`), rendered to PNG/SVG.

### Module 3: scaling service and data
- [x] **X-scale of the service:** clones behind a load balancer (Kubernetes Service in front of two pods).
- [~] **Y-scale roadmap (interface, factory, API, proxy):** the search logic is behind `ISearchService` and exposed through the API, with the Blazor GUI calling it over HTTP, so steps 1–3 are effectively done. I did not find an explicit factory or proxy class; this is a naming/structure question, not a gap.
- [~] **Own load balancer:** a `LoadBalancer` project exists (compose only) but is excluded from the Kubernetes deployment; Kubernetes Service load balancing replaces it. Decide whether to keep, document or remove that project from the exam story.
- [ ] **Data scaling (x/y/z):** only x (read replicas) and z (sharding) apply to the index; see the module 12 backlog items.

### Module 6: z-scale and test data
- [x] **Z-scale design:** (done in `k8s/DATABASE-SCALING.md`) the deck defines it (partition key, exclusive ownership, locality; a reception routes to the node owning the data). Covered by the module 12 z-axis design item.
- [ ] **Use the test-data reference table in the performance work.** `testdata søgemaskine.png` lists the teacher's reference timings for three data sets: medium (5,000 documents, 500,000 occurrences; Postgres index 34 s, search 51 ms), large (50,000 documents, 11 million occurrences; index 10 min, search 600 ms) and xlarge (280,000 documents, 65 million occurrences; index about 1 h 3 min, search 1 min 40 s). These are good baselines for the module 9 load test. Note that `k8s/README.md` reports 3,034 documents indexed for the data set used, so `seData/medium` may not be the same size as the teacher's "medium"; confirm which folder the numbers refer to.
- [?] **Larger data sets:** `seData/large` exists locally. A run on it would show whether the xlarge search time (100 s) is a real bottleneck worth discussing at the exam.

### Modules 4–5: other files
- [?] **`spec of functions - jan 26.pdf` (module 4):** a generic note on pre/post-condition specifications with 5 exercises (is-increasing, cube number, minimum, date validation, array reverse). Not tied to the search engine. Optional: write an informal and formal specification (pre/post-condition) for one search function such as the scoring or query-parsing function, to show the specification-first approach.
- [x] **Exam project description (module 5):** summarised in section 0.

<!-- Module sections are appended below, one at a time. -->
