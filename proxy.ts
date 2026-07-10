import { NextRequest, NextResponse } from "next/server";
export function proxy(request:NextRequest){if(request.nextUrl.pathname.startsWith("/admin")&&!request.nextUrl.pathname.startsWith("/admin/login")&&!request.cookies.has("vedike_admin")){return NextResponse.redirect(new URL("/admin/login",request.url))}return NextResponse.next()}
export const config={matcher:["/admin/:path*"]};
