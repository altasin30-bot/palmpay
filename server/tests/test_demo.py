from contextlib import closing
import atexit
import os, tempfile, unittest, sqlite3, sys, datetime
sys.path.insert(0,os.path.dirname(os.path.dirname(__file__)))
tmp=tempfile.TemporaryDirectory(); atexit.register(tmp.cleanup); os.environ['PALMPAY_DB']=os.path.join(tmp.name,'test.db')
import app as mod
import core
# Discovery can import app before this module; always point both names at our temporary DB.
core.DB_PATH = os.path.join(tmp.name, 'test.db')
mod.DB_PATH = core.DB_PATH
mod.init_db()
mod.app.testing=True
class DemoTests(unittest.TestCase):
 def setUp(self):
  self.client=mod.app.test_client()
  self.tokens={}
  for role,email,password in [('customer','rahim@palmpay.com','Rahim@123'),('merchant','shop@palmpay.com','Shop@123'),('admin','admin@palmpay.com','Admin@123')]:
   r=self.client.post('/api/auth/login',json={'email':email,'password':password}); self.assertEqual(r.status_code,200); self.tokens[role]=r.json['token']
 def req(self,role,method,path,data=None):
  return self.client.open(path,method=method,json=data,headers={'Authorization':'Bearer '+self.tokens[role]})
 def balance(self): return self.req('customer','GET','/api/wallet/balance').json['balance']
 def new(self,amount,key,mode='success',**kw): return self.req('merchant','POST','/api/payments/process',{'amount':amount,'customer_id':3,'idempotency_key':key,'mode':mode,**kw})
 def test_01_no_pin_exposure(self):
  u=self.req('customer','GET','/api/auth/me').json['user']; self.assertNotIn('pin',u); self.assertTrue(u['pin_set'])
  users=self.req('admin','GET','/api/admin/users').json['users']; self.assertTrue(all('pin' not in x for x in users))
  with closing(sqlite3.connect(mod.DB_PATH)) as db, db:
   self.assertTrue(db.execute('select pin from users where id=3').fetchone()[0].startswith('$2'))
   self.assertFalse(db.execute('select template from palm_templates').fetchone()[0].startswith('['))
 def test_02_small_payment_idempotency(self):
  self.req('customer','PUT','/api/customer/verification',{'enabled':False})
  before=self.balance(); r=self.new(1000,'small-test-key-0001');self.assertEqual(r.status_code,200);self.assertEqual(r.json['status'],'success')
  same=self.new(1000,'small-test-key-0001');self.assertEqual(same.json['tx_id'],r.json['tx_id']);self.assertEqual(self.balance(),before-1000)
  self.assertEqual(self.new(999,'small-test-key-0001').status_code,409)
 def test_03_approval(self):
  self.req('customer','PUT','/api/customer/verification',{'enabled':True})
  before=self.balance(); r=self.new(1001,'approval-key-00001'); self.assertEqual(r.json['status'],'pending');self.assertNotIn('code',r.json);self.assertEqual(before,self.balance())
  request_id=r.json['request_id']; pending=self.req('customer','GET','/api/payments/pending').json['requests']; code=next(x['code'] for x in pending if x['request_id']==request_id)
  wrong=self.req('merchant','POST',f'/api/payments/{request_id}/confirm',{'code':'bad'});self.assertEqual(wrong.status_code,400);self.assertEqual(self.balance(),before)
  good=self.req('merchant','POST',f'/api/payments/{request_id}/confirm',{'code':code});self.assertEqual(good.json['status'],'success'); self.assertEqual(self.balance(),before-1001)
  repeat=self.req('merchant','POST',f'/api/payments/{request_id}/confirm',{'code':code});self.assertEqual(repeat.json['tx_id'],good.json['tx_id']);self.assertEqual(self.balance(),before-1001)
 def test_04_decline_and_lock(self):
  before=self.balance();r=self.new(1001,'decline-key-00001');rid=r.json['request_id'];self.req('customer','POST',f'/api/payments/{rid}/decline');self.assertEqual(self.req('merchant','POST',f'/api/payments/{rid}/confirm',{'code':'123456'}).json['status'],'declined');self.assertEqual(self.balance(),before)
  r=self.new(1001,'lockout-key-00001');rid=r.json['request_id']
  for i in range(3): self.assertEqual(self.req('merchant','POST',f'/api/payments/{rid}/confirm',{'code':'xxxxxx'}).status_code,400)
  self.assertEqual(self.req('merchant','GET',f'/api/payments/{rid}').json['status'],'cancelled');self.assertEqual(self.balance(),before)
 def test_05_expiry_and_rejections(self):
  r=self.new(1001,'expired-key-00001');rid=r.json['request_id'];
  with closing(sqlite3.connect(mod.DB_PATH)) as db, db: db.execute("update payment_requests set expires_at=? where id=?",('2000-01-01T00:00:00+00:00',rid))
  self.assertEqual(self.req('merchant','GET',f'/api/payments/{rid}').json['status'],'expired')
  for mode in ('unrecognized','poor_lighting'): self.assertEqual(self.new(20,'failed-'+mode+'-000',mode).status_code,400)
  self.assertEqual(self.new('NaN','invalid-amount-0001').status_code,400)
  self.assertEqual(self.req('merchant','POST','/api/payments/process',{'amount':100,'customer_id':3,'idempotency_key':'bypass-test-00001'}).status_code,400)
 def test_06_register_approve_suspend(self):
  r=self.client.post('/api/auth/register',json={'name':'New shop','email':'new@example.org','password':'abc12345','role':'merchant'});self.assertEqual(r.status_code,201);uid=r.json['id']
  self.assertEqual(self.client.post('/api/auth/login',json={'email':'new@example.org','password':'abc12345'}).status_code,403)
  self.assertEqual(self.req('admin','POST',f'/api/admin/users/{uid}/approve').status_code,200)
  self.assertEqual(self.client.post('/api/auth/login',json={'email':'new@example.org','password':'abc12345'}).status_code,200)
  self.assertEqual(self.req('admin','DELETE',f'/api/admin/users/{uid}').status_code,200)
  self.assertEqual(self.client.post('/api/auth/login',json={'email':'new@example.org','password':'abc12345'}).status_code,403)
 def test_07_reenroll_invalid_topup(self):
  self.assertEqual(self.req('customer','POST','/api/palm/enroll',{'samples':[1,2,3]}).status_code,400)
  self.assertEqual(self.req('customer','POST','/api/palm/enroll',{}).status_code,200)
  with closing(sqlite3.connect(mod.DB_PATH)) as db, db:self.assertEqual(db.execute("select count(*) from palm_templates where user_id=3 and status='active'").fetchone()[0],1)
  self.assertEqual(self.req('customer','POST','/api/wallet/topup',{'amount':'abc','idempotency_key':'topup-test-key000'}).status_code,400)
  before=self.balance(); data={'amount':100,'method':'nagad','idempotency_key':'topup-test-key000'}
  self.assertEqual(self.req('customer','POST','/api/wallet/topup',data).status_code,200);self.assertEqual(self.req('customer','POST','/api/wallet/topup',data).status_code,200);self.assertEqual(self.balance(),before+100)
if __name__=='__main__':unittest.main()
