import NextAuth from "next-auth";
import authConfig from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const ROLE_DEFAULT_DASHBOARD: Record<string, string> = {
  ADMIN: "/dashboard",
  FACTURACION: "/dashboard/pedidos",
  IGUALADOR: "/dashboard/produccion",
  VENDEDOR_READONLY: "/dashboard/pedidos",
};

const ROLE_ALLOWED_PREFIXES: Record<string, string[]> = {
  ADMIN: ["/dashboard"],
  FACTURACION: ["/dashboard/pedidos", "/dashboard/clientes", "/dashboard/produccion"],
  IGUALADOR: ["/dashboard/produccion", "/dashboard/pedidos"],
  VENDEDOR_READONLY: ["/dashboard/pedidos"],
};

function isAllowedDashboardPath(pathname: string, role: string): boolean {
  const allowedPrefixes = ROLE_ALLOWED_PREFIXES[role] || [];
  return allowedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Public routes
  if (pathname === "/login" || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Protect dashboard routes
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/api/")) {
    if (!req.auth) {
      const loginUrl = new URL("/login", req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith("/dashboard") && req.auth) {
    const role = (req.auth.user as { role?: string } | undefined)?.role || "";
    const fallback = ROLE_DEFAULT_DASHBOARD[role] || "/dashboard/pedidos";

    // Redirect non-admin users away from admin dashboard home.
    if (pathname === "/dashboard" && role !== "ADMIN") {
      return NextResponse.redirect(new URL(fallback, req.url));
    }

    // Block direct navigation to unauthorized dashboard sections.
    if (role && !isAllowedDashboardPath(pathname, role)) {
      return NextResponse.redirect(new URL(fallback, req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
