import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const accessToken = req.cookies.get("accessToken")?.value;
  const path = req.nextUrl.pathname;

  const isAuthPage = path === "/login" || path === "/register";

  const protectedPaths = ["/alerts", "/predictView", "/news"];
  const isProtected = protectedPaths.includes(path);

  if (isProtected && !accessToken) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (accessToken && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};