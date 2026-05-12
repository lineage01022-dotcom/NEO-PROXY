import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0f19]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-indigo-500 animate-spin" />
          <p className="text-sm text-zinc-400">Loading session…</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/signin" replace />;
  return children;
}
