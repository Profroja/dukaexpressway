import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Coins,
  Crown,
  HandCoins,
  Package,
  PhoneCall,
  Store,
  Truck,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MonthPicker } from "@/components/MonthPicker";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

type Cards = {
  stores_total: number;
  stores_approved: number;
  stores_pending: number;
  stores_free_plan: number;
  stores_monthly_plan: number;
  customers: number;
  customers_new_this_month: number;
  vendors: number;
  products: number;
  services: number;
  orders_this_month: number;
  orders_needing_action: number;
  orders_at_stores: number;
  orders_on_the_way: number;
  orders_delivered_this_month: number;
  orders_closed_this_month: number;
  orders_awaiting_close: number;
  awaiting_close_expected: string;
  orders_cancelled_this_month: number;
  owed_to_vendors: string;
  owed_to_vendors_count: number;
  total_revenue: string;
  received_from_customers: string;
  paid_to_vendors: string;
  order_profit: string;
  subscription_income: string;
  unpaid_subscriptions: number;
};

type Stats = {
  monthly: {
    month: string;
    label: string;
    total_revenue: number;
    received_from_customers: number;
    paid_to_vendors: number;
    orders: number;
  }[];
  daily_orders: { date: string; label: string; orders: number }[];
  orders_by_status: { status: string; label: string; orders: number }[];
  top_stores: { store: string; amount: number; orders: number }[];
};

// Chart tokens - the validated default categorical slots (blue, orange) and
// recessive chrome. Text never wears a series color.
const SERIES_1 = "#2a78d6";
const SERIES_2 = "#eb6834";
const GRID = "#e1e0d9";
const AXIS_TEXT = "#898781";
const BASELINE = "#c3c2b7";

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  confirmed: "Confirmed",
  sourcing: "At store",
  picked_up: "On the way",
  delivered: "To close",
  closed: "Closed",
  cancelled: "Cancelled",
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

/** Axis ticks: 0 / 450K / 1.2M */
function compact(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

/** Column with a 4px rounded data-end and a square baseline, for positive and negative values. */
function RoundedColumn(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
}) {
  const { x = 0, y = 0, width = 0, fill } = props;
  let { height = 0 } = props;
  if (!width || !height) return null;
  const negative = height < 0;
  height = Math.abs(height);
  const top = negative ? y - height : y;
  const r = Math.min(4, width / 2, height);
  const path = negative
    ? // rounded at the bottom (data end), square at the top (baseline)
      `M${x},${top} h${width} v${height - r} q0,${r} -${r},${r} h-${width - 2 * r} q-${r},0 -${r},-${r} Z`
    : `M${x},${top + height} v-${height - r} q0,-${r} ${r},-${r} h${width - 2 * r} q${r},0 ${r},${r} v${height - r} Z`;
  return <path d={path} fill={fill} />;
}

/** Horizontal bar with a 4px rounded data-end (right), square at the baseline (left). */
function RoundedBarH(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
}) {
  const { x = 0, y = 0, width = 0, height = 0, fill } = props;
  if (width <= 0 || !height) return null;
  const r = Math.min(4, height / 2, width);
  return (
    <path
      d={`M${x},${y} h${width - r} q${r},0 ${r},${r} v${height - 2 * r} q0,${r} -${r},${r} h-${width - r} Z`}
      fill={fill}
    />
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  money = true,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  money?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-bold text-slate-900">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-slate-600">
          <span className="size-2.5 rounded-sm" style={{ background: p.color }} />
          {p.name}:{" "}
          <span className="font-semibold text-slate-900">
            {money ? tzs(p.value) : p.value.toLocaleString()}
          </span>
        </p>
      ))}
    </div>
  );
}

function AdminDashboard() {
  const [month, setMonth] = useState(currentMonth());
  const [cards, setCards] = useState<Cards | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/admin/dashboard/?month=${encodeURIComponent(month)}`, { credentials: "include" })
      .then(async (response) => {
        const json = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok) {
          setError(json?.error || "Could not load the dashboard.");
          return;
        }
        setCards(json.cards);
        setStats(json.stats);
      })
      .catch(() => !cancelled && setError("Could not reach the server."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [month]);

  const v = (value: ReactNode) => (loading || !cards ? "..." : value);
  const total = Number(cards?.total_revenue || 0);

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Manager Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Overview of platform performance and activity · {monthLabel(month)}
          </p>
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {error && (
        <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      )}

      {/* Hero: total revenue */}
      <Link
        to="/admin/revenue"
        className="block overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-orange-700 p-6 text-white shadow-lg transition hover:shadow-xl"
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-white/70">
          <Coins className="size-4" /> Total revenue · {monthLabel(month)}
        </p>
        <p className={`mt-2 text-5xl font-black ${total < 0 ? "text-red-300" : ""}`}>
          {v(tzs(total))}
        </p>
        <p className="mt-2 text-sm text-white/70">
          {v(
            `${tzs(cards?.order_profit || 0)} profit on orders + ${tzs(cards?.subscription_income || 0)} subscriptions`,
          )}
        </p>
      </Link>

      {/* Money */}
      <Group title="Money this month">
        <StatCard
          to="/admin/revenue"
          icon={ArrowDownLeft}
          tone="bg-emerald-50 text-emerald-600"
          label="Received from customers"
          value={v(tzs(cards?.received_from_customers || 0))}
          note={v(`${cards?.orders_closed_this_month} closed orders (exact amounts)`)}
        />
        <StatCard
          to="/admin/revenue"
          icon={ArrowUpRight}
          tone="bg-red-50 text-red-600"
          label="Paid to vendors"
          value={v(tzs(cards?.paid_to_vendors || 0))}
          note="Confirmed by stores"
        />
        <StatCard
          to="/admin/orders"
          icon={HandCoins}
          tone="bg-amber-50 text-amber-600"
          label="Still to pay vendors"
          value={v(tzs(cards?.owed_to_vendors || 0))}
          note={v(`${cards?.owed_to_vendors_count} accepted orders not paid yet`)}
        />
        <StatCard
          to="/admin/subscriptions"
          icon={Crown}
          tone="bg-purple-50 text-purple-600"
          label="Subscription income"
          value={v(tzs(cards?.subscription_income || 0))}
          note={v(`${cards?.unpaid_subscriptions} invoices unpaid`)}
        />
      </Group>

      {/* Orders */}
      <Group title="Orders">
        <StatCard
          to="/admin/orders"
          icon={ClipboardList}
          tone="bg-blue-50 text-blue-600"
          label="Orders this month"
          value={v(cards?.orders_this_month)}
          note={v(`${cards?.orders_cancelled_this_month} cancelled`)}
        />
        <StatCard
          to="/admin/orders"
          icon={PhoneCall}
          tone="bg-amber-50 text-amber-600"
          label="Needing your action"
          value={v(cards?.orders_needing_action)}
          note="New, contacted or confirmed"
          alert={!!cards?.orders_needing_action}
        />
        <StatCard
          to="/admin/orders"
          icon={Store}
          tone="bg-purple-50 text-purple-600"
          label="At stores"
          value={v(cards?.orders_at_stores)}
          note={v(`${cards?.orders_on_the_way} on the way to customers`)}
        />
        <StatCard
          to="/admin/orders"
          icon={Truck}
          tone="bg-amber-50 text-amber-700"
          label="Delivered · to close"
          value={v(cards?.orders_awaiting_close)}
          note={v(`Record payment · ~${tzs(cards?.awaiting_close_expected || 0)} expected`)}
          alert={!!cards?.orders_awaiting_close}
        />
        <StatCard
          to="/admin/revenue"
          icon={CheckCircle2}
          tone="bg-emerald-50 text-emerald-600"
          label="Closed this month"
          value={v(cards?.orders_closed_this_month)}
          note="Payment recorded"
        />
      </Group>

      {/* Platform */}
      <Group title="Platform">
        <StatCard
          to="/admin/stores"
          icon={Store}
          tone="bg-blue-50 text-blue-600"
          label="Stores"
          value={v(cards?.stores_total)}
          note={v(`${cards?.stores_approved} approved · ${cards?.stores_pending} pending`)}
          alert={!!cards?.stores_pending}
        />
        <StatCard
          to="/admin/orders"
          icon={Users}
          tone="bg-emerald-50 text-emerald-600"
          label="Customers"
          value={v(cards?.customers)}
          note={v(`${cards?.customers_new_this_month} new this month`)}
        />
        <StatCard
          to="/admin/users"
          icon={UserRound}
          tone="bg-orange-50 text-orange-600"
          label="Active vendors"
          value={v(cards?.vendors)}
          note={v(`${cards?.stores_free_plan} free · ${cards?.stores_monthly_plan} monthly plan`)}
        />
        <StatCard
          to="/admin/products"
          icon={Package}
          tone="bg-cyan-50 text-cyan-600"
          label="Products & services"
          value={v((cards?.products || 0) + (cards?.services || 0))}
          note={
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <Package className="size-3" /> {v(cards?.products)}
              </span>
              <span className="flex items-center gap-1">
                <Wrench className="size-3" /> {v(cards?.services)}
              </span>
            </span>
          }
        />
      </Group>

      {/* Statistics */}
      <h2 className="mb-3 mt-8 text-lg font-black text-slate-900">Statistics</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Revenue"
          subtitle="Order profit + subscriptions, last 6 months"
          loading={loading}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats?.monthly ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              />
              <YAxis
                tickFormatter={compact}
                tickLine={false}
                axisLine={false}
                width={48}
                tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              />
              <ReferenceLine y={0} stroke={BASELINE} />
              <Tooltip cursor={{ fill: "rgba(11,11,11,0.04)" }} content={<ChartTooltip />} />
              <Bar
                dataKey="total_revenue"
                name="Revenue"
                fill={SERIES_1}
                maxBarSize={24}
                shape={<RoundedColumn />}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Money in vs money out"
          subtitle="Received from customers vs paid to vendors, last 6 months"
          loading={loading}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={stats?.monthly ?? []}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              barGap={2}
            >
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: BASELINE }}
                tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              />
              <YAxis
                tickFormatter={compact}
                tickLine={false}
                axisLine={false}
                width={48}
                tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              />
              <Tooltip cursor={{ fill: "rgba(11,11,11,0.04)" }} content={<ChartTooltip />} />
              <Legend
                iconType="square"
                iconSize={10}
                wrapperStyle={{ fontSize: 12, color: "#52514e" }}
                formatter={(value) => <span style={{ color: "#52514e" }}>{value}</span>}
              />
              <Bar
                dataKey="received_from_customers"
                name="Received from customers"
                fill={SERIES_1}
                maxBarSize={24}
                shape={<RoundedColumn />}
              />
              <Bar
                dataKey="paid_to_vendors"
                name="Paid to vendors"
                fill={SERIES_2}
                maxBarSize={24}
                shape={<RoundedColumn />}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Orders per day"
          subtitle={`New customer orders · ${monthLabel(month)}`}
          loading={loading}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={stats?.daily_orders ?? []}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: BASELINE }}
                interval="preserveStartEnd"
                tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={32}
                tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: "rgba(11,11,11,0.04)" }}
                content={<ChartTooltip money={false} />}
                labelFormatter={(label) => `Day ${label}`}
              />
              <Bar
                dataKey="orders"
                name="Orders"
                fill={SERIES_1}
                maxBarSize={24}
                shape={<RoundedColumn />}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Orders by status"
          subtitle={`Orders placed in ${monthLabel(month)}`}
          loading={loading}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              layout="vertical"
              data={(stats?.orders_by_status ?? []).map((s) => ({
                ...s,
                label: STATUS_LABEL[s.status] ?? s.label,
              }))}
              margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
            >
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis
                type="number"
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: BASELINE }}
                width={80}
                tick={{ fill: "#52514e", fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: "rgba(11,11,11,0.04)" }}
                content={<ChartTooltip money={false} />}
              />
              <Bar
                dataKey="orders"
                name="Orders"
                fill={SERIES_1}
                maxBarSize={18}
                shape={<RoundedBarH />}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Top stores"
          subtitle={`Paid to each store · ${monthLabel(month)}`}
          loading={loading}
          empty={!stats?.top_stores.length}
          className="lg:col-span-2"
        >
          <ResponsiveContainer
            width="100%"
            height={Math.max(120, (stats?.top_stores.length || 0) * 44)}
          >
            <BarChart
              layout="vertical"
              data={stats?.top_stores ?? []}
              margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
            >
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis
                type="number"
                tickFormatter={compact}
                tickLine={false}
                axisLine={false}
                tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="store"
                tickLine={false}
                axisLine={{ stroke: BASELINE }}
                width={140}
                tick={{ fill: "#52514e", fontSize: 12 }}
              />
              <Tooltip cursor={{ fill: "rgba(11,11,11,0.04)" }} content={<ChartTooltip />} />
              <Bar
                dataKey="amount"
                name="Paid"
                fill={SERIES_1}
                maxBarSize={18}
                shape={<RoundedBarH />}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">{title}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
        {children}
      </div>
    </section>
  );
}

function StatCard({
  to,
  icon: Icon,
  tone,
  label,
  value,
  note,
  alert = false,
}: {
  to: string;
  icon: typeof Store;
  tone: string;
  label: string;
  value: ReactNode;
  note: ReactNode;
  alert?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group rounded-xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex items-start justify-between">
        <div className={`flex size-11 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="size-6" />
        </div>
        {alert && (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            <AlertCircle className="size-3" /> Check
          </span>
        )}
      </div>
      <div className="mt-4 text-2xl font-black text-slate-900">{value}</div>
      <div className="mt-1 text-sm font-semibold text-slate-600">{label}</div>
      <div className="mt-0.5 text-xs text-slate-400">{note}</div>
    </Link>
  );
}

function ChartCard({
  title,
  subtitle,
  loading,
  empty = false,
  className = "",
  children,
}: {
  title: string;
  subtitle: string;
  loading: boolean;
  empty?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 sm:p-5 ${className}`}>
      <h3 className="text-base font-black text-slate-900">{title}</h3>
      <p className="mb-4 text-xs text-slate-500">{subtitle}</p>
      {loading ? (
        <div className="flex h-[240px] items-center justify-center text-sm text-slate-400">
          Loading...
        </div>
      ) : empty ? (
        <div className="flex h-[120px] items-center justify-center text-sm text-slate-400">
          No data this month.
        </div>
      ) : (
        children
      )}
    </div>
  );
}
