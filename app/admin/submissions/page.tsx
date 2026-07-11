import { AdminPage } from "@/components/admin/admin-page";
import {
  deleteUnpaidSubmissionAction,
  disqualifySubmissionAction,
  moderateSubmissionAction,
} from "@/app/admin/actions";
import { getDashboardData } from "@/lib/data";
import { decryptPii } from "@/lib/security";

export default async function AdminSubmissionsPage() {
  const { submissions } = await getDashboardData();
  return (
    <AdminPage>
      <div className="eyebrow">Participant moderation</div>
      <h1 className="page-title" style={{ fontSize: 48 }}>Submissions</h1>
      <p className="muted">Hiding keeps an entry out of public views. Disqualification starts an auditable refund workflow for every paid vote.</p>
      <div style={{ display: "grid", gap: 12, marginTop: 22 }}>
        {submissions.map((submission) => {
          const showcase = "showcaseVoteCount" in submission && submission.showcaseVoteCount > 0;
          const realSubmission = !showcase && "state" in submission;
          return (
            <article
              className="glass"
              key={submission.id}
              style={{
                padding: 18,
                borderRadius: 15,
                display: "grid",
                gridTemplateColumns: "minmax(160px,1fr) minmax(200px,1fr) auto",
                gap: 16,
                alignItems: "center",
              }}
            >
              <div>
                <b>{"participantName" in submission ? submission.participantName : submission.name}</b>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: "5px 0" }}>{submission.description}</p>
                {realSubmission && <small className="badge badge-ended">{submission.state}</small>}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {showcase ? "Demo contact hidden" : <>{"participantPhoneEncrypted" in submission && decryptPii(submission.participantPhoneEncrypted)}<br />{"participantEmailEncrypted" in submission && decryptPii(submission.participantEmailEncrypted)}</>}
              </div>
              {realSubmission && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {submission.state !== "DISQUALIFIED" && <form action={moderateSubmissionAction}><input type="hidden" name="id" value={submission.id} /><input type="hidden" name="state" value={submission.state === "VISIBLE" ? "HIDDEN" : "VISIBLE"} /><button className="btn btn-secondary" style={{ padding: "8px 14px" }}>{submission.state === "VISIBLE" ? "Hide" : "Restore"}</button></form>}
                  {submission.state !== "DISQUALIFIED" && <form action={disqualifySubmissionAction}><input type="hidden" name="id" value={submission.id} /><button className="btn btn-secondary" style={{ padding: "8px 14px", color: "#ff8a8f" }}>Disqualify & refund</button></form>}
                  {submission.paidVoteCount === 0 && <form action={deleteUnpaidSubmissionAction}><input type="hidden" name="id" value={submission.id} /><button className="btn btn-secondary" style={{ padding: "8px 14px" }}>Delete unpaid</button></form>}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </AdminPage>
  );
}
