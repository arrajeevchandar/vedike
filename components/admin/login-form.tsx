"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/admin/actions";
import { BrandLoader, BrandLogo } from "@/components/brand/brand-logo";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});

  return (
    <form
      action={action}
      className="glass"
      style={{
        width: "min(410px,100%)",
        padding: 34,
        borderRadius: 25,
        background: "linear-gradient(165deg,#1c0e12,#100608)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
        <BrandLogo size={58} />
      </div>
      <div className="eyebrow">Secure access</div>
      <h1 className="display" style={{ fontSize: "clamp(22px,7vw,28px)", margin: "8px 0 24px" }}>
        Admin Dashboard
      </h1>
      <label className="form-label">Email</label>
      <input className="field" type="email" name="email" autoComplete="username" required />
      <label className="form-label">Password</label>
      <input className="field" type="password" name="password" autoComplete="current-password" required />
      <button className="btn btn-primary" style={{ width: "100%", marginTop: 22 }} disabled={pending}>
        {pending ? <BrandLoader mode="inline" label="Checking…" /> : "Login to Dashboard"}
      </button>
      {state.error && <p role="alert" style={{ color: "#ff8a8f", fontSize: 13, textAlign: "center" }}>{state.error}</p>}
    </form>
  );
}
