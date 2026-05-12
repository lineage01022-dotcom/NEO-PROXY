import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import SignIn from "@/pages/SignIn";
import Landing from "@/pages/Landing";
import Pricing from "@/pages/Pricing";
import Dashboard from "@/pages/Dashboard";
import ProxyList from "@/pages/ProxyList";
import BulkImport from "@/pages/BulkImport";
import Settings from "@/pages/Settings";
import Servers from "@/pages/Servers";
import ServerDetail from "@/pages/ServerDetail";
import Billing from "@/pages/Billing";
import Checkout from "@/pages/Checkout";
import AdminLayout from "@/components/AdminLayout";
import AdminOverview from "@/pages/admin/AdminOverview";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminPayments from "@/pages/admin/AdminPayments";
import AdminWallets from "@/pages/admin/AdminWallets";

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Toaster
            position="top-right"
            theme="dark"
            toastOptions={{
              className: "glass-card",
              style: {
                background: "rgba(15,18,32,0.95)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#fff",
              },
            }}
          />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/signin" element={<SignIn />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout><Dashboard /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/proxies"
              element={
                <ProtectedRoute>
                  <Layout><ProxyList /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/servers"
              element={
                <ProtectedRoute>
                  <Layout><Servers /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/servers/:id"
              element={
                <ProtectedRoute>
                  <Layout><ServerDetail /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/import"
              element={
                <ProtectedRoute>
                  <Layout><BulkImport /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Layout><Settings /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing"
              element={
                <ProtectedRoute>
                  <Layout><Billing /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/checkout/:plan"
              element={
                <ProtectedRoute>
                  <Layout><Checkout /></Layout>
                </ProtectedRoute>
              }
            />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminOverview />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="wallets" element={<AdminWallets />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
