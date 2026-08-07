"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { openVotingAction } from "@/app/admin/actions";

type Entry = { id: string; name: string; description: string };

export function CompetitionReleaseDialog({ competitionId, competitionTitle, entries, visibleEntryCount }: { competitionId: string; competitionTitle: string; entries: Entry[]; visibleEntryCount: number }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", close);
    requestAnimationFrame(() => dialogRef.current?.focus());
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  return (
    <>
      <button className="btn btn-primary" type="button" style={{ padding: "8px 14px", marginTop: 14 }} onClick={() => setOpen(true)}>Open public voting</button>
      {open && createPortal(<div className="admin-release-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
        <section ref={dialogRef} tabIndex={-1} className="glass admin-release-dialog" role="dialog" aria-modal="true" aria-labelledby="release-voting-title">
          <button type="button" className="admin-dialog-close" aria-label="Close release dialog" onClick={() => setOpen(false)}>×</button>
          <div className="eyebrow">Release checklist</div>
          <h2 id="release-voting-title" className="display" style={{ margin: "8px 0" }}>Open voting for {competitionTitle}</h2>
          <p className="muted">Select the entries to reveal. Unselected entries remain private and can be released later while voting is open.</p>
          {entries.length ? <form action={openVotingAction}>
            <input type="hidden" name="id" value={competitionId} />
            <div className="admin-release-list">
              {entries.map((entry) => <label className="admin-release-entry" key={entry.id}>
                <input type="checkbox" name="submissionIds" value={entry.id} checked={selected.has(entry.id)} onChange={(event) => setSelected((current) => {
                  const next = new Set(current);
                  if (event.target.checked) next.add(entry.id);
                  else next.delete(entry.id);
                  return next;
                })} />
                <span><b>{entry.name}</b><small>{entry.description}</small></span>
              </label>)}
            </div>
            <button className="btn btn-primary" disabled={!selected.size} style={{ width: "100%", marginTop: 18 }}>Release {selected.size || ""} {selected.size === 1 ? "entry" : "entries"} & open voting</button>
          </form> : visibleEntryCount ? <form action={openVotingAction}>
            <input type="hidden" name="id" value={competitionId} />
            <div className="admin-release-summary">{visibleEntryCount} {visibleEntryCount === 1 ? "entry is" : "entries are"} already released and ready for public voting.</div>
            <button className="btn btn-primary" style={{ width: "100%", marginTop: 18 }}>Open public voting</button>
          </form> : <div className="empty">No pending entries are ready to release yet.</div>}
        </section>
      </div>, document.body)}
    </>
  );
}
