import {useEffect, useRef, useState} from 'react';
import {MapPin, RefreshCw} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {api} from '../../api.js';

function DeviceMap({devices, onSelect}) {
  const container = useRef(null);
  const map = useRef(null);
  useEffect(() => {
    const instance = L.map(container.current).setView([23.8103, 90.4125], 11);
    map.current = instance;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(instance);
    const markers = [];
    devices.forEach(device => {
      const active = device.demo_status === 'active';
      const icon = L.divIcon({className:'', html:`<span style="display:block;width:20px;height:20px;border-radius:50%;border:3px solid white;background:${active ? '#059669' : '#64748b'};box-shadow:0 1px 5px #333"></span>`, iconSize:[20,20], iconAnchor:[10,10]});
      const popup = document.createElement('div');
      const heading = document.createElement('strong'); heading.textContent = device.label;
      const details = document.createElement('div'); details.textContent = `${device.merchant_name} · ${device.location_name}`;
      popup.append(heading, details);
      const marker = L.marker([device.latitude,device.longitude], {icon, title:device.label, keyboard:true}).addTo(instance).bindPopup(popup);
      marker.on('click', () => onSelect(device.id));
      markers.push(marker);
    });
    if (markers.length) instance.fitBounds(L.featureGroup(markers).getBounds().pad(0.2), {maxZoom:12});
    return () => { instance.remove(); map.current = null; };
  }, [devices, onSelect]);
  return <div ref={container} aria-label="Map of simulated demo devices" style={{height:420, width:'100%', zIndex:0}} />;
}

export default function AdminDevices() {
  const [devices,setDevices] = useState([]), [active,setActive] = useState(0), [selected,setSelected] = useState(null);
  const [loading,setLoading] = useState(true), [error,setError] = useState('');
  // Stable callback keeps the Leaflet map mounted when selection changes.
  const onSelect = useRef(id => setSelected(id)).current;
  async function load() {
    setLoading(true);
    try { const res=await api.adminDevices(); setDevices(res.devices); setActive(res.simulated_active_count); setError(''); }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  const chosen=devices.find(d=>d.id===selected);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold flex items-center gap-2"><MapPin/>Demo device map</h2><p className="text-slate-500 text-sm">Select a marker or a device below to see its merchant.</p></div><button onClick={load} className="flex items-center gap-2 border rounded px-3 py-2"><RefreshCw size={16}/>Refresh</button></div>
    <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-900 text-sm"><strong>Simulation only:</strong> device statuses and locations are preset examples, not live hardware, GPS, or connectivity. Map tiles need internet access.</div>
    <div className="grid md:grid-cols-3 gap-3"><div className="bg-white border rounded-xl p-4"><p className="text-sm text-slate-500">Simulated active devices</p><p className="text-2xl font-bold">{loading ? '…' : active}</p></div><div className="bg-white border rounded-xl p-4"><p className="text-sm text-slate-500">Simulated inactive devices</p><p className="text-2xl font-bold">{loading ? '…' : devices.length-active}</p></div><div className="bg-white border rounded-xl p-4"><p className="text-sm text-slate-500">Total demo devices</p><p className="text-2xl font-bold">{loading ? '…' : devices.length}</p></div></div>
    {error && <p role="alert" className="text-rose-700">Could not load devices: {error}</p>}
    {!loading && !error && <div className="grid xl:grid-cols-3 gap-4"><div className="xl:col-span-2 bg-white border rounded-xl overflow-hidden"><DeviceMap devices={devices} onSelect={onSelect}/></div><div className="bg-white border rounded-xl p-5" aria-live="polite"><h3 className="font-semibold mb-3">Device & merchant details</h3>{chosen ? <dl className="space-y-2 text-sm"><div><dt className="text-slate-500">Device</dt><dd>{chosen.label} · {chosen.device_code}</dd></div><div><dt className="text-slate-500">Demo status</dt><dd className="capitalize">{chosen.demo_status} (simulated)</dd></div><div><dt className="text-slate-500">Sample location</dt><dd>{chosen.location_name}</dd></div><div><dt className="text-slate-500">Merchant</dt><dd>{chosen.merchant_name}</dd></div><div><dt className="text-slate-500">Shop</dt><dd>{chosen.merchant_shop || '—'}</dd></div><div><dt className="text-slate-500">Email</dt><dd>{chosen.merchant_email}</dd></div><div><dt className="text-slate-500">Merchant account</dt><dd>{chosen.merchant_status}</dd></div></dl> : <p className="text-slate-500 text-sm">Select a device on the map or in the list.</p>}</div></div>}
    <div className="bg-white border rounded-xl p-5"><h3 className="font-semibold mb-3">Demo device list</h3><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">{devices.map(d=><button key={d.id} onClick={()=>setSelected(d.id)} aria-pressed={selected===d.id} className={`text-left border rounded-lg p-3 ${selected===d.id?'border-brand-600 bg-brand-50':'hover:bg-slate-50'}`}><span className="font-medium">{d.label} · {d.device_code}</span><br/><span className="text-sm text-slate-500">{d.merchant_name} · {d.location_name} · {d.demo_status}</span></button>)}</div>{!loading&&!error&&!devices.length&&<p>No demo devices are available.</p>}</div>
  </div>;
}
