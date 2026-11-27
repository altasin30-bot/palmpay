import { useEffect, useState } from "react";
import { api } from "../api.js";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Hand, Wallet, Receipt, Scan, Store, PlusCircle, CreditCard,
  Users, Fingerprint, BarChart3, LogOut, ShieldCheck, MapPin,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

// Menu items per role — keeping it simple so it's easy to explain in defense.
const MENU = {
  customer: [
    { to: "/customer",              label: "Dashboard",    icon: Wallet },
    { to: "/customer/topup",        label: "Top Up",       icon: PlusCircle },
    { to: "/customer/transactions", label: "Transactions", icon: Receipt },
    { to: "/customer/enroll",       label: "Enroll Palm",  icon: Fingerprint },
  ],
  merchant: [
    { to: "/merchant",              label: "Dashboard",   icon: Store },
    { to: "/merchant/bills",        label: "Create Bill", icon: PlusCircle },
    { to: "/merchant/pay",          label: "Palm Payment", icon: Scan },
    { to: "/merchant/transactions", label: "Transactions", icon: Receipt },
    { to: "/merchant/balance", label: "Balance & payouts", icon: Wallet },
  ],
  admin: [
    { to: "/admin",            label: "Dashboard",          icon: BarChart3 },
    { to: "/admin/devices",    label: "Demo Devices",        icon: MapPin },
    { to: "/admin/users",      label: "Users & Merchants",  icon: Users },
    { to: "/admin/biometric",  label: "Biometric Metadata", icon: Fingerprint },
    { to: "/admin/reports",    label: "Reports",            icon: BarChart3 },
    { to: "/admin/settings", label: "Settings & alerts", icon: ShieldCheck },
  ],
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = MENU[user.role] || [];
  const [bangla,setBangla]=useState(()=>localStorage.getItem('palmpay_lang')==='bn');
  const labels={'Dashboard':'ড্যাশবোর্ড','Demo Devices':'ডেমো ডিভাইস','Top Up':'টপ আপ','Transactions':'লেনদেন','Enroll Palm':'পাম নিবন্ধন','Create Bill':'বিল তৈরি','Palm Payment':'পাম পেমেন্ট','Balance & payouts':'ব্যালেন্স ও পেআউট','Users & Merchants':'ব্যবহারকারী ও মার্চেন্ট','Biometric Metadata':'বায়োমেট্রিক তথ্য','Reports':'রিপোর্ট','Settings & alerts':'সেটিংস ও সতর্কতা'};
  const [pending, setPending] = useState([]);
  const [recent,setRecent]=useState([]), [pin,setPin]=useState("");
  useEffect(() => {
    if (user.role !== "customer") return;
    let active=true;
    const check=()=>{api.pendingPayments().then(x=>{if(active)setPending(x.requests)}).catch(()=>{});api.recentPayments().then(x=>{if(active)setRecent(x.completed.filter(y=>!sessionStorage.getItem(`done_${y.id}`)))}).catch(()=>{})};
    check(); const id=setInterval(check,3000);
    return ()=>{active=false;clearInterval(id)};
  }, [user.role]);
  async function decline(id) {try {await api.declinePayment(id); setPending(x=>x.filter(y=>y.request_id!==id));} catch(e){alert(e.message)}}

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-brand-900 text-white flex flex-col">
        <div className="px-6 py-6 flex items-center gap-2">
          <Hand className="w-8 h-8 text-brand-300" />
          <div>
            <div className="text-xl font-bold leading-none">PalmPay</div>
            <div className="text-xs text-brand-300">Palm Vein Payments</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition " +
                (isActive
                  ? "bg-brand-500 text-white shadow"
                  : "text-brand-100 hover:bg-brand-800 hover:text-white")
              }
            >
              <Icon className="w-5 h-5" />
              {bangla ? (labels[label] || label) : label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-brand-800">
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck className="w-4 h-4 text-brand-300" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{user.name}</div>
              <div className="text-xs text-brand-300 capitalize">{user.role}</div>
            </div>
          </div>
          <button className="mt-3 w-full rounded border border-brand-400 p-1 text-sm" onClick={()=>setBangla(x=>{localStorage.setItem('palmpay_lang',x?'en':'bn');return !x})}>{bangla ? 'English' : 'বাংলা (navigation only)'}</button>
          <button
            onClick={handleLogout}
            className="mt-3 w-full flex items-center justify-center gap-2 bg-brand-700 hover:bg-brand-600 text-white text-sm py-2 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-800">
            {user.role === "customer" && "Customer Console"}
            {user.role === "merchant" && "Merchant Console"}
            {user.role === "admin" && "Admin Console"}
          </h1>
          <div className="text-sm text-slate-500">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "short", day: "numeric" })}
          </div>
        </header>
        <div className="p-4 md:p-8">{pending.map(p => <section key={p.request_id} role="alert" className="mb-5 p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-950"><h2 className="font-bold">Payment approval requested</h2><p>{p.merchant_name} requests ৳{p.amount} for {p.description}. Expires at {new Date(p.expires_at).toLocaleTimeString()}.</p>{p.pin_required ? <form onSubmit={async e=>{e.preventDefault();try{await api.verifyPaymentPin(p.request_id,pin);setPin("")}catch(err){alert(err.message)}}} className="my-2"><label>Enter your PIN privately: <input className="border p-1" type="password" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" value={pin} onChange={e=>setPin(e.target.value)} required /></label><button className="border rounded p-1 ml-2">Approve with PIN</button></form> : <><p className="my-2">Your code: <b className="text-xl tracking-widest">{p.code}</b></p><p>Only share this code if you agree to pay.</p></>}<button onClick={()=>decline(p.request_id)} className="mt-2 px-3 py-1 rounded border border-amber-700">Decline</button></section>)}{recent.map(r=><div key={r.id} className="mb-4 p-4 bg-emerald-50 border border-emerald-300 rounded">Payment complete · ৳{r.amount} · {r.description} · receipt #{r.tx_id}<button className="ml-3 underline" onClick={()=>{sessionStorage.setItem(`done_${r.id}`,'1');setRecent(x=>x.filter(y=>y.id!==r.id))}}>Dismiss</button></div>)}{children}</div>
      </main>
    </div>
  );
}
