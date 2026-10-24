#!/usr/bin/env python3
"""Add VcM MCP transport to each existing Hermes profile without rewriting other keys."""
from pathlib import Path
import os
import re

ROOT = Path(os.environ.get('VCM_HERMES_ROOT', '/docker/hermes-agent-o8ot/data'))
PROFILES = {
    'coordination': (ROOT / 'config.yaml', ROOT / 'vcm-api-credential.json'),
    'interview': (
        ROOT / 'profiles/vcm-entrevistas/config.yaml',
        ROOT / 'profiles/vcm-entrevistas/vcm-api-credential.json',
    ),
}


def configure(profile, path, credential):
    original = path.read_text()
    if re.search(r'^  vcm_api:', original, re.M):
        raise SystemExit(f'vcm_api already configured in {path}')
    entry = f'''  vcm_api:
    command: python3
    args: [/opt/data/tools/vcm-backend/bridge.py]
    env:
      VCM_PROFILE: {profile}
      VCM_API_URL: http://vcm-api-api-1:3000
      VCM_CREDENTIAL_FILE: {credential.as_posix().replace(ROOT.as_posix(), '/opt/data')}
    tools:
      include: [vcm_contract, vcm_query, vcm_read, vcm_write]
'''
    if 'mcp_servers: {}' in original:
        updated = original.replace('mcp_servers: {}', 'mcp_servers:\n' + entry, 1)
    else:
        match = re.search(r'^mcp_servers:\s*\n', original, re.M)
        if not match:
            raise SystemExit(f'mcp_servers section missing in {path}')
        next_root = re.search(r'^[A-Za-z_][^\n]*:', original[match.end():], re.M)
        insert_at = match.end() + (next_root.start() if next_root else len(original[match.end():]))
        updated = original[:insert_at] + entry + original[insert_at:]
    path.write_text(updated)
    print(f'Configured {profile} in {path}')


for name, (config, credential) in PROFILES.items():
    if not credential.is_file():
        raise SystemExit(f'Credential missing: {credential}')
    configure(name, config, credential)
