import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  MapPin,
  Package,
  PackageCheck,
  Pencil,
  Phone,
  PhoneCall,
  Search,
  ShoppingCart,
  Store as StoreIcon,
  Trash2,
  Truck,
  Receipt,
  XCircle,
} from "lucide-react";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrdersPage,
});

type OrderStatus =
  | "new"
  | "contacted"
  | "confirmed"
  | "sourcing"
  | "picked_up"
  | "delivered"
  | "closed"
  | "cancelled";

type PurchaseOrderStatus = "sent" | "accepted" | "ready" | "picked_up" | "rejected" | "cancelled";

/** Price negotiation with the store: we offer, or ask for a quote; the store accepts or proposes. */
type PriceStatus = "offered" | "awaiting_quote" | "vendor_proposed" | "agreed";

type PurchaseOrder = {
  id: string;
  po_number: string;
  store: string;
  store_id: string;
  store_phone: string;
  product_title: string;
  quantity: number;
  unit_price: string;
  total: string;
  currency: string;
  status: PurchaseOrderStatus;
  payment_status: "unpaid" | "paid";
  paid_at: string | null;
  amount_received: string | null;
  price_status: PriceStatus;
  vendor_quote: string | null;
  vendor_quote_note: string;
  vendor_note: string;
  admin_note: string;
  created_at: string | null;
};

type AdminOrder = {
  id: string;
  product_title: string;
  product_image: string;
  listing_type: string;
  listed_store: string;
  listed_store_id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  admin_note: string;
  quantity: number;
  unit_price: string;
  total: string;
  currency: string;
  status: OrderStatus;
  cost: string | null;
  margin: string | null;
  price_on_request: boolean;
  amount_paid: string | null;
  purchase_orders: PurchaseOrder[];
  created_at: string | null;
};

type SourcingOption = {
  listing_id: string;
  title: string;
  image_url: string;
  store: string;
  store_id: string;
  region: string;
  price: string;
  currency: string;
  stock_quantity: number | null;
  in_stock: boolean;
  is_original: boolean;
  store_status: string;
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "New",
  contacted: "Contacted",
  confirmed: "Confirmed",
  sourcing: "At store",
  picked_up: "On the way",
  delivered: "Delivered · to close",
  closed: "Closed",
  cancelled: "Cancelled",
};

const STATUS_BADGE: Record<OrderStatus, string> = {
  new: "bg-amber-100 text-amber-700",
  contacted: "bg-blue-100 text-blue-700",
  confirmed: "bg-cyan-100 text-cyan-700",
  sourcing: "bg-purple-100 text-purple-700",
  picked_up: "bg-indigo-100 text-indigo-700",
  delivered: "bg-amber-100 text-amber-800",
  closed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-200 text-slate-600",
};

const PO_LABEL: Record<PurchaseOrderStatus, string> = {
  sent: "Waiting for store",
  accepted: "Store accepted",
  ready: "Ready for pickup",
  picked_up: "Picked up",
  rejected: "Store rejected",
  cancelled: "Cancelled",
};

const PO_BADGE: Record<PurchaseOrderStatus, string> = {
  sent: "bg-amber-50 text-amber-700",
  accepted: "bg-blue-50 text-blue-700",
  ready: "bg-purple-50 text-purple-700",
  picked_up: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-600",
  cancelled: "bg-slate-100 text-slate-500",
};

const ACTIVE_PO: PurchaseOrderStatus[] = ["sent", "accepted", "ready"];

const FILTERS = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "confirmed", label: "Confirmed" },
  { key: "sourcing", label: "At store" },
  { key: "picked_up", label: "On the way" },
  { key: "delivered", label: "Delivered · to close" },
  { key: "closed", label: "Closed" },
  { key: "cancelled", label: "Cancelled" },
] as const;

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], { dateStyle: "medium" });
}

/** Where the price stands with the store, shown under the purchase order. */
function NegotiationBadge({ po }: { po: PurchaseOrder }) {
  if (po.price_status === "awaiting_quote")
    return (
      <p className="mt-1 text-[11px] font-bold text-amber-600">Waiting for the store's price</p>
    );
  if (po.price_status === "vendor_proposed" && po.vendor_quote)
    return (
      <div className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-[11px]">
        <p className="font-bold text-amber-700">Store asks {money(po.currency, po.vendor_quote)}</p>
        {po.vendor_quote_note && (
          <p className="max-w-[180px] truncate italic text-amber-700/80">
            “{po.vendor_quote_note}”
          </p>
        )}
      </div>
    );
  if (po.price_status === "offered")
    return (
      <p className="mt-1 text-[11px] font-semibold text-slate-500">
        Our offer sent — store to accept
      </p>
    );
  return null;
}

/** For text placed inside SweetAlert `html` - customer input must never become markup. */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(currency: string, value: string | number) {
  return `${currency} ${Number(value).toLocaleString()}`;
}

function activePurchaseOrder(order: AdminOrder) {
  return order.purchase_orders.find((po) => ACTIVE_PO.includes(po.status)) || null;
}

function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sourcingOrder, setSourcingOrder] = useState<AdminOrder | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/orders/", { credentials: "include" });
      if (!response.ok) return;
      const data = await response.json();
      setOrders(data.orders || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const replaceOrder = (updated: AdminOrder) =>
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));

  const send = async (orderId: string, url: string, method: string, body?: unknown) => {
    setBusyId(orderId);
    try {
      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : null,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        Swal.fire({ title: "Update failed", text: data.error || "Try again.", icon: "error" });
        return null;
      }
      if (data.order) replaceOrder(data.order);
      return data;
    } catch {
      Swal.fire({ title: "Network error", text: "Please try again.", icon: "error" });
      return null;
    } finally {
      setBusyId(null);
    }
  };

  const setStatus = (order: AdminOrder, status: OrderStatus) =>
    send(order.id, `/api/admin/orders/${order.id}/`, "PATCH", { status });

  const cancelOrder = async (order: AdminOrder) => {
    const po = activePurchaseOrder(order);
    const confirm = await Swal.fire({
      title: "Cancel this order?",
      text: po
        ? `${order.customer_name} · ${order.product_title}. The purchase order at ${po.store} will be cancelled too.`
        : `${order.customer_name} · ${order.product_title}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, cancel it",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (confirm.isConfirmed) setStatus(order, "cancelled");
  };

  const cancelPurchaseOrder = async (order: AdminOrder, po: PurchaseOrder) => {
    const confirm = await Swal.fire({
      title: "Cancel purchase order?",
      text: `${po.po_number} at ${po.store}. You can then buy from another store.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Cancel PO",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (confirm.isConfirmed)
      send(order.id, `/api/admin/purchase-orders/${po.id}/`, "PATCH", { status: "cancelled" });
  };

  const editPrice = async (order: AdminOrder, po: PurchaseOrder) => {
    const quoteLine =
      po.price_status === "vendor_proposed" && po.vendor_quote
        ? `<br/>The store asked for <b>${money(po.currency, po.vendor_quote)}</b> in total.`
        : "";
    const result = await Swal.fire({
      title: po.price_status === "vendor_proposed" ? "Counter-offer" : "Offer a new price",
      html: `${po.po_number} · ${po.quantity}x ${escapeHtml(po.product_title)} at <b>${escapeHtml(po.store)}</b>${quoteLine}<br/>The store gets an email and must accept your offer again.`,
      input: "number",
      inputLabel: `Price per unit we pay (${po.currency})`,
      inputValue: Number(po.unit_price) > 0 ? String(Number(po.unit_price)) : "",
      inputAttributes: { min: "1", step: "any" },
      showCancelButton: true,
      confirmButtonText: "Send offer",
      confirmButtonColor: "#ea580c",
      cancelButtonColor: "#64748b",
      inputValidator: (value) =>
        !value || !(Number(value) > 0) ? "Enter a price greater than zero." : null,
    });
    if (result.isConfirmed)
      send(order.id, `/api/admin/purchase-orders/${po.id}/`, "PATCH", {
        unit_price: result.value,
      });
  };

  const acceptQuote = async (order: AdminOrder, po: PurchaseOrder) => {
    if (!po.vendor_quote) return;
    const margin = Number(order.total) - Number(po.vendor_quote);
    const confirm = await Swal.fire({
      title: `Accept ${money(po.currency, po.vendor_quote)}?`,
      html:
        `${escapeHtml(po.store)} asks <b>${money(po.currency, po.vendor_quote)}</b> for ${po.quantity}x ${escapeHtml(po.product_title)}.` +
        (po.vendor_quote_note ? `<br/><i>“${escapeHtml(po.vendor_quote_note)}”</i>` : "") +
        (order.price_on_request
          ? "<br/><br/>You haven't set the customer's price yet."
          : `<br/><br/>Customer pays ${money(order.currency, order.total)} → margin <b>${money(order.currency, margin)}</b>.`) +
        "<br/>The order will be confirmed with the store.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Accept price",
      confirmButtonColor: "#059669",
      cancelButtonColor: "#64748b",
    });
    if (confirm.isConfirmed)
      send(order.id, `/api/admin/purchase-orders/${po.id}/`, "PATCH", { accept_quote: true });
  };

  /** Agreed price before closing; on a closed order, corrects the amount actually paid. */
  const setCustomerPrice = async (order: AdminOrder) => {
    const isClosed = order.status === "closed";
    const current = isClosed ? Number(order.amount_paid ?? order.total) : Number(order.total);
    const result = await Swal.fire({
      title: isClosed ? "Correct the amount paid" : "What does the customer pay?",
      html:
        `${escapeHtml(order.customer_name)} · ${order.quantity}x ${escapeHtml(order.product_title)}<br/>` +
        (isClosed
          ? "Correct exactly what the customer paid. Revenue updates right away."
          : "Set the total agreed with the customer.") +
        (order.cost !== null
          ? `<br/>We pay the store <b>${money(order.currency, order.cost)}</b>.`
          : ""),
      input: "number",
      inputLabel: isClosed
        ? `Amount the customer paid (${order.currency})`
        : `Customer pays in total (${order.currency})`,
      inputValue: current > 0 ? String(current) : "",
      inputAttributes: { min: "1", step: "any" },
      showCancelButton: true,
      confirmButtonText: "Save price",
      confirmButtonColor: "#ea580c",
      cancelButtonColor: "#64748b",
      inputValidator: (value) =>
        !value || !(Number(value) > 0) ? "Enter a price greater than zero." : null,
    });
    if (result.isConfirmed)
      send(
        order.id,
        `/api/admin/orders/${order.id}/`,
        "PATCH",
        isClosed ? { amount_paid: result.value } : { customer_total: result.value },
      );
  };

  const markDelivered = async (order: AdminOrder) => {
    const confirm = await Swal.fire({
      title: "Mark as delivered?",
      html: `${escapeHtml(order.customer_name)} · ${order.quantity}x ${escapeHtml(order.product_title)}<br/>Next, close the order by recording exactly what the customer paid.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Delivered",
      confirmButtonColor: "#059669",
      cancelButtonColor: "#64748b",
    });
    if (confirm.isConfirmed) setStatus(order, "delivered");
  };

  /** Closing records exactly what the customer paid - the money Revenue counts. */
  const closeOrder = async (order: AdminOrder) => {
    const cost = order.cost !== null ? Number(order.cost) : null;
    const agreed = Number(order.total);
    const result = await Swal.fire({
      title: "Close order",
      html:
        `${escapeHtml(order.customer_name)} · ${order.quantity}x ${escapeHtml(order.product_title)}` +
        (agreed > 0 ? `<br/>Agreed price: <b>${money(order.currency, agreed)}</b>.` : "") +
        (cost !== null ? `<br/>We paid the store <b>${money(order.currency, cost)}</b>.` : "") +
        (order.listing_type === "service"
          ? "<br/><br/>Enter exactly what the customer paid for this job (not the starting price)."
          : "<br/><br/>Enter exactly what the customer paid."),
      input: "number",
      inputLabel: `Amount the customer paid (${order.currency})`,
      inputValue: agreed > 0 ? String(agreed) : "",
      inputAttributes: { min: "1", step: "any" },
      showCancelButton: true,
      confirmButtonText: "Close order",
      confirmButtonColor: "#059669",
      cancelButtonColor: "#64748b",
      inputValidator: (value) =>
        !value || !(Number(value) > 0) ? "Enter the amount the customer paid." : null,
    });
    if (!result.isConfirmed) return;
    const amount = Number(result.value);
    if (cost !== null && amount < cost) {
      const check = await Swal.fire({
        title: "This order makes a loss",
        html: `The customer paid <b>${money(order.currency, amount)}</b> but the store cost <b>${money(order.currency, cost)}</b> — a loss of <b>${money(order.currency, cost - amount)}</b>. Is the amount right?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, it's right",
        cancelButtonText: "Let me fix it",
        confirmButtonColor: "#dc2626",
        cancelButtonColor: "#64748b",
      });
      if (!check.isConfirmed) return;
    }
    send(order.id, `/api/admin/orders/${order.id}/`, "PATCH", {
      status: "closed",
      amount_paid: String(amount),
    });
  };

  const markPickedUp = (order: AdminOrder, po: PurchaseOrder) =>
    send(order.id, `/api/admin/purchase-orders/${po.id}/`, "PATCH", { status: "picked_up" });

  const deleteOrder = async (order: AdminOrder) => {
    const pos = order.purchase_orders;
    const active = pos.filter((po) => ACTIVE_PO.includes(po.status));
    const paid = pos.filter((po) => po.payment_status === "paid");
    const details = [
      `<b>${escapeHtml(order.customer_name)}</b> · ${order.quantity}x ${escapeHtml(order.product_title)}`,
      "This permanently removes the order and cannot be undone.",
    ];
    if (pos.length > 0) {
      details.push(
        `Its ${pos.length} purchase order${pos.length > 1 ? "s" : ""} will be deleted too.`,
      );
    }
    if (active.length > 0) {
      details.push(
        `${active.map((po) => escapeHtml(po.store)).join(", ")} will be emailed that the order is cancelled.`,
      );
    }
    if (paid.length > 0) {
      details.push(
        `<span style="color:#dc2626;font-weight:700">A store already confirmed payment. Deleting removes that sale from the store's order history.</span>`,
      );
    }
    const confirm = await Swal.fire({
      title: "Delete this order?",
      html: details.join("<br/><br/>"),
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (!confirm.isConfirmed) return;

    const data = await send(order.id, `/api/admin/orders/${order.id}/`, "DELETE");
    if (data) setOrders((prev) => prev.filter((o) => o.id !== order.id));
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (!term) return true;
      return (
        o.customer_name.toLowerCase().includes(term) ||
        o.customer_phone.toLowerCase().includes(term) ||
        o.product_title.toLowerCase().includes(term) ||
        o.purchase_orders.some(
          (po) =>
            po.store.toLowerCase().includes(term) || po.po_number.toLowerCase().includes(term),
        )
      );
    });
  }, [orders, search, filter]);

  const countOf = (key: (typeof FILTERS)[number]["key"]) =>
    key === "all" ? orders.length : orders.filter((o) => o.status === key).length;

  const stats = [
    {
      label: "Needs action",
      value: orders.filter((o) => ["new", "contacted", "confirmed"].includes(o.status)).length,
      icon: PhoneCall,
      iconStyle: "bg-amber-50 text-amber-600",
    },
    {
      label: "At stores",
      value: countOf("sourcing"),
      icon: StoreIcon,
      iconStyle: "bg-purple-50 text-purple-600",
    },
    {
      label: "On the way",
      value: countOf("picked_up"),
      icon: Truck,
      iconStyle: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "Delivered · to close",
      value: countOf("delivered"),
      icon: Receipt,
      iconStyle: "bg-amber-50 text-amber-700",
    },
    {
      label: "Closed",
      value: countOf("closed"),
      icon: CheckCircle2,
      iconStyle: "bg-emerald-50 text-emerald-600",
    },
  ];

  const renderActions = (order: AdminOrder) => {
    const busy = busyId === order.id;
    const po = activePurchaseOrder(order);
    // Delivered orders can only move on to closed; closed/cancelled are final.
    const closed = ["delivered", "closed", "cancelled"].includes(order.status);
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {order.status === "new" && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setStatus(order, "contacted")}
          >
            <PhoneCall className="size-4" /> Contacted
          </Button>
        )}
        {(order.status === "new" || order.status === "contacted") && (
          <Button
            size="sm"
            disabled={busy}
            className="bg-cyan-600 text-white hover:bg-cyan-700"
            onClick={() => setStatus(order, "confirmed")}
          >
            <CheckCircle2 className="size-4" /> Confirm
          </Button>
        )}
        {order.status === "confirmed" && (
          <Button
            size="sm"
            disabled={busy}
            className="bg-gradient-to-r from-primary to-orange-600 text-white"
            onClick={() => setSourcingOrder(order)}
          >
            <ShoppingCart className="size-4" />{" "}
            {order.listing_type === "service" ? "Book provider" : "Buy from store"}
          </Button>
        )}
        {po && po.price_status === "vendor_proposed" && po.vendor_quote && (
          <Button
            size="sm"
            disabled={busy}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => acceptQuote(order, po)}
          >
            <CheckCircle2 className="size-4" /> Accept {money(po.currency, po.vendor_quote)}
          </Button>
        )}
        {po && (po.status === "accepted" || po.status === "ready") && (
          <Button
            size="sm"
            disabled={busy || po.payment_status !== "paid"}
            className="bg-indigo-600 text-white hover:bg-indigo-700"
            onClick={() => markPickedUp(order, po)}
            title={
              po.payment_status !== "paid"
                ? "The store must mark this order as paid first"
                : "Mark as picked up from the store"
            }
          >
            <PackageCheck className="size-4" /> Picked up
          </Button>
        )}
        {po && po.payment_status !== "paid" && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            onClick={() => editPrice(order, po)}
          >
            <Pencil className="size-4" />{" "}
            {po.price_status === "vendor_proposed"
              ? "Counter-offer"
              : po.price_status === "awaiting_quote"
                ? "Offer a price"
                : "Edit price"}
          </Button>
        )}
        {po && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            className="border-amber-200 text-amber-700 hover:bg-amber-50"
            onClick={() => cancelPurchaseOrder(order, po)}
          >
            <StoreIcon className="size-4" /> Change store
          </Button>
        )}
        {order.status === "picked_up" && (
          <Button
            size="sm"
            disabled={busy}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => markDelivered(order)}
          >
            <Truck className="size-4" /> Delivered
          </Button>
        )}
        {order.status === "delivered" && (
          <Button
            size="sm"
            disabled={busy}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => closeOrder(order)}
          >
            <Receipt className="size-4" /> Close order
          </Button>
        )}
        {!closed && (
          <Button
            variant="outline"
            size="sm"
            className="border-red-200 text-red-600 hover:bg-red-50"
            disabled={busy}
            onClick={() => cancelOrder(order)}
            title="Cancel order"
          >
            <XCircle className="size-4" />
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          disabled={busy}
          onClick={() => deleteOrder(order)}
          title="Delete order"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    );
  };

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Orders</h1>
        <p className="mt-1 text-sm text-slate-500">
          Customer orders come only to you. Confirm with the customer, buy the items from a store
          (the store only sees Mo Expressway as the buyer), collect them and deliver.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-lg sm:p-6"
          >
            <div
              className={`mb-4 flex size-11 items-center justify-center rounded-lg ${stat.iconStyle}`}
            >
              <stat.icon className="size-6" />
            </div>
            <div className="text-xl font-black text-slate-900 sm:text-2xl">
              {loading ? "..." : stat.value}
            </div>
            <div className="mt-1 text-xs text-slate-500 sm:text-sm">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
          <Input
            type="text"
            placeholder="Search customer, phone, product, store or PO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              onClick={() => setFilter(f.key)}
              className={filter === f.key ? "bg-gradient-to-r from-primary to-orange-600" : ""}
            >
              {f.label} ({countOf(f.key)})
            </Button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Loading orders...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList className="mx-auto size-10 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-500">No orders found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="py-3 pr-3">S/N</th>
                  <th className="py-3 pr-3">Order</th>
                  <th className="py-3 pr-3">Customer</th>
                  <th className="py-3 pr-3">Customer pays</th>
                  <th className="py-3 pr-3">Store / Purchase</th>
                  <th className="py-3 pr-3">Margin</th>
                  <th className="py-3 pr-3">Status</th>
                  <th className="py-3 pr-3">Date</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order, index) => {
                  const latestPo = order.purchase_orders[0];
                  const failedCount = order.purchase_orders.filter(
                    (po) => po.status === "rejected" || po.status === "cancelled",
                  ).length;
                  return (
                    <tr
                      key={order.id}
                      className="border-b border-slate-100 align-top last:border-0 hover:bg-slate-50/50"
                    >
                      <td className="py-3 pr-3 text-slate-400">{index + 1}</td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                            {order.product_image ? (
                              <img
                                src={order.product_image}
                                alt={order.product_title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Package className="size-4 text-slate-300" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="max-w-[180px] truncate font-semibold text-slate-900">
                              {order.quantity}x {order.product_title}
                            </p>
                            <p className="max-w-[180px] truncate text-[11px] text-slate-400">
                              {order.listing_type === "service" && (
                                <span className="mr-1 rounded bg-purple-100 px-1.5 py-0.5 font-bold text-purple-700">
                                  Booking
                                </span>
                              )}
                              Listed by {order.listed_store}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-slate-800">{order.customer_name}</p>
                        <a
                          href={`tel:${order.customer_phone}`}
                          className="mt-0.5 flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                        >
                          <Phone className="size-3" /> {order.customer_phone}
                        </a>
                        {order.delivery_address && (
                          <p className="mt-0.5 flex max-w-[180px] items-center gap-1 truncate text-[11px] text-slate-500">
                            <MapPin className="size-3 shrink-0" /> {order.delivery_address}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-3">
                        {order.status === "closed" && order.amount_paid ? (
                          <>
                            <span className="font-bold text-slate-900">
                              {money(order.currency, order.amount_paid)}
                            </span>
                            <p className="text-[10px] font-semibold text-emerald-600">
                              Paid · order closed
                            </p>
                            {Number(order.amount_paid) !== Number(order.total) && (
                              <p className="text-[10px] text-slate-400">
                                Agreed {money(order.currency, order.total)}
                              </p>
                            )}
                          </>
                        ) : order.price_on_request ? (
                          <span className="font-semibold text-amber-600">Price on request</span>
                        ) : (
                          <span className="font-bold text-slate-900">
                            {money(order.currency, order.total)}
                          </span>
                        )}
                        {order.status === "delivered" && (
                          <p className="text-[10px] font-semibold text-amber-700">
                            Payment not recorded yet
                          </p>
                        )}
                        {order.status !== "cancelled" && (
                          <button
                            type="button"
                            onClick={() => setCustomerPrice(order)}
                            disabled={busyId === order.id}
                            className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                          >
                            <Pencil className="size-3" />
                            {order.status === "closed"
                              ? "Correct amount"
                              : order.price_on_request
                                ? "Set price"
                                : "Change"}
                          </button>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        {latestPo ? (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Sent to
                            </p>
                            <p className="flex items-center gap-1.5 font-semibold text-slate-800">
                              <StoreIcon className="size-3.5 text-slate-400" />
                              <span className="max-w-[160px] truncate">{latestPo.store}</span>
                            </p>
                            {latestPo.store_id !== order.listed_store_id && (
                              <p className="text-[10px] font-semibold text-amber-600">
                                Not the store the customer chose
                              </p>
                            )}
                            {latestPo.store_phone && (
                              <a
                                href={`tel:${latestPo.store_phone}`}
                                className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                              >
                                <Phone className="size-3" /> {latestPo.store_phone}
                              </a>
                            )}
                            <p className="font-mono text-[11px] text-slate-400">
                              {latestPo.po_number}
                              {latestPo.price_status !== "awaiting_quote" &&
                                ` · ${money(latestPo.currency, latestPo.total)}`}
                            </p>
                            {ACTIVE_PO.includes(latestPo.status) && (
                              <NegotiationBadge po={latestPo} />
                            )}
                            <span
                              className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${PO_BADGE[latestPo.status]}`}
                            >
                              {PO_LABEL[latestPo.status]}
                            </span>{" "}
                            {["accepted", "ready", "picked_up"].includes(latestPo.status) &&
                              (latestPo.payment_status === "paid" ? (
                                latestPo.amount_received &&
                                Number(latestPo.amount_received) !== Number(latestPo.total) ? (
                                  <span
                                    className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700"
                                    title={`Agreed ${money(latestPo.currency, latestPo.total)}`}
                                  >
                                    Received {money(latestPo.currency, latestPo.amount_received)} ≠
                                    agreed
                                  </span>
                                ) : (
                                  <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                    Paid ✓
                                    {latestPo.amount_received &&
                                      ` ${money(latestPo.currency, latestPo.amount_received)}`}
                                  </span>
                                )
                              ) : (
                                <span
                                  className="mt-1 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600"
                                  title="Pay the store; it must mark the order as paid before pickup"
                                >
                                  Awaiting payment confirmation
                                </span>
                              ))}
                            {latestPo.vendor_note && (
                              <p className="mt-0.5 max-w-[180px] truncate text-[11px] italic text-slate-500">
                                “{latestPo.vendor_note}”
                              </p>
                            )}
                            {failedCount > 0 &&
                              latestPo.status !== "rejected" &&
                              latestPo.status !== "cancelled" && (
                                <p className="mt-0.5 text-[10px] text-slate-400">
                                  {failedCount} earlier attempt{failedCount > 1 ? "s" : ""}
                                </p>
                              )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Not purchased yet</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-3">
                        {order.margin !== null ? (
                          <span
                            className={`font-bold ${Number(order.margin) >= 0 ? "text-emerald-600" : "text-red-600"}`}
                          >
                            {money(order.currency, order.margin)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <Badge className={`font-medium ${STATUS_BADGE[order.status]}`}>
                          {STATUS_LABEL[order.status]}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap py-3 pr-3 text-xs text-slate-500">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="py-3">{renderActions(order)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SourcingDialog
        order={sourcingOrder}
        onClose={() => setSourcingOrder(null)}
        onCreated={(updated) => {
          replaceOrder(updated);
          setSourcingOrder(null);
        }}
      />
    </>
  );
}

function SourcingDialog({
  order,
  onClose,
  onCreated,
}: {
  order: AdminOrder | null;
  onClose: () => void;
  onCreated: (order: AdminOrder) => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SourcingOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SourcingOption | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState("");
  const [note, setNote] = useState("");
  const [askQuote, setAskQuote] = useState(false);
  const [originalUnavailable, setOriginalUnavailable] = useState<{
    store: string;
    reason: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isBooking = order?.listing_type === "service";

  useEffect(() => {
    if (!order) return;
    setQuery("");
    setSelected(null);
    setQuantity(order.quantity);
    setUnitPrice("");
    setNote("");
    setAskQuote(false);
  }, [order]);

  useEffect(() => {
    if (!order) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
        const response = await fetch(`/api/admin/orders/${order.id}/sourcing/${params}`, {
          credentials: "include",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        setOptions(response.ok ? data.options || [] : []);
        setOriginalUnavailable(response.ok ? data.original_unavailable || null : null);
      } catch {
        // Aborted or offline - keep the last results.
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [order, query]);

  const choose = (option: SourcingOption) => {
    setSelected(option);
    const listed = Number(option.price);
    setUnitPrice(listed > 0 ? option.price : "");
    // Services without a listed price are usually quoted by the provider.
    setAskQuote(isBooking && !(listed > 0));
  };

  const cost = (Number(unitPrice) || 0) * quantity;
  const margin = order ? Number(order.total) - cost : 0;

  const submit = async () => {
    if (!order || !selected) return;
    let price = unitPrice;
    // A bare number in the note is almost certainly a price typed in the wrong box.
    const noteAsNumber = note.trim().replace(/,/g, "");
    if (
      !askQuote &&
      /^\d+(\.\d+)?$/.test(noteAsNumber) &&
      Number(noteAsNumber) !== Number(unitPrice)
    ) {
      const check = await Swal.fire({
        title: "Is this the negotiated price?",
        html: `Your internal note is <b>${Number(noteAsNumber).toLocaleString()}</b>, but the negotiated price is <b>${money(selected.currency, unitPrice || 0)}</b>.<br/>The store only sees the negotiated price.`,
        icon: "question",
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: `Use ${Number(noteAsNumber).toLocaleString()} as the price`,
        denyButtonText: "Keep it as a note",
        confirmButtonColor: "#059669",
        denyButtonColor: "#64748b",
      });
      if (check.isDismissed) return;
      if (check.isConfirmed) {
        price = noteAsNumber;
        setUnitPrice(noteAsNumber);
      }
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/purchase-orders/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          askQuote
            ? { listing_id: selected.listing_id, quantity, request_quote: true, admin_note: note }
            : { listing_id: selected.listing_id, quantity, unit_price: price, admin_note: note },
        ),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        Swal.fire({ title: "Could not send", text: data.error || "Try again.", icon: "error" });
        return;
      }
      Swal.fire({
        title: askQuote ? "Quote requested" : isBooking ? "Booking sent" : "Purchase order sent",
        text: askQuote
          ? `${selected.store} will send its price. You can then accept it or counter-offer.`
          : `${selected.store} will see an order from Mo Expressway — no customer details.`,
        icon: "success",
        timer: 2200,
        showConfirmButton: false,
      });
      onCreated(data.order);
    } catch {
      Swal.fire({ title: "Network error", text: "Please try again.", icon: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {selected
              ? isBooking
                ? "Booking details"
                : "Purchase details"
              : isBooking
                ? "Book a provider"
                : "Buy from a store"}
          </DialogTitle>
          <DialogDescription>
            {order && (
              <>
                {order.quantity}x {order.product_title} · customer pays{" "}
                <b>
                  {order.price_on_request
                    ? "price not set yet"
                    : money(order.currency, order.total)}
                </b>
                . The store will only see Mo Expressway as the buyer.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {selected && order ? (
          <PurchaseDetails
            order={order}
            selected={selected}
            quantity={quantity}
            setQuantity={setQuantity}
            unitPrice={unitPrice}
            setUnitPrice={setUnitPrice}
            note={note}
            setNote={setNote}
            askQuote={askQuote}
            setAskQuote={setAskQuote}
            cost={cost}
            margin={margin}
            submitting={submitting}
            onBack={() => setSelected(null)}
            onSubmit={submit}
          />
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search other products or stores..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {originalUnavailable && !query.trim() && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <b>The customer's choice ({originalUnavailable.store}) can't be bought:</b>{" "}
                {originalUnavailable.reason} The stores below are alternatives — the customer
                ordered from {originalUnavailable.store}.
              </div>
            )}

            <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
              {loading && options.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">Finding stores...</p>
              ) : options.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No store has a matching product.
                </p>
              ) : (
                options.map((option) => {
                  return (
                    <button
                      key={option.listing_id}
                      type="button"
                      onClick={() => choose(option)}
                      className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-primary hover:bg-orange-50/50"
                    >
                      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                        {option.image_url ? (
                          <img
                            src={option.image_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Package className="size-5 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">{option.title}</p>
                        <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                          <StoreIcon className="size-3" /> {option.store}
                          {option.region && <> · {option.region}</>}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {option.is_original && (
                            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                              Customer's choice
                            </span>
                          )}
                          {option.store_status === "pending" && (
                            <span
                              className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700"
                              title="You can still buy from this store; approve it on the Stores page."
                            >
                              Store not approved yet
                            </span>
                          )}
                          {!option.in_stock && (
                            <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                              Low stock ({option.stock_quantity})
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="whitespace-nowrap text-sm font-black text-slate-900">
                        {money(option.currency, option.price)}
                      </p>
                      <ChevronRight className="size-4 shrink-0 text-slate-300 transition group-hover:text-primary" />
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PurchaseDetails({
  order,
  selected,
  quantity,
  setQuantity,
  unitPrice,
  setUnitPrice,
  note,
  setNote,
  askQuote,
  setAskQuote,
  cost,
  margin,
  submitting,
  onBack,
  onSubmit,
}: {
  order: AdminOrder;
  selected: SourcingOption;
  quantity: number;
  setQuantity: (value: number) => void;
  unitPrice: string;
  setUnitPrice: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  askQuote: boolean;
  setAskQuote: (value: boolean) => void;
  cost: number;
  margin: number;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const isBooking = order.listing_type === "service";
  const listed = Number(selected.price);
  return (
    <div className="space-y-4">
      {/* Chosen store product */}
      <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-orange-50/60 p-3">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
          {selected.image_url ? (
            <img src={selected.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <Package className="size-5 text-slate-300" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{selected.title}</p>
          <p className="flex items-center gap-1 truncate text-xs text-slate-500">
            <StoreIcon className="size-3" /> {selected.store}
            {selected.region && <> · {selected.region}</>}
          </p>
        </div>
        <p className="whitespace-nowrap text-sm font-black text-slate-900">
          {listed > 0 ? money(selected.currency, selected.price) : "Price on request"}
        </p>
      </div>

      {/* How the price is settled with the store */}
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            { quote: false, title: "Offer a price", desc: "Store accepts or proposes its own" },
            {
              quote: true,
              title: isBooking ? "Ask for their quote" : "Ask the store's price",
              desc: "Store sends its price, you accept or counter",
            },
          ] as const
        ).map((option) => (
          <button
            key={option.title}
            type="button"
            onClick={() => setAskQuote(option.quote)}
            className={`rounded-xl border p-3 text-left transition ${
              askQuote === option.quote
                ? "border-primary bg-orange-50 ring-2 ring-primary/20"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <p className="text-sm font-bold text-slate-900">{option.title}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{option.desc}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-bold text-slate-600">
          Quantity
          <Input
            type="number"
            min={1}
            max={999}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1"
            autoFocus
          />
        </label>
        {askQuote ? (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <b>No price yet.</b> {selected.store} will send its price for this
            {isBooking ? " job" : " order"} — for example based on how big it is. You'll get an
            email to accept it or counter-offer.
          </div>
        ) : (
          <label className="text-xs font-bold text-slate-600">
            Price per unit we offer ({selected.currency})
            <Input
              type="number"
              min={0}
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="mt-1 border-emerald-300 font-bold focus-visible:ring-emerald-500"
            />
            <span className="mt-1 block font-normal text-slate-400">
              {listed > 0
                ? `Store's listed price: ${money(selected.currency, selected.price)}. `
                : "The store has no listed price. "}
              The store sees this offer and can accept it or propose its own.
            </span>
          </label>
        )}
      </div>
      <label className="block text-xs font-bold text-slate-600">
        Internal note (only you see this)
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. agreed by phone with the owner"
          className="mt-1"
        />
      </label>

      {!askQuote && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm">
          <span className="text-slate-600">
            Cost <b className="text-slate-900">{money(selected.currency, cost)}</b>
          </span>
          {order.price_on_request ? (
            <span className="text-amber-600">Set the customer's price to see your margin</span>
          ) : (
            <span className={margin >= 0 ? "text-emerald-700" : "text-red-600"}>
              Margin <b>{money(order.currency, margin)}</b>
            </span>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} disabled={submitting} className="h-11">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button
          onClick={onSubmit}
          disabled={submitting || (!askQuote && !(Number(unitPrice) > 0))}
          className="h-11 flex-1 bg-gradient-to-r from-primary to-orange-600 font-bold text-white"
        >
          <ShoppingCart className="size-4" />
          {submitting
            ? "Sending..."
            : askQuote
              ? `Ask ${selected.store} for a quote`
              : `Send ${isBooking ? "booking" : "purchase order"} to ${selected.store}`}
        </Button>
      </div>
    </div>
  );
}
