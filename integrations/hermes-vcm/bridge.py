#!/usr/bin/env python3
"""Small stdio MCP adapter for the VcM API; never connects to PostgreSQL."""
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

RESOURCES = frozenset({
    "cases", "plans", "decisions", "projects", "campaigns", "contents",
    "editorial-packages", "cuts", "organizations", "contacts", "agreements",
    "resources", "indicators",
})
SUMMARIES = frozenset({"overview", "control", "reports"})
ID = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
PROFILE = os.environ.get("VCM_PROFILE", "")
if PROFILE not in ("interview", "coordination"):
    raise SystemExit("VCM_PROFILE must be interview or coordination")
BASE = os.environ.get("VCM_API_URL", "http://127.0.0.1:32800").rstrip("/")
if not (
    BASE.startswith("http://127.0.0.1:")
    or BASE.startswith("http://localhost:")
    or BASE == "http://vcm-api-api-1:3000"
    or BASE.startswith("https://")
):
    raise SystemExit("VCM_API_URL must use loopback, the private API service or HTTPS")
TOKEN_FILE = Path(os.environ["VCM_CREDENTIAL_FILE"])
if TOKEN_FILE.stat().st_mode & 0o077:
    raise SystemExit("VCM_CREDENTIAL_FILE must be private (0600)")
TOKEN = json.loads(TOKEN_FILE.read_text())["token"]
INTERVIEW_COMMANDS = frozenset({"createCase", "setField", "setFields", "addEvidence"})


def call_api(method, path, body=None):
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode()
    req = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={
            "Authorization": "Bearer " + TOKEN,
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=20) as response:
            return json.loads(response.read(2_000_000))
    except urllib.error.HTTPError as error:
        payload = error.read(8192).decode("utf-8", "replace")
        return {"httpStatus": error.code, "error": payload}


def required_id(value):
    if not isinstance(value, str) or not ID.fullmatch(value):
        raise ValueError("Invalid resource ID")
    return value


def execute(name, args):
    if name == "vcm_contract":
        catalog = call_api("GET", "/v1/catalog")
        if PROFILE == "interview" or "httpStatus" in catalog:
            if isinstance(catalog, dict) and "commands" in catalog:
                catalog["commands"] = [c for c in catalog["commands"]
                                       if c["name"] in INTERVIEW_COMMANDS]
            return {"catalog": catalog}
        return {"catalog": catalog,
                "openapi": call_api("GET", "/v1/openapi.json")}
    if name == "vcm_query":
        return call_api("POST", "/v1/query", args["query"])
    if name == "vcm_read":
        resource = args["resource"]
        if resource not in RESOURCES | SUMMARIES:
            raise ValueError("Resource is not exposed by this adapter")
        if PROFILE == "interview" and resource != "cases":
            raise ValueError("Resource unavailable to interviewer")
        if resource in SUMMARIES | {"indicators"} and args.get("id") is not None:
            raise ValueError("This resource has no detail route")
        path = "/v1/" + resource
        if args.get("id") is not None:
            path += "/" + required_id(args["id"])
        elif resource not in SUMMARIES | {"indicators"}:
            limit = args.get("limit", 25)
            if not isinstance(limit, int) or not 1 <= limit <= 100:
                raise ValueError("limit must be 1..100")
            params = {"limit": limit}
            if args.get("cursor"):
                params["cursor"] = args["cursor"]
            path += "?" + urllib.parse.urlencode(params)
        return call_api("GET", path)
    if name == "vcm_write":
        resource = args["resource"]
        if resource not in RESOURCES:
            raise ValueError("Resource is not exposed by this adapter")
        if PROFILE == "interview" and resource != "cases":
            raise ValueError("Resource unavailable to interviewer")
        envelope = args["request"]
        if not isinstance(envelope, dict) or set(envelope) != {"command", "expectedVersion", "idempotencyKey"}:
            raise ValueError("Expected command, expectedVersion and idempotencyKey")
        if not isinstance(envelope["expectedVersion"], int) or envelope["expectedVersion"] < 0:
            raise ValueError("Invalid expectedVersion")
        if not isinstance(envelope["idempotencyKey"], str) or len(envelope["idempotencyKey"]) < 8:
            raise ValueError("Invalid idempotencyKey")
        command = envelope["command"]
        if not isinstance(command, dict):
            raise ValueError("command must be an object")
        if PROFILE == "interview" and command.get("type") not in INTERVIEW_COMMANDS:
            raise ValueError("Interviewer may only capture antecedents")
        path = "/v1/" + resource
        if args.get("id") is not None:
            path += "/" + required_id(args["id"]) + "/commands"
        elif resource == "indicators":
            raise ValueError("Indicator commands require an ID")
        return call_api("POST", path, envelope)
    raise ValueError("Unknown tool")


def tool(name, description, properties, required):
    return {"name": name, "description": description,
            "inputSchema": {"type": "object", "properties": properties,
                            "required": required, "additionalProperties": False}}


TOOLS = [
    tool("vcm_contract", "Read the authorized live VcM catalog and, for Coordination, OpenAPI before queries or writes.", {}, []),
    tool("vcm_query", "Run an authorized semantic query; SQL is never accepted.", {"query": {"type": "object"}}, ["query"]),
    tool("vcm_read", "Read one authorized resource or a paginated collection.", {
        "resource": {"type": "string"}, "id": {"type": "string"},
        "limit": {"type": "integer"}, "cursor": {"type": "string"}}, ["resource"]),
    tool("vcm_write", "Create or command a resource with expected version and idempotency key; API enforces authority.", {
        "resource": {"type": "string"}, "id": {"type": "string"},
        "request": {"type": "object"}}, ["resource", "request"]),
]


def respond(message):
    sys.stdout.write(json.dumps(message, ensure_ascii=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()


for line in sys.stdin:
    try:
        message = json.loads(line)
        method = message.get("method")
        if method == "notifications/initialized":
            continue
        if method == "initialize":
            result = {"protocolVersion": "2025-06-18", "capabilities": {"tools": {}},
                      "serverInfo": {"name": "vcm-api", "version": "0.1.0"}}
        elif method == "tools/list":
            result = {"tools": TOOLS}
        elif method == "tools/call":
            params = message.get("params") or {}
            output = execute(params["name"], params.get("arguments") or {})
            result = {"content": [{"type": "text", "text": json.dumps(output, ensure_ascii=False)}],
                      "isError": isinstance(output, dict) and "httpStatus" in output}
        else:
            raise ValueError("Unsupported MCP method")
        if "id" in message:
            respond({"jsonrpc": "2.0", "id": message["id"], "result": result})
    except Exception as error:
        if "id" in message:
            respond({"jsonrpc": "2.0", "id": message["id"], "error": {
                "code": -32603, "message": str(error)}})
