import { CheckCircle2, ClipboardList, Clock3, PackageCheck, PackageSearch, PhoneCall, Truck, X, XCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CUSTOMER_ORDERS_EVENT, getCustomerOrders, isActiveCustomerOrder, updateCustomerOrderStatus, type CustomerOrder, type CustomerOrderStatus } from "@/lib/customerOrders";

const statusStyle: Record<CustomerOrderStatus, string> = {
  new: "bg-amber-100 text-amber-700",
  contacted: "bg-blue-100 text-blue-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  sourcing: "bg-purple-100 text-purple-700",
  picked_up: "bg-indigo-100 text-indigo-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-200 text-slate-600",
};

const statusLabel: Record<CustomerOrderStatus, string> = {
  new: "Order received",
  contacted: "We are contacting you",
  confirmed: "Confirmed",
  sourcing: "Preparing your order",
  picked_up: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const statusIcon: Record<CustomerOrderStatus, ReactNode> = {
  new: <Clock3 className="size-3.5 animate-pulse text-amber-500" />,
  contacted: <PhoneCall className="size-3.5 animate-pulse text-blue-500" />,
  confirmed: <CheckCircle2 className="size-3.5 text-emerald-500" />,
  sourcing: <PackageSearch className="size-3.5 animate-pulse text-purple-500" />,
  picked_up: <Truck className="size-3.5 animate-pulse text-indigo-500" />,
  delivered: <CheckCircle2 className="size-3.5 text-emerald-500" />,
  cancelled: <XCircle className="size-3.5 text-slate-400" />,
};

export function CustomerOrders() {
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);

  const load = () => setOrders(getCustomerOrders());

  useEffect(() => {
    load();
    window.addEventListener(CUSTOMER_ORDERS_EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(CUSTOMER_ORDERS_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const refresh = async () => {
      const current = getCustomerOrders();
      const active = current.filter((order) => isActiveCustomerOrder(order.status));
      await Promise.all(active.map(async (order) => {
        try {
          const response = await fetch(`/api/orders/quick/${order.id}/`);
          const data = await response.json().catch(() => null);
          if (response.ok && data?.status && data.status !== order.status) {
            updateCustomerOrderStatus(order.id, data.status as CustomerOrderStatus);
          }
        } catch {
          // Keep the last known status while offline.
        }
      }));
      load();
    };
    refresh();
    const timer = window.setInterval(refresh, 4000);
    return () => window.clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const ongoing = orders.filter((order) => isActiveCustomerOrder(order.status)).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex size-10 items-center justify-center rounded-full text-navy transition hover:bg-muted"
        aria-label={`Orders${ongoing ? `, ${ongoing} ongoing` : ""}`}
      >
        <ClipboardList className="size-5" />
        {ongoing > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 h-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-black text-white">
            {ongoing > 9 ? "9+" : ongoing}
          </span>
        )}
        <span className="nav-label hidden xl:inline">Orders</span>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[9999]">
          <button className="absolute inset-0 bg-navy/55 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Close orders" />
          <aside className="absolute bottom-0 right-0 top-0 flex w-full max-w-md flex-col bg-slate-50 shadow-2xl animate-in slide-in-from-right duration-300 sm:w-[420px]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <h2 className="text-xl font-black text-navy">My Orders</h2>
                <p className="text-xs text-muted-foreground">Ongoing and completed orders on this device</p>
              </div>
              <button onClick={() => setOpen(false)} className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
              {orders.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="flex size-20 items-center justify-center rounded-full bg-white shadow-sm">
                    <PackageCheck className="size-9 text-slate-300" />
                  </div>
                  <h3 className="mt-4 font-black text-navy">No orders yet</h3>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground">Your orders will be saved here after you place them.</p>
                </div>
              ) : orders.map((order) => {
                const active = isActiveCustomerOrder(order.status);
                return (
                  <article key={order.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${active ? "border-primary/30" : "border-slate-200"}`}>
                    {active && <div className="h-1 w-full bg-gradient-to-r from-primary via-amber-300 to-primary bg-[length:200%_100%] animate-pulse" />}
                    <div className="p-4">
                      <div className="flex gap-3">
                        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                          {order.imageUrl ? <img src={order.imageUrl} alt={order.title} className="h-full w-full object-contain p-1" /> : <PackageCheck className="size-7 text-slate-300" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-black text-navy">{order.title}</p>
                            <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${statusStyle[order.status]}`}>{statusLabel[order.status]}</span>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">Delivered by Mo Expressway</p>
                          <p className="mt-2 text-sm font-black text-primary">{order.currency} {order.total.toLocaleString()} <span className="font-semibold text-slate-400">· x{order.quantity}</span></p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                        <span className="flex items-center gap-1.5 font-semibold text-slate-500">
                          {statusIcon[order.status]}
                          {statusLabel[order.status]}
                        </span>
                        <span className="text-[10px] text-slate-400">{new Date(order.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </aside>
        </div>,
        document.body
      )}
    </div>
  );
}
