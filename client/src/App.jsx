import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";

// Customer pages
import CustomerDashboard   from "./pages/customer/Dashboard.jsx";
import CustomerTopUp        from "./pages/customer/TopUp.jsx";
import CustomerTransactions from "./pages/customer/Transactions.jsx";
import EnrollPalm          from "./pages/customer/EnrollPalm.jsx";

// Merchant pages
import MerchantDashboard   from "./pages/merchant/Dashboard.jsx";
import MerchantBills       from "./pages/merchant/CreateBill.jsx";
import MerchantPay         from "./pages/merchant/PaymentTerminal.jsx";
import MerchantBalance from "./pages/merchant/Balance.jsx";
import AdminSettings from "./pages/admin/Settings.jsx";
import MerchantTransactions from "./pages/merchant/Transactions.jsx";

// Admin pages
import AdminDashboard from "./pages/admin/Dashboard.jsx";
import AdminUsers     from "./pages/admin/Users.jsx";
import AdminBiometric from "./pages/admin/Biometric.jsx";
import AdminReports   from "./pages/admin/Reports.jsx";
import AdminDevices   from "./pages/admin/Devices.jsx";

import Layout from "./components/Layout.jsx";

// Helper: only render children if the user has the right role
function RoleRoute({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Customer */}
      <Route path="/customer" element={<RoleRoute role="customer"><CustomerDashboard /></RoleRoute>} />
      <Route path="/customer/topup" element={<RoleRoute role="customer"><CustomerTopUp /></RoleRoute>} />
      <Route path="/customer/transactions" element={<RoleRoute role="customer"><CustomerTransactions /></RoleRoute>} />
      <Route path="/customer/enroll" element={<RoleRoute role="customer"><EnrollPalm /></RoleRoute>} />

      {/* Merchant */}
      <Route path="/merchant" element={<RoleRoute role="merchant"><MerchantDashboard /></RoleRoute>} />
      <Route path="/merchant/bills" element={<RoleRoute role="merchant"><MerchantBills /></RoleRoute>} />
      <Route path="/merchant/pay" element={<RoleRoute role="merchant"><MerchantPay /></RoleRoute>} />
      <Route path="/merchant/transactions" element={<RoleRoute role="merchant"><MerchantTransactions /></RoleRoute>} />

      <Route path="/merchant/balance" element={<RoleRoute role="merchant"><MerchantBalance /></RoleRoute>} />
      <Route path="/admin/settings" element={<RoleRoute role="admin"><AdminSettings /></RoleRoute>} />
      {/* Admin */}
      <Route path="/admin" element={<RoleRoute role="admin"><AdminDashboard /></RoleRoute>} />
      <Route path="/admin/devices" element={<RoleRoute role="admin"><AdminDevices /></RoleRoute>} />
      <Route path="/admin/users" element={<RoleRoute role="admin"><AdminUsers /></RoleRoute>} />
      <Route path="/admin/biometric" element={<RoleRoute role="admin"><AdminBiometric /></RoleRoute>} />
      <Route path="/admin/reports" element={<RoleRoute role="admin"><AdminReports /></RoleRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
