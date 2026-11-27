#!/usr/bin/env bash
# Measures the indexing pipeline with different numbers of workers (see INDEXING-PIPELINE.md).
#
#   ./k8s/pipeline-scaling.sh 1:1 2:2 4:4 1:4 4:1     # TOKENIZERS:WRITERS pairs
#
# For each pair it scales the two worker Deployments, waits until they are ready, runs the indexer Job
# (a full reindex, which REPLACES the index) and prints how long the pipeline took. Stop the API first,
# as for any reindex: kubectl --context searchv2 -n searchv2 scale deployment/search-api --replicas=0
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
k="kubectl --context searchv2 -n searchv2"
(( $# > 0 )) || { echo "Usage: $0 TOKENIZERS:WRITERS ..." >&2; exit 1; }

printf '%-11s %-8s %10s %9s\n' tokenizers writers seconds docs/s
for pair in "$@"; do
  tokenizers=${pair%%:*}
  writers=${pair##*:}
  $k scale deployment/indexer-tokenizer --replicas="$tokenizers" > /dev/null
  $k scale deployment/indexer-writer --replicas="$writers" > /dev/null
  $k rollout status deployment/indexer-tokenizer --timeout=120s > /dev/null
  $k rollout status deployment/indexer-writer --timeout=120s > /dev/null
  $k delete job indexer --ignore-not-found --wait=true > /dev/null
  # Only the Job (the first document of indexer.yaml); applying the whole file would reset the worker counts.
  python3 -c "import yaml; print(yaml.dump(next(yaml.safe_load_all(open('k8s/indexer.yaml')))))" | $k apply -f - > /dev/null
  $k wait --for=condition=complete job/indexer --timeout=900s > /dev/null
  logs=$($k logs job/indexer)
  ms=$(sed -n 's/^DONE! used \([0-9.]*\).*/\1/p' <<< "$logs")
  docs=$(sed -n 's/^Indexed \([0-9]*\) documents/\1/p' <<< "$logs")
  python3 -c "import sys; ms, docs = float('$ms'), int('$docs'); print(f'{\"$tokenizers\":<11} {\"$writers\":<8} {ms/1000:10.1f} {docs/(ms/1000):9.0f}')"
done
