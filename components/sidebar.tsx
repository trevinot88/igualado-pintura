"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  Factory,
  Users,
  Palette,
  BarChart3,
  ScrollText,
  UserCircle,
  LogOut,
  ChevronLeft,
  Menu,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["ADMIN"] },
  { label: "Producción", href: "/dashboard/produccion", icon: Factory, roles: ["ADMIN", "IGUALADOR"] },
  { label: "Nuevo Pedido", href: "/dashboard/pedidos/nuevo", icon: PlusCircle, roles: ["ADMIN", "VENDEDOR"] },
  { label: "Pedidos", href: "/dashboard/pedidos", icon: ClipboardList, roles: ["ADMIN", "VENDEDOR", "IGUALADOR"] },
  { label: "Clientes", href: "/dashboard/clientes", icon: Users, roles: ["ADMIN", "VENDEDOR"] },
  { label: "Precios", href: "/dashboard/precios", icon: Palette, roles: ["ADMIN"] },
  { label: "Reportes", href: "/dashboard/reportes", icon: BarChart3, roles: ["ADMIN"] },
  { label: "Usuarios", href: "/dashboard/usuarios", icon: UserCircle, roles: ["ADMIN"] },
  { label: "Auditoría", href: "/dashboard/audit", icon: ScrollText, roles: ["ADMIN"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const role = (session?.user as { role?: string })?.role || "";

  const filtered = navItems.filter((item) => item.roles.includes(role));

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden rounded-md bg-[#1e3a8a] p-2 text-white"
        onClick={() => setCollapsed(!collapsed)}
      >
        <Menu className="h-5 w-5" />
      </button>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white transition-all duration-300",
          collapsed ? "w-16" : "w-64",
          "max-lg:translate-x-0",
          collapsed ? "max-lg:-translate-x-full" : ""
        )}
      >
        {/* Brand */}
          <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <img src="/dyrlo-logo.png" alt="dyrlo" className="h-8 w-8 object-contain" />
              <span className="font-bold text-lg">dyrlo</span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:block rounded p-1 hover:bg-slate-100"
          >
            <ChevronLeft
              className={cn("h-5 w-5 transition-transform", collapsed && "rotate-180")}
            />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {filtered.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-blue-50 text-[#1e3a8a] font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-[#1e3a8a]"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
          <div className="border-t border-slate-200 p-3">
          {!collapsed && session?.user && (
            <div className="mb-2 px-3">
              <p className="text-sm font-medium truncate">{session.user.name}</p>
              <p className="text-xs text-slate-500 truncate">{role}</p>
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-[#1e3a8a]"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
