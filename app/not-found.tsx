import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}><BrandLogo variant="mark" size={88} /></div>
        <h1 className="display" style={{ fontSize: 48, margin: 0 }}>This stage is empty</h1>
        <p className="muted">The event, competition or page could not be found.</p>
        <Link href="/events" className="btn btn-primary">Explore Events</Link>
      </div>
    </main>
  );
}
