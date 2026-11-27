# SearchV2

With Docker, Minikube, kubectl, and OpenSSL installed, start the setup with:

```sh
./k8s/start.sh
```

See the [Kubernetes startup and architecture guide](k8s/README.md) to run the
Blazor GUI, two SearchAPI replicas, and the indexer on Minikube, with
Redis caching, OpenTelemetry, Prometheus, Loki, and a provisioned Grafana dashboard.

The Kubernetes deployment excludes LoadBalancer and ConsoleSearch.

## Workspace layout

This repository holds the deployment, documentation and course material. Each project lives
in its own repository, with its tests under `tests/`. Clone them next to this one (same parent
folder, these folder names):

| Folder | Repository |
| --- | --- |
| `SearchAPI/` | https://github.com/searchv2/search-api |
| `indexer/` | https://github.com/searchv2/indexer |
| `blazor-client-gui/` | https://github.com/searchv2/blazor-client-gui |
| `search-utilities/` | https://github.com/searchv2/search-utilities |
| `ConsoleSearch/` | https://github.com/searchv2/console-search (not deployed to Kubernetes) |
| `LoadBalancer/` | https://github.com/searchv2/load-balancer (compose only, not deployed to Kubernetes) |

Folders in this repository: `k8s/` (manifests and start script), `uml/` (UML diagrams),
`c4reference/` (C4 diagrams), `docker-compose.yml` and `BACKLOG.md` (course-compliance backlog).
