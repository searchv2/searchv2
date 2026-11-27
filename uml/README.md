# UML diagrams

The exam asks for class, object and deployment diagrams. These are the PlantUML sources;
the C4 container diagrams live in `../c4reference/`.

| File | Shows |
| --- | --- |
| `class-diagram.puml` | Classes and interfaces of the Blazor client, SearchAPI (onion layers, Redis cache, feature flag) and the shared SearchUtilities model, in the style of Modul 2 "Class diagram - version 2". |
| `class-diagram-indexer.puml` | The Indexer: the batch indexing service and the three-stage message-driven pipeline (coordinator, tokenizer, writer), their ports, messages and the Postgres/RabbitMQ/file implementations. Split from the diagram above to keep both readable. |
| `object-diagram.puml` | A snapshot of the objects alive while `search-api-1` answers one search for "apple" (a cache miss), including the Redis cache entry and the `SearchCache` feature flag. |
| `deployment-diagram.puml` | The Kubernetes deployment on Minikube (including RabbitMQ and the pipeline workers): namespaces, pods, images, volumes, ConfigMap/Secrets, ports and protocols, in the notation of Modul 7. |

The console client is out of scope, as everywhere else in this project.

Each `.puml` has a rendered `.png` and `.svg` next to it. All four were re-rendered on 2026-11-27 with PlantUML 1.2026.x (jar version 8059), after the indexing pipeline, RabbitMQ and the workers were added to `class-diagram-indexer` and `deployment-diagram`.

## Rendering

```sh
java -jar plantuml.jar -tsvg uml/*.puml
java -DPLANTUML_LIMIT_SIZE=16384 -jar plantuml.jar -tpng uml/*.puml
```

Run the SVG and the PNG as **two commands**: with both `-tsvg` and `-tpng` on one line only the last one is
written. The size limit property matters for `deployment-diagram`, which is wider than PlantUML's default limit
of 4,096 pixels and would otherwise be cut off at the right edge. On Java 24 and newer the PNG writer also needs
`--add-exports java.desktop/com.sun.imageio.plugins.png=ALL-UNNAMED` before `-jar`.

Newer PlantUML versions require the stereotype **after** the alias (`node "Name" as alias <<pod>>`); older ones
accepted `node "Name" <<pod>> as alias`, and the deployment diagram was changed to the new order.

`plantuml.jar` is not stored in the repo; install PlantUML (for example
`sudo pacman -S plantuml`, then `plantuml -tsvg -tpng uml/*.puml`) or download the jar
from https://github.com/plantuml/plantuml/releases. Graphviz (`dot`) must be installed
for class and deployment diagrams. Re-export after editing a `.puml` file.
