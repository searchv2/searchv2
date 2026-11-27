"""Check startup order and failure handling without changing Docker or Kubernetes."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


class StartupTests(unittest.TestCase):
    def run_start(self, *, existing=False, failure="", empty=False):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            docs = folder / "documents"
            docs.mkdir()
            if not empty:
                (docs / "example.txt").write_text("apple cherry")
            log = folder / "commands.jsonl"
            stub = folder / "stub"
            stub.write_text("""#!/usr/bin/env python3
import json, os, pathlib, sys, time
args = sys.argv[1:]
command = pathlib.Path(sys.argv[0]).name
with open(os.environ['START_LOG'], 'a') as f:
    f.write(json.dumps([command, *args]) + '\\n')
if command == 'kubectl':
    if 'get' in args:
        if 'deployment' in args and os.environ['START_FAILURE'] == 'lookup':
            sys.exit(1)
        if os.environ['START_EXISTING'] == '1':
            print('existing-resource')
    if '--for=condition=complete' in args and os.environ['START_FAILURE'] == 'index':
        sys.exit(1)
    if 'port-forward' in args:
        time.sleep(0.2)
""")
            stub.chmod(0o755)
            for tool in ["docker", "minikube", "kubectl", "helm"]:
                (folder / tool).symlink_to(stub)
            env = dict(os.environ, PATH=str(folder) + os.pathsep + os.environ["PATH"],
                       START_LOG=str(log), START_EXISTING=str(int(existing)), START_FAILURE=failure)
            result = subprocess.run(["bash", str(Path(__file__).with_name("start.sh")), str(docs)],
                                    env=env, capture_output=True, text=True, timeout=15)
            commands = [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []
            return result, [" ".join(command) for command in commands]

    def test_first_start(self):
        result, commands = self.run_start()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(any("create secret generic grafana-admin" in c for c in commands))
        self.assertTrue(any("create secret generic redis-credentials" in c for c in commands))
        self.assertTrue(any("create secret generic rabbitmq-credentials" in c for c in commands))
        self.assertTrue(any("-n database create secret generic postgresql-credentials" in c for c in commands))
        self.assertTrue(any("-n searchv2 create secret generic postgresql-credentials" in c for c in commands))
        self.assertTrue(any(c.startswith("helm --kube-context searchv2 upgrade --install postgresql-db") for c in commands))
        index = next(i for i, c in enumerate(commands) if "--for=condition=complete" in c)
        redis_restart = next(i for i, c in enumerate(commands) if "rollout restart deployment/redis" in c)
        apps = next(i for i, c in enumerate(commands) if "apply -f k8s/apps.yaml" in c)
        self.assertLess(index, redis_restart)
        self.assertLess(redis_restart, apps)
        # The message bus is up before the pipeline starts, and the workers are ready before the Job is awaited.
        bus = next(i for i, c in enumerate(commands) if "rollout status deployment/rabbitmq" in c)
        pipeline = next(i for i, c in enumerate(commands) if "apply -f k8s/indexer.yaml" in c)
        writers = next(i for i, c in enumerate(commands) if "rollout status deployment/indexer-writer" in c)
        self.assertLess(bus, pipeline)
        self.assertLess(writers, index)
        self.assertEqual(sum("port-forward" in c for c in commands), 3)
        self.assertEqual(sum(c.startswith("docker save searchv2-") for c in commands), 3)
        self.assertEqual(commands.count("minikube image load -p searchv2 -"), 3)
        self.assertFalse(any("load-balancer" in c or "consolesearch" in c.lower() for c in commands))

    def test_restart_stops_api_before_copy_and_reuses_secret(self):
        result, commands = self.run_start(existing=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(any("create secret" in c for c in commands))
        stopped = next(i for i, c in enumerate(commands) if "--for=delete pod" in c)
        copied = next(i for i, c in enumerate(commands) if c.startswith("minikube cp"))
        self.assertLess(stopped, copied)

    def test_index_failure_does_not_start_apps(self):
        result, commands = self.run_start(existing=True, failure="index")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(any("apply -f k8s/apps.yaml" in c or "port-forward" in c for c in commands))

    def test_failed_deployment_lookup_does_not_copy_or_index(self):
        result, commands = self.run_start(existing=True, failure="lookup")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(any(c.startswith("minikube cp") or "apply -f k8s/indexer.yaml" in c for c in commands))

    def test_empty_source_fails_before_starting_cluster(self):
        result, commands = self.run_start(empty=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(commands, [])


if __name__ == "__main__":
    unittest.main()
