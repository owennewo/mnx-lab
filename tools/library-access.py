#!/usr/bin/env python3
"""Operator-only Access bootstrap and D1 membership management (Python 3.11+).
No secret values, API bodies or user emails are logged. No destructive resource actions.
"""
import argparse
import datetime
import json
import os
from pathlib import Path
import re
import subprocess
import tomllib
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parent.parent
ACCOUNT = 'e95cec11beeb0167dcd9f5c034f564ec'
DATABASE = '2e76025c-80d7-40b8-a2dd-c80f051b1867'
TEAM = 'mnx-labs-team.cloudflareaccess.com'
DOMAIN = 'mnx-lab.totai.uk'
INVENTORY = ROOT / 'tools/library-access-resources.json'


def private_read(path):
    path = Path(path)
    if path.is_symlink() or not path.is_file() or path.stat().st_mode & 0o077:
        raise ValueError('Credential must be a regular owner-only file (chmod 600)')
    return path.read_text().strip()


class API:
    def __init__(self, token):
        if not isinstance(token, str) or not re.fullmatch(r'[!-~]{16,8192}', token):
            raise ValueError('Invalid API credential format')
        self.token = token

    def call(self, path, method='GET', body=None):
        request = urllib.request.Request(
            f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/{path}',
            data=None if body is None else json.dumps(body).encode(), method=method,
            headers={'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                data = json.load(response)
        except urllib.error.HTTPError as error:
            raise RuntimeError(f'Cloudflare {method} failed: HTTP {error.code}; response withheld') from None
        if not data.get('success'):
            raise RuntimeError('Cloudflare operation failed; response withheld')
        return data['result']

    def listing(self, path):
        # Paginate explicitly; never mistake a later-page resource for an absent one.
        rows = []
        for page in range(1, 101):
            batch = self.call(f'{path}?page={page}&per_page=100')
            rows.extend(batch)
            if len(batch) < 100:
                return rows
        raise RuntimeError('Resource inventory exceeds operator limit')


def d1_api():
    # Keep Access API scope separate from the existing Wrangler D1 authorization.
    path = Path.home() / '.config/.wrangler/config/default.toml'
    token = os.environ.get('LIBRARY_D1_API_TOKEN') or tomllib.loads(path.read_text()).get('oauth_token')
    if not token:
        raise ValueError('Run wrangler login for D1 operator access')
    return API(token)


def query(api, sql, params=()):
    result = api.call(f'd1/database/{DATABASE}/query', 'POST', {'sql': sql, 'params': list(params)})
    if not result or not result[0].get('success'):
        raise RuntimeError('D1 operation failed')
    return result[0]['results']


def same(actual, expected):
    return all(actual.get(key) == value for key, value in expected.items())


def save_inventory(inventory):
    INVENTORY.write_text(json.dumps(inventory, indent=2) + '\n')


def resource(api, inventory, key, path, expected):
    rows = api.listing(path)
    candidates = [row for row in rows if row.get('id') == inventory.get(key)] if inventory.get(key) else [row for row in rows if row.get('name') == expected['name']]
    if len(candidates) > 1 or (inventory.get(key) and not candidates):
        raise ValueError(f'{key}: missing or ambiguous recorded resource; refusing replacement')
    if candidates:
        row = candidates[0]
        comparison = dict(row)
        # Cloudflare adds its derived callback URL to an otherwise empty OTP config.
        if expected.get('type') == 'onetimepin' and comparison.get('config') == {'redirect_url': 'https://' + TEAM + '/cdn-cgi/access/callback'}:
            comparison['config'] = {}
        if not same(comparison, expected):
            raise ValueError(f'{key}: resource differs from declared configuration; review drift manually')
    else:
        row = api.call(path, 'POST', expected)
    inventory[key] = row['id']
    save_inventory(inventory)
    return row


def sync_users(api, db, inventory):
    app_id = inventory.get('browser')
    if not app_id:
        raise ValueError('Bootstrap Access applications first')
    users = query(db, 'SELECT email FROM users WHERE active=1 ORDER BY email')
    # An empty allowlist uses an impossible conjunction, not an everyone rule.
    policy = {'name': 'MNX active library users', 'decision': 'allow', 'precedence': 1,
              'include': [{'email': {'email': row['email']}} for row in users] or [{'everyone': {}}],
              'exclude': [] if users else [{'everyone': {}}], 'require': []}
    path = f'access/apps/{app_id}/policies'
    rows = api.listing(path)
    if any(row['name'] != policy['name'] for row in rows) or len(rows) > 1:
        raise ValueError('Unexpected browser policy; refusing to broaden access')
    if not rows:
        api.call(path, 'POST', policy)
    elif not same(rows[0], policy) or rows[0].get('session_duration'):
        api.call(path + '/' + rows[0]['id'], 'PUT', policy)
    print('Access allowlist reconciled from active D1 users')


def bootstrap(api, db, inventory, service_file):
    # The operator set the global duration to one month in the dashboard.
    # Bootstrap manages application sessions only; no organization permission needed.
    otp = resource(api, inventory, 'otp', 'access/identity_providers',
                   {'name': 'MNX library email codes', 'type': 'onetimepin', 'config': {}})
    service_path = Path(service_file)
    service_path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    if service_path.parent.stat().st_mode & 0o077:
        raise ValueError('Service credential directory must be owner-only (chmod 700)')
    if service_path.exists():
        credential = json.loads(private_read(service_path))
        live = api.call('access/service_tokens/' + credential['id'])
        if live.get('client_id') != credential['client_id'] or not live.get('enabled', True):
            raise ValueError('Stored service credential differs from live token')
    else:
        if any(t['name'] == 'MNX library ingest' for t in api.listing('access/service_tokens')):
            raise ValueError('Service token exists without its local secret; recover or rotate explicitly')
        credential = api.call('access/service_tokens', 'POST', {'name': 'MNX library ingest', 'duration': '8760h'})
        fd = os.open(service_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as file:
            json.dump({k: credential[k] for k in ['id', 'client_id', 'client_secret']}, file)
    # The more-specific ingest path takes precedence over the browser application.
    common = {'type': 'self_hosted', 'app_launcher_visible': False, 'options_preflight_bypass': False}
    machine = resource(api, inventory, 'machine', 'access/apps', {
        **common, 'name': 'MNX library ingest', 'domain': DOMAIN + '/api/library/ingest',
        'session_duration': '1h', 'service_auth_401_redirect': False})
    machine_policy = {'name': 'MNX ingest service only', 'decision': 'non_identity', 'precedence': 1,
                      'include': [{'service_token': {'token_id': credential['id']}}], 'exclude': [], 'require': []}
    machine_policies = api.listing(f"access/apps/{machine['id']}/policies")
    if any(p['name'] != machine_policy['name'] for p in machine_policies):
        raise ValueError('Unexpected machine policy; refusing mixed authentication')
    resource(api, inventory, 'machine_policy', f"access/apps/{machine['id']}/policies", machine_policy)
    browser = resource(api, inventory, 'browser', 'access/apps', {
        **common, 'name': 'MNX library browser', 'domain': DOMAIN + '/api/library', 'session_duration': '720h',
        'allowed_idps': [otp['id']], 'auto_redirect_to_identity': True})
    sync_users(api, db, inventory)
    variables = {'LIBRARY_ACCESS_ISSUER': 'https://' + TEAM, 'LIBRARY_ACCESS_AUD': browser['aud'],
                 'LIBRARY_INGEST_AUD': machine['aud'], 'LIBRARY_INGEST_CLIENT_ID': credential['client_id']}
    config = ROOT / 'wrangler.jsonc'
    content = config.read_text()
    for key, value in variables.items():
        content, count = re.subn(r'("' + key + r'"\s*:\s*)"[^"]*"', lambda m: m[1] + json.dumps(value), content)
        if count != 1:
            raise ValueError('Expected one Wrangler variable: ' + key)
    config.write_text(content)
    print('Access resources ready; nonsecret IDs recorded. Deploy matching Worker and verify browser/ingest paths.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['bootstrap', 'sync', 'add', 'disable', 'enable'])
    parser.add_argument('--token-file', required=True)
    parser.add_argument('--service-file', help='Persistent owner-only service credential file (defaults to primary checkout .secrets)')
    parser.add_argument('--id')
    parser.add_argument('--email')
    args = parser.parse_args()
    api, db = API(private_read(args.token_file)), d1_api()
    inventory = json.loads(INVENTORY.read_text()) if INVENTORY.exists() else {}
    if args.action == 'bootstrap':
        common = Path(subprocess.check_output(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], cwd=ROOT, text=True).strip())
        service_file = args.service_file or str(common.parent / '.secrets/library-access-service.json')
        bootstrap(api, db, inventory, service_file)
        return
    if args.action in ['add', 'disable', 'enable']:
        if not args.id or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', args.id):
            raise ValueError('Supply a stable --id')
        if args.action == 'add':
            email = (args.email or '').strip().lower()
            if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
                raise ValueError('Supply --email')
            old = query(db, 'SELECT email FROM users WHERE id=?', [args.id])
            if old and old[0]['email'] != email:
                raise ValueError('Existing stable id has another email; refusing reassignment')
            query(db, 'INSERT INTO users(id,email,active,created_at) VALUES (?,?,1,?) ON CONFLICT(id) DO NOTHING',
                  [args.id, email, datetime.datetime.now(datetime.timezone.utc).isoformat()])
        else:
            if not query(db, 'SELECT id FROM users WHERE id=?', [args.id]):
                raise ValueError('Unknown user id')
            query(db, 'UPDATE users SET active=? WHERE id=?', [int(args.action == 'enable'), args.id])
        print('D1 user operation complete; reconciling edge policy next')
    sync_users(api, db, inventory)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Never print an arbitrary exception containing a request/token/user payload.
        if isinstance(error, (ValueError, RuntimeError)):
            print(str(error))
        else:
            print(f'Operator command failed ({type(error).__name__}); details withheld')
        raise SystemExit(1)
