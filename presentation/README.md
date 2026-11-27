# Exam presentation

`searchv2-exam.pptx` is a first version of the slides for the oral exam in *Arkitekturprincipper i praksis*.
It is in English. 44 slides, speaker notes on every slide.

## How it is built around the exam

The study regulations (`valgfag studieordning`) say the exam is an individual oral exam of **30 minutes**:
a **5 to 10 minute presentation** in which you present a self-chosen set of architecture principles and show
in a working system how they are implemented, then **15 to 20 minutes of questions**, then 5 minutes for the
grade. The learning goals include judging the business gain and the cost of a principle. So the deck has a
short presentation block that goes principle by principle (where it lives, proof, gain, cost), and a large
backup block for the questions.

| Section | Slides | Use |
| --- | --- | --- |
| Presentation | 1 to 13 | The 5 to 10 minutes: plan, system overview, the five principles with proof, gain against cost, demo plan, conclusion |
| Demo storyboard | 14 to 19 | The screens and commands for a live demo |
| Architecture and diagrams | 20 to 26 | Kubernetes deployment, UML deployment, class and object diagrams, indexer design |
| Evidence | 27 to 37 | Performance test, load tests with the cache on and off, what the numbers taught, cache, indexer dashboard, failures, PostgreSQL, z-axis, rollback |
| Decisions and questions | 38 to 44 | Decision table, scaling cube, what is not done, likely questions, numbers to remember, file map |

## Files

| Path | What |
| --- | --- |
| `searchv2-exam.pptx` | The deck |
| `build-deck.js` | Generator (pptxgenjs). Edit this, not the .pptx, to keep the structure |
| `screenshots/` | Real screenshots from the running cluster (see below) |
| `terminal/` | Command output shown as terminal text, and raw load-test output |

### Screenshots

All taken on 2026-11-27 from the Minikube cluster started with `k8s/start.sh`.

| File | Shows | Situation |
| --- | --- | --- |
| `gui-home.png`, `gui-results*.png`, `gui-route-zoom.png` | The Blazor GUI and a search result with the serving pod | Search for "kitchen music" |
| `grafana-load-cache-on.png`, `grafana-cache-on.png` | Dashboard during the load test | Cache on, both API pods, 2/8/16 workers |
| `grafana-load-cache-off.png`, `grafana-cache-off.png` | The same, with the cache flag off | Flag switched off two minutes earlier |
| `grafana-load-both-top.png`, `grafana-cache-both.png` | Both runs in one time window | Cache hits stop when the flag is off |
| `grafana-outage-*.png`, `prometheus-alerts-*.png` | Redis taken down under load; the cache alert firing | `SearchCacheFailing` firing, `SearchLatencyHigh` pending |
| `grafana-indexing-*.png`, `grafana-postgres.png` | The indexer and PostgreSQL panels | Fresh reindexes with 1+1 and 4+4 workers, earlier runs with 2+2 and 8+8 |
| `rabbitmq-queues*.png` | RabbitMQ management UI | Mid-run: 2,656 messages waiting for the writers |
| `grafana-overview.png` | The whole dashboard in one tall image | After all scenarios |

The GUI screenshot of the document preview was left out on purpose: it showed a real e-mail from the
course's data set, with names and addresses, and this repository is public.

## Rebuild

```sh
npm install pptxgenjs                       # once, in any folder
NODE_PATH=<that folder>/node_modules PPTX_SKILL_DIR=<pptx skill directory> node build-deck.js
```

`PPTX_SKILL_DIR` is the directory that contains `scripts/apply_theme.js` (it writes the theme colours into the
file). If you do not have it, delete the two `applyTheme` lines at the bottom of `build-deck.js`; the deck still
builds, but PowerPoint shows its default theme colours until you pick the colours again.

## Things to check before the exam

* Read the speaker notes and change anything you would not say yourself; they were written from the repository
  and the measurements, not from your memory of the choices.
* The author name on slide 1 comes from the git configuration.
* Language: the exam is probably in Danish; the deck is in English.
* The UML diagrams on slides 22, 23, 25 and 26 are the rendered files from `uml/` (re-rendered on 2026-11-27, so the
  deployment and indexer diagrams include RabbitMQ and the pipeline). They are detailed, so for questions open the
  `.svg` files, which zoom without losing quality; slides 21 and 24 show the same structure as simpler drawn diagrams.
* Pick which demo steps you will show live; the plan is on slide 12. The reindex step replaces the index.
* The numbers are from one laptop and are relative; say so if asked.
