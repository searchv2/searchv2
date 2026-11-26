#!/usr/bin/env bash
# Failed release and rollback demo for search-api (M8.02, "Barrier conditions & rollback").
#
# 1. Release a version whose image does not exist.
# 2. Show that the rollout stalls but the old pods keep serving (maxSurge 1, maxUnavailable 0,
#    readiness probes), by sending searches the whole time.
# 3. Roll back with `rollout undo` and show the history with change causes.
#
# Needs the cluster from start.sh. Takes about two minutes. Always restores the original image.
set -euo pipefail

ctx=searchv2
ns=searchv2
dep=deployment/search-api
port=5099
k() { kubectl --context "$ctx" -n "$ns" "$@"; }

good=$(k get "$dep" -o jsonpath='{.spec.template.spec.containers[0].image}')
bad=searchv2-search-api:does-not-exist
work=$(mktemp -d)
probe_pid=
forward_pid=

cleanup() {
  [[ -n "$probe_pid" ]] && kill "$probe_pid" 2>/dev/null || true
  [[ -n "$forward_pid" ]] && kill "$forward_pid" 2>/dev/null || true
  current=$(k get "$dep" -o jsonpath='{.spec.template.spec.containers[0].image}')
  if [[ "$current" != "$good" ]]; then
    echo "Restoring $good"
    k annotate "$dep" kubernetes.io/change-cause="demo cleanup: restore $good" --overwrite > /dev/null
    k set image "$dep" "search-api=$good"
    k rollout status "$dep" --timeout=180s
  fi
  rm -rf "$work"
}
trap cleanup EXIT

step() { printf '\n=== %s\n' "$*"; }

step "0. Current state (image $good)"
k rollout status "$dep" --timeout=60s
k get pods -l app=search-api
k rollout history "$dep"

# A search every 0.2 s through the Service; one line per request: HTTP status and answering pod.
k port-forward service/search-api "$port:8080" > /dev/null 2>&1 &
forward_pid=$!
sleep 3
(
  while true; do
    curl -s -o /dev/null -m 5 -w '%{http_code} %header{x-served-by}\n' \
      -H 'Content-Type: application/json' -d '{"Query":["enron"],"CaseSensitive":false}' \
      "http://localhost:$port/api/Search" || echo "000 -"
    sleep 0.2
  done
) > "$work/probe.log" &
probe_pid=$!

step "1. Bad release: image tag that does not exist"
k annotate "$dep" kubernetes.io/change-cause="demo: release $bad (broken on purpose)" --overwrite
k set image "$dep" "search-api=$bad"
echo "Waiting 40 s for the rollout to stall..."
sleep 40
k get pods -l app=search-api
echo "Service endpoints (only Ready pods receive traffic; the broken pod is not among them):"
k get endpoints search-api
if k rollout status "$dep" --timeout=20s; then
  echo "UNEXPECTED: the broken release completed" >&2
else
  echo "As expected: the rollout does not complete. The new pod cannot start, the old pods stay Ready."
fi

step "2. Did users notice? Requests sent during the bad release"
sort "$work/probe.log" | awk '{print $1}' | uniq -c
echo "(The port-forward pins to one pod, so this shows that pod stayed up; the endpoints above show both did.)"

step "3. Roll back"
k rollout undo "$dep"
k annotate "$dep" kubernetes.io/change-cause="rollback: back to $good after the broken release" --overwrite
k rollout status "$dep" --timeout=180s
k get pods -l app=search-api

step "4. History (change causes) and the whole run"
k rollout history "$dep"
echo "Requests during the whole demo (HTTP status):"
sort "$work/probe.log" | awk '{print $1}' | uniq -c
echo "Image now: $(k get "$dep" -o jsonpath='{.spec.template.spec.containers[0].image}')"
