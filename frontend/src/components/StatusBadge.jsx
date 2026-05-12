export default function StatusBadge({ status }) {
  const map = {
    active: { cls: "status-active", dot: "bg-emerald-400", label: "Active" },
    dead: { cls: "status-dead", dot: "bg-red-400", label: "Dead" },
    checking: { cls: "status-checking", dot: "bg-indigo-400 pulse", label: "Checking" },
    unknown: { cls: "status-unknown", dot: "bg-zinc-400", label: "Unknown" },
  };
  const s = map[status] || map.unknown;
  return (
    <span className={`status-badge ${s.cls}`} data-testid={`status-${status}`}>
      <span className={`status-dot ${s.dot}`} />
      {s.label}
    </span>
  );
}
