from core import *

@app.get('/api/admin/settings')
@auth_required(roles=['admin'])
def settings_get():
    db=get_db(); return jsonify({r['name']:r['value'] for r in db.execute("SELECT * FROM settings WHERE name!='session_epoch'")})

@app.post('/api/admin/settings')
@auth_required(roles=['admin'])
def settings_save():
    data=request.get_json(silent=True) or {}; allowed={'approval_threshold_p','per_payment_limit_p','daily_limit_p','scanner_mode','match_cutoff'}; changes={}
    try:
        for k,v in data.items():
            if k not in allowed: raise ValueError('Unknown setting')
            if k.endswith('_p'):
                if isinstance(v,bool) or int(v)!=float(v) or not 0<=int(v)<=1000000000: raise ValueError('Limits must be non-negative whole poisha')
                v=str(int(v))
            elif k=='scanner_mode':
                if v not in ('demo','real'): raise ValueError('Invalid scanner mode')
            else:
                if not 0.5<=float(v)<=1: raise ValueError('Cutoff must be from 0.5 to 1')
                v=str(float(v))
            changes[k]=v
    except (ValueError,TypeError,OverflowError): return jsonify({'error':'Invalid setting value'}),400
    db=get_db()
    for k,v in changes.items(): db.execute('UPDATE settings SET value=? WHERE name=?',(v,k))
    db.commit(); return jsonify({'message':'Settings saved'})

@app.get('/api/admin/scan-alerts')
@auth_required(roles=['admin'])
def scan_alerts():
    db=get_db(); rows=db.execute("SELECT id,name,email,account_status FROM users WHERE account_status='scan_locked'").fetchall()
    return jsonify({'alerts':[dict(x) for x in rows]})

@app.post('/api/admin/users/<int:uid>/unlock')
@auth_required(roles=['admin'])
def scan_unlock(uid):
    db=get_db(); cur=db.execute("UPDATE users SET account_status='active' WHERE id=? AND account_status='scan_locked'",(uid,))
    if cur.rowcount:
        db.execute("INSERT INTO scan_events(customer_id,outcome,created_at) VALUES(?,'success',?)",(uid,datetime.datetime.now(datetime.timezone.utc).isoformat()))
    db.commit(); return jsonify({'message':'Account unlocked'}) if cur.rowcount else (jsonify({'error':'Locked account not found'}),404)

@app.post('/api/bills/<int:bid>/cancel')
@auth_required(roles=['merchant'])
def cancel_bill(bid):
    db=get_db(); cur=db.execute("UPDATE bills SET status='cancelled' WHERE id=? AND merchant_id=? AND status='unpaid'",(bid,request.current_user['id']))
    db.commit(); return jsonify({'status':'cancelled'}) if cur.rowcount else (jsonify({'error':'Unpaid bill not found'}),404)

@app.post('/api/merchant/refunds/<int:txid>')
@auth_required(roles=['merchant'])
def refund(txid):
    db=get_db(); db.execute('BEGIN IMMEDIATE'); mid=request.current_user['id']
    tx=db.execute("SELECT * FROM transactions WHERE id=? AND merchant_id=? AND type='payment' AND status='success'",(txid,mid)).fetchone()
    if not tx: db.rollback(); return jsonify({'error':'Payment not found'}),404
    previous=db.execute('SELECT refund_tx_id FROM refunds WHERE original_tx_id=?',(txid,)).fetchone()
    if previous: db.commit(); return jsonify({'status':'refunded','tx_id':previous[0]})
    merchant=db.execute('SELECT wallet_p FROM users WHERE id=?',(mid,)).fetchone()
    if merchant['wallet_p']<tx['amount_p']: db.rollback(); return jsonify({'error':'Insufficient merchant balance'}),400
    now=datetime.datetime.now(datetime.timezone.utc).isoformat(); ref='refund:'+str(txid)
    post_money(db,mid,-tx['amount_p'],'refund',ref,now); post_money(db,tx['user_id'],tx['amount_p'],'refund',ref,now)
    cur=db.execute("INSERT INTO transactions(user_id,merchant_id,bill_id,type,amount,amount_p,status,idempotency_key,palm_matched,created_at) VALUES(?,?,?,'refund',?,?,'success',?,0,?)",(tx['user_id'],mid,tx['bill_id'],tx['amount'],tx['amount_p'],ref,now))
    db.execute('INSERT INTO refunds(original_tx_id,refund_tx_id,created_at) VALUES(?,?,?)',(txid,cur.lastrowid,now)); db.commit()
    return jsonify({'status':'refunded','tx_id':cur.lastrowid})

@app.get('/api/merchant/balance')
@auth_required(roles=['merchant'])
def merchant_balance():
    db=get_db(); r=db.execute('SELECT wallet_p FROM users WHERE id=?',(request.current_user['id'],)).fetchone();return jsonify({'balance':r['wallet_p']/100})

@app.post('/api/merchant/payout')
@auth_required(roles=['merchant'])
def merchant_payout():
    data=request.get_json(silent=True) or {}; key=data.get('idempotency_key');
    try: amount=money(data.get('amount'))
    except ValueError as e: return jsonify({'error':str(e)}),400
    if not isinstance(key,str) or not 12<=len(key)<=128: return jsonify({'error':'A stable payout key is required'}),400
    db=get_db(); db.execute('BEGIN IMMEDIATE'); uid=request.current_user['id']; old=db.execute('SELECT * FROM transactions WHERE idempotency_key=?',(key,)).fetchone()
    if old:
        if old['user_id']!=uid or old['type']!='payout' or old['amount_p']!=poisha(amount): db.rollback(); return jsonify({'error':'Payout key already used'}),409
        db.commit(); return jsonify({'status':'success','tx_id':old['id']})
    balance=db.execute('SELECT wallet_p FROM users WHERE id=?',(uid,)).fetchone()[0]
    if balance<poisha(amount): db.rollback(); return jsonify({'error':'Insufficient merchant balance'}),400
    now=datetime.datetime.now(datetime.timezone.utc).isoformat(); post_money(db,uid,-poisha(amount),'simulated_payout',key,now)
    cur=db.execute("INSERT INTO transactions(user_id,merchant_id,type,amount,amount_p,status,idempotency_key,palm_matched,created_at) VALUES(?,?,'payout',?,?,'success',?,0,?)",(uid,uid,amount,poisha(amount),key,now)); db.commit()
    return jsonify({'status':'success','tx_id':cur.lastrowid,'message':'Simulated payout; no funds were sent'})

@app.get('/api/admin/analytics')
@auth_required(roles=['admin'])
def analytics():
    db=get_db(); today=datetime.datetime.now(ZoneInfo('Asia/Dhaka')).date()
    try:
        end=datetime.date.fromisoformat(request.args.get('end',str(today)))
        start=datetime.date.fromisoformat(request.args.get('start',str(end-datetime.timedelta(days=6))))
        if end<start or (end-start).days>365: raise ValueError()
    except ValueError: return jsonify({'error':'Select a valid date range of at most 366 days'}),400
    a=datetime.datetime.combine(start,datetime.time.min,tzinfo=ZoneInfo('Asia/Dhaka')).astimezone(datetime.timezone.utc).isoformat()
    b=datetime.datetime.combine(end+datetime.timedelta(days=1),datetime.time.min,tzinfo=ZoneInfo('Asia/Dhaka')).astimezone(datetime.timezone.utc).isoformat()
    daily=db.execute("SELECT date(datetime(created_at,'+6 hours')) day,type,SUM(amount_p)/100.0 total FROM transactions WHERE status='success' AND datetime(created_at)>=datetime(?) AND datetime(created_at)<datetime(?) GROUP BY day,type",(a,b)).fetchall()
    scans=db.execute("SELECT COUNT(*) n,COALESCE(SUM(CASE WHEN outcome NOT IN ('success') THEN 1 ELSE 0 END),0) failed,AVG(CASE WHEN outcome='success' THEN similarity END) avg_score FROM scan_events WHERE merchant_id IS NOT NULL AND datetime(created_at)>=datetime(?) AND datetime(created_at)<datetime(?)",(a,b)).fetchone()
    merchants=db.execute("SELECT u.name,SUM(t.amount_p)/100.0 total FROM transactions t JOIN users u ON u.id=t.merchant_id WHERE t.type='payment' AND t.status='success' AND datetime(t.created_at)>=datetime(?) AND datetime(t.created_at)<datetime(?) GROUP BY u.id ORDER BY total DESC LIMIT 10",(a,b)).fetchall()
    byday={}; d=start
    while d<=end: byday[str(d)]={'day':str(d),'payment':0,'topup':0};d+=datetime.timedelta(days=1)
    for r in daily:
        if r['type'] in ('payment','topup') and r['day'] in byday: byday[r['day']][r['type']]=r['total']
    return jsonify({'daily':list(byday.values()),'scans':scans['n'],'failed':scans['failed'],'failed_rate':scans['failed']/scans['n'] if scans['n'] else 0,'avg_score':scans['avg_score'],'merchants':[dict(r) for r in merchants]})

@app.get('/api/admin/analytics.csv')
@auth_required(roles=['admin'])
def analytics_csv():
    from flask import Response
    import csv,io
    response=analytics()
    if isinstance(response,tuple): return response
    data=response.get_json(); out=io.StringIO(); writer=csv.writer(out);writer.writerow(['Date (Asia/Dhaka)','Payments BDT','Topups BDT'])
    for r in data['daily']: writer.writerow([r['day'],r['payment'],r['topup']])
    return Response(out.getvalue(),mimetype='text/csv',headers={'Content-Disposition':'attachment; filename=palmpay-report.csv'})

@app.get('/api/payments/customer-recent')
@auth_required(roles=['customer'])
def customer_recent_payments():
    db=get_db(); cutoff=(datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(minutes=3)).isoformat()
    rows=db.execute("SELECT id,amount,description,tx_id FROM payment_requests WHERE customer_id=? AND status='success' AND datetime(created_at)>=datetime(?) ORDER BY id DESC LIMIT 5",(request.current_user['id'],cutoff)).fetchall()
    return jsonify({'completed':[dict(x) for x in rows]})

@app.post('/api/admin/reset-demo')
@auth_required(roles=['admin'])
def reset_demo():
    # Explicitly destructive and local-demo only: all records, including the ledger, are erased.
    if request.get_json(silent=True) != {'confirm':'RESET DEMO'}: return jsonify({'error':'Type RESET DEMO to confirm'}),400
    if request.remote_addr not in ('127.0.0.1','::1'): return jsonify({'error':'Demo reset is restricted to local access'}),403
    db=get_db(); db.execute('BEGIN IMMEDIATE')
    db.execute('DROP TRIGGER IF EXISTS ledger_no_delete');db.execute('DROP TRIGGER IF EXISTS ledger_no_update')
    for table in ('refunds','payment_requests','ledger','scan_events','login_failures','transactions','bills','palm_templates','users','settings'):
        db.execute('DELETE FROM '+table)
    db.execute("DELETE FROM sqlite_sequence WHERE name IN ('users','transactions','bills','palm_templates','payment_requests')")
    db.commit(); init_db()
    response=jsonify({'message':'Demo reset; sign in again'});response.delete_cookie('palmpay_session',path='/',samesite='Strict');return response
