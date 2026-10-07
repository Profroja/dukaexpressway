import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, MapPin, Minus, PackageCheck, PackageSearch, Phone, PhoneCall, Plus, ShoppingBag, Store, Truck, User, X, XCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/LanguageContext";
import { ServicePrice } from "@/components/ServicePrice";
import { isActiveCustomerOrder, saveCustomerOrder, updateCustomerOrderStatus, type CustomerOrderStatus } from "@/lib/customerOrders";

export type OrderModalProduct = {
  id: string;
  image_url: string;
  title: string;
  subcategory?: string;
  category?: string;
  price: string | number;
  currency: string;
  discount?: string | number | null;
  sale?: string;
  store?: string;
  listing_type?: "product" | "service";
};

type OrderStatus = CustomerOrderStatus;

interface OrderModalProps {
  product: OrderModalProduct | null;
  open: boolean;
  onClose: () => void;
  onOrderSuccess?: (product: OrderModalProduct, quantity: number) => void;
}

export function OrderModal({ product, open, onClose, onOrderSuccess }: OrderModalProps) {
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [step, setStep] = useState<"details" | "contact" | "tracking">("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<OrderStatus>("new");

  useEffect(() => {
    if (open) {
      setMounted(true);
      setQuantity(1);
      setStep(product?.listing_type === "service" ? "contact" : "details");
      setName("");
      setPhone("");
      setAddress("");
      setError("");
      setOrderId(null);
      setOrderStatus("new");
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
    const timer = setTimeout(() => setMounted(false), 300);
    return () => clearTimeout(timer);
  }, [open, product?.listing_type]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  // Poll order status while tracking (until delivered / cancelled)
  useEffect(() => {
    if (step !== "tracking" || !orderId) return;
    if (!isActiveCustomerOrder(orderStatus)) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/quick/${orderId}/`);
        const data = await res.json().catch(() => null);
        if (res.ok && data?.status) {
          setOrderStatus(data.status);
          updateCustomerOrderStatus(orderId, data.status as CustomerOrderStatus);
        }
      } catch {
        // keep polling quietly
      }
    };
    poll();
    const timer = window.setInterval(poll, 3000);
    return () => window.clearInterval(timer);
  }, [step, orderId, orderStatus]);

  if (!mounted || !product) return null;

  const unitPrice = Number(product.price) || 0;
  const totalPrice = unitPrice * quantity;
  const currency = product.currency || "TZS";
  const isSwahili = t("orderNow") === "Agiza Sasa";
  const isService = product.listing_type === "service";

  const handleOrder = async () => {
    if (!name.trim()) {
      setError(isSwahili ? "Tafadhali weka jina lako." : "Please enter your name.");
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, "").length < 9) {
      setError(isSwahili ? "Tafadhali weka namba sahihi ya simu." : "Please enter a valid mobile number.");
      return;
    }

    setOrdering(true);
    setError("");
    try {
      const res = await fetch("/api/orders/quick/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: product.id,
          quantity,
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || (isSwahili ? "Imeshindwa kutuma agizo. Jaribu tena." : "Could not place the order. Try again."));
        return;
      }

      setOrderId(data.order_id);
      setOrderStatus("new");
      saveCustomerOrder({
        id: data.order_id,
        listingId: product.id,
        title: product.title,
        imageUrl: product.image_url,
        store: "Mo Expressway",
        quantity,
        total: totalPrice,
        currency,
        phone: phone.trim(),
        status: "new",
        createdAt: new Date().toISOString(),
      });
      setStep("tracking");
      if (onOrderSuccess) onOrderSuccess(product, quantity);
    } catch {
      setError(isSwahili ? "Hakuna mtandao. Jaribu tena." : "Network error. Please try again.");
    } finally {
      setOrdering(false);
    }
  };

  const cancelOrder = async () => {
    if (!orderId) return;
    try {
      await fetch(`/api/orders/quick/${orderId}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      setOrderStatus("cancelled");
      updateCustomerOrderStatus(orderId, "cancelled");
    } catch {
      // ignore
    }
  };

  // The customer only ever deals with Mo Expressway; which store supplies the goods stays internal.
  const trackingSteps: { key: string; label: string; labelSw: string; icon: typeof PackageCheck }[] = [
    { key: "received", label: "Received", labelSw: "Limepokelewa", icon: PackageCheck },
    { key: "confirmed", label: "Confirmed", labelSw: "Limethibitishwa", icon: PhoneCall },
    { key: "preparing", label: "Preparing", labelSw: "Linaandaliwa", icon: PackageSearch },
    { key: "on_the_way", label: "On the way", labelSw: "Njiani", icon: Truck },
  ];
  const STEP_INDEX: Record<OrderStatus, number> = {
    new: 1,
    contacted: 2,
    confirmed: 3,
    sourcing: 3,
    picked_up: 4,
    delivered: 5,
    cancelled: 0,
  };
  const stepIndex = STEP_INDEX[orderStatus] ?? 1;
  const itemLabel = isService ? product.title : `${quantity}x ${product.title}`;
  const isDelivered = orderStatus === "delivered";

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-end justify-center p-0 transition-all duration-300 sm:items-center sm:p-4 ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-navy/70 backdrop-blur-md transition-all duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={step === "tracking" ? undefined : onClose}
      />

      {/* Modal Card */}
      <div
        className={`relative z-10 max-h-[100dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-border bg-white shadow-2xl transition-all duration-500 sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl ${
          open ? "scale-100 translate-y-0 opacity-100" : "scale-95 translate-y-8 opacity-0"
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute right-4 top-4 z-20 flex size-9 items-center justify-center rounded-full transition ${
            step === "tracking"
              ? "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
              : "bg-slate-100/90 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          }`}
          aria-label="Close"
        >
          <X className="size-5" />
        </button>

        {step === "tracking" ? (
          /* ===== Bolt-style live tracking screen ===== */
          <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-navy px-4 py-16 text-center sm:min-h-[540px] sm:px-6 sm:py-12">
            {/* Radar rings */}
            <div className="relative mb-7 flex items-center justify-center sm:mb-10">
              {!isDelivered && orderStatus !== "cancelled" && (
                <>
                  <span className="absolute size-36 rounded-full bg-primary/25 animate-ping" />
                  <span className="absolute size-52 rounded-full bg-primary/15 animate-ping" style={{ animationDelay: "0.4s" }} />
                  <span className="absolute size-56 rounded-full bg-primary/8 animate-ping sm:size-72" style={{ animationDelay: "0.8s" }} />
                </>
              )}
              {isDelivered && (
                <>
                  <span className="absolute size-36 rounded-full bg-emerald-500/25 animate-ping" />
                  <span className="absolute size-52 rounded-full bg-emerald-500/10 animate-ping" style={{ animationDelay: "0.4s" }} />
                </>
              )}
              <div className={`relative z-10 flex size-28 items-center justify-center overflow-hidden rounded-full border-4 shadow-2xl transition-colors duration-500 ${
                isDelivered ? "border-emerald-400 bg-emerald-500" :
                orderStatus === "cancelled" ? "border-red-400 bg-red-500" :
                "border-white bg-white"
              }`}>
                {isDelivered ? (
                  <CheckCircle2 className="size-14 text-white" />
                ) : orderStatus === "cancelled" ? (
                  <XCircle className="size-14 text-white" />
                ) : orderStatus === "picked_up" ? (
                  <Truck className="size-12 text-primary animate-pulse" />
                ) : orderStatus === "confirmed" || orderStatus === "sourcing" ? (
                  <PackageSearch className="size-12 text-primary animate-pulse" />
                ) : orderStatus === "contacted" ? (
                  <PhoneCall className="size-12 text-primary animate-pulse" />
                ) : product.image_url ? (
                  <img src={product.image_url} alt={product.title} className="h-full w-full object-cover" />
                ) : (
                  <ShoppingBag className="size-12 text-primary" />
                )}
              </div>
            </div>

            {/* Status text */}
            {isDelivered ? (
              <>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  {isSwahili ? "Limefika! 🎉" : "Delivered! 🎉"}
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-300">
                  {isSwahili
                    ? <>Asante kwa kununua na <b className="text-white">Mo Expressway</b>. <b className="text-white">{itemLabel}</b> {isService ? "imekamilika" : "imekufikia"}.</>
                    : <>Thank you for shopping with <b className="text-white">Mo Expressway</b>. Your <b className="text-white">{itemLabel}</b> {isService ? "is complete" : "has been delivered"}.</>}
                </p>
              </>
            ) : orderStatus === "cancelled" ? (
              <>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  {isSwahili ? "Agizo Limeghairiwa" : "Order Cancelled"}
                </h2>
                <p className="mt-3 max-w-sm text-sm text-slate-300">
                  {isSwahili ? "Agizo hili halijatelekezwa tena." : "This order is no longer being processed."}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  {orderStatus === "picked_up"
                    ? (isSwahili ? "Agizo Liko Njiani!" : "On the Way!")
                    : orderStatus === "confirmed" || orderStatus === "sourcing"
                      ? (isSwahili ? "Tunaandaa Agizo Lako" : "Preparing Your Order")
                      : orderStatus === "contacted"
                        ? (isSwahili ? "Tunathibitisha Agizo" : "Confirming Your Order")
                        : (isSwahili ? "Agizo Limepokelewa!" : "Order Received!")}
                </h2>
                <p className="mt-3 flex items-center justify-center gap-1 text-sm text-slate-300">
                  {orderStatus === "picked_up"
                    ? (isSwahili ? "Mo Expressway inakuletea agizo lako" : "Mo Expressway is bringing your order to you")
                    : orderStatus === "confirmed" || orderStatus === "sourcing"
                      ? (isSwahili ? "Tunakusanya bidhaa zako" : "We are getting your items ready")
                      : (isSwahili ? `Mo Expressway itakupigia ${phone} kuthibitisha` : `Mo Expressway will call ${phone} to confirm`)}
                  <span className="ml-1 flex gap-1">
                    <span className="size-1.5 rounded-full bg-primary animate-bounce" />
                    <span className="size-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.15s" }} />
                    <span className="size-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.3s" }} />
                  </span>
                </p>
              </>
            )}

            {/* Progress steps */}
            <div className="mt-7 flex w-full max-w-sm items-center sm:mt-10">
              {trackingSteps.map((s, i) => {
                const done = stepIndex > i;
                const active = stepIndex === i + 1;
                return (
                  <div key={s.key} className="flex flex-1 items-center last:flex-none">
                    <div className="flex flex-col items-center gap-2">
                      <div className={`flex size-9 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                        done ? "border-emerald-400 bg-emerald-500 text-white" :
                        active ? "border-primary bg-primary/20 text-primary" :
                        "border-slate-600 bg-slate-800 text-slate-500"
                      }`}>
                        {done ? <CheckCircle2 className="size-4" /> : <s.icon className="size-4" />}
                      </div>
                      <span className={`text-[10px] font-bold whitespace-nowrap ${done || active ? "text-white" : "text-slate-500"}`}>
                        {isSwahili ? s.labelSw : s.label}
                      </span>
                    </div>
                    {i < trackingSteps.length - 1 && (
                      <div className={`mx-2 mb-6 h-0.5 flex-1 rounded transition-colors duration-500 ${stepIndex > i + 1 ? "bg-emerald-400" : "bg-slate-700"}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Order summary chip */}
            <div className="mt-6 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 backdrop-blur sm:mt-8 sm:px-4">
              {product.image_url && <img src={product.image_url} alt="" className="size-10 rounded-lg object-cover" />}
              <div className="text-left">
                <p className="text-xs font-bold text-white">{itemLabel}</p>
                <p className="text-[11px] text-slate-400">{isSwahili ? "Inaletwa na Mo Expressway" : "Delivered by Mo Expressway"}</p>
              </div>
              {isService ? (
                <ServicePrice price={unitPrice} currency={currency} className="ml-4 text-sm font-black text-primary whitespace-nowrap" />
              ) : (
                <p className="ml-4 text-sm font-black text-primary whitespace-nowrap">{currency} {totalPrice.toLocaleString()}</p>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 w-full max-w-sm sm:mt-8">
              {orderStatus !== "new" && orderStatus !== "contacted" ? (
                <Button
                  onClick={onClose}
                  className="w-full h-12 rounded-xl text-base font-black"
                >
                  {isDelivered || orderStatus === "cancelled"
                    ? (isSwahili ? "Sawa, Asante!" : "Done")
                    : (isSwahili ? "Funga — fuatilia kwenye Maagizo Yangu" : "Close — track in My Orders")}
                </Button>
              ) : (
                <button
                  type="button"
                  onClick={cancelOrder}
                  className="w-full rounded-xl border border-white/15 py-3 text-xs font-bold text-slate-300 transition hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-300"
                >
                  {isSwahili ? "Ghairi Agizo" : "Cancel Order"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Left Side: Big Product Image */}
            <div className="relative flex h-48 items-center justify-center overflow-hidden bg-slate-100 sm:h-60 md:h-auto md:min-h-[420px]">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.title}
                  className="h-full w-full object-contain p-4 transition-transform duration-500 hover:scale-105"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <ShoppingBag className="size-16 text-primary/40" />
                </div>
              )}
              {product.sale && (
                <span className="absolute left-4 top-4 rounded-full bg-sale px-3 py-1 text-xs font-black text-sale-foreground shadow-md">
                  {product.sale}
                </span>
              )}
            </div>

            {/* Right Side: Product Details & Order Form */}
            <div className="flex flex-col justify-between p-4 pb-6 sm:p-6 md:p-8">
              {step === "details" ? (
                <>
                  <div className="space-y-4">
                    {/* Store Name Badge */}
                    {product.store && (
                      <div className="flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-bold text-navy w-fit">
                        <Store className="size-4 text-primary" />
                        <span className="truncate">{product.store}</span>
                      </div>
                    )}

                    {/* Product Name */}
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-navy leading-tight">
                        {product.title}
                      </h2>
                      {(product.subcategory || product.category) && (
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          {product.subcategory || product.category}
                        </p>
                      )}
                    </div>

                    {/* Price section */}
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {quantity > 1 ? "Bei ya Jumla / Total Price" : "Bei / Price"}
                      </div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-black text-primary">
                          {currency} {totalPrice.toLocaleString()}
                        </span>
                        {quantity > 1 && (
                          <span className="text-xs text-muted-foreground">
                            ({currency} {unitPrice.toLocaleString()} / item)
                          </span>
                        )}
                      </div>
                      {product.discount && (
                        <p className="mt-1 text-xs text-muted-foreground line-through">
                          {currency} {(Number(product.discount) * quantity).toLocaleString()}
                        </p>
                      )}
                    </div>

                    {/* Quantity Counter (Plus / Minus) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Idadi / Quantity
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          disabled={quantity <= 1}
                          className="flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-navy font-bold shadow-sm transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="size-4" />
                        </button>
                        <span className="min-w-[48px] text-center text-xl font-black text-navy">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => q + 1)}
                          className="flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-navy font-bold shadow-sm transition hover:bg-slate-50 active:scale-95"
                          aria-label="Increase quantity"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Agiza Sasa Button -> go to contact step */}
                  <div className="mt-6 pt-4 border-t border-slate-100">
                    <Button
                      onClick={() => setStep("contact")}
                      className="w-full h-12 rounded-xl text-base font-black shadow-lg shadow-primary/20 transition hover:shadow-xl active:scale-[0.99]"
                    >
                      <Zap className="size-5 fill-current" />
                      {t("orderNow")}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-navy leading-tight">
                        {isService
                          ? (isSwahili ? "Maliza Uhifadhi Wako" : "Complete Your Booking")
                          : (isSwahili ? "Maliza Agizo Lako" : "Complete Your Order")}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {isSwahili
                          ? "Weka jina na namba yako ya simu — Mo Expressway itakupigia na kukuletea."
                          : "Enter your name and phone — Mo Expressway will call you and deliver."}
                      </p>
                    </div>

                    {/* Mini order summary */}
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                      {product.image_url && (
                        <img src={product.image_url} alt="" className="size-14 rounded-xl object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold text-navy">{product.title}</p>
                        <p className="text-xs text-muted-foreground">{isService ? "Mo Expressway" : `${quantity}x · Mo Expressway`}</p>
                      </div>
                      {isService ? (
                        <ServicePrice price={unitPrice} currency={currency} className="text-sm font-black text-primary whitespace-nowrap" />
                      ) : (
                        <p className="text-sm font-black text-primary whitespace-nowrap">
                          {currency} {totalPrice.toLocaleString()}
                        </p>
                      )}
                    </div>
                    {isService && (
                      <p className="-mt-2 text-[11px] text-muted-foreground">{t("servicePriceNote")}</p>
                    )}

                    {/* Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        {isSwahili ? "Jina Lako" : "Your Name"}
                      </label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <input
                          value={name}
                          onChange={(e) => { setName(e.target.value); setError(""); }}
                          placeholder={isSwahili ? "Mfano: Amina Juma" : "e.g. Amina Juma"}
                          className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-semibold text-navy outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        {isSwahili ? "Namba ya Simu" : "Mobile Number"}
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <input
                          value={phone}
                          onChange={(e) => { setPhone(e.target.value); setError(""); }}
                          onKeyDown={(e) => { if (e.key === "Enter") handleOrder(); }}
                          type="tel"
                          placeholder="e.g. 0712 345 678"
                          className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-semibold text-navy outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>

                    {/* Delivery location (optional) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        {isSwahili ? "Mahali pa Kuletewa (si lazima)" : "Delivery Location (optional)"}
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <input
                          value={address}
                          onChange={(e) => { setAddress(e.target.value); setError(""); }}
                          onKeyDown={(e) => { if (e.key === "Enter") handleOrder(); }}
                          maxLength={255}
                          placeholder={isSwahili ? "Mfano: Sinza Mori, Dar es Salaam" : "e.g. Sinza Mori, Dar es Salaam"}
                          className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-semibold text-navy outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>

                    {error && (
                      <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{error}</p>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
                    <Button
                      onClick={handleOrder}
                      disabled={ordering}
                      className="w-full h-12 rounded-xl text-base font-black shadow-lg shadow-primary/20 transition hover:shadow-xl active:scale-[0.99]"
                    >
                      <Zap className="size-5 fill-current" />
                      {ordering
                        ? (isSwahili ? "Inatuma..." : "Submitting...")
                        : isService
                          ? (isSwahili ? "Thibitisha Uhifadhi" : "Confirm Booking")
                          : (isSwahili ? "Thibitisha Agizo" : "Confirm Order")}
                    </Button>
                    {!isService && (
                      <button
                        type="button"
                        onClick={() => setStep("details")}
                        disabled={ordering}
                        className="flex w-full items-center justify-center gap-1.5 text-xs font-bold text-muted-foreground transition hover:text-navy"
                      >
                        <ArrowLeft className="size-3.5" />
                        {isSwahili ? "Rudi nyuma" : "Back"}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
