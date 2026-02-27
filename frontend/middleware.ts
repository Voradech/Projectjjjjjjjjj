import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const accessToken = req.cookies.get("accessToken")?.value;
  const role = req.cookies.get("role")?.value;
  const path = req.nextUrl.pathname;

  const isAuthPage =
    path === "/login" ||
    path === "/register" ;

  // Redirect to login if not authenticated and trying to access protected route
  if (!accessToken && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Redirect authenticated users away from auth pages
  if (accessToken && isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Protect admin routes - redirect non-admins to home page
// แก้โดยทำให้เข้มงวดขึ้น
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