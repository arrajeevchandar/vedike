import { requireAdmin } from "@/lib/auth";import { AdminShell } from "./admin-shell";
export async function AdminPage({children}:{children:React.ReactNode}){const session=await requireAdmin();return <AdminShell email={session.email}>{children}</AdminShell>}
