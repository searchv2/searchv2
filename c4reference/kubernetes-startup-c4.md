# SearchV2 startup script — C4 architecture

These views describe `k8s/start.sh`. The container view shows the deployed
applications and their communication. The dynamic view shows what the script
does to bring them up. A C4 container represents an application or data store;
the two API pods are replicas of the same container.

## C4 level 2: containers and communication

```mermaid
C4Container
    title SearchV2 — containers started by k8s/start.sh

    Person(user, "User", "Uses the search GUI and Grafana in a browser")

    System_Boundary(cluster, "SearchV2 — single-node Minikube profile: searchv2") {
        Boundary(application, "Namespace: searchv2 — search engine") {
            Container(ui, "Blazor GUI", "ASP.NET Core Blazor Server", "One pod behind the blazor Service")
            Container(api, "SearchAPI", "ASP.NET Core Web API", "Two pods behind the search-api Service")
            Container(indexer, "Indexer", ".NET / Kubernetes Job", "Runs once during startup to rebuild the index")
            ContainerDb(documents, "Document snapshot", "Node filesystem", "Copied from the host; mounted read-only at /data/docs")
        }
        Boundary(caching, "Namespace: caching") {
            ContainerDb(redis, "Search result cache", "Redis / one pod", "Shares search responses between API pods; no persistent volume")
        }
        Boundary(database, "Namespace: database") {
            ContainerDb(index, "Search index", "PostgreSQL / Bitnami Helm chart", "Release postgresql-db; database searchengine, 2 GiB PVC")
        }
        Boundary(monitoring, "Namespace: devops — observability") {
            Container(otel, "OpenTelemetry Collector", "OTel Collector", "Receives application metrics and logs; batches and exports them")
            ContainerDb(prometheus, "Prometheus", "Prometheus", "Stores scraped metrics")
            ContainerDb(loki, "Loki", "Grafana Loki", "Stores application logs")
            Container(grafana, "Grafana", "Grafana", "Provisioned SearchV2 dashboard and data sources")
        }
    }

    Rel(user, ui, "Searches and reads documents through localhost port-forward", "HTTP / WebSocket, localhost:5080 to :8080")
    Rel(user, grafana, "Views dashboards through localhost port-forward", "HTTP, localhost:3000 to :3000")
    Rel(ui, api, "Search and document requests through the Kubernetes Service", "HTTP/JSON, search-api:8080")
    Rel(api, index, "Reads the index as user searcher", "SQL, postgresql-db.database:5432")
    Rel(api, redis, "Reads and writes cached search results", "Redis protocol, redis.caching.svc.cluster.local:6379")
    Rel(api, documents, "Reads document content", "Filesystem, read-only")
    Rel(indexer, documents, "Reads .txt files", "Filesystem, read-only")
    Rel(indexer, index, "Replaces index tables before API startup", "SQL / COPY, postgresql-db.database:5432")
    Rel(ui, otel, "Exports metrics and logs", "OTLP/gRPC, otel-collector.devops:4317")
    Rel(api, otel, "Exports metrics and logs", "OTLP/gRPC, otel-collector.devops:4317")
    Rel(prometheus, otel, "Scrapes application metrics every 15 seconds", "HTTP, :8889/metrics")
    Rel(otel, loki, "Exports application logs", "OTLP/HTTP, :3100/otlp/v1/logs")
    Rel(grafana, prometheus, "Queries metrics", "HTTP / PromQL, :9090")
    Rel(grafana, loki, "Queries logs", "HTTP / LogQL, :3100")
```

Arrows show who initiates each interaction. Prometheus pulls metrics from the
collector, while the collector pushes logs to Loki. Grafana queries the two
stores when displaying the dashboard. The port-forwards are processes on the
workstation; they are not additional deployed services.

Each boundary inside the cluster is a Kubernetes namespace, following the
teacher's C4 diagram (search engine, DevOps infrastructure, caching). Calls
inside a namespace use the short Service name (for example `search-api:8080`);
calls across namespaces use the full DNS name `<service>.<namespace>.svc.cluster.local`.
The `database` namespace holds the search index in PostgreSQL, installed with
the Bitnami Helm chart as release `postgresql-db` (`k8s/postgresql/custom-values.yaml`).

## C4 dynamic view: startup orchestration

```mermaid
C4Dynamic
    title k8s/start.sh — startup interactions in execution order

    Person(developer, "Developer", "Runs the startup command")
    Container(script, "start.sh", "Bash on the workstation", "Orchestrates startup and owns two localhost port-forwards")
    System_Ext(docker, "Host Docker engine", "Builds local app images and pulls monitoring images")
    System_Ext(kubernetes, "Minikube / Kubernetes", "Dedicated searchv2 profile; searchv2, devops, caching, and database namespaces")

    Rel(developer, script, "Runs ./k8s/start.sh with an optional document folder")
    Rel(script, script, "Validates .txt input, required commands, and Docker access")
    Rel(script, kubernetes, "Starts the single-node Minikube profile")
    Rel(script, docker, "Builds indexer, API, and GUI images; pulls Redis, PostgreSQL, and four monitoring images")
    Rel(script, kubernetes, "Loads all nine images into the node")
    Rel(script, kubernetes, "Applies the four namespaces; creates the Grafana Secret (devops), Redis Secret (caching and searchv2), and PostgreSQL Secret (database and searchv2) if absent")
    Rel(script, kubernetes, "Installs PostgreSQL with Helm and waits until it is ready")
    Rel(script, kubernetes, "Applies Redis, collector, Prometheus, Loki, Grafana, and monitoring configuration")
    Rel(script, kubernetes, "Stops existing API replicas and waits for pod deletion")
    Rel(script, kubernetes, "Deletes the previous indexing Job and replaces the document snapshot")
    Rel(script, kubernetes, "Creates the indexer Job and waits for successful completion")
    Rel(script, kubernetes, "Restarts Redis to clear results from the old index")
    Rel(script, kubernetes, "Applies web apps, restarts API and GUI pods, and waits for all rollouts")
    Rel(script, kubernetes, "Starts localhost forwards for GUI :5080 and Grafana :3000")
    Rel(script, developer, "Prints URLs and the Grafana password retrieval command; waits")
```

The Job finishes before the script starts the API against the rebuilt index.
If indexing fails, startup stops with the API still stopped. Grafana's existing
password and Redis password are reused, and their values are not printed by the
script.

The script launches seven long-running Deployments:
Blazor, SearchAPI, Redis, the collector, Prometheus, Loki, and Grafana. With two
API replicas, these Deployments normally run eight pods in total. The Helm
release adds the PostgreSQL StatefulSet pod `postgresql-db-0`. The indexer adds
one temporary Job pod. Kubernetes also runs its own cluster infrastructure.
LoadBalancer and ConsoleSearch are excluded.

Ctrl+C terminates the script's two port-forwards and removes its local temporary
files. The cluster and deployed workloads remain running. Each new invocation
refreshes the document snapshot and rebuilds the index, creating a search
maintenance window. Monitoring history uses temporary pod storage.
