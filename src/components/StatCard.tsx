"use client";

/** Pastel gradient KPI card (icon chip, big value, label), in the style of modern finance dashboards. */
export function StatCard({ icon, value, label, tone = "grey", hint, onClick }: {
  icon: React.ReactNode; value: React.ReactNode; label: string; tone?: "blue" | "green" | "orange" | "purple" | "grey"; hint?: React.ReactNode; onClick?: () => void;
}) {
  return (
    <div className={`stat-card stat-${tone}`} onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div style={{ fontSize: 12, marginTop: 6 }}>{hint}</div>}
    </div>
  );
}
