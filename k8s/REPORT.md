# Report: Kubernetes deployment and observability for SearchV2

The work added a local Kubernetes deployment for SearchV2, based on the workflow
used in the neighbouring MK-TEST project. It uses Minikube, locally built Docker
images, Kubernetes manifests, and rolling deployments. The deployed application
consists of the Blazor GUI, two SearchAPI replicas, and a manually triggered
indexer Job. LoadBalancer and ConsoleSearch are excluded from this deployment.

## Deployment and image builds

`k8s/Dockerfile` provides separate build targets for SearchAPI, Blazor, and the
indexer. It builds the checked-out SearchUtilities project and uses that local
library when publishing the applications. `k8s/Dockerfile.dockerignore` excludes
build output, Git metadata, generated packages, the workstation database, and
the excluded projects from the build context.

The Kubernetes resources are split by startup responsibility:

| File | Added resources and purpose |
| --- | --- |
| `namespaces.yaml` | The `searchv2` (search engine), `devops` (observability), `caching` (Redis), and `database` (PostgreSQL) namespaces. |
| `indexer.yaml` | A one-time indexing Job with automatic retries disabled and a check that rejects an empty document folder before indexing. |
| `apps.yaml` | Two API replicas, one Blazor replica, their Services, resource requests and memory limits, and startup/readiness/liveness probes. |
| `observability.yaml` | Deployments and Services for the collector, Prometheus, Loki, and Grafana. |
| `kustomization.yaml` | Generates monitoring ConfigMaps from configuration files and connects them to the monitoring deployments. |
| `postgresql/custom-values.yaml` | Values for the Bitnami PostgreSQL Helm chart (release `postgresql-db` in `database`): user `searcher`, database `searchengine`, 2 GiB storage, passwords from the `postgresql-credentials` Secret. |

The API Service provides an internal address and routes connections to ready API
pods. Blazor calls that Service through Kubernetes DNS. The GUI has a NodePort
Service, and the guide also provides localhost port-forward commands.

Both web deployments use rolling updates with `maxSurge: 1` and
`maxUnavailable: 0`. Blazor uses one replica because its interactive server
circuits hold state inside the application process.

## Documents and database storage

The document corpus is copied into the dedicated Minikube node as a snapshot.
The indexer and API pods mount it read-only at `/data/docs`. Keeping the same
path matters because the index stores source-file paths used by document
retrieval and case-sensitive searches.

The indexer writes the index to PostgreSQL (`postgresql-db` in the `database`
namespace) as user `searcher`. Both API replicas read the same tables over the
network with pooled connections; the password comes from the
`postgresql-credentials` Secret copied into `searchv2`.

The guide includes a maintenance procedure that scales the API to zero before
reindexing and restores two replicas after indexing succeeds. This is necessary
because the existing indexer drops and recreates the index tables. The empty
folder guard prevents a missing document snapshot from silently replacing the
index with an empty one.

## Application telemetry and health endpoints

SearchAPI and Blazor received OpenTelemetry configuration in their existing
`Program.cs` files. Both projects now reference
`OpenTelemetry.Extensions.Hosting` and
`OpenTelemetry.Exporter.OpenTelemetryProtocol`, version `1.18.0`. SearchAPI
manages these versions through its existing central package configuration.

When `OTEL_EXPORTER_OTLP_ENDPOINT` is configured, the applications export built-in
ASP.NET Core, HTTP client, and .NET runtime metrics, plus formatted `ILogger`
records. Resources identify the application as `search-api` or `blazor` and
identify each instance using its hostname, which is the pod name in Kubernetes.

Both applications also expose `/healthz` for Kubernetes probes. This endpoint
checks that the web process responds; it does not validate the database schema or
document availability. Successful indexing is enforced by the documented
startup order.

## Monitoring and Grafana

The telemetry pipeline is:

```text
API and Blazor -- OTLP/gRPC --> OpenTelemetry Collector
                                  |              |
                          metrics endpoint    OTLP/HTTP logs
                                  ^              v
                             Prometheus         Loki
                                  ^              ^
                                  +--- Grafana --+
```

The collector batches telemetry and exposes application metrics for Prometheus
to scrape every 15 seconds. It forwards application logs to Loki's native OTLP
endpoint. Prometheus and Loki are configured for 24-hour retention while their
pods remain alive.

Files under `k8s/observability/` configure these components and provision Grafana
with both data sources and a SearchV2 dashboard. Its six panels show:

* Request rate.
* 95th percentile request duration.
* Server error rate.
* Collector scrape availability.
* Process memory by pod.
* Application logs.

On 20 October 2026, a seventh panel was added for average API-side SQLite
operation duration, grouped by the four index lookup methods. A custom .NET
histogram measures command preparation, execution, and result reading/mapping.
It uses the existing OpenTelemetry pipeline and adds no production packages.
Fixed operation labels exclude SQL text and search/document data. Failed
attempts are included; empty lookups without SQL are skipped. Indexer writes
are outside this metric's scope.

On 3 November 2026, SQLite was removed and the index moved to PostgreSQL. The
panel became **Database operation duration**, and the metric was renamed to
`searchv2.database.operation.duration` on the `SearchV2.Database` meter. Timing
now includes the network round trips to the database pod.

An eighth panel, **Active searches**, was subsequently added. It sums a sampled
gauge across API replicas to show searches executing inside `SearchService`.
The count is updated atomically and decremented on completion or failure.
Short searches between collection instants may not appear in the graph. The
metric adds no production packages or user/search labels.

A ninth panel, **Search interaction duration — browser**, adds user experience
metrics. It shows p50 and p95 browser submission-to-results paint-opportunity
duration. Browser-side timing covers communication and the rendered result
update; reporting latency is excluded. Failed, hidden-tab, and superseded
interactions are discarded, and the Blazor process validates client-reported
durations before exporting a histogram through the existing OTEL pipeline.
No search/user labels or new public telemetry endpoints are introduced.

Request traffic panels exclude `/healthz`. Memory metrics provide useful data
before searches are made. Grafana's administrator password is supplied through
a Kubernetes Secret. The temporary password file used during validation was
removed after verification.

## Documentation and validation

The root `README.md` links to `k8s/README.md`. That guide combines the architecture
explanation with commands for creating the cluster, importing documents,
building/loading images, indexing, opening the GUI and Grafana, generating
traffic, reindexing, updating, rolling back, troubleshooting, and cleanup.

`k8s/smoke-test.py` sends real API searches and waits for a positive request
metric in Prometheus and matching request logs in Loki.

Validation performed during implementation on 19 October 2026 included:

* Successful API and Blazor builds and all three application image builds.
* Kubernetes server dry runs for application, monitoring, and indexer manifests.
* Successful indexing of 3,034 documents and readiness of both API replicas.
* A successful GUI response through its Kubernetes Service.
* Authenticated Grafana access, all six provisioned panels, healthy data
  sources, and application memory metrics queried through Grafana.
* A passing telemetry smoke test and checks of the indexer guard with both an
  empty folder and a synthetic document.
* YAML/JSON parsing, deployment selector checks, and guide shell syntax checks.

Minikube's node could not resolve Docker Hub during validation, so monitoring
images were pulled through the host and loaded into Minikube. A live 9p mount
also timed out; the documented setup therefore uses a copied document snapshot.

## Limitations

This setup targets a local, single-node learning environment. The node-local
document snapshot needs a different storage design for multiple nodes. Host document edits require refreshing the snapshot before reindexing.
Reindexing requires a search maintenance window, and Blazor restarts disconnect
active circuits.

Monitoring uses `emptyDir` volumes, so pod replacement removes monitoring
history and Grafana edits. Provisioned data sources and dashboard definitions
are recreated from configuration. Application logs are exported through the
SDK; indexer and infrastructure stdout remain available through `kubectl logs`.
Loki and OTLP endpoints have no authentication inside the cluster and should
remain internal. A trace backend is not included.

Sustained load, multi-node operation, and rollback during active user traffic
were not tested. Production use requires durable monitoring storage and
appropriate access controls.
