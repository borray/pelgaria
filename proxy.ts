import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Public routes — always accessible
  const publicPaths = ["/login", "/api/auth", "/verify", "/yandex_"];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Everything else requires auth
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Admin routes — admin only
  if (pathname.startsWith("/admin")) {
    const role = (session.user as { role?: string })?.role;
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/profile", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/files).*)"],
};
