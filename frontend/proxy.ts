import { NextRequest, NextResponse } from "next/server";

async function validateSession(req: NextRequest) {
  const accessToken = req.cookies.get("accessToken")?.value;
  if (!accessToken) {
    return false;
  }
  return true;

}
export async function proxy(req: NextRequest) {
  const accessToken = await validateSession(req);
  const path = req.nextUrl.pathname;
  const isAuthPage =
    path === "/login" ||
    path === "/register" ;

  const protectedPaths = ["/alerts", "/predictView", "/news"];
  const isProtected = protectedPaths.some((protectedPath) => path === protectedPath);

  if (isProtected && !accessToken) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (accessToken && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  /* if (path.startsWith("/admin") && role?.trim().toLowerCase() !== "admin") {
    return NextResponse.redirect(new URL("/admin/manageUser", req.url));
  }*/
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/:path",
    "/((?!api|trpc|_next|_vercel|.\..).)",
  ],
};