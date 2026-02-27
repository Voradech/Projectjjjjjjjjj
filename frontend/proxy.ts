import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const accessToken = req.cookies.get("accessToken")?.value;
  const role = req.cookies.get("role")?.value;
  const path = req.nextUrl.pathname;

  const isAuthPage =
    path === "/login" ||
    path === "/register" ;

  if (!accessToken && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (accessToken && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

if (path.startsWith("/admin") && role?.trim().toLowerCase() !== "admin") {
  return NextResponse.redirect(new URL("/admin/manageUser", req.url));
}

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/forgotPassword",
    "/alerts",
    "/predictView",
    "/viewGraph",
    "/admin/:path*",
  ],
};