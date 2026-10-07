import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  Crown,
  Info,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { MonthPicker } from "@/components/MonthPicker";

export const Route = createFileRoute("/admin/revenue")({
  component: AdminRevenuePage,
});

type FinanceData = {
  month: string;
  summary: {
    received_from_customers: string;
    paid_to_vendors: string;
    cost_of_delivered_orders: string;
    order_profit: string;
    subscription_income: string;
    total_revenue: string;
    delivered_orders: number;
    closed_orders: number;
    awaiting_close: number;
    awaiting_close_expected: string;
    vendor_payments: number;
    paid_subscriptions: number;
    unpaid_subscriptions: number;
  };
  awaiting_close: {
    id: string;
    delivered_at: string | null;
    product: string;
    customer_name: string;
    expected: string;
  }[];
  orders: {
    id: string;
    delivered_at: string | null;
    closed_at: string | null;
    agreed_price: string;
    product: string;
    listing_type: string;
    customer_name: string;
    stores: string[];
    customer_paid: string;
    paid_to_store: string;
    profit: string;
  }[];
  vendor_payments: {
    po_number: string;
    store: string;
    item: string;
    paid_at: string | null;
    agreed: string;
    amount: string;
    status: string;
  }[];
  subscriptions: { store: string; amount: string; paid_at: string | null }[];
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function tzs(value: string | number) {
  return `TZS ${Number(value).toLocaleString()}`;
}

function day(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" }) : "—";
}

function AdminRevenuePage() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/admin/finance/?month=${encodeURIComponent(month)}`, { credentials: "include" })
      .then(async (response) => {
        const json = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok) {
          setError(json?.error || "Could not load revenue.");
          setData(null);
        } else {
          setData(json);
        }
      })
      .catch(() => !cancelled && setError("Could not reach the server."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [month]);

  const s = data?.summary;
  const profit = Number(s?.order_profit || 0);
  const total = Number(s?.total_revenue || 0);

  const cards = [
    {
      label: "Received from customers",
      value: s?.received_from_customers,
      note: `${s?.closed_orders ?? 0} closed order${s?.closed_orders === 1 ? "" : "s"} (exact amounts)`,
      icon: ArrowDownLeft,
      style: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Paid to vendors",
      value: s?.paid_to_vendors,
      note: `${s?.vendor_payments ?? 0} payment${s?.vendor_payments === 1 ? "" : "s"} confirmed by stores`,
      icon: ArrowUpRight,
      style: "bg-red-50 text-red-600",
    },
    {
      label: "Profit on orders",
      value: s?.order_profit,
      note: `Customer paid − store cost (${tzs(s?.cost_of_delivered_orders || 0)})`,
      icon: TrendingUp,
      style: profit >= 0 ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600",
    },
    {
      label: "Subscription income",
      value: s?.subscription_income,
      note: `${s?.paid_subscriptions ?? 0} paid · ${s?.unpaid_subscriptions ?? 0} unpaid`,
      icon: Crown,
      style: "bg-purple-50 text-purple-600",
    },
  ];

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Revenue</h1>
          <p className="mt-1 text-sm text-slate-500">
            What Mo Expressway earned in {monthLabel(month)}: profit on orders plus subscription
            income.
          </p>
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {error && (
        <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      )}

      {/* Total revenue */}
      <div className="mt-6 overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-orange-700 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-white/70">
              <Coins className="size-4" /> Total revenue · {monthLabel(month)}
            </p>
            <p className={`mt-2 text-4xl font-black ${total < 0 ? "text-red-300" : ""}`}>
              {loading ? "..." : tzs(total)}
            </p>
          </div>
          <p className="text-sm text-white/70">
            {loading
              ? ""
              : `${tzs(s?.order_profit || 0)} order profit + ${tzs(s?.subscription_income || 0)} subscriptions`}
          </p>
        </div>
      </div>

      {/* Cards */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <div
              className={`mb-4 flex size-11 items-center justify-center rounded-lg ${card.style}`}
            >
              <card.icon className="size-6" />
            </div>
            <div className="text-xl font-black text-slate-900 sm:text-2xl">
              {loading ? "..." : tzs(card.value || 0)}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-600">{card.label}</div>
            <div className="mt-0.5 text-xs text-slate-400">{loading ? "" : card.note}</div>
          </div>
        ))}
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <Info className="mt-0.5 size-4 shrink-0 text-slate-400" />
        Customer money counts when you close an order with exactly what the customer paid. Vendor
        payments count when the store marks the order as paid (the amount it entered). Profit on
        orders compares, for the orders closed this month, what the customer paid with what we paid
        the store.
      </p>

      {/* Delivered, payment not recorded */}
      {!loading && (data?.awaiting_close.length ?? 0) > 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-black text-amber-900">
              <AlertCircle className="size-4" />
              {data?.awaiting_close.length} delivered order
              {data?.awaiting_close.length === 1 ? "" : "s"} waiting to be closed
            </p>
            <Link
              to="/admin/orders"
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
            >
              Close them on Orders
            </Link>
          </div>
          <p className="mt-1 text-xs text-amber-800">
            Their money isn't counted until you record exactly what each customer paid (about{" "}
            {tzs(s?.awaiting_close_expected || 0)} expected).
          </p>
          <ul className="mt-3 divide-y divide-amber-200 text-sm">
            {data?.awaiting_close.map((o) => (
              <li key={o.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="text-amber-900">
                  <b>{o.product}</b> · {o.customer_name}
                  <span className="ml-2 text-xs text-amber-700">
                    delivered {day(o.delivered_at)}
                  </span>
                </span>
                <span className="text-xs font-semibold text-amber-800">
                  agreed {tzs(o.expected)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Closed orders */}
      <Section title="Closed orders" count={data?.orders.length} loading={loading}>
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-400">
              <th className="py-3 pr-3">Date</th>
              <th className="py-3 pr-3">Order</th>
              <th className="py-3 pr-3">Customer</th>
              <th className="py-3 pr-3">Store</th>
              <th className="py-3 pr-3 text-right">Customer paid</th>
              <th className="py-3 pr-3 text-right">Paid to store</th>
              <th className="py-3 text-right">Profit</th>
            </tr>
          </thead>
          <tbody>
            {data?.orders.map((o) => (
              <tr key={o.id} className="border-b border-slate-100 last:border-0">
                <td className="whitespace-nowrap py-3 pr-3 text-xs text-slate-500">
                  {day(o.delivered_at)}
                </td>
                <td className="py-3 pr-3 font-semibold text-slate-900">
                  {o.product}
                  {o.listing_type === "service" && (
                    <span className="ml-1.5 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">
                      Booking
                    </span>
                  )}
                </td>
                <td className="py-3 pr-3 text-slate-600">{o.customer_name}</td>
                <td className="py-3 pr-3 text-slate-600">{o.stores.join(", ") || "—"}</td>
                <td className="whitespace-nowrap py-3 pr-3 text-right font-semibold text-emerald-700">
                  {tzs(o.customer_paid)}
                </td>
                <td className="whitespace-nowrap py-3 pr-3 text-right text-red-600">
                  {tzs(o.paid_to_store)}
                </td>
                <td
                  className={`whitespace-nowrap py-3 text-right font-black ${
                    Number(o.profit) >= 0 ? "text-slate-900" : "text-red-600"
                  }`}
                >
                  {tzs(o.profit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Vendor payments */}
      <Section title="Payments to vendors" count={data?.vendor_payments.length} loading={loading}>
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-400">
              <th className="py-3 pr-3">Date</th>
              <th className="py-3 pr-3">PO</th>
              <th className="py-3 pr-3">Store</th>
              <th className="py-3 pr-3">Item</th>
              <th className="py-3 pr-3 text-right">Agreed</th>
              <th className="py-3 text-right">Paid</th>
            </tr>
          </thead>
          <tbody>
            {data?.vendor_payments.map((p) => (
              <tr key={p.po_number} className="border-b border-slate-100 last:border-0">
                <td className="whitespace-nowrap py-3 pr-3 text-xs text-slate-500">
                  {day(p.paid_at)}
                </td>
                <td className="py-3 pr-3 font-mono text-xs text-slate-600">{p.po_number}</td>
                <td className="py-3 pr-3 font-semibold text-slate-800">{p.store}</td>
                <td className="py-3 pr-3 text-slate-600">{p.item}</td>
                <td className="whitespace-nowrap py-3 pr-3 text-right text-slate-500">
                  {tzs(p.agreed)}
                </td>
                <td className="whitespace-nowrap py-3 text-right font-bold text-red-600">
                  {tzs(p.amount)}
                  {Number(p.amount) !== Number(p.agreed) && (
                    <span className="ml-1 text-[10px] font-semibold text-amber-600">≠ agreed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Subscriptions */}
      <Section title="Subscription payments" count={data?.subscriptions.length} loading={loading}>
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-400">
              <th className="py-3 pr-3">Store</th>
              <th className="py-3 pr-3">Paid on</th>
              <th className="py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data?.subscriptions.map((sub) => (
              <tr key={sub.store} className="border-b border-slate-100 last:border-0">
                <td className="py-3 pr-3 font-semibold text-slate-800">{sub.store}</td>
                <td className="py-3 pr-3 text-xs text-slate-500">{day(sub.paid_at)}</td>
                <td className="py-3 text-right font-bold text-purple-700">{tzs(sub.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}

function Section({
  title,
  count,
  loading,
  children,
}: {
  title: string;
  count: number | undefined;
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 sm:px-6">
        <Receipt className="size-4 text-slate-400" />
        <h2 className="text-base font-black text-slate-900">{title}</h2>
        {!loading && count !== undefined && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
            {count}
          </span>
        )}
      </div>
      {loading ? (
        <div className="py-10 text-center text-sm text-slate-500">Loading...</div>
      ) : !count ? (
        <div className="py-10 text-center text-sm text-slate-400">Nothing this month.</div>
      ) : (
        <div className="overflow-x-auto px-4 sm:px-6">{children}</div>
      )}
    </div>
  );
}
