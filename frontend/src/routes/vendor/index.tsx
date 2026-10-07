import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, CircleAlert, CircleCheck, Crown, Package, ShoppingCart, Store, Wallet, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/vendor/")({
  component: VendorDashboard,
});

// Purchase orders from Mo Expressway - customer details are never exposed to vendors.
type RecentOrder = {
  id: string;
  po_number: string;
  product_title: string;
  product_image: string;
  quantity: number;
  total: string;
  currency: string;
  status: "sent" | "accepted" | "ready" | "picked_up" | "rejected" | "cancelled";
  created_at: string | null;
};

type SubscriptionStatus = "paid" | "unpaid" | "not_billed";

type SubscriptionInvoiceInfo = {
  month: string;
  amount: string;
  status: SubscriptionStatus;
  paid_at: string | null;
};

type DashboardData = {
  store: { name: string; category: string };
  vendor_name: string;
  summary: {
    total_sales: string;
    orders: number;
    listings: number;
    platform_subscription: string;
  };
  subscription: SubscriptionInvoiceInfo & {
    history: SubscriptionInvoiceInfo[];
    plan: "free" | "monthly";
    plan_label: string;
    monthly_fee: string;
    plan_updated_at: string | null;
  };
  recent_orders: RecentOrder[];
};

const statusStyles: Record<RecentOrder["status"], string> = {
  sent: "bg-amber-100 text-amber-700",
  accepted: "bg-blue-100 text-blue-700",
  ready: "bg-purple-100 text-purple-700",
  picked_up: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-600",
  cancelled: "bg-slate-200 text-slate-600",
};

const statusLabels: Record<RecentOrder["status"], string> = {
  sent: "New",
  accepted: "Accepted",
  ready: "Ready for pickup",
  picked_up: "Collected",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function VendorDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/vendor/dashboard/", { credentials: "include" })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => setData(result))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const isServiceStore = data?.store.category.toLowerCase() === "services";
  const isMixedStore = data?.store.category.toLowerCase() === "goods & services";
  const subscription = data?.subscription;
  const subStatus = subscription?.status || "not_billed";
  const subtotal = Number(subscription?.amount || 0);
  const monthLabel = subscription?.month
    ? new Date(subscription.month + "T00:00:00").toLocaleString([], { month: "long", year: "numeric" })
    : "—";
  const statusConfig: Record<SubscriptionStatus, { label: string; badge: string; note: string }> = {
    paid: {
      label: "Paid",
      badge: "bg-emerald-100 text-emerald-700",
      note: `You have paid the subscription for ${monthLabel}. Thank you!`,
    },
    unpaid: {
      label: "Unpaid",
      badge: "bg-red-100 text-red-700",
      note: `Pay TZS ${subtotal.toLocaleString()} for ${monthLabel} to keep your store visible to customers.`,
    },
    not_billed: {
      label: "Not billed",
      badge: "bg-slate-100 text-slate-600",
      note: `No subscription invoice has been created for ${monthLabel} yet.`,
    },
  };
  const currentStatus = statusConfig[subStatus];
  const isFreePlan = subscription?.plan === "free";
  const monthlyFee = Number(subscription?.monthly_fee || 0);

  const stats = [
    {
      label: "Total Sales",
      value: `TZS ${Number(data?.summary.total_sales || 0).toLocaleString()}`,
      icon: ShoppingCart,
      iconStyle: "bg-purple-50 text-purple-600",
    },
    {
      label: "Orders",
      value: String(data?.summary.orders || 0),
      icon: Package,
      iconStyle: "bg-orange-50 text-orange-600",
    },
    {
      label: isMixedStore ? "Products & Services" : isServiceStore ? "Services" : "Products",
      value: String(data?.summary.listings || 0),
      icon: isServiceStore ? Wrench : Package,
      iconStyle: "bg-blue-50 text-blue-600",
    },
    {
      label: "Subscription",
      value: data?.summary.platform_subscription || "—",
      icon: Crown,
      iconStyle: "bg-sky-50 text-sky-600",
    },
  ];

  return (
    <>
      {/* Hero Card */}
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 p-5 text-white sm:p-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30" />
        <div className="relative z-10">
          <p className="text-sm font-semibold text-white/80">{data?.store.name || "Your Store"}</p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">Welcome, {data?.vendor_name || "Vendor"}</h1>
          <p className="mt-2 text-sm text-white/90">Here&apos;s what&apos;s happening with your store today.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-lg sm:p-6">
            <div className={`mb-4 flex size-11 items-center justify-center rounded-lg ${stat.iconStyle}`}>
              <stat.icon className="size-6" />
            </div>
            <div className="break-words text-xl font-black text-slate-900 sm:text-2xl">{loading ? "..." : stat.value}</div>
            <div className="mt-1 text-xs text-slate-500 sm:text-sm">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Subscription */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Wallet className="size-5 text-primary" /> Subscription</h3>
          <span className={`rounded-full px-3 py-1 text-xs font-black capitalize ${loading ? "bg-slate-100 text-slate-500" : isFreePlan ? "bg-sky-100 text-sky-700" : currentStatus.badge}`}>
            {loading ? "..." : isFreePlan ? "Free" : currentStatus.label}
          </span>
        </div>

        {/* Current plan */}
        {!loading && subscription && (
          <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${isFreePlan ? "border-sky-200 bg-sky-50" : "border-purple-200 bg-purple-50"}`}>
            <div className="flex items-center gap-3">
              <div className={`flex size-11 items-center justify-center rounded-lg ${isFreePlan ? "bg-sky-100 text-sky-600" : "bg-purple-100 text-purple-600"}`}>
                <Crown className="size-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Your plan</p>
                <p className="text-lg font-black text-slate-900">{subscription.plan_label} plan</p>
              </div>
            </div>
            <p className="text-sm font-bold text-slate-700">
              {isFreePlan ? "TZS 0 — no monthly fee" : `TZS ${monthlyFee.toLocaleString()} / month`}
            </p>
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-sm text-slate-500">Loading subscription...</div>
        ) : isFreePlan ? (
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">
            You are on the Free plan. Your products stay visible to customers without a monthly fee.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <CalendarDays className="size-4 text-primary" /> Billing Month
              </div>
              <p className="mt-2 text-lg font-black text-slate-900">{monthLabel}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Wallet className="size-4 text-primary" /> Amount to Pay
              </div>
              <p className="mt-2 text-lg font-black text-slate-900">
                {subscription?.amount ? `TZS ${subtotal.toLocaleString()}` : "TZS 0"}
              </p>
              {subscription?.amount && <p className="mt-1 text-xs text-slate-500">For {monthLabel}</p>}
            </div>
            <div className={`rounded-xl p-4 ${subStatus === "paid" ? "bg-emerald-50" : subStatus === "unpaid" ? "bg-red-50" : "bg-slate-100"}`}>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                {subStatus === "paid" ? <CircleCheck className="size-4 text-emerald-600" /> : <CircleAlert className="size-4 text-red-500" />} Payment Status
              </div>
              <p className="mt-2 text-lg font-black text-slate-900 capitalize">{currentStatus.label}</p>
              {subStatus === "paid" && subscription?.paid_at && (
                <p className="mt-1 text-xs text-slate-500">Paid on {new Date(subscription.paid_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
              )}
            </div>
          </div>
        )}

        {!isFreePlan && (
          <p className={`mt-4 rounded-lg px-3 py-2 text-xs font-semibold ${loading ? "bg-slate-50 text-slate-500" : subStatus === "paid" ? "bg-emerald-50 text-emerald-700" : subStatus === "unpaid" ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-600"}`}>
            {loading ? "Loading..." : currentStatus.note}
          </p>
        )}

        {(subscription?.history?.length || 0) > 0 && (
          <div className="mt-5">
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Recent months</h4>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-400">
                    <th className="py-2 pr-3">Month</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {subscription!.history.map((inv) => {
                    const month = new Date(inv.month + "T00:00:00").toLocaleString([], { month: "long", year: "numeric" });
                    const sConfig = statusConfig[inv.status];
                    return (
                      <tr key={inv.month} className="border-b border-slate-100 last:border-0">
                        <td className="py-2.5 pr-3 font-semibold text-slate-900">{month}</td>
                        <td className="py-2.5 pr-3 font-bold text-slate-900">TZS {Number(inv.amount).toLocaleString()}</td>
                        <td className="py-2.5">
                          <span className={`rounded-full px-2 py-1 text-xs font-black capitalize ${sConfig.badge}`}>{sConfig.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Recent Orders */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-900">Recent Orders</h3>
          <Button variant="outline" size="sm" onClick={() => { window.location.href = "/vendor/orders"; }}>View All</Button>
        </div>
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Loading dashboard...</div>
        ) : !data?.recent_orders.length ? (
          <div className="py-16 text-center">
            <Store className="mx-auto size-10 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-500">No orders received yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="py-3 pr-3">S/N</th>
                  <th className="py-3 pr-3">Order No.</th>
                  <th className="py-3 pr-3">Product</th>
                  <th className="py-3 pr-3">Amount</th>
                  <th className="py-3 pr-3">Status</th>
                  <th className="py-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_orders.map((order, index) => (
                  <tr key={order.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-3 font-medium text-slate-500">{index + 1}</td>
                    <td className="py-3 pr-3 font-mono text-xs font-bold text-slate-700">{order.po_number}</td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                          {order.product_image ? <img src={order.product_image} alt={order.product_title} className="h-full w-full object-cover" /> : <Package className="size-4 text-slate-300" />}
                        </div>
                        <span className="max-w-[180px] truncate font-semibold text-slate-900">{order.quantity}x {order.product_title}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 font-bold text-slate-900">{order.currency} {Number(order.total).toLocaleString()}</td>
                    <td className="py-3 pr-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${statusStyles[order.status]}`}>{statusLabels[order.status]}</span></td>
                    <td className="whitespace-nowrap py-3 text-xs text-slate-400">{order.created_at ? new Date(order.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
