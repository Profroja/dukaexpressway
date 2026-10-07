import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Store,
  Package,
  ShoppingCart,
  Coins,
  TrendingUp,
  Calendar,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  LogOut,
  CircleUserRound,
} from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const menuItems = [
  { icon: LayoutDashboard, label: "Home", href: "/admin" },
  { icon: Users, label: "Users", href: "/admin/users" },
  { icon: Store, label: "Stores", href: "/admin/stores" },
  { icon: Package, label: "Products", href: "/admin/products" },
  { icon: ShoppingCart, label: "Orders", href: "/admin/orders" },
  { icon: TrendingUp, label: "Revenue", href: "/admin/revenue" },
  { icon: Coins, label: "Monthly Subscriptions", href: "/admin/subscriptions" },
  { icon: Calendar, label: "Calendar", href: "#" },
  { icon: Settings, label: "Settings", href: "#" },
];

function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState("Admin");
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch("/api/logout/", { method: "POST", credentials: "include" });
    } catch {
      // ignore network errors; still redirect
    }
    navigate({ to: "/login" });
  };

  useEffect(() => {
    fetch("/api/me/", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.name) setAdminName(data.name);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-slate-50">
      {/* Mobile/Tablet Backdrop */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white shadow-2xl transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 lg:shadow-none ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center">
              <span className="text-white font-black text-sm">ME</span>
            </div>
            <span className="font-bold text-lg text-white">
              Duka Magic <em className="not-italic text-primary">Expressway</em>
            </span>
          </div>
          <button
            className="rounded p-1 hover:bg-slate-700 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const active = location.pathname === item.href;
            if (item.href === "#") {
              return (
                <button
                  key={item.label}
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-700 transition"
                >
                  <item.icon className="size-5 shrink-0" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            }
            return (
              <Link
                key={item.label}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                  active
                    ? "bg-gradient-to-r from-primary to-orange-600 text-white"
                    : "text-slate-300 hover:bg-slate-700"
                }`}
              >
                <item.icon className="size-5 shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-red-400 transition"
          >
            <LogOut className="size-5 shrink-0" />
            <span className="text-sm font-medium">Log out</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="border-b border-slate-200 bg-white px-3 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 lg:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="size-5" />
              </button>
              <div className="relative hidden max-w-md flex-1 sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search anything..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="relative p-2 hover:bg-slate-100 rounded-lg">
                <Bell className="size-5 text-slate-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100 transition"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-orange-600 text-white">
                    <CircleUserRound className="size-5" />
                  </span>
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-48 z-20 bg-white rounded-xl border border-slate-200 shadow-lg py-2">
                      <div className="px-4 py-2">
                        <span className="block text-sm font-semibold text-slate-900">
                          {adminName}
                        </span>
                        <span className="block text-xs font-normal text-slate-500">
                          Administrator
                        </span>
                      </div>
                      <div className="my-1 border-t border-slate-200" />
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="size-4" /> Log out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
