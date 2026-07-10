/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req: any) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isLoginPage = pathname === "/login";
  const isChangePasswordPage = pathname === "/change-password";
  const isApiAuth = pathname.startsWith("/api/auth");
  const isApiHealth = pathname.startsWith("/api/health");
  if (isApiAuth || isApiHealth) return NextResponse.next();
  const isStatic =
    pathname.startsWith("/_next") || pathname.startsWith("/favicon.ico");

  if (isStatic || isApiAuth) return NextResponse.next();
  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  // Let mustChangePassword users through to change-password page only
  // The app layout handles the redirect for everything else
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
