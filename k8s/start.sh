#!/usr/bin/env bash
set -euo pipefail

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
if (( $# > 1 )); then
  echo "Usage: $0 [document-folder]" >&2
  exit 1
fi
docs_dir=$(realpath -- "${1:-$root/../seData/medium}")
if [[ ! -d "$docs_dir" || -z "$(find "$docs_dir" -type f -name '*.txt' -print -quit)" ]]; then
  echo "The document folder must contain .txt files: $docs_dir" >&2
  exit 1
fi
for tool in docker minikube kubectl openssl helm; do
  command -v "$tool" > /dev/null || { echo "Missing required command: $tool" >&2; exit 1; }
done
docker info > /dev/null
cd -- "$root"

umask 077
work_dir=$(mktemp -d)
forward_pids=()
cleanup() {
  for pid in "${forward_pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  rm -rf -- "$work_dir"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

minikube start -p searchv2 --driver=docker --nodes=1 --cpus=4 --memory=6144 --keep-context

for target in indexer search-api blazor; do
  docker build -f k8s/Dockerfile --target "$target" -t "searchv2-$target:1.0.1" .
  docker save "searchv2-$target:1.0.1" | minikube image load -p searchv2 -
done
# Load through the host because this machine's Minikube node cannot resolve Docker Hub.
for image in redis:7-alpine bitnami/postgresql:latest otel/opentelemetry-collector-contrib:0.123.0 prom/prometheus:v3.4.1 grafana/loki:3.5.1 grafana/grafana:12.0.2; do
  docker pull "$image"
  minikube image load -p searchv2 "$image"
done

kubectl --context searchv2 apply -f k8s/namespaces.yaml
secret=$(kubectl --context searchv2 -n devops get secret grafana-admin --ignore-not-found -o name)
if [[ -z "$secret" ]]; then
  openssl rand -hex 24 | tr -d '\n' > "$work_dir/password"
  kubectl --context searchv2 -n devops create secret generic grafana-admin --from-file="password=$work_dir/password"
fi
# Secrets are namespace-scoped: Redis (caching) and search-api (searchv2) each need a copy of the same password.
secret=$(kubectl --context searchv2 -n caching get secret redis-credentials --ignore-not-found -o name)
copy=$(kubectl --context searchv2 -n searchv2 get secret redis-credentials --ignore-not-found -o name)
if [[ -z "$secret" || -z "$copy" ]]; then
  openssl rand -hex 24 | tr -d '\n' > "$work_dir/redis-password"
  for namespace in caching searchv2; do
    kubectl --context searchv2 -n "$namespace" delete secret redis-credentials --ignore-not-found
    kubectl --context searchv2 -n "$namespace" create secret generic redis-credentials --from-file="password=$work_dir/redis-password"
  done
fi
secret=$(kubectl --context searchv2 -n database get secret postgresql-credentials --ignore-not-found -o name)
if [[ -z "$secret" ]]; then
  openssl rand -hex 24 | tr -d '\n' > "$work_dir/postgres-password"
  openssl rand -hex 24 | tr -d '\n' > "$work_dir/searcher-password"
  kubectl --context searchv2 -n database create secret generic postgresql-credentials \
    --from-file="postgres-password=$work_dir/postgres-password" --from-file="password=$work_dir/searcher-password"
fi
# The indexer and search-api (searchv2) log in as searcher, so they need a copy of its password.
secret=$(kubectl --context searchv2 -n searchv2 get secret postgresql-credentials --ignore-not-found -o name)
if [[ -z "$secret" ]]; then
  kubectl --context searchv2 -n database get secret postgresql-credentials -o jsonpath='{.data.password}' \
    | base64 --decode > "$work_dir/searcher-password"
  kubectl --context searchv2 -n searchv2 create secret generic postgresql-credentials --from-file="password=$work_dir/searcher-password"
fi
kubectl --context searchv2 apply -f k8s/redis.yaml
helm repo add bitnami https://charts.bitnami.com/bitnami --force-update
helm --kube-context searchv2 upgrade --install postgresql-db bitnami/postgresql --version 18.12.17 \
  --namespace database --values k8s/postgresql/custom-values.yaml --wait --timeout 5m
kubectl --context searchv2 apply -k k8s

# Stop readers before replacing either the document snapshot or the index tables.
deployment=$(kubectl --context searchv2 -n searchv2 get deployment search-api --ignore-not-found -o name)
if [[ -n "$deployment" ]]; then
  kubectl --context searchv2 -n searchv2 scale deployment/search-api --replicas=0
  kubectl --context searchv2 -n searchv2 wait --for=delete pod -l app=search-api --timeout=120s
fi
kubectl --context searchv2 -n searchv2 delete job indexer --ignore-not-found --wait=true
tar -C "$docs_dir" -czf "$work_dir/documents.tar.gz" .
minikube cp -p searchv2 "$work_dir/documents.tar.gz" /tmp/searchv2-docs.tar.gz
minikube ssh -p searchv2 -- 'sudo rm -rf /data/searchv2-docs && sudo mkdir -p /data/searchv2-docs && sudo tar -xzf /tmp/searchv2-docs.tar.gz -C /data/searchv2-docs && sudo rm /tmp/searchv2-docs.tar.gz'
kubectl --context searchv2 apply -f k8s/indexer.yaml
kubectl --context searchv2 -n searchv2 wait --for=condition=complete job/indexer --timeout=1800s
# Redis holds only cached search results; restart it after reindexing to drop stale entries.
kubectl --context searchv2 -n caching rollout restart deployment/redis
kubectl --context searchv2 -n caching rollout status deployment/redis --timeout=300s
kubectl --context searchv2 apply -f k8s/feature-flags.yaml
kubectl --context searchv2 apply -f k8s/apps.yaml
# The local tags are rebuilt on each run; recreate pods so they use the loaded images.
kubectl --context searchv2 -n searchv2 rollout restart deployment/search-api deployment/blazor
for service in otel-collector prometheus loki grafana; do
  kubectl --context searchv2 -n devops rollout status "deployment/$service" --timeout=300s
done
for service in search-api blazor; do
  kubectl --context searchv2 -n searchv2 rollout status "deployment/$service" --timeout=300s
done

kubectl --context searchv2 -n searchv2 port-forward service/blazor 5080:8080 &
forward_pids+=("$!")
kubectl --context searchv2 -n devops port-forward service/grafana 3000:3000 &
forward_pids+=("$!")

echo 'GUI:     http://localhost:5080'
echo 'Grafana: http://localhost:3000/d/searchv2 (user: admin)'
echo "Get the password in another terminal:"
echo "kubectl --context searchv2 -n devops get secret grafana-admin -o jsonpath='{.data.password}' | base64 --decode; echo"
echo 'Keep this terminal open. Ctrl+C closes the port-forwards; the cluster stays running.'
wait -n "${forward_pids[@]}"
