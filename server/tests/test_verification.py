from contextlib import closing
import os, sqlite3, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import app, core

class VerificationTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); core.DB_PATH=os.path.join(self.tmp.name,'demo.db'); core.init_db()
        app.app.testing=True; self.client=app.app.test_client(); self.tokens={}
        for role,email,password in [('customer','rahim@palmpay.com','Rahim@123'),('customer2','ayesha@palmpay.com','Demo@123'),('merchant','shop@palmpay.com','Shop@123'),('admin','admin@palmpay.com','Admin@123')]:
            response=self.client.post('/api/auth/login',json={'email':email,'password':password}); self.assertEqual(response.status_code,200); self.tokens[role]=response.json['token']
    def tearDown(self): self.tmp.cleanup()
    def req(self,role,method,path,data=None):
        return self.client.open(path,method=method,json=data,headers={'Authorization':'Bearer '+self.tokens[role]})
    def toggle(self,value): return self.req('customer','PUT','/api/customer/verification',{'enabled':value})
    def pay(self,amount,key,mode='success'):
        return self.req('merchant','POST','/api/payments/process',{'customer_id':3,'amount':amount,'description':'Demo','mode':mode,'idempotency_key':key})
    def balance(self): return self.req('customer','GET','/api/wallet/balance').json['balance']
    def test_default_on_for_small_and_large_payment(self):
        self.assertEqual(self.req('customer','GET','/api/customer/verification').json,{'enabled':True})
        for amount,key in [(10,'verification-small-001'),(1200,'verification-large-001')]:
            before=self.balance(); r=self.pay(amount,key); self.assertEqual(r.json['status'],'pending'); self.assertNotIn('code',r.json); self.assertEqual(self.balance(),before)
            rid=r.json['request_id']; requests=self.req('customer','GET','/api/payments/pending').json['requests']; code=next(x['code'] for x in requests if x['request_id']==rid)
            self.assertEqual(len(code),6); self.assertEqual(self.req('merchant','POST',f'/api/payments/{rid}/confirm',{'code':code}).json['status'],'success'); self.assertEqual(self.balance(),before-amount)
    def test_off_on_persistence_isolation_and_idempotency(self):
        self.assertEqual(self.toggle(False).json,{'enabled':False}); core.init_db()
        self.assertEqual(self.req('customer','GET','/api/customer/verification').json,{'enabled':False})
        self.assertEqual(self.req('customer2','GET','/api/customer/verification').json,{'enabled':True})
        before=self.balance(); r=self.pay(1200,'verification-off-0001'); self.assertEqual(r.json['status'],'success'); self.assertEqual(self.balance(),before-1200)
        self.assertEqual(self.req('customer','GET','/api/payments/pending').json['requests'],[])
        self.toggle(True); self.assertEqual(self.pay(1200,'verification-off-0001').json['tx_id'],r.json['tx_id']); self.assertEqual(self.balance(),before-1200)
        self.assertEqual(self.pay(2,'verification-on-again01').json['status'],'pending')
    def test_pending_request_keeps_original_rule(self):
        before=self.balance(); r=self.pay(25,'old-pending-request01'); rid=r.json['request_id']; self.assertEqual(r.json['status'],'pending')
        self.toggle(False); pending=self.req('customer','GET','/api/payments/pending').json['requests']; code=next(x['code'] for x in pending if x['request_id']==rid)
        self.assertEqual(self.balance(),before); self.assertEqual(self.req('merchant','POST',f'/api/payments/{rid}/confirm',{'code':code}).json['status'],'success')
    def test_off_still_requires_pin_after_failed_scan(self):
        self.toggle(False); before=self.balance(); self.assertEqual(self.pay(10,'failure-scan-key001','poor_lighting').status_code,400)
        r=self.pay(10,'pin-off-fallback-001','pin_fallback'); self.assertEqual(r.json['status'],'pending'); self.assertTrue(r.json['pin_required']); rid=r.json['request_id']; self.assertEqual(self.balance(),before)
        self.assertEqual(self.req('customer','POST',f'/api/payments/{rid}/verify-pin',{'pin':'1234'}).status_code,200); self.assertEqual(self.balance(),before-10)
        self.assertEqual(self.req('merchant','GET',f'/api/payments/{rid}').json['status'],'success')
    def test_access_validation_and_legacy_admin_threshold(self):
        for role in ['merchant','admin']:
            self.assertEqual(self.req(role,'GET','/api/customer/verification').status_code,403)
            self.assertEqual(self.req(role,'PUT','/api/customer/verification',{'enabled':False}).status_code,403)
        self.assertEqual(app.app.test_client().get('/api/customer/verification').status_code,401)
        for payload in [{}, {'enabled':0}, {'enabled':'false'}, {'enabled':False,'id':4}]:
            self.assertEqual(self.req('customer','PUT','/api/customer/verification',payload).status_code,400)
        self.assertTrue(self.req('customer','GET','/api/customer/verification').json['enabled'])
        settings=self.req('admin','GET','/api/admin/settings').json; self.assertNotIn('approval_threshold_p',settings)
        self.assertEqual(self.req('admin','POST','/api/admin/settings',{'approval_threshold_p':0}).status_code,400)
    def test_existing_database_migration_defaults_on(self):
        with closing(sqlite3.connect(core.DB_PATH)) as db, db:
            before=db.execute('SELECT COUNT(*) FROM users').fetchone()[0]
            db.execute('ALTER TABLE users DROP COLUMN verification_enabled')
        core.init_db()
        with closing(sqlite3.connect(core.DB_PATH)) as db, db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM users').fetchone()[0],before)
            self.assertEqual(db.execute('SELECT verification_enabled FROM users WHERE id=3').fetchone()[0],1)
    def test_reset_restores_default_on(self):
        self.toggle(False); self.assertEqual(self.req('admin','POST','/api/admin/reset-demo',{'confirm':'RESET DEMO'}).status_code,200)
        r=self.client.post('/api/auth/login',json={'email':'rahim@palmpay.com','password':'Rahim@123'}); self.tokens['customer']=r.json['token']
        self.assertTrue(self.req('customer','GET','/api/customer/verification').json['enabled'])
if __name__=='__main__': unittest.main()
