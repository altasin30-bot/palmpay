import {useEffect,useRef,useState} from 'react';
import {api} from '../../api.js';
export default function Balance(){
 const [balance,setBalance]=useState(0),[amount,setAmount]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);const key=useRef(crypto.randomUUID());
 const load=()=>api.merchantBalance().then(x=>setBalance(x.balance));useEffect(()=>{load().catch(e=>setMsg(e.message))},[]);
 async function payout(e){e.preventDefault();if(!window.confirm('Simulate this payout? No money will be sent.'))return;setBusy(true);try{const r=await api.merchantPayout({amount,idempotency_key:key.current});setMsg(`${r.message} · #${r.tx_id}`);key.current=crypto.randomUUID();setAmount('');await load()}catch(e){setMsg(e.message)}finally{setBusy(false)}}
 return <div className="max-w-xl p-6 bg-white rounded-xl border space-y-4"><h2 className="font-bold text-xl">Merchant balance</h2><p className="text-3xl">৳{Number(balance).toLocaleString()}</p><p>Demo payout only: no bank, bKash, or other transfer occurs.</p><form onSubmit={payout} className="flex gap-2"><input aria-label="Payout amount" type="number" step="0.01" min="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className="border rounded p-2" required/><button disabled={busy} className="bg-brand-600 text-white rounded p-2">Simulate payout</button></form><p role="status">{msg}</p></div>
}
