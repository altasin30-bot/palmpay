from contextlib import closing
import os,sys,tempfile,unittest,sqlite3,datetime
sys.path.insert(0,os.path.dirname(os.path.dirname(__file__)))
import app, core
class FeatureTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();core.DB_PATH=os.path.join(self.tmp.name,'db.sqlite');core.init_db();app.app.testing=True;self.c=app.app.test_client();self.tokens={}
  for role,email,pw in [('customer','rahim@palmpay.com','Rahim@123'),('merchant','shop@palmpay.com','Shop@123'),('admin','admin@palmpay.com','Admin@123')]:
   r=self.c.post('/api/auth/login',json={'email':email,'password':pw});self.assertEqual(r.status_code,200);self.tokens[role]=r.json['token']
 def tearDown(self):self.tmp.cleanup()
 def req(self,role,method,path,data=None):return self.c.open(path,method=method,json=data,headers={'Authorization':'Bearer '+self.tokens[role]})
 def payment(self,amount,key,mode='success'):return self.req('merchant','POST','/api/payments/process',{'amount':amount,'customer_id':3,'mode':mode,'idempotency_key':key})
 def bal(self):return self.req('customer','GET','/api/wallet/balance').json['balance']
 def test_pin_fallback(self):
  self.req('customer','PUT','/api/customer/verification',{'enabled':False})
  self.assertEqual(self.payment(500,'scan-fail-key0001','poor_lighting').status_code,400)
  fallback=self.payment(500,'fallback-key-0001','pin_fallback');self.assertEqual(fallback.json['status'],'pending');rid=fallback.json['request_id'];self.assertEqual(self.bal(),5000)
  self.assertEqual(self.req('merchant','POST',f'/api/payments/{rid}/confirm',{'code':'123456'}).status_code,400)
  self.assertEqual(self.req('customer','POST',f'/api/payments/{rid}/verify-pin',{'pin':'1111'}).status_code,400)
  self.assertEqual(self.req('customer','POST',f'/api/payments/{rid}/verify-pin',{'pin':'1234'}).status_code,200);self.assertEqual(self.bal(),4500)
  self.assertEqual(self.req('merchant','GET',f'/api/payments/{rid}').json['status'],'success')
 def test_large_pin_fallback_and_code(self):
  self.payment(1200,'failed-large-key1','unrecognized')
  r=self.payment(1200,'fallback-large001','pin_fallback');rid=r.json['request_id']
  before=self.req('customer','GET','/api/payments/pending').json['requests'][0];self.assertTrue(before['pin_required']);self.assertIsNone(before['code'])
  self.assertEqual(self.req('customer','POST',f'/api/payments/{rid}/verify-pin',{'pin':'1234'}).status_code,200)
  after=self.req('customer','GET','/api/payments/pending').json['requests'][0];self.assertIsNotNone(after['code']);self.assertEqual(self.bal(),5000)
  self.assertEqual(self.req('merchant','POST',f'/api/payments/{rid}/confirm',{'code':after['code']}).json['status'],'success');self.assertEqual(self.bal(),3800)
 def test_pin_failure_cancels(self):
  self.payment(500,'failed-pin-key001','poor_lighting');r=self.payment(500,'wrong-pin-key0001','pin_fallback');rid=r.json['request_id']
  for i in range(3):self.assertEqual(self.req('customer','POST',f'/api/payments/{rid}/verify-pin',{'pin':'0000'}).status_code,400)
  self.assertEqual(self.req('merchant','GET',f'/api/payments/{rid}').json['status'],'cancelled');self.assertEqual(self.bal(),5000)
 def test_limits_and_settings(self):
  self.assertEqual(self.req('admin','POST','/api/admin/settings',{'per_payment_limit_p':10000,'daily_limit_p':15000}).status_code,200)
  self.assertEqual(self.payment(101,'over-limit-key001').status_code,400)
  r=self.payment(60,'limit-test-key001');self.assertEqual(r.json['status'],'pending')
  rid=r.json['request_id'];code=self.req('customer','GET','/api/payments/pending').json['requests'][0]['code']
  self.assertEqual(self.req('merchant','POST',f'/api/payments/{rid}/confirm',{'code':code}).json['status'],'success')
  self.assertEqual(self.payment(100,'daily-limit-key01').status_code,400)
  self.req('admin','POST','/api/admin/settings',{'scanner_mode':'real'});self.assertEqual(self.payment(1,'real-mode-test001').status_code,503)
 def test_refund_payout_ledger(self):
  self.req('customer','PUT','/api/customer/verification',{'enabled':False})
  r=self.payment('700.10','payment-one-key01');tx=r.json['tx_id']
  self.assertEqual(self.req('merchant','POST','/api/merchant/payout',{'amount':'100.05','idempotency_key':'payout-test-key01'}).status_code,200)
  self.assertEqual(self.req('merchant','POST',f'/api/merchant/refunds/{tx}').status_code,400)
  self.payment(200,'payment-two-key01')
  first=self.req('merchant','POST',f'/api/merchant/refunds/{tx}');second=self.req('merchant','POST',f'/api/merchant/refunds/{tx}')
  self.assertEqual(first.json['tx_id'],second.json['tx_id']);self.assertAlmostEqual(self.bal(),4800)
  with closing(sqlite3.connect(core.DB_PATH)) as db, db:
   for uid,wallet in db.execute('SELECT id,wallet_p FROM users'):
    total=db.execute('SELECT COALESCE(SUM(delta_p),0) FROM ledger WHERE user_id=?',(uid,)).fetchone()[0];self.assertEqual(wallet,total)
 def test_lock_report_reset(self):
  for i in range(3):self.assertEqual(self.payment(1,'failure-key-000'+str(i),'poor_lighting').status_code,400)
  self.assertEqual(len(self.req('admin','GET','/api/admin/scan-alerts').json['alerts']),1)
  self.assertEqual(self.req('admin','POST','/api/admin/users/3/unlock').status_code,200)
  year=datetime.datetime.now(core.ZoneInfo('Asia/Dhaka')).year;analytics=self.req('admin','GET',f'/api/admin/analytics?start={year}-01-01&end={year}-12-31');self.assertEqual(analytics.status_code,200);self.assertEqual(analytics.json['failed'],3)
  self.assertEqual(self.req('admin','POST','/api/admin/reset-demo',{'confirm':'RESET DEMO'}).status_code,200)
  self.assertEqual(self.req('customer','GET','/api/wallet/balance').status_code,401)
  login=self.c.post('/api/auth/login',json={'email':'rahim@palmpay.com','password':'Rahim@123'});self.assertEqual(login.status_code,200)
  self.tokens['customer']=login.json['token'];self.assertEqual(self.bal(),5000)
 def test_without_system_timezone_data(self):
  # Windows commonly lacks system IANA data. This must work via the tzdata package.
  import zoneinfo
  original=zoneinfo.TZPATH
  try:
   zoneinfo.ZoneInfo.clear_cache();zoneinfo.reset_tzpath([])
   r=self.payment(1200,'windows-tzdata-test-0001')
   self.assertEqual(r.status_code,200);self.assertEqual(r.json['status'],'pending')
   pending=self.req('customer','GET','/api/payments/pending').json['requests']
   self.assertEqual(len(pending),1);self.assertEqual(len(pending[0]['code']),6)
   report=self.req('admin','GET','/api/admin/analytics');self.assertEqual(report.status_code,200)
  finally:
   zoneinfo.reset_tzpath(original);zoneinfo.ZoneInfo.clear_cache()
 def test_login_throttle(self):
  for _ in range(5):self.assertEqual(self.c.post('/api/auth/login',json={'email':'bad@example.org','password':'bad'}).status_code,401)
  self.assertEqual(self.c.post('/api/auth/login',json={'email':'bad@example.org','password':'bad'}).status_code,429)
if __name__=='__main__':unittest.main()
