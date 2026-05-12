import { useEffect, useState } from "react";
import { Search, Trash2, Shield, ShieldOff, Crown, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";

const PLAN_BADGE = {
  starter: "bg-zinc-500/15 text-zinc-300",
  pro: "bg-indigo-500/15 text-indigo-300",
  elite: "bg-purple-500/15 text-purple-300",
  lifetime: "bg-amber-500/15 text-amber-300",
};

export default function AdminUsers() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/users", { params: { search: search || undefined } });
      setItems(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const updateUser = async (id, patch) => {
    try {
      const { data } = await api.put(`/admin/users/${id}`, patch);
      setItems((prev) => prev.map((u) => (u.id === id ? data : u)));
      toast.success("Updated");
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this user permanently?")) return;
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success("Deleted");
      setItems((prev) => prev.filter((u) => u.id !== id));
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-red-300/80">Admin</p>
          <h1 className="text-3xl lg:text-4xl font-semibold mt-2 tracking-tight">Users</h1>
          <p className="text-sm text-zinc-400 mt-2">Promote, plan-gift, ban, or delete any user.</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search email…" className="glass-input w-full pl-10 pr-3 py-2.5 text-sm" data-testid="admin-users-search" />
        </form>
      </header>

      <div className="glass-card rounded-[20px] overflow-hidden">
        <table className="w-full text-sm" data-testid="admin-users-table">
          <thead className="bg-white/[0.02]">
            <tr className="text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="text-left p-3 pl-5">Email</th>
              <th className="text-left p-3">Role</th>
              <th className="text-left p-3">Plan</th>
              <th className="text-left p-3">Expires</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3 pr-5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
            ) : items.map((u) => (
              <tr key={u.id} className="border-t border-white/5 hover:bg-white/5" data-testid={`admin-user-row-${u.id}`}>
                <td className="p-3 pl-5 font-medium">{u.email}</td>
                <td className="p-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold ${u.role === "admin" ? "bg-red-500/15 text-red-300" : "bg-white/5 text-zinc-400"}`}>
                    {u.role}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold ${PLAN_BADGE[u.plan] || PLAN_BADGE.starter}`}>
                    {u.plan}
                  </span>
                </td>
                <td className="p-3 text-xs text-zinc-400">{u.plan_expires_at ? new Date(u.plan_expires_at).toLocaleDateString() : (u.plan === "lifetime" ? "∞" : "—")}</td>
                <td className="p-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${u.banned ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                    {u.banned ? "banned" : "active"}
                  </span>
                </td>
                <td className="p-3 pr-5 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button onClick={() => setEditing(u)} className="px-2.5 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-xs" data-testid={`edit-user-${u.id}`}>Edit</button>
                    <button onClick={() => updateUser(u.id, { banned: !u.banned })} className="w-8 h-8 rounded-lg border border-white/10 hover:bg-white/5 inline-flex items-center justify-center" title={u.banned ? "Unban" : "Ban"} data-testid={`ban-user-${u.id}`}>
                      {u.banned ? <Shield className="w-4 h-4 text-emerald-400" /> : <ShieldOff className="w-4 h-4 text-amber-400" />}
                    </button>
                    <button onClick={() => remove(u.id)} className="w-8 h-8 rounded-lg border border-white/10 hover:bg-red-500/10 inline-flex items-center justify-center text-red-300" data-testid={`delete-user-${u.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditModal user={editing} onClose={() => setEditing(null)} onSave={(patch) => { updateUser(editing.id, patch); setEditing(null); }} />
      )}
    </div>
  );
}

function EditModal({ user, onClose, onSave }) {
  const [plan, setPlan] = useState(user.plan || "starter");
  const [role, setRole] = useState(user.role || "user");
  const [extendDays, setExtendDays] = useState(0);

  const save = () => {
    const patch = { plan, role };
    if (extendDays > 0) {
      const base = user.plan_expires_at ? new Date(user.plan_expires_at) : new Date();
      const newDate = new Date(Math.max(base.getTime(), Date.now()) + extendDays * 86400000);
      patch.plan_expires_at = newDate.toISOString();
    }
    onSave(patch);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0f19]/80 backdrop-blur-[12px] p-4">
      <div className="glass-card rounded-[24px] w-full max-w-md p-7 relative" data-testid="edit-user-modal">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        <h2 className="text-lg font-semibold mb-1">Edit user</h2>
        <p className="text-xs text-zinc-500 mb-5">{user.email}</p>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-zinc-400">Plan</label>
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className="glass-input px-3 py-2.5 text-sm" data-testid="edit-plan">
              {["starter", "pro", "elite", "lifetime"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-zinc-400">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="glass-input px-3 py-2.5 text-sm" data-testid="edit-role">
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-zinc-400">Extend subscription by (days)</label>
            <input type="number" value={extendDays} onChange={(e) => setExtendDays(parseInt(e.target.value || "0", 10))} className="glass-input px-3 py-2.5 text-sm" data-testid="edit-extend-days" />
            <span className="text-[11px] text-zinc-500">Current expiry: {user.plan_expires_at ? new Date(user.plan_expires_at).toLocaleString() : "—"}</span>
          </div>
        </div>
        <button onClick={save} className="btn-gradient w-full mt-6 py-3 text-sm" data-testid="edit-user-save">Save</button>
      </div>
    </div>
  );
}
