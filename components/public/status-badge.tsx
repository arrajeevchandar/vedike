import type { DisplayStatus } from "@/lib/types";
export function StatusBadge({status}:{status:DisplayStatus}){return <span className={`badge badge-${status}`}>{status === "showcase" ? "Showcase" : status}</span>}
