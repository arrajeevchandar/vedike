import Link from "next/link";
import { logoutAction } from "@/app/admin/actions";
import { BrandLogo } from "@/components/brand/brand-logo";

const nav = [
  ["Dashboard", "/admin"],
  ["Events", "/admin/events"],
  ["Competitions", "/admin/competitions"],
  ["Submissions", "/admin/submissions"],
  ["Payments", "/admin/payments"],
  ["Leaderboard", "/admin/leaderboard"],
];

export function AdminShell({ children, email }: { children: React.ReactNode; email: string }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "240px minmax(0,1fr)" }} className="admin-layout">
      <aside style={{ padding: 22, borderRight: "1px solid var(--line)", background: "rgba(7,4,8,.88)", position: "sticky", top: 0, height: "100vh" }}>
        <Link href="/" aria-label="Savitri Foundation home" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none", marginBottom: 30 }}>
          <BrandLogo size={38} decorative />
        </Link>
        <div style={{ display: "grid", gap: 6 }}>
          {nav.map(([label, href]) => (
            <Link key={href} href={href} style={{ padding: "11px 13px", borderRadius: 10, textDecoration: "none", color: "var(--muted)" }}>{label}</Link>
          ))}
        </div>
        <div style={{ position: "absolute", bottom: 22, left: 22, right: 22 }}>
          <p style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</p>
          <form action={logoutAction}><button className="btn btn-secondary" style={{ width: "100%", padding: 9 }}>Logout</button></form>
        </div>
      </aside>
      <main style={{ padding: "34px clamp(18px,4vw,52px) 70px", minWidth: 0 }}>{children}</main>
    </div>
  );
}
