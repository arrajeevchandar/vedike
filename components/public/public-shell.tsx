import { Footer } from "./footer";
import { PublicNav } from "./public-nav";
export function PublicShell({children}:{children:React.ReactNode}){return <><PublicNav/><main>{children}</main><Footer/></>}
