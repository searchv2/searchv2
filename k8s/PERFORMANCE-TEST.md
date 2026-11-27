# Performance test design and results

Module 9 (M9.01 and M9.03). The test quantifies what this environment can do, following the Abbott & Fisher steps from the slides: success criteria, environment, define tests, execute, analyse, report, repeat.

## A. Metrics: one per category, with the reason

| Category | Metric (Prometheus name) | Why this one | Bottleneck it can reveal |
| --- | --- | --- | --- |
| API requests | requests/s and p95 duration of `http_server_request_duration_seconds`, 5xx rate | What the user feels, and what the success criteria are written in. p95 rather than average, because the slowest requests are the ones users notice. | Latency rising while throughput flattens means a saturated resource somewhere behind the API. |
| Database | `searchv2_database_operation_duration_seconds` per operation | Separates "the database is slow" from "the API is slow". If the request time grows and the database time does not, the bottleneck is in the API. | `GetDocuments` growing with load: the `occ` scan or connection pool. |
| System resources | `dotnet_process_cpu_time_seconds_total` (rate = cores used) and `dotnet_process_memory_working_set_bytes` per pod | A pod at its CPU limit explains latency with no other symptom. Memory shows leaks and headroom against the 512 MiB limit. | CPU near the node's 4 cores: add replicas or reduce work. Memory growth: leak or too large a cache. |
| Application | `searchv2_search_active` (concurrent searches); `searchv2_cache_hits_total`, `_misses_total`, `_errors_total` (hit ratio) | Concurrency shows queueing inside the API. The hit ratio shows how much load the cache keeps off the database, which is the caching argument in numbers. | Low hit ratio: the database carries the full load. Errors: Redis problems. |
| User experience | `searchv2_search_interaction_duration_seconds` from the Blazor client | The time a user waits in the browser, including rendering, not only the API. | A gap between the API p95 and the browser time points to the GUI or the network. |

The CPU panel ("Process CPU by pod") and the cache panels were added to the Grafana dashboard for this test. Redis' own metrics and PostgreSQL's (connections, locks) are not collected; that is a known gap.

## B. Test design

**Success criteria** (chosen for a small single-node demo cluster, to be confirmed by the first run):

- p95 latency under 500 ms at the planned load, with the cache enabled.
- Error rate under 1 %.
- No pod restarts, and memory below 70 % of the limit.
- Cache hit ratio reported alongside, expected well above 50 % for the repeating query mix.

**Environment.** Minikube, one node with 4 CPUs and 6 GB memory (`start.sh`), running on a development laptop: the API (2 replicas, 100m CPU request, 512 Mi memory limit), PostgreSQL (one pod), Redis (one pod, 64 MB `maxmemory`), the monitoring stack, and the load generator all share that machine. The numbers are therefore **relative, not absolute**: they show where the system saturates and how the cache and scaling change it, not what production hardware would do. Data set: `seData/medium` (3,034 documents, an Enron mail sample; the teacher's reference "medium" is 5,000 documents, so the data is smaller). Traffic goes through a `kubectl port-forward` to the `search-api` Service, which adds overhead and is a client-side limit in itself.

**Load.** `k8s/load-test.py` sends `POST /api/Search` with a mix of queries: a pool of 50 repeating queries picked with a skew (a few are very popular) and 20 % one-off queries that always miss the cache. Stages of increasing concurrency, 60 s each:

1. **Load test**: stepped concurrency (2, 8, 16 workers) to find where latency starts to rise.
2. **Cache comparison**: the same load with the `SearchCache` flag off (`kubectl apply` of the flag, no restart), showing what the cache is worth.
3. **Endurance** (optional): one moderate stage for 10 to 15 minutes, to watch memory.

**Measurement.** Client side: the script reports requests, errors, req/s and p50/p95/p99 per stage and which pod answered. Server side: the Grafana dashboard (requests/s, p95, 5xx, CPU, memory, database duration, active searches, cache hit ratio), and the request counter in Prometheus.

**Verification of the metric.** The script compares the number of requests it sent with the increase of `http_server_request_duration_seconds_count` (without `/healthz`) in Prometheus (`--prometheus`). A match shows the instrumentation counts every request.

**Evaluation.** Read the stage table against the criteria; use the dashboard to see which resource moves first (database duration vs. CPU vs. active searches); state the bottleneck, or why none appeared; repeat with one change at a time.

### How to run

```sh
kubectl --context searchv2 -n searchv2 port-forward service/search-api 5071:8080 &
kubectl --context searchv2 -n devops port-forward service/prometheus 9090:9090 &
python3 k8s/load-test.py --docs ../seData/medium --stages 2x30,8x60,16x60 --prometheus http://localhost:9090
```

Open the dashboard at <http://localhost:3000/d/searchv2> during the run. For the cache comparison, switch the flag as described in "Disabling a feature" in `README.md`.

## C. Results

> **Superseded for throughput and latency (27 November).** These two runs were made while the PostgreSQL pod was limited to the Helm chart's default of 150m CPU, which throttled it. Without that limit the same test gives 556 req/s with the cache on and 521 without; see section D. The method, the metric check and the 0-error result still hold.

Run on 2026-11-26 on the Minikube cluster above, with `seData/medium` (3,034 documents), two API replicas, Redis and PostgreSQL as deployed by `start.sh`. Load: `k8s/load-test.py --stages 2x30,8x60,16x60`, 20 % one-off queries, 50 repeating ones. Requests were spread over the two API pods through one port-forward per pod. Raw output and the dashboard screenshots are in `k8s/perf-results/`.

### Cache on (default)

| Workers | req/s | p50 | p95 | p99 | Errors |
| --- | --- | --- | --- | --- | --- |
| 2 | 171 | 8 ms | 16 ms | 84 ms | 0 |
| 8 | 145 | 10 ms | 269 ms | 721 ms | 0 |
| 16 | 135 | 10 ms | 624 ms | 1,364 ms | 0 |

Cache hit ratio about 80 %. API pods peaked at about 0.65 cores each and 234 MiB.

### Cache off (`SearchCache` flag switched off, no restart)

| Workers | req/s | p50 | p95 | p99 | Errors |
| --- | --- | --- | --- | --- | --- |
| 2 | 57 | 15 ms | 98 ms | 290 ms | 0 |
| 8 | 42 | 106 ms | 499 ms | 1,291 ms | 0 |
| 16 | 40 | 300 ms | 1,000 ms | 1,864 ms | 0 |

API pods peaked at about 0.16 cores each. The Minikube node used 190 to 209 % of its 400 % CPU (`docker stats`, includes everything on the node).

### Verification of the metric

Both runs: the number of requests the script sent equals the increase of `http_server_request_duration_seconds_count` in Prometheus exactly (22,103 and 6,662, difference 0). The request counter is correct for this load.

### Against the success criteria

| Criterion | Result |
| --- | --- |
| p95 under 500 ms, cache on | Met at 2 and 8 workers (16 ms, 269 ms). **Not met at 16 workers (624 ms).** |
| p95 under 500 ms, cache off | Met at 2 workers (98 ms), borderline at 8 (499 ms), **not met at 16 (1,000 ms).** |
| Error rate under 1 % | Met: 0 errors in all stages. |
| No restarts, memory under 70 % of limit | Met: no pod restarts, 234 MiB of 512 MiB (46 %). |

### Analysis

- **Throughput falls as concurrency rises** in both runs (171 to 135 req/s with the cache, 57 to 40 without). More workers only add queueing, so the system is saturated already at 2 to 8 workers.
- **The bottleneck is the database path, not the API.** With the cache off the API pods use only about 0.16 cores each, so they are not CPU bound. A search without a cache makes four sequential database calls (`GetWordIds`, `GetDocuments`, `GetDocDetails`, `GetMissingWords`). On the dashboard their average duration rises from about 5 ms to about 50 ms (`GetMissingWords` to about 115 ms) as load increases, and this accounts for the latency. The database operation panel separates this from the request duration, as the module asks.
- **The cache is worth about 3.4 times the throughput** at 16 workers (135 against 40 req/s) and cuts p50 from 300 ms to 10 ms. The database seems to saturate at about 40 uncached searches per second whatever the cache does, so with hit ratio *h* the system can serve about 40 / (1 - *h*) req/s. At *h* = 0.8 that is about 200 req/s. This is the argument for the cache in numbers (M10.01).
- **Caveat on the hit ratio:** 80 % follows from the workload I generated (20 % one-off queries by construction), so it is not a prediction for real traffic. It shows the mechanism, not the production figure.
- **What is not established:** *why* PostgreSQL slows down. PostgreSQL's own CPU, connections and locks are not measured (no exporter), and the load generator, both API pods, Redis, PostgreSQL and the monitoring stack share one laptop, so some of the slowdown is likely competition for CPU. The numbers are relative, as stated in the design. A single Python client is also a limit at high request rates.

### What I would change if CPU or latency was a problem

Adding API replicas would not help, because the API is not the bottleneck. Cheaper and more effective options, in order: raise the cache hit ratio (longer TTL after reindexing is safe, since the index only changes through the indexer); reduce the four round trips per search (`GetWordIds` makes one query per word and could be one `WHERE name = ANY(...)`, and the missing-words lookup could be folded into `GetDocuments`); then x-axis read replicas for the database, as described in `DATABASE-SCALING.md`. These are suggestions from this run, not implemented.

### Open points

- Repeat the run with PostgreSQL metrics enabled (`metrics.enabled` in the Bitnami values) to see where inside the database the time goes.
- An endurance run (10 to 15 minutes) was not done, so memory growth over time is not shown.
- Run on a quieter machine, or with the load generator inside the cluster, to remove the port-forward and the shared-CPU effects.

## D. Re-run on 27 November: PostgreSQL without a CPU limit

The same script (`k8s/load-test.py --stages 2x30,8x60,16x60`), the same data and two API pods, but with the CPU limit removed from PostgreSQL (it had been 150m, then 1 CPU; see `INDEXING-PIPELINE.md`, "Results"). Screenshots: `presentation/screenshots/grafana-load-cache-on.png` and `grafana-load-cache-off.png`; raw output in `presentation/terminal/`.

### Cache on

| Workers | req/s | p50 | p95 | p99 | Errors |
| --- | --- | --- | --- | --- | --- |
| 2 | 192 | 8.9 ms | 14.9 ms | 25.8 ms | 0 |
| 8 | 486 | 14.6 ms | 24.1 ms | 34.6 ms | 0 |
| 16 | 556 | 26.8 ms | 41.9 ms | 57.9 ms | 0 |

The client sent 68,325 requests and Prometheus counted 68,303. The cache served 55,233 hits and 13,951 misses (80 %). Both pods took about half of the requests each. The API pods peaked at about 1 core each.

### Cache off (flag switched off two minutes beforehand)

| Workers | req/s | p50 | p95 | p99 | Errors |
| --- | --- | --- | --- | --- | --- |
| 2 | 195 | 9.4 ms | 13.7 ms | 28.6 ms | 0 |
| 8 | 454 | 16.2 ms | 24.7 ms | 45.6 ms | 0 |
| 16 | 521 | 28.8 ms | 44.0 ms | 71.9 ms | 0 |

Prometheus showed 0 cache hits and 0 misses during this run, so the cache really was bypassed. The client sent 64,374 requests and Prometheus counted 64,374.

### What changed in the conclusions

| 16 workers | DB limited (26 Nov) | No DB CPU limit (27 Nov) |
| --- | --- | --- |
| Cache on | 135 req/s, p95 624 ms | 556 req/s, p95 42 ms |
| Cache off | 40 req/s, p95 1,000 ms | 521 req/s, p95 44 ms |

- **The "database path is the bottleneck" finding in section C came mostly from the CPU limit**, not from the database being slow by nature. With the limit gone, throughput is four times higher with the cache and thirteen times higher without it.
- **The cache's throughput gain shrinks from about 3.4 times to about 7 %.** Searches on this index take a few milliseconds in PostgreSQL, about as long as a Redis round trip, so the cache buys little speed here.
- **The cache still earns its place as protection for PostgreSQL:** it answers 80 % of the queries, so the database sees a fifth of the load. That matters when the index or the traffic grows; a run on `seData/large` would show it and has not been done.
- **The "database saturates at about 40 uncached searches per second" formula in section C is withdrawn;** it was a property of the throttled pod.
- **Still not established:** the load generator (one Python process), both API pods, Redis, PostgreSQL and the monitoring stack share one laptop, so the numbers remain relative. At 16 workers the API pods used about 1 core each, so the API, the generator or the node may now be the limit.
