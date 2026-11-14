import { useEffect, useRef, useState } from "react";
import { Scan } from "lucide-react";
import { api } from "../../api.js";
import PalmScanner from "../../components/PalmScanner.jsx";

export default function MerchantPay() {
  const [bills,setBills]=useState([]), [customers,setCustomers]=useState([]);
  const [billId,setBillId]=useState(""), [customerId,setCustomerId]=useState("");
  const [amount,setAmount]=useState(""), [description,setDescription]=useState("");
  const [failed,setFailed]=useState(false);
  const [result,setResult]=useState(()=>{try{return JSON.parse(sessionStorage.getItem("palmpay_payment_result")||"null")}catch{return null}}), [code,setCode]=useState(""), [error,setError]=useState(""), [busy,setBusy]=useState(false);
  const key=useRef(sessionStorage.getItem("palmpay_payment_key") || crypto.randomUUID());
  useEffect(()=>{sessionStorage.setItem("palmpay_payment_key",key.current); if(result) sessionStorage.setItem("palmpay_payment_result",JSON.stringify(result)); else sessionStorage.removeItem("palmpay_payment_result");},[result]);
  async function load() { const [b,c]=await Promise.all([api.billsList(),api.demoCustomers()]); setBills(b.bills.filter(x=>x.status==='unpaid')); setCustomers(c.customers); }
  useEffect(()=>{load().catch(e=>setError(e.message));},[]);
  useEffect(()=>{
    if(result?.status!=='pending') return;
    const timer=setInterval(async()=>{try {setResult(await api.paymentStatus(result.request_id));} catch(e){setError(e.message)}},3000);
    return ()=>clearInterval(timer);
  },[result?.request_id,result?.status]);
  function selectBill(id) {setBillId(id); const b=bills.find(x=>x.id===Number(id)); setAmount(b?.amount||""); setDescription(b?.description||"");}
  function reset() { key.current=crypto.randomUUID();sessionStorage.setItem("palmpay_payment_key",key.current);setResult(null);setFailed(false);setCode("");setError("");setBillId("");setAmount("");setDescription("");load().catch(e=>setError(e.message)); }
  async function scan(mode){
    if(result) throw new Error("Finish or start a new payment first.");
    if(!customerId || !amount || Number(amount)<=0) throw new Error("Select a demo customer and enter an amount.");
    const name=customers.find(c=>c.id===Number(customerId))?.name;
    if(['success','pin_fallback'].includes(mode) && !window.confirm(`Demo payment: charge ${name} ৳${amount} for ${description || 'Palm payment'}?`)) throw new Error("Payment cancelled before scan.");
    setBusy(true);setError("");
    try { const res=await api.paymentsProcess({mode,customer_id:Number(customerId),idempotency_key:key.current,...(billId?{bill_id:Number(billId)}:{amount,description})});setResult(res);return res; }
    catch(e){if(['unrecognized','poor_lighting','success'].includes(mode) && e.data?.matched===false) setFailed(true);setError(e.message);throw e;} finally{setBusy(false)}
  }
  async function confirmCode(e){e.preventDefault();setBusy(true);setError("");try{setResult(await api.confirmPayment(result.request_id,code));setCode("");}catch(e){setError(e.message);try{setResult(await api.paymentStatus(result.request_id))}catch{}}finally{setBusy(false)}}
  return <div className="space-y-6"><div className="flex items-center gap-2"><Scan/><h2 className="text-xl font-bold">Palm Payment Terminal</h2></div>
    <p className="p-3 rounded bg-amber-50 text-amber-800 text-sm">Demo only: the scanner is simulated. Selecting a customer does not prove that person is present. Do not use real money.</p>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><div className="bg-white rounded-2xl border p-6 space-y-4">
      <h3 className="font-semibold">1. Set up payment</h3>
      <label className="block text-sm">Demo customer<select disabled={!!result} className="w-full p-2 border rounded mt-1" value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">Select customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="block text-sm">Unpaid bill (optional)<select disabled={!!result} className="w-full p-2 border rounded mt-1" value={billId} onChange={e=>selectBill(e.target.value)}><option value="">Enter manually</option>{bills.map(b=><option key={b.id} value={b.id}>#{b.id} · ৳{b.amount} · {b.description}</option>)}</select></label>
      <label className="block text-sm">Amount (৳)<input disabled={!!billId||!!result} className="w-full p-2 border rounded mt-1" type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
      <label className="block text-sm">Description<input disabled={!!billId||!!result} className="w-full p-2 border rounded mt-1" value={description} onChange={e=>setDescription(e.target.value)}/></label>
      {failed && !result && <button onClick={()=>scan('pin_fallback').catch(()=>{})} className="border p-2 rounded">Request customer PIN fallback</button>}
      {result?.status==='pending' && result.pin_required && <p className="p-3 bg-amber-50">Waiting for the customer to verify their PIN in their own PalmPay account.</p>}
      {result?.status==='pending' && !result.pin_required && <form onSubmit={confirmCode} className="p-4 rounded bg-amber-50 space-y-2"><p>Ask the customer for the six-digit code shown in their PalmPay account. Time left: {Math.max(0,Math.ceil((new Date(result.expires_at)-Date.now())/1000))} seconds.</p><input aria-label="Customer approval code" className="p-2 border rounded" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value)} required/><button disabled={busy} className="bg-brand-600 text-white rounded px-3 py-2 ml-2">Confirm payment</button></form>}
      {result?.status==='success' && <div className="p-4 bg-emerald-50 rounded text-emerald-800">Payment complete · Receipt #{result.tx_id} · ৳{result.amount} · {result.description}<br/><button className="underline" onClick={()=>window.print()}>Print receipt</button></div>}
      {result && !['pending','success'].includes(result.status) && <p className="text-rose-700">Payment {result.status}. Nothing was charged.</p>}
      {error&&<p role="alert" className="text-rose-700">{error}</p>}
      {result && result.status!=='pending' && <button className="px-4 py-2 rounded border" onClick={reset}>Start new payment</button>}
    </div><PalmScanner onScan={scan} title="2. Simulate palm scan"/></div></div>;
}
