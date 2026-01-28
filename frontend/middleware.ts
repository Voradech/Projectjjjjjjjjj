import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const accessToken = req.cookies.get("accessToken")?.value;
  const role = req.cookies.get("role")?.value;
  const path = req.nextUrl.pathname;

  const isAuthPage =
    path === "/login" ||
    path === "/register" ||
    path === "/forgotPassword";

  if (!accessToken && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (accessToken && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (path.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/forgotPassword",
    "/alert",
    "/alers",
    "/predictView",
    "/viewGraph",
    "/admin/:path*",
  ],
};
