"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CompetitionDetail, PublicSubmission } from "@/lib/types";

declare global {
  interface Window {
    PhonePeCheckout?: {
      transact(input: {
        tokenUrl: string;
        type: "IFRAME";
        callback: (response: string) => void;
      }): void;
    };
  }
}

export function CompetitionActions({
  competition,
  submission,
}: {
  competition: CompetitionDetail;
  submission?: PublicSubmission;
}) {
  const [mode, setMode] = useState<"submit" | "vote" | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const router = useRouter();
  const active = competition.status === "live" && !competition.isShowcase;

  const close = () => {
    setMode(null);
    setMessage("");
    setBusy(false);
  };

  useEffect(() => {
    if (!mode) return;
    const opener = openerRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, [mode]);

  const open = (
    nextMode: "submit" | "vote",
    opener: HTMLButtonElement,
  ) => {
    openerRef.current = opener;
    setMessage("");
    setMode(nextMode);
  };

  async function submitEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      form.set("competitionId", competition.id);
      const response = await fetch("/api/submissions", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error ?? "Submission failed.");
        return;
      }
      setMessage("Entry published — best of luck!");
      router.refresh();
      window.setTimeout(close, 1300);
    } catch {
      setMessage("Submission failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function payVote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submission) return;
    setBusy(true);
    setMessage("Creating secure ₹2 checkout…");
    try {
      const data = new FormData(event.currentTarget);
      const response = await fetch("/api/votes/phonepe/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: submission.id,
          voterName: data.get("voterName"),
          voterPhone: data.get("voterPhone"),
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.redirectUrl) {
        setMessage(body.error ?? "Could not start checkout.");
        return;
      }
      const poll = async () => {
        for (let attempt = 0; attempt < 30; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 2000));
          const statusResponse = await fetch(
            `/api/votes/phonepe/orders/${body.statusToken}`,
          );
          const status = await statusResponse.json();
          if (status.state === "COMPLETED") {
            setMessage("Vote counted! 🎉");
            router.refresh();
            window.setTimeout(close, 1500);
            return;
          }
          if (["FAILED", "EXPIRED", "REFUNDED", "REVIEW_REQUIRED"].includes(status.state)) {
            setMessage(`Payment ${String(status.state).toLowerCase()}.`);
            setBusy(false);
            return;
          }
        }
        setMessage("Payment is still being verified. You can safely close this dialog.");
        setBusy(false);
      };
      if (window.PhonePeCheckout) {
        window.PhonePeCheckout.transact({
          tokenUrl: body.redirectUrl,
          type: "IFRAME",
          callback: () => void poll(),
        });
      } else {
        window.location.assign(body.redirectUrl);
      }
    } catch {
      setMessage("Could not start checkout. Please try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <Script
        src="https://mercury.phonepe.com/web/bundle/checkout.js"
        strategy="lazyOnload"
      />
      {submission ? (
        <button
          className="btn btn-secondary"
          style={{
            width: "100%",
            color: "var(--gold)",
            borderColor: "rgba(242,183,5,.4)",
          }}
          disabled={!active}
          onClick={(event) => open("vote", event.currentTarget)}
        >
          {competition.isShowcase ? "Showcase only" : "Vote · ₹2"}
        </button>
      ) : (
        <button
          className="btn btn-primary"
          disabled={!active}
          onClick={(event) => open("submit", event.currentTarget)}
        >
          {competition.isShowcase ? "Showcase only" : "+ Submit Entry"}
        </button>
      )}

      {mode && (
        <div
          onMouseDown={(event) => event.target === event.currentTarget && close()}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: 18,
            background: "rgba(3,1,2,.78)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            ref={dialogRef}
            className="glass"
            role="dialog"
            aria-modal="true"
            aria-labelledby="competition-action-title"
            tabIndex={-1}
            style={{
              width: "min(470px,100%)",
              borderRadius: 24,
              padding: 28,
              animation: "vd-pop .35s ease both",
              background: "linear-gradient(165deg,#1c0e12,#120709)",
            }}
          >
            <button
              onClick={close}
              aria-label="Close dialog"
              style={{
                float: "right",
                border: 0,
                background: "transparent",
                color: "var(--cream)",
                fontSize: 22,
                cursor: "pointer",
              }}
            >
              ×
            </button>
            <div className="eyebrow">
              {mode === "submit" ? "Submit Entry" : "Cast Your Vote"}
            </div>
            <h2 id="competition-action-title" className="display" style={{ margin: "8px 0 4px" }}>
              {mode === "submit" ? competition.title : submission?.name}
            </h2>
            {mode === "vote" && (
              <p className="muted" style={{ fontSize: 13 }}>
                One successful ₹2 payment equals one vote. Repeat after completion to vote again.
              </p>
            )}
            {mode === "submit" ? (
              <form onSubmit={submitEntry}>
                <label className="form-label">Name</label>
                <input className="field" name="name" required />
                <label className="form-label">Phone</label>
                <input className="field" name="phone" inputMode="tel" required />
                <label className="form-label">Email</label>
                <input className="field" name="email" type="email" required />
                <label className="form-label">Submission photo</label>
                <input className="field" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required />
                <label className="form-label">Description</label>
                <textarea className="field" name="description" rows={4} required />
                <button className="btn btn-primary" disabled={busy} style={{ width: "100%", marginTop: 18 }}>
                  {busy ? "Publishing…" : "Submit Entry"}
                </button>
              </form>
            ) : (
              <form onSubmit={payVote}>
                <label className="form-label">Your name</label>
                <input className="field" name="voterName" required />
                <label className="form-label">Your phone</label>
                <input className="field" name="voterPhone" inputMode="tel" required />
                <button className="btn btn-primary" disabled={busy} style={{ width: "100%", marginTop: 18 }}>
                  {busy ? "Please wait…" : "Pay ₹2 & Vote"}
                </button>
              </form>
            )}
            {message && (
              <p
                role="status"
                style={{
                  color: message.includes("failed") ? "#ff8a8f" : "var(--gold)",
                  fontSize: 13,
                  textAlign: "center",
                  marginBottom: 0,
                }}
              >
                {message}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
