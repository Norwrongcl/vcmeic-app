import json
import os
import subprocess
import sys
import tempfile
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

BRIDGE = Path(__file__).with_name("bridge.py")


class BridgeTests(unittest.TestCase):
    def invoke(self, profile, request, api_url=None):
        with tempfile.TemporaryDirectory() as directory:
            credential = Path(directory) / "credential.json"
            credential.write_text(json.dumps({"token": "test-token"}))
            credential.chmod(0o600)
            env = {**os.environ, "VCM_PROFILE": profile,
                   "VCM_CREDENTIAL_FILE": str(credential)}
            if api_url:
                env["VCM_API_URL"] = api_url
            result = subprocess.run(
                [sys.executable, str(BRIDGE)], input=json.dumps(request) + "\n",
                text=True, capture_output=True, env=env, check=True,
            )
            self.assertNotIn("test-token", result.stdout + result.stderr)
            return json.loads(result.stdout)

    def test_exposes_only_four_tools(self):
        result = self.invoke("interview", {"jsonrpc": "2.0", "id": 1,
                                           "method": "tools/list"})
        self.assertEqual({t["name"] for t in result["result"]["tools"]},
                         {"vcm_contract", "vcm_query", "vcm_read", "vcm_write"})

    def test_interview_cannot_read_governance_resource(self):
        result = self.invoke("interview", {"jsonrpc": "2.0", "id": 2,
            "method": "tools/call", "params": {"name": "vcm_read",
            "arguments": {"resource": "decisions"}}})
        self.assertIn("unavailable", result["error"]["message"])

    def test_interview_cannot_approve(self):
        result = self.invoke("interview", {"jsonrpc": "2.0", "id": 3,
            "method": "tools/call", "params": {"name": "vcm_write",
            "arguments": {"resource": "cases", "id": "case1", "request": {
                "command": {"type": "transition", "caseId": "case1"},
                "expectedVersion": 1, "idempotencyKey": "unique-key-123"}}}})
        self.assertIn("capture", result["error"]["message"])

    def test_catalog_uses_bearer_without_exposing_token(self):
        observed = []

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                observed.append((self.path, self.headers.get("Authorization")))
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"version":"test"}')

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        worker = Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            result = self.invoke("coordination", {"jsonrpc": "2.0", "id": 4,
                "method": "tools/call", "params": {"name": "vcm_contract"}},
                f"http://127.0.0.1:{server.server_port}")
        finally:
            server.shutdown()
            worker.join()
            server.server_close()
        self.assertEqual(result["result"]["content"][0]["type"], "text")
        self.assertEqual([path for path, _ in observed],
                         ["/v1/catalog", "/v1/openapi.json"])
        self.assertEqual({auth for _, auth in observed}, {"Bearer test-token"})

    def test_interview_capture_posts_envelope_to_case_route(self):
        observed = []

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                observed.append((self.path, body, self.headers.get("Authorization")))
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"version":2}')

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        worker = Thread(target=server.serve_forever, daemon=True)
        worker.start()
        request = {"command": {"type": "setField", "caseId": "case1",
                               "fieldId": "name", "value": "Test"},
                   "expectedVersion": 1, "idempotencyKey": "capture-123"}
        try:
            result = self.invoke("interview", {"jsonrpc": "2.0", "id": 5,
                "method": "tools/call", "params": {"name": "vcm_write",
                "arguments": {"resource": "cases", "id": "case1",
                              "request": request}}},
                f"http://127.0.0.1:{server.server_port}")
        finally:
            server.shutdown()
            worker.join()
            server.server_close()
        self.assertEqual(observed,
                         [("/v1/cases/case1/commands", request, "Bearer test-token")])
        self.assertEqual(json.loads(result["result"]["content"][0]["text"]),
                         {"version": 2})


if __name__ == "__main__":
    unittest.main()
