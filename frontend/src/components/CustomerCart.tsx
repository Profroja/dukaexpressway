import { Minus, Plus, ShoppingBag, ShoppingCart, Store, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { CART_EVENT, getCart, getCartCount, removeFromCart, setCartQuantity, type CartItem } from "@/lib/customerCart";

export function CustomerCart() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const load = () => setItems(getCart());

  useEffect(() => {
    load();
    window.addEventListener(CART_EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(CART_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const count = getCartCount(items);
  const total = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const currency = items[0]?.currency || "TZS";

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(true)} className="relative flex size-10 items-center justify-center rounded-full text-navy transition hover:bg-muted" aria-label={`Cart with ${count} items`}>
        <ShoppingCart className="size-5" />
        {count > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-black text-white">{count > 99 ? "99+" : count}</span>}
        <span className="nav-label hidden xl:inline">Cart</span>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[9999]">
          <button className="absolute inset-0 bg-navy/55 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Close cart" />
          <aside className="absolute bottom-0 right-0 top-0 flex w-full max-w-md flex-col bg-slate-50 shadow-2xl animate-in slide-in-from-right duration-300 sm:w-[420px]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div><h2 className="text-xl font-black text-navy">My Cart</h2><p className="text-xs text-muted-foreground">{count} item{count === 1 ? "" : "s"}</p></div>
              <button onClick={() => setOpen(false)} className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Close"><X className="size-5" /></button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="flex size-20 items-center justify-center rounded-full bg-white shadow-sm"><ShoppingBag className="size-9 text-slate-300" /></div>
                  <h3 className="mt-4 font-black text-navy">Your cart is empty</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Add products and they will appear here.</p>
                </div>
              ) : items.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex gap-3">
                    <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                      {item.image_url ? <img src={item.image_url} alt={item.title} className="h-full w-full object-contain p-1" /> : <ShoppingBag className="size-7 text-slate-300" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0"><p className="truncate text-sm font-black text-navy">{item.title}</p>{item.store && <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-muted-foreground"><Store className="size-3" />{item.store}</p>}</div>
                        <button onClick={() => removeFromCart(item.id)} className="flex size-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500" aria-label={`Remove ${item.title}`}><Trash2 className="size-4" /></button>
                      </div>
                      <p className="mt-2 text-sm font-black text-primary">{item.currency} {(Number(item.price) * item.quantity).toLocaleString()}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <button onClick={() => setCartQuantity(item.id, item.quantity - 1)} className="flex size-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"><Minus className="size-3.5" /></button>
                        <span className="min-w-7 text-center text-sm font-black text-navy">{item.quantity}</span>
                        <button onClick={() => setCartQuantity(item.id, item.quantity + 1)} className="flex size-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"><Plus className="size-3.5" /></button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {items.length > 0 && (
              <div className="border-t border-slate-200 bg-white p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between"><span className="font-bold text-slate-600">Total</span><span className="text-xl font-black text-primary">{currency} {total.toLocaleString()}</span></div>
                <Button className="h-12 w-full rounded-xl text-base font-black" onClick={() => setOpen(false)}>Continue Shopping</Button>
              </div>
            )}
          </aside>
        </div>,
        document.body
      )}
    </div>
  );
}
