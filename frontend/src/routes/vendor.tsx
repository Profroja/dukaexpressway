import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  Wrench,
  ShoppingCart,
  Bell,
  Search,
  Menu,
  X,
  Store,
  User,
  LogOut,
} from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/vendor")({
  component: VendorLayout,
});

const baseMenuItems = [
  { icon: ShoppingCart, label: "Orders", href: "/vendor/orders" },
];

function VendorLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [storeCategory, setStoreCategory] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const storeKind = storeCategory.toLowerCase();
  const isServiceStore = storeKind === "services";
  const isMixedStore = storeKind === "goods & services";
  const menuItems = [
    { icon: LayoutDashboard, label: "Home", href: "/vendor" },
    {
      icon: isServiceStore ? Wrench : Package,
      label: isMixedStore ? "Products & Services" : isServiceStore ? "Services" : "Products",
      href: "/vendor/products",
    },
    ...baseMenuItems,
  ];

  const handleLogout = async () => {
    try {
      await fetch("/api/logout/", { method: "POST", credentials: "include" });
    } catch {
      // ignore network errors; still redirect
    }
    window.location.href = "/";
  };

  useEffect(() => {
    fetch("/api/me/", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.store?.name) setStoreName(data.store.name);
        if (data?.store?.category) setStoreCategory(data.store.category);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-slate-50">
      {mobileSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white shadow-2xl transition-all duration-300 lg:static lg:z-auto lg:shadow-none ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${sidebarOpen ? "lg:w-64" : "lg:w-20"} lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          {(sidebarOpen || mobileSidebarOpen) && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center">
                <Store className="size-4 text-white" />
              </div>
              <span className="font-bold text-lg truncate">{storeName || "Your Store"}</span>
            </div>
          )}
          <button
            onClick={() => {
              if (mobileSidebarOpen) setMobileSidebarOpen(false);
              else setSidebarOpen(!sidebarOpen);
            }}
            className="rounded p-1 hover:bg-slate-700"
            aria-label={mobileSidebarOpen || sidebarOpen ? "Collapse menu" : "Open menu"}
          >
            {mobileSidebarOpen || sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const active = location.pathname === item.href;
            return (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMobileSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                  active
                    ? "bg-gradient-to-r from-primary to-orange-600 text-white"
                    : "text-slate-300 hover:bg-slate-700"
                }`}
              >
                <item.icon className="size-5 shrink-0" />
                {(sidebarOpen || mobileSidebarOpen) && <span className="text-sm font-medium">{item.label}</span>}
              </a>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="border-b border-slate-200 bg-white px-3 py-3 sm:px-6 sm:py-4">
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
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
            <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-gradient-to-r from-primary to-orange-600 px-4 py-1.5 text-white shadow-md md:flex">
              <Store className="size-4" />
              <span className="text-sm font-bold truncate max-w-[220px]">
                {storeName || "Your Store"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button className="relative p-2 hover:bg-slate-100 rounded-lg">
                <Bell className="size-5 text-slate-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <User className="size-5 text-slate-600" />
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-48 z-20 bg-white rounded-xl border border-slate-200 shadow-lg py-2">
                      <a
                        href="/vendor/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      >
                        <User className="size-4" /> My Profile
                      </a>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="size-4" /> Logout
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
