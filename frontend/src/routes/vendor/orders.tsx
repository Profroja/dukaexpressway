import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  ClipboardList,
  HandCoins,
  Wallet,
  PackageCheck,
  Package,
  RefreshCw,
  ShoppingBag,
  ThumbsUp,
  Truck,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/vendor/orders")({
  component: VendorOrders,
});

type PurchaseOrderStatus = "sent" | "accepted" | "ready" | "picked_up" | "rejected" | "cancelled";

// Orders placed with this store by Mo Expressway. Customer details are never sent here.
type VendorOrder = {
  id: string;
  po_number: string;
  buyer: string;
  product_title: string;
  product_image: string;
  listing_type: "product" | "service";
  quantity: number;
  unit_price: string;
  total: string;
  currency: string;
  status: PurchaseOrderStatus;
  listing_price: string;
  price_status: "offered" | "awaiting_quote" | "vendor_proposed" | "agreed";
  vendor_quote: string | null;
  vendor_quote_note: string;
  payment_status: "unpaid" | "paid";
  paid_at: string | null;
  amount_received: string | null;
  vendor_note: string;
  created_at: string | null;
};

// Payment matters once the store has accepted the order.
const SHOWS_PAYMENT: PurchaseOrderStatus[] = ["accepted", "ready", "picked_up"];

const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  sent: "New",
  accepted: "Accepted",
  ready: "Ready for pickup",
  picked_up: "Collected",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const STATUS_BADGE: Record<PurchaseOrderStatus, string> = {
  sent: "bg-amber-100 text-amber-700",
  accepted: "bg-blue-100 text-blue-700",
  ready: "bg-purple-100 text-purple-700",
  picked_up: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-600",
  cancelled: "bg-slate-200 text-slate-600",
};

const NEXT_ACTION: Partial<
  Record<
    PurchaseOrderStatus,
    { label: string; next: PurchaseOrderStatus; icon: typeof ThumbsUp; color: string }
  >
> = {
  sent: {
    label: "Accept",
    next: "accepted",
    icon: ThumbsUp,
    color: "bg-blue-600 hover:bg-blue-700",
  },
  accepted: {
    label: "Mark Ready",
    next: "ready",
    icon: PackageCheck,
    color: "bg-purple-600 hover:bg-purple-700",
  },
};

const FILTERS = ["all", "sent", "accepted", "ready", "picked_up", "rejected", "cancelled"] as const;

/** Where the price stands: our offer, a request for the store's price, its proposal, or agreed. */
function PriceLines({ order }: { order: VendorOrder }) {
  const listed = Number(order.listing_price);
  const negotiated = Number(order.unit_price);
  const money = (value: number | string) => `${order.currency} ${Number(value).toLocaleString()}`;
  const listedLine = (
    <p
      className={
        listed !== negotiated && order.price_status !== "awaiting_quote"
          ? "text-slate-400 line-through"
          : "text-slate-500"
      }
    >
      Your listed price: {listed > 0 ? money(listed) : "on request"}
    </p>
  );

  if (order.price_status === "awaiting_quote")
    return (
      <div className="mt-0.5 space-y-0.5 text-[11px]">
        <p className="text-slate-500">
          Your listed price: {listed > 0 ? money(listed) : "on request"}
        </p>
        <p className="font-bold text-amber-600">Mo Expressway asks for your price</p>
      </div>
    );
  if (order.price_status === "vendor_proposed" && order.vendor_quote)
    return (
      <div className="mt-0.5 space-y-0.5 text-[11px]">
        {negotiated > 0 && (
          <p className="text-slate-500">Mo Expressway offered: {money(order.total)} total</p>
        )}
        <p className="font-bold text-amber-600">
          Your price: {money(order.vendor_quote)} total — waiting for Mo Expressway
        </p>
      </div>
    );
  return (
    <div className="mt-0.5 space-y-0.5 text-[11px]">
      {listedLine}
      <p
        className={`font-bold ${order.price_status === "offered" ? "text-blue-700" : "text-emerald-700"}`}
      >
        {order.price_status === "offered" ? "Offered price" : "Negotiated price"}:{" "}
        {money(negotiated)} each
        {listed === negotiated && (
          <span className="font-normal text-slate-400"> (same as listed)</span>
        )}
      </p>
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) +
    " " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
}

function VendorOrders() {
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  const loadOrders = () => {
    fetch("/api/vendor/orders/", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.orders) setOrders(data.orders);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const patchOrder = async (order: VendorOrder, body: Record<string, string>) => {
    setUpdating(order.id);
    try {
      const res = await fetch("/api/vendor/orders/", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id, ...body }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        Swal.fire({
          icon: "error",
          title: "Update failed",
          text: data?.error || "Try again.",
          confirmButtonColor: "#ea580c",
        });
        return;
      }
      setOrders((prev) => prev.map((o) => (o.id === order.id ? data.order : o)));
    } catch {
      Swal.fire({
        icon: "error",
        title: "Network error",
        text: "Please try again.",
        confirmButtonColor: "#ea580c",
      });
    } finally {
      setUpdating(null);
    }
  };

  const rejectOrder = async (order: VendorOrder) => {
    const result = await Swal.fire({
      title: "Reject this order?",
      text: `${order.po_number} · ${order.quantity}x ${order.product_title}`,
      input: "text",
      inputPlaceholder: "Reason (e.g. out of stock)",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Reject",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (!result.isConfirmed) return;
    updateStatus(order, "rejected", (result.value as string) || "");
  };

  const updateStatus = (order: VendorOrder, status: PurchaseOrderStatus, note = "") =>
    patchOrder(order, { status, note });

  const markPaid = async (order: VendorOrder) => {
    const agreed = Number(order.total);
    const result = await Swal.fire({
      title: "Mark payment received",
      html: `Agreed total for <b>${order.po_number}</b>: <b>${order.currency} ${agreed.toLocaleString()}</b><br/>Enter the amount you received from Mo Expressway. This cannot be undone.`,
      input: "number",
      inputLabel: `Amount received (${order.currency})`,
      inputValue: String(agreed),
      inputAttributes: { min: "1", step: "any" },
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Confirm payment received",
      confirmButtonColor: "#059669",
      cancelButtonColor: "#64748b",
      inputValidator: (value) => {
        const amount = Number(value);
        if (!value || !Number.isFinite(amount) || amount <= 0) {
          return "Enter the amount you received.";
        }
        return null;
      },
    });
    if (!result.isConfirmed) return;
    const amount = Number(result.value);
    if (amount !== agreed) {
      const check = await Swal.fire({
        title: "Amount differs from agreed total",
        html: `You received <b>${order.currency} ${amount.toLocaleString()}</b> but the agreed total is <b>${order.currency} ${agreed.toLocaleString()}</b>. Mo Expressway will be notified. Continue?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, confirm",
        confirmButtonColor: "#059669",
        cancelButtonColor: "#64748b",
      });
      if (!check.isConfirmed) return;
    }
    patchOrder(order, { payment_status: "paid", amount_received: String(amount) });
  };

  const proposePrice = async (order: VendorOrder) => {
    const offered = Number(order.total);
    const current = order.vendor_quote ? Number(order.vendor_quote) : offered > 0 ? offered : "";
    const isService = order.listing_type === "service";
    const result = await Swal.fire({
      title: order.price_status === "awaiting_quote" ? "Send your price" : "Propose your price",
      html:
        `<b>${order.po_number}</b> · ${order.quantity}x ${escapeHtml(order.product_title)}` +
        (offered > 0 && order.price_status !== "awaiting_quote"
          ? `<br/>Mo Expressway offered <b>${order.currency} ${offered.toLocaleString()}</b> in total.`
          : "") +
        `<br/><br/>Enter the <b>total</b> price for this ${isService ? "job" : "order"}.` +
        `<textarea id="quote-note" class="swal2-textarea" placeholder="${
          isService ? "What's included, job size, duration..." : "Optional note for Mo Expressway"
        }" style="margin:12px 0 0;width:100%;box-sizing:border-box"></textarea>`,
      input: "number",
      inputLabel: `Total price (${order.currency})`,
      inputValue: String(current),
      inputAttributes: { min: "1", step: "any" },
      showCancelButton: true,
      confirmButtonText: "Send price",
      confirmButtonColor: "#ea580c",
      cancelButtonColor: "#64748b",
      inputValidator: (value) =>
        !value || !(Number(value) > 0) ? "Enter a price greater than zero." : null,
      preConfirm: (value) => ({
        quote: value as string,
        note: (document.getElementById("quote-note") as HTMLTextAreaElement | null)?.value ?? "",
      }),
    });
    if (!result.isConfirmed || !result.value) return;
    patchOrder(order, { quote: result.value.quote, note: result.value.note });
  };

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const countOf = (s: (typeof FILTERS)[number]) =>
    s === "all" ? orders.length : orders.filter((o) => o.status === s).length;

  const renderPayment = (order: VendorOrder) => {
    if (!SHOWS_PAYMENT.includes(order.status)) return null;
    return order.payment_status === "paid" ? (
      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
        <Wallet className="size-3" /> Paid
        {order.amount_received && (
          <>
            {" "}
            · {order.currency} {Number(order.amount_received).toLocaleString()}
          </>
        )}
      </span>
    ) : (
      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-600">
        <Wallet className="size-3" /> Not paid
      </span>
    );
  };

  const renderActions = (order: VendorOrder, mobile = false) => {
    // A new order can only be accepted once there is a price on the table from Mo Expressway.
    const priceOpen =
      order.price_status === "awaiting_quote" || order.price_status === "vendor_proposed";
    const action = order.status === "sent" && priceOpen ? undefined : NEXT_ACTION[order.status];
    const canPropose = order.status === "sent";
    const unpaid = order.payment_status !== "paid";
    const canMarkPaid = unpaid && (order.status === "accepted" || order.status === "ready");
    const canReject = unpaid && (order.status === "sent" || order.status === "accepted");
    const busy = updating === order.id;
    const size = mobile ? "h-9 flex-1" : "h-8";

    if (!action && !canMarkPaid && !canPropose) {
      if (order.status === "ready")
        return (
          <span className="flex items-center gap-1 text-xs font-bold text-purple-600">
            <Truck className="size-4" /> Awaiting pickup
          </span>
        );
      if (order.status === "picked_up")
        return (
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
            <CheckCircle2 className="size-4" /> Collected
          </span>
        );
      return null;
    }
    const ActionIcon = action?.icon;
    return (
      <div className={`flex flex-wrap items-center gap-2 ${mobile ? "w-full" : "justify-end"}`}>
        {action && ActionIcon && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => updateStatus(order, action.next)}
            className={`gap-1.5 rounded-lg text-xs font-bold text-white ${action.color} ${size}`}
          >
            <ActionIcon className="size-3.5" />
            {busy ? "..." : order.status === "sent" ? "Accept offer" : action.label}
          </Button>
        )}
        {canPropose && (
          <Button
            size="sm"
            variant={order.price_status === "awaiting_quote" ? "default" : "outline"}
            disabled={busy}
            onClick={() => proposePrice(order)}
            className={`gap-1.5 rounded-lg text-xs font-bold ${
              order.price_status === "awaiting_quote"
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "border-amber-300 text-amber-700 hover:bg-amber-50"
            } ${size}`}
          >
            <HandCoins className="size-3.5" />
            {order.price_status === "awaiting_quote"
              ? "Send my price"
              : order.price_status === "vendor_proposed"
                ? "Change my price"
                : "Propose my price"}
          </Button>
        )}
        {canMarkPaid && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => markPaid(order)}
            className={`gap-1.5 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 ${size}`}
          >
            <Wallet className="size-3.5" />
            {busy ? "..." : "Mark as Paid"}
          </Button>
        )}
        {canReject && (
          <Button
            size="sm"
            variant="outline"
            disabled={updating === order.id}
            onClick={() => rejectOrder(order)}
            className={`gap-1.5 rounded-lg border-red-200 text-xs font-bold text-red-600 hover:bg-red-50 ${mobile ? "h-9" : "h-8"}`}
          >
            <XCircle className="size-3.5" /> Reject
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Orders</h1>
          <p className="text-sm text-slate-500">
            Orders from Mo Expressway. Accept, prepare the items, mark them ready and mark the order
            as paid once you receive our payment — our rider collects paid orders from your store.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setLoading(true);
            loadOrders();
          }}
          className="gap-2"
        >
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              filter === s
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:border-slate-400"
            }`}
          >
            {s === "all" ? "All" : STATUS_LABEL[s]} ({countOf(s)})
          </button>
        ))}
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-sm text-slate-500">
          <span className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
          Loading orders...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-24 text-center">
          <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-slate-100">
            <ClipboardList className="size-10 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No orders yet</h3>
          <p className="mt-1 text-sm text-slate-500">
            {filter === "all"
              ? "Orders from Mo Expressway will appear here."
              : `No ${STATUS_LABEL[filter].toLowerCase()} orders.`}
          </p>
        </div>
      ) : (
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">S/N</th>
                <th className="px-4 py-3">Order No.</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Agreed Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((order, index) => (
                <tr key={order.id} className="transition hover:bg-slate-50/60">
                  <td className="px-4 py-3">{index + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-bold text-slate-800">{order.po_number}</p>
                    <p className="text-[11px] text-slate-400">Buyer: {order.buyer}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                        {order.product_image ? (
                          <img
                            src={order.product_image}
                            alt={order.product_title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Package className="size-6 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-900 max-w-[200px]">
                          {order.product_title}
                        </p>
                        <PriceLines order={order} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-700">x{order.quantity}</td>
                  <td className="px-4 py-3 font-black text-slate-900 whitespace-nowrap">
                    {order.price_status === "agreed"
                      ? `${order.currency} ${Number(order.total).toLocaleString()}`
                      : "Not agreed yet"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${STATUS_BADGE[order.status]}`}
                    >
                      {STATUS_LABEL[order.status]}
                    </span>
                    <div>{renderPayment(order)}</div>
                    {order.vendor_note && (
                      <p className="mt-1 max-w-[160px] truncate text-[11px] text-slate-400">
                        {order.vendor_note}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {formatDate(order.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">{renderActions(order)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile cards */}
      {!loading && filtered.length > 0 && (
        <div className="grid gap-3 md:hidden">
          {filtered.map((order) => (
            <div
              key={`m-${order.id}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                  {order.product_image ? (
                    <img
                      src={order.product_image}
                      alt={order.product_title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ShoppingBag className="size-7 text-slate-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-900">{order.product_title}</p>
                  <p className="text-xs text-slate-500">
                    x{order.quantity} ·{" "}
                    {order.price_status === "agreed"
                      ? `Agreed total ${order.currency} ${Number(order.total).toLocaleString()}`
                      : "Price not agreed yet"}
                  </p>
                  <PriceLines order={order} />
                  <span
                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${STATUS_BADGE[order.status]}`}
                  >
                    {STATUS_LABEL[order.status]}
                  </span>{" "}
                  {renderPayment(order)}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <div>
                  <p className="font-mono text-xs font-bold text-slate-800">{order.po_number}</p>
                  <p className="text-[11px] text-slate-500">Buyer: {order.buyer}</p>
                </div>
                <p className="text-[10px] text-slate-400">{formatDate(order.created_at)}</p>
              </div>
              <div className="mt-3">{renderActions(order, true)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
