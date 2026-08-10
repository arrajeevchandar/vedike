import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";

export function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--line)", padding: "34px 20px", background: "#080406" }}>
      <div className="shell" style={{ display: "flex", gap: 20, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", color: "var(--muted)", fontSize: 13 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <BrandLogo size={37} />
          <span>Where culture meets community.</span>
        </span>
        <span style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <Link href="/support">Support</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/refund-policy">Refunds</Link>
        </span>
      </div>
    </footer>
  );
}
