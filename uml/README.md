# UML diagrams

The exam asks for class, object and deployment diagrams. These are the PlantUML sources;
the C4 container diagrams live in `../c4reference/`.

| File | Shows |
| --- | --- |
| `class-diagram.puml` | Classes and interfaces of the Blazor client, SearchAPI (onion layers, Redis cache, feature flag) and the shared SearchUtilities model, in the style of Modul 2 "Class diagram - version 2". |
| `class-diagram-indexer.puml` | The Indexer (one-shot job): its application service, interfaces, entities and the Postgres/in-memory/file implementations. Split from the diagram above to keep both readable. |
| `object-diagram.puml` | A snapshot of the objects alive while `search-api-1` answers one search for "apple" (a cache miss), including the Redis cache entry and the `SearchCache` feature flag. |
| `deployment-diagram.puml` | The Kubernetes deployment on Minikube: namespaces, pods, images, volumes, ConfigMap/Secrets, ports and protocols, in the notation of Modul 7. |

The console client is out of scope, as everywhere else in this project.

Each `.puml` has a rendered `.png` and `.svg` next to it.

## Rendering

```sh
java -jar plantuml.jar -tsvg uml/*.puml     # or -tpng
```

`plantuml.jar` is not stored in the repo; install PlantUML (for example
`sudo pacman -S plantuml`, then `plantuml -tsvg -tpng uml/*.puml`) or download the jar
from https://github.com/plantuml/plantuml/releases. Graphviz (`dot`) must be installed
for class and deployment diagrams. Re-export after editing a `.puml` file.
