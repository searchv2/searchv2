# Demo script (about 12 minutes)

A walk through the system for the exam. Every command below was run against this cluster. Each
step says what to show and what point it makes.

## Before you start (not part of the 12 minutes)

```sh
./k8s/start.sh                      # keep this terminal open: it holds the GUI (5080) and Grafana (3000) forwards
# in other terminals:
kubectl --context searchv2 -n searchv2 port-forward service/search-api 5071:8080
kubectl --context searchv2 -n devops get secret grafana-admin -o jsonpath='{.data.password}' | base64 --decode; echo
```

Open Grafana at <http://localhost:3000/d/searchv2> (user `admin`) and the GUI at
<http://localhost:5080>. Have these files open: `c4reference/kubernetes-startup-c4.md` and
`uml/deployment-diagram.svg`. Close anything that already uses ports 5080 and 3000.

## 1. Architecture (2 min)

Show the C4 container diagram and the UML deployment diagram.

- Five namespaces: `searchv2` (GUI, API, indexing workers), `caching` (Redis), `messaging` (RabbitMQ), `database` (PostgreSQL),
  `devops` (monitoring).
- The API is stateless and runs two replicas (scale out, not up). The GUI is one replica
  because Blazor Server keeps state in its circuit. Indexing is a three-stage pipeline (indexer Job, tokenizer and writer Deployments) with RabbitMQ in the `messaging` namespace.
- Point at the decision log in the C4 document for why it is split this way.

## 2. It runs (1 min)

```sh
kubectl --context searchv2 get pods -A | grep -v kube-system
```

Search for a word in the GUI (for example `enron`). Say: two API pods share one Redis and one
PostgreSQL, and the answering pod is reported in the `X-Served-By` header.

## 3. Observability (2 min)

In Grafana: requests per second, p95 latency, 5xx rate, CPU and memory per pod, database operation
duration, active searches, cache hit ratio, and the application logs from Loki.

Start some load and watch the panels move:

```sh
python3 k8s/load-test.py --docs ../seData/medium --stages 4x30 --url http://localhost:5071/api/Search
```

Say: the metrics come from OpenTelemetry in the apps, through one collector, into Prometheus and
Loki. Why plain manifests rather than the course's Helm charts: smaller and easier to read.

## 4. Caching and its failure mode (2 min)

Point at the cache hit ratio panel (about 80 % in the load test; the figure follows from the
workload mix). Then take Redis away:

```sh
kubectl --context searchv2 -n caching scale deploy/redis --replicas=0
curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' -H 'Content-Type: application/json' \
  -d '{"Query":["enron"],"CaseSensitive":false}' localhost:5071/api/Search
kubectl --context searchv2 -n caching scale deploy/redis --replicas=1
```

Say: the search still answers (HTTP 200) because the cache is only an optimisation and the API
falls back to PostgreSQL. Be honest about the cost: it is slower, about 4 s, because each request
still tries Redis twice. A circuit breaker would fix it; it is not built. See `CACHING.md`.

Design to be disabled: the same cache can be switched off without a release
(`README.md`, "Disabling a feature"). It reaches the pods in about a minute with no restart.

## 5. A release that fails, and rollback (2 min)

```sh
./k8s/rollback-demo.sh
```

Say what it shows: the broken pod never becomes Ready, the two old pods keep serving (the rolling
update keeps old pods until a new one is Ready), the check requests all return 200, and
`rollout undo` restores the previous version. `rollout history` shows why each change was made
(change-cause). Limit: it cannot catch a release that starts fine but is wrong; that is what the
feature flag is for.

## 6. Scaling (2 min)

```sh
kubectl --context searchv2 -n searchv2 scale deploy/search-api --replicas=3
kubectl --context searchv2 -n searchv2 rollout status deploy/search-api
kubectl --context searchv2 -n searchv2 scale deploy/search-api --replicas=2
```

Say: x-axis for the code is just more replicas. The load test shows more replicas would not help
today, because the bottleneck is the database path (the API used about 0.16 cores per pod with the
cache off). Then open `k8s/DATABASE-SCALING.md`: read replicas (x-axis) and sharding by document
(z-axis) with a scatter/gather router in the API, and the downsides.

The indexing side does scale. Open the RabbitMQ UI (http://localhost:15672, started by `start.sh`) or the
Grafana panel "Indexing queues: messages waiting" and say: indexing is a pipeline, three stages joined by queues,
so each stage scales on its own. Show `INDEXING-PIPELINE.md`, "Results": 24.6 s with one tokenizer and one
writer, 8.4 s with eight of each, and the finding that the writers are the slow stage (one tokenizer with four
writers is almost as fast as four and four). Optional live step, which REPLACES the index and needs the API
stopped first: `./k8s/pipeline-scaling.sh 1:1 4:4`.

## Questions to be ready for

| Question | Where the answer is |
| --- | --- |
| Why Redis, what is cached, what is not, eviction and TTL? | `CACHING.md` |
| What was the bottleneck and how do you know? | `PERFORMANCE-TEST.md` (analysis) |
| How would the database scale on the z-axis? | `DATABASE-SCALING.md` |
| Why is the database in the cluster, and what is the backup plan? | `DECISIONS.md` ("Database in Kubernetes or not", "Backup and recovery") |
| Which architecture principles do you follow? | `DECISIONS.md` (principles table) |
| Why plain manifests and not the guide's Helm charts? Build or buy? | `DECISIONS.md` |
| Why is the document volume a hostPath, and what in production? | `DECISIONS.md` |
| How would Redis scale? | `DECISIONS.md` ("Redis is not scaled out") |
| Why a message bus, why RabbitMQ, what if a worker dies or a message is bad? | `INDEXING-PIPELINE.md` ("Decisions and why", "Failures") |
| Which stage is the bottleneck and how do you know? | `INDEXING-PIPELINE.md` ("Results") |
| How do you know when something is wrong? | `README.md` ("Alerting"), the Grafana panel "Firing alerts" |
| What happens when a pod dies / Redis dies / a release fails? | steps 4 and 5 above |
| Secrets versus ConfigMaps? | C4 document, decision log point 4 |
| What do the volumes hold, and what may disappear? | C4 document, volume table |
| What is not done or not tested? | `README.md`, "Validation performed", "Not tested" |

## After the demo

```sh
kubectl --context searchv2 -n caching get deploy redis        # should be 1/1
kubectl --context searchv2 -n searchv2 get deploy search-api  # should be 2/2
```

Stop the cluster with `minikube stop -p searchv2`.
