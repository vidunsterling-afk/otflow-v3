/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req: any) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isLoginPage = pathname === "/login";
  const isChangePasswordPage = pathname === "/change-password";
  const isApiAuth = pathname.startsWith("/api/auth");
  const isStatic =
    pathname.startsWith("/_next") || pathname.startsWith("/favicon.ico");

  const isPublicApi =
    pathname === "/api/settings/logo" || pathname === "/api/health/db";

  if (isStatic || isApiAuth || isPublicApi) return NextResponse.next();
  // Not logged in — send to login (except login page itself)
  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Logged in + on login page — send to dashboard
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Logged in + mustChangePassword + NOT already on change-password page
  // → force to change-password
  if (isLoggedIn && !isChangePasswordPage) {
    const mustChange = req.auth?.user?.mustChangePassword;
    if (mustChange) {
      return NextResponse.redirect(new URL("/change-password", req.url));
    }
  }

  // Logged in + on change-password page + does NOT need to change
  // → send to dashboard (they navigated there manually)
  if (isLoggedIn && isChangePasswordPage) {
    const mustChange = req.auth?.user?.mustChangePassword;
    if (!mustChange) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
