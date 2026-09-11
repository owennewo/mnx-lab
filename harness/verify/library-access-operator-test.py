"""No-network regression checks for Access bootstrap idempotence and drift refusal."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('access_operator', Path(__file__).parents[2] / 'tools/library-access.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FakeAPI:
    def __init__(self):
        self.rows = {}
        self.writes = []
    def listing(self, path):
        return self.rows.get(path, [])
    def call(self, path, method='GET', body=None):
        self.writes.append((path, method, body))
        row = dict(body, id='resource-' + str(len(self.writes)))
        self.rows.setdefault(path, []).append(row)
        return row


class ResourceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.inventory = patch.object(module, 'INVENTORY', Path(self.temp.name) / 'inventory.json')
        self.inventory.start()
    def tearDown(self):
        self.inventory.stop()
        self.temp.cleanup()
    def test_repeated_bootstrap_resource_is_noop(self):
        api = FakeAPI(); inventory = {}
        expected = {'name': 'library', 'type': 'self_hosted', 'domain': 'test/api/library'}
        first = module.resource(api, inventory, 'browser', 'access/apps', expected)
        second = module.resource(api, inventory, 'browser', 'access/apps', expected)
        self.assertEqual(first, second)
        self.assertEqual(len(api.writes), 1)
        self.assertEqual(json.loads(module.INVENTORY.read_text()), inventory)
    def test_otp_derived_callback_is_not_configuration_drift(self):
        api = FakeAPI()
        expected = {'name': 'email', 'type': 'onetimepin', 'config': {}}
        api.rows['access/identity_providers'] = [dict(expected, id='otp', config={'redirect_url': 'https://' + module.TEAM + '/cdn-cgi/access/callback'})]
        module.resource(api, {'otp': 'otp'}, 'otp', 'access/identity_providers', expected)
        self.assertEqual(api.writes, [])

    def test_missing_committed_resource_never_recreated(self):
        api = FakeAPI()
        with self.assertRaises(ValueError):
            module.resource(api, {'browser': 'missing'}, 'browser', 'access/apps', {'name': 'library'})
        self.assertEqual(api.writes, [])
    def test_drift_and_ambiguous_names_stop(self):
        for rows in [[{'name': 'library', 'domain': 'wrong', 'id': 'one'}], [{'name': 'library', 'id': 'one'}, {'name': 'library', 'id': 'two'}]]:
            api = FakeAPI(); api.rows['access/apps'] = rows
            with self.assertRaises(ValueError):
                module.resource(api, {}, 'browser', 'access/apps', {'name': 'library', 'domain': 'expected'})
            self.assertEqual(api.writes, [])
    def test_empty_users_policy_denies_everyone(self):
        api = FakeAPI()
        with patch.object(module, 'query', return_value=[]):
            module.sync_users(api, None, {'browser': 'app'})
        policy = api.writes[0][2]
        self.assertEqual(policy['exclude'], [{'everyone': {}}])
        self.assertNotIn('session_duration', policy)
    def test_extra_policy_is_not_silently_kept(self):
        api = FakeAPI(); api.rows['access/apps/app/policies'] = [{'name': 'Everyone allowed'}]
        with patch.object(module, 'query', return_value=[{'email': 'test@example.test'}]):
            with self.assertRaises(ValueError):
                module.sync_users(api, None, {'browser': 'app'})
        self.assertEqual(api.writes, [])
    def test_world_readable_credential_rejected(self):
        file = Path(self.temp.name) / 'credential'
        file.write_text('synthetic-only'); file.chmod(0o644)
        with self.assertRaises(ValueError): module.private_read(file)
        file.chmod(0o600)
        self.assertEqual(module.private_read(file), 'synthetic-only')


if __name__ == '__main__':
    unittest.main()
