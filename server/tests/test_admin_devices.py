"""Integration checks for synthetic devices and admin profile updates."""
from contextlib import closing
import os, sqlite3, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import app, core

class AdminDeviceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.old_db = core.DB_PATH
        core.DB_PATH = os.path.join(cls.tmp.name, 'devices.db')
        core.init_db()
        app.app.testing = True
        cls.client = app.app.test_client()
        cls.tokens = {}
        for role, email, password in [('admin','admin@palmpay.com','Admin@123'), ('merchant','shop@palmpay.com','Shop@123'), ('customer','rahim@palmpay.com','Rahim@123')]:
            res = cls.client.post('/api/auth/login', json={'email':email,'password':password})
            if res.status_code != 200: raise AssertionError(res.json)
            cls.tokens[role] = res.json['token']

    @classmethod
    def tearDownClass(cls):
        core.DB_PATH = cls.old_db
        cls.tmp.cleanup()

    def req(self, role, method, path, data=None):
        return self.client.open(path, method=method, json=data, headers={'Authorization':'Bearer '+self.tokens[role]})

    def test_01_seed_counts_and_access(self):
        users = self.req('admin','GET','/api/admin/users').json['users']
        self.assertEqual(sum(u['role']=='customer' for u in users), 3)
        self.assertEqual(sum(u['role']=='merchant' for u in users), 5)
        response = self.req('admin','GET','/api/admin/devices')
        self.assertTrue(response.json['simulated'])
        self.assertEqual(response.json['simulated_active_count'], 4)
        self.assertEqual(len(response.json['devices']), 5)
        for device in response.json['devices']:
            self.assertIn('merchant_id', device)
            self.assertTrue(-90 <= device['latitude'] <= 90)
            self.assertTrue(-180 <= device['longitude'] <= 180)
        self.assertEqual(self.req('customer','GET','/api/admin/devices').status_code,403)
        self.assertEqual(self.req('merchant','GET','/api/admin/devices').status_code,403)
        self.assertEqual(app.app.test_client().get('/api/admin/devices').status_code,401)

    def test_02_admin_can_update_customer(self):
        res=self.req('admin','PATCH','/api/admin/users/3',{'name':'Rahim Updated','email':'updated@example.org'})
        self.assertEqual(res.status_code, 200)
        users=self.req('admin','GET','/api/admin/users').json['users']
        user=next(u for u in users if u['id']==3)
        self.assertEqual((user['name'],user['email']), ('Rahim Updated','updated@example.org'))

    def test_03_admin_updates_show_in_map_data(self):
        data={'name':'Updated Store Owner','email':'owner@example.org','merchant_shop':'Updated Shop'}
        self.assertEqual(self.req('admin','PATCH','/api/admin/users/2',data).status_code,200)
        device=next(d for d in self.req('admin','GET','/api/admin/devices').json['devices'] if d['merchant_id']==2)
        self.assertEqual((device['merchant_name'],device['merchant_email'],device['merchant_shop']), ('Updated Store Owner','owner@example.org','Updated Shop'))

    def test_04_invalid_updates_and_permissions(self):
        valid={'name':'X','email':'x@example.org'}
        self.assertEqual(self.req('customer','PATCH','/api/admin/users/3',valid).status_code,403)
        self.assertEqual(self.req('merchant','PATCH','/api/admin/users/3',valid).status_code,403)
        self.assertEqual(self.req('admin','PATCH','/api/admin/users/1',valid).status_code,403)
        self.assertEqual(self.req('admin','PATCH','/api/admin/users/9999',valid).status_code,404)
        for data in [{'name':'','email':'x@example.org'}, {'name':'X','email':'bad'}, {'name':123,'email':'x@example.org'}, {'name':'X','email':'x@example.org','role':'admin'}]:
            with self.subTest(data=data): self.assertEqual(self.req('admin','PATCH','/api/admin/users/3',data).status_code,400)
        self.assertEqual(self.req('admin','PATCH','/api/admin/users/2',{'name':'X','email':'x@example.org','merchant_shop':''}).status_code,400)
        self.assertEqual(self.req('admin','PATCH','/api/admin/users/3',{'name':'X','email':'admin@palmpay.com'}).status_code,409)

    def test_05_startup_is_idempotent(self):
        core.init_db()
        users=self.req('admin','GET','/api/admin/users').json['users']
        self.assertEqual(len(users),9)
        self.assertEqual(len(self.req('admin','GET','/api/admin/devices').json['devices']),5)
        self.assertEqual(next(u for u in users if u['id']==3)['name'],'Rahim Updated')
        with closing(sqlite3.connect(core.DB_PATH)) as db:
            for uid,wallet in db.execute('SELECT id,wallet_p FROM users'):
                self.assertEqual(wallet, db.execute('SELECT COALESCE(SUM(delta_p),0) FROM ledger WHERE user_id=?',(uid,)).fetchone()[0])

if __name__ == '__main__': unittest.main()
