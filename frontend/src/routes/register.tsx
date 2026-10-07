import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Camera,
  Car,
  Check,
  ChefHat,
  Crosshair,
  Dumbbell,
  Droplets,
  Hammer,
  Heart,
  Lock,
  LocateFixed,
  Mail,
  MailCheck,
  MapPin,
  Monitor,
  Phone,
  ShoppingBasket,
  Shirt,
  Sofa,
  Sparkles,
  Store,
  Truck,
  User,
  Wrench,
  BookOpen,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/LanguageContext";
import { BrandLogo } from "@/components/BrandLogo";
import heroImage from "@/assets/market-hero.jpg";

declare global {
  interface Window {
    __gmapsReady?: () => void;
  }
}

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Vendor Registration | Duka Magic Expressway" },
      {
        name: "description",
        content:
          "Register your business on Duka Magic Expressway and start selling goods and services today.",
      },
    ],
  }),
  component: RegisterPage,
});

const GOODS_CATEGORIES = [
  "Electronics",
  "Fashion",
  "Home & Living",
  "Beauty & Health",
  "Groceries",
  "Automotive",
  "Sports & Outdoors",
  "Books & Stationery",
  "Services",
];

const SERVICE_CATEGORIES = [
  "Electronics Repair",
  "Home Repair & Maintenance",
  "Vehicle Services",
  "Beauty & Spa",
  "Professional Services",
  "Cleaning",
  "Delivery & Logistics",
  "Catering & Food",
  "Photography",
];

type CategoryType = "goods" | "services" | "both";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Electronics: Monitor,
  Fashion: Shirt,
  "Home & Living": Sofa,
  "Beauty & Health": Heart,
  Groceries: ShoppingBasket,
  Automotive: Car,
  "Sports & Outdoors": Dumbbell,
  "Books & Stationery": BookOpen,
  Services: Store,
  "Electronics Repair": Wrench,
  "Home Repair & Maintenance": Hammer,
  "Vehicle Services": Car,
  "Beauty & Spa": Sparkles,
  "Professional Services": Briefcase,
  Cleaning: Droplets,
  "Delivery & Logistics": Truck,
  "Catering & Food": ChefHat,
  Photography: Camera,
};

type Step = "email" | "check-email" | "verifying" | "business";

function RegisterPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const search = Route.useSearch() as { token?: string };
  const urlToken = typeof search.token === "string" ? search.token : undefined;

  const [step, setStep] = useState<Step>(urlToken ? "verifying" : "email");
  const [verifiedToken, setVerifiedToken] = useState<string | null>(urlToken ?? null);

  // email step
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  // business step
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [storeName, setStoreName] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [categoryType, setCategoryType] = useState<CategoryType | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const verifyToken = async (tok: string) => {
    setStep("verifying");
    try {
      const res = await fetch("/api/register/verify/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: tok }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || "Could not verify this link.");
      }
      setEmail(data.email || "");
      setVerifiedToken(tok);
      const { default: Swal } = await import("sweetalert2");
      Swal.fire({
        title: "Email verified!",
        text: "Now let's set up your store.",
        icon: "success",
        background: "#ffffff",
        color: "#0f172a",
        confirmButtonColor: "#f97316",
      }).then(() => {
        setStep("business");
      });
    } catch (err) {
      setVerifiedToken(null);
      setStep("email");
      const { default: Swal } = await import("sweetalert2");
      Swal.fire({
        title: "Link not valid",
        text:
          err instanceof Error ? err.message : "Verification failed. Please request a new link.",
        icon: "error",
        background: "#ffffff",
        color: "#0f172a",
        confirmButtonColor: "#f97316",
      });
    }
  };

  useEffect(() => {
    if (urlToken) verifyToken(urlToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    const { default: Swal } = await import("sweetalert2");
    try {
      const res = await fetch("/api/register/request/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSending(false);
        Swal.fire({
          title: "Couldn't send the link",
          text: data?.error || "Please try again.",
          icon: "error",
          background: "#ffffff",
          color: "#0f172a",
          confirmButtonColor: "#f97316",
        });
        return;
      }
      setSending(false);
      setStep("check-email");
    } catch {
      setSending(false);
      Swal.fire({
        title: "Connection error",
        text: "Unable to reach the server. Please make sure the backend is running.",
        icon: "error",
        background: "#ffffff",
        color: "#0f172a",
        confirmButtonColor: "#f97316",
      });
    }
  };

  const toggleCategory = (name: string) => {
    setFormError(null);
    setSelected((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));
  };

  const categories =
    categoryType === "goods"
      ? GOODS_CATEGORIES
      : categoryType === "services"
        ? SERVICE_CATEGORIES
        : categoryType === "both"
          ? [...GOODS_CATEGORIES, ...SERVICE_CATEGORIES]
          : [];

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedToken) {
      setFormError("Your verification has expired. Please restart.");
      return;
    }
    if (!categoryType) {
      setFormError("Choose what you sell: goods, services or both.");
      return;
    }
    if (selected.length === 0) {
      setFormError("Select at least one category you sell.");
      return;
    }
    if (
      categoryType === "both" &&
      (!selected.some((c) => GOODS_CATEGORIES.includes(c)) ||
        !selected.some((c) => SERVICE_CATEGORIES.includes(c)))
    ) {
      setFormError("Select at least one goods category and one services category.");
      return;
    }
    if (password !== passwordConfirm) {
      setFormError("Passwords do not match.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    const { default: Swal } = await import("sweetalert2");
    try {
      const res = await fetch("/api/register/complete/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token: verifiedToken,
          full_name: fullName,
          phone_number: phone,
          password,
          store_name: storeName,
          category_type: categoryType,
          categories: selected,
          latitude,
          longitude,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.authenticated) {
        setSubmitting(false);
        Swal.fire({
          title: "Registration failed",
          text: data?.error || "Please check your details and try again.",
          icon: "error",
          background: "#ffffff",
          color: "#0f172a",
          confirmButtonColor: "#f97316",
        });
        return;
      }
      setSubmitting(false);
      Swal.fire({
        title: "Account created!",
        html: "<b>Your business is set up.</b><br/>Welcome to your dashboard.",
        icon: "success",
        confirmButtonText: "Go to my dashboard",
        confirmButtonColor: "#f97316",
        timer: 3000,
        timerProgressBar: true,
        background: "#ffffff",
        color: "#0f172a",
      }).then(() => {
        navigate({ to: data.redirect || "/vendor" });
      });
    } catch {
      setSubmitting(false);
      Swal.fire({
        title: "Connection error",
        text: "Unable to reach the server. Please make sure the backend is running.",
        icon: "error",
        background: "#ffffff",
        color: "#0f172a",
        confirmButtonColor: "#f97316",
      });
    }
  };

  return (
    <div className="auth-autofill relative min-h-screen overflow-hidden">
      <style>{`
        .auth-autofill input:-webkit-autofill,
        .auth-autofill input:-webkit-autofill:hover,
        .auth-autofill input:-webkit-autofill:focus {
          -webkit-text-fill-color: #ffffff;
          caret-color: #ffffff;
          -webkit-box-shadow: 0 0 0 1000px rgba(20, 15, 20, 0.85) inset;
          box-shadow: 0 0 0 1000px rgba(20, 15, 20, 0.85) inset;
          transition: background-color 9999s ease-in-out 0s;
        }
      `}</style>

      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img src={heroImage} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-navy/90 via-slate-900/85 to-orange-900/80" />
      </div>

      <div className="relative z-10 flex min-h-screen items-start justify-center px-4 py-10">
        <div className="w-full max-w-xl">
          {/* Logo */}
          <div className="mb-6 text-center">
            <div className="inline-flex items-center gap-2">
              <BrandLogo className="size-12 rounded-2xl ring-2 ring-white/20" />
              <div>
                <strong className="block text-2xl font-black leading-none text-white">
                  Duka Magic <em className="not-italic text-primary">Expressway</em>
                </strong>
                <small className="text-xs font-bold text-white/70">{t("goodsServices")}</small>
              </div>
            </div>
          </div>

          {step === "email" && (
            <Card title="Become a Seller" subtitle="Start with your business email.">
              <form onSubmit={handleRequest} className="space-y-5">
                <Field label="Business Email" icon={<Mail className="size-5" />}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="field-input"
                    required
                  />
                </Field>
                <Button
                  type="submit"
                  disabled={sending}
                  className="h-12 w-full rounded-xl bg-gradient-to-r from-primary to-amber-600 text-sm font-black text-white shadow-lg transition hover:from-orange-600 hover:to-amber-700 disabled:opacity-60"
                >
                  {sending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-5 animate-spin" /> Sending...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Send verification link <ArrowRight className="size-5" />
                    </span>
                  )}
                </Button>
              </form>
              <div className="mt-5 text-center text-sm text-white/60">
                <Link toLogin>
                  <ArrowLeft className="size-4" /> Back to login
                </Link>
              </div>
            </Card>
          )}

          {step === "check-email" && (
            <Card
              title="Check your inbox"
              subtitle={`We emailed ${email || "you"} a verification link.`}
            >
              <div className="flex flex-col items-center gap-4 py-2 text-center">
                <span className="grid size-16 place-items-center rounded-full bg-emerald-500/20">
                  <MailCheck className="size-8 text-emerald-300" />
                </span>
                <p className="text-sm leading-relaxed text-white/70">
                  Click the link in the email to verify your address and continue with your business
                  registration. The link expires in 24 hours.
                </p>
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="mt-1 text-sm font-semibold text-white/60 transition hover:text-white"
                >
                  ← Use a different email
                </button>
              </div>
            </Card>
          )}

          {step === "verifying" && (
            <Card title="Verifying your email" subtitle="Just a moment...">
              <div className="flex flex-col items-center gap-4 py-6">
                <Loader2 className="size-10 animate-spin text-primary" />
                <p className="text-sm text-white/70">Validating your verification link.</p>
              </div>
            </Card>
          )}

          {step === "business" && (
            <BusinessForm
              fullName={fullName}
              setFullName={setFullName}
              phone={phone}
              setPhone={setPhone}
              password={password}
              setPassword={setPassword}
              passwordConfirm={passwordConfirm}
              setPasswordConfirm={setPasswordConfirm}
              storeName={storeName}
              setStoreName={setStoreName}
              latitude={latitude}
              setLatitude={setLatitude}
              longitude={longitude}
              setLongitude={setLongitude}
              categoryType={categoryType}
              setCategoryType={(ct) => {
                setFormError(null);
                setSelected([]);
                setCategoryType(ct);
              }}
              categories={categories}
              selected={selected}
              toggleCategory={toggleCategory}
              submitting={submitting}
              formError={formError}
              onSubmit={handleComplete}
              onExit={() => setStep("email")}
            />
          )}

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-white/50">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => navigate({ to: "/login" })}
              className="font-bold text-primary transition hover:text-orange-400"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>

      <style>{`
        .field-input {
          height: 3rem;
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.1);
          padding-left: 3rem;
          padding-right: 1rem;
          font-size: 0.875rem;
          color: #fff;
          outline: none;
          backdrop-filter: blur(12px);
        }
        .field-input::placeholder { color: rgba(255,255,255,0.4); }
        .field-input:focus {
          border-color: var(--color-primary);
          background: rgba(255,255,255,0.2);
          box-shadow: 0 0 0 2px color-mix(in oklch, var(--color-primary) 30%, transparent);
        }
        .step-animate {
          animation: step-slide-in 0.35s ease both;
        }
        .step-animate-left {
          animation: step-slide-in-left 0.35s ease both;
        }
        @keyframes step-slide-in {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes step-slide-in-left {
          from { opacity: 0; transform: translateX(-24px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 p-7 shadow-2xl backdrop-blur-xl sm:p-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-black text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-white/70">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-white/90">{label}</label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50">{icon}</span>
        {children}
      </div>
    </div>
  );
}

function Link({ children, toLogin }: { children: React.ReactNode; toLogin: boolean }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate({ to: toLogin ? "/login" : "/" })}
      className="inline-flex items-center gap-2 font-semibold text-white/60 transition hover:text-white"
    >
      {children}
    </button>
  );
}

const GOOGLE_MAPS_API_KEY = import.meta.env["VITE_GOOGLE_MAPS_API_KEY"] as string | undefined;

const PIN_ICON =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#F97316" stroke="#ffffff" stroke-width="1.6">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3.2" fill="#ffffff" stroke="none"/>
  </svg>`);

let gmapsPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (!GOOGLE_MAPS_API_KEY) return Promise.reject(new Error("Google Maps API key is not configured."));
  if (gmapsPromise) return gmapsPromise;
  gmapsPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById("gmaps-script");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Could not load Google Maps.")));
      return;
    }
    const script = document.createElement("script");
    script.id = "gmaps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=weekly&callback=__gmapsReady`;
    script.async = true;
    script.defer = true;
    window.__gmapsReady = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google Maps."));
    const timer = window.setTimeout(() => {
      reject(
        new Error(
          "Google Maps failed to load. Check that your API key is valid, enabled, and unrestricted to this origin.",
        ),
      );
    }, 12000);
    script.onload = () => window.clearTimeout(timer);
    document.head.appendChild(script);
  });
  return gmapsPromise;
}

function MapPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const watchRef = useRef<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    return () => {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      markerRef.current?.setMap(null);
      circleRef.current?.setMap(null);
      mapRef.current = null;
    };
  }, []);

  const sync = (p: { lat: number; lng: number }) => {
    if (markerRef.current) markerRef.current.setPosition(p);
    onChangeRef.current(p.lat, p.lng);
    return { lat: p.lat, lng: p.lng };
  };

  const ensureCircle = (center: { lat: number; lng: number }, accuracy: number) => {
    if (!mapRef.current) return;
    if (circleRef.current == null) {
      circleRef.current = new google.maps.Circle({
        map: mapRef.current,
        center,
        radius: Math.max(accuracy, 20),
        fillColor: "#3b82f6",
        fillOpacity: 0.18,
        strokeColor: "#3b82f6",
        strokeOpacity: 0.5,
        strokeWeight: 1,
      });
    } else {
      circleRef.current.setCenter(center);
      circleRef.current.setRadius(Math.max(accuracy, 20));
    }
  };

  const stopTracking = () => {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setTracking(false);
  };

  const selectManualLocation = () => {
    stopTracking();
    circleRef.current?.setMap(null);
    circleRef.current = null;
  };

  const buildMap = (center: { lat: number; lng: number }, accuracy: number) => {
    if (mapRef.current || !ref.current) return;
    const map = new google.maps.Map(ref.current, {
      center,
      zoom: 16,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      gestureHandling: "greedy",
    });
    mapRef.current = map;

    const marker = new google.maps.Marker({
      map,
      position: center,
      draggable: true,
      icon: {
        url: PIN_ICON,
        scaledSize: new google.maps.Size(36, 36),
        anchor: new google.maps.Point(18, 34),
      },
    });
    markerRef.current = marker;

    marker.addListener("dragstart", selectManualLocation);
    marker.addListener("dragend", () => {
      const p = marker.getPosition();
      if (p) sync({ lat: p.lat(), lng: p.lng() });
    });
    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      const p = e.latLng;
      if (!p) return;
      selectManualLocation();
      sync({ lat: p.lat(), lng: p.lng() });
      map.panTo(p);
      map.setZoom(Math.max(map.getZoom() ?? 15, 15));
    });

    ensureCircle(center, accuracy);
    setMapReady(true);
  };

  const updateLive = (pos: GeolocationPosition, first: boolean) => {
    const { latitude: la, longitude: lo, accuracy } = pos.coords;
    const ll = { lat: la, lng: lo };
    sync(ll);
    if (mapRef.current) {
      ensureCircle(ll, accuracy);
      if (first) mapRef.current.panTo(ll);
    }
  };

  const startLive = async () => {
    if (tracking) {
      stopTracking();
      return;
    }
    if (!navigator.geolocation) {
      setMapError("Your browser does not support location access.");
      return;
    }
    setLocating(true);
    setMapError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 20000,
        }),
      );
      await loadGoogleMaps();
      if (!mapRef.current) {
        buildMap({ lat: pos.coords.latitude, lng: pos.coords.longitude }, pos.coords.accuracy);
      }
      updateLive(pos, true);
      setTracking(true);
      setLocating(false);

      let firstFix = true;
      watchRef.current = navigator.geolocation.watchPosition(
        (p) => {
          if (mapRef.current) updateLive(p, firstFix);
          firstFix = false;
        },
        () => {
          stopTracking();
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
      );
    } catch (error) {
      setLocating(false);
      if (error instanceof Error) {
        setMapError(error.message);
      } else {
        setMapError("Could not get your location. Allow location access in the browser prompt.");
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative h-72 w-full overflow-hidden rounded-xl border border-white/25 bg-slate-200">
        <div ref={ref} className="absolute inset-0" />

        {!mapReady && !mapError && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-gradient-to-br from-navy/95 via-slate-900/90 to-orange-900/85 px-6 text-center">
            {locating ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="text-sm font-semibold text-white/80">Finding your location...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <span className="grid size-14 place-items-center rounded-full bg-primary/25 ring-1 ring-primary/50">
                  <LocateFixed className="size-7 text-primary" />
                </span>
                <p className="max-w-xs text-sm leading-relaxed text-white/70">
                  We'll open the map at your store position once you allow location access.
                </p>
                <button
                  type="button"
                  onClick={startLive}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-amber-600 px-6 text-sm font-black text-white shadow-lg transition hover:from-orange-600 hover:to-amber-700"
                >
                  <Crosshair className="size-4" /> Use my live location
                </button>
              </div>
            )}
          </div>
        )}

        {mapError && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-black/60 px-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm font-semibold text-red-200">{mapError}</p>
              {!mapReady && (
                <button
                  type="button"
                  onClick={startLive}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-xs font-bold text-white shadow-md transition hover:from-orange-600 hover:to-amber-700"
                >
                  <Crosshair className="size-4" /> Try again
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs text-white/80">
        <span className="flex items-center gap-2">
          <MapPin className="size-4 text-primary" /> Store location
        </span>
        <span className="font-mono font-bold text-white">
          {lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "Not set yet"}
        </span>
      </div>
    </div>
  );
}

function BusinessForm(props: {
  fullName: string;
  setFullName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  passwordConfirm: string;
  setPasswordConfirm: (v: string) => void;
  storeName: string;
  setStoreName: (v: string) => void;
  latitude: number | null;
  setLatitude: (v: number | null) => void;
  longitude: number | null;
  setLongitude: (v: number | null) => void;
  categoryType: CategoryType | null;
  setCategoryType: (v: CategoryType) => void;
  categories: string[];
  selected: string[];
  toggleCategory: (name: string) => void;
  submitting: boolean;
  formError: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onExit: () => void;
}) {
  const STEP_HEADERS: Record<number, { title: string; subtitle: string }> = {
    1: {
      title: "Create your account",
      subtitle: "A few details to set up your vendor login.",
    },
    2: {
      title: "Name your store",
      subtitle: "What should we call your business?",
    },
    3: {
      title: "Store location",
      subtitle: "Where is your store located?",
    },
    4: {
      title: "What do you sell?",
      subtitle: "Goods, services or both — choose your categories.",
    },
  };

  const [bStep, setBStep] = useState(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [stepError, setStepError] = useState<string | null>(null);

  const goTo = (n: number, dir: 1 | -1) => {
    setDirection(dir);
    setStepError(null);
    setBStep(n);
  };

  const handleNext = () => {
    setStepError(null);
    if (bStep === 1) {
      if (!props.fullName.trim()) return setStepError("Enter your full name.");
      if (!props.phone.trim()) return setStepError("Enter your phone number.");
      if (props.password.length < 8) return setStepError("Password must be at least 8 characters.");
      if (props.password !== props.passwordConfirm) return setStepError("Passwords do not match.");
    }
    if (bStep === 2 && !props.storeName.trim()) return setStepError("Enter your store name.");
    if (bStep === 3 && (props.latitude == null || props.longitude == null))
      return setStepError("Place your store on the map to continue.");
    goTo(bStep + 1, 1);
  };

  const handleBack = () => {
    if (bStep === 1) return props.onExit();
    goTo(bStep - 1, -1);
  };

  const stepHeader = STEP_HEADERS[bStep] ?? {
    title: "Vendor registration",
    subtitle: "Complete your store details.",
  };

  return (
    <Card title={stepHeader.title} subtitle={stepHeader.subtitle}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (bStep === 4) props.onSubmit(e);
          else handleNext();
        }}
        className="space-y-6"
      >
        <div key={bStep} className={`step-animate${direction === 1 ? "" : "-left"}`}>
          {bStep === 1 && (
            <>
              <div className="mt-4 space-y-5">
                <Field label="Full Name" icon={<User className="size-5" />}>
                  <input
                    className="field-input"
                    value={props.fullName}
                    onChange={(e) => props.setFullName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    required
                  />
                </Field>
                <Field label="Phone Number" icon={<Phone className="size-5" />}>
                  <input
                    type="tel"
                    className="field-input"
                    value={props.phone}
                    onChange={(e) => props.setPhone(e.target.value)}
                    placeholder="e.g. +255712345678"
                    required
                  />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Password" icon={<Lock className="size-5" />}>
                    <input
                      type="password"
                      className="field-input"
                      value={props.password}
                      onChange={(e) => props.setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      required
                      minLength={8}
                    />
                  </Field>
                  <Field label="Confirm Password" icon={<Lock className="size-5" />}>
                    <input
                      type="password"
                      className="field-input"
                      value={props.passwordConfirm}
                      onChange={(e) => props.setPasswordConfirm(e.target.value)}
                      placeholder="Repeat password"
                      required
                      minLength={8}
                    />
                  </Field>
                </div>
              </div>
            </>
          )}

          {bStep === 2 && (
            <>
              <div className="mt-4 space-y-5">
                <Field label="Store Name" icon={<Store className="size-5" />}>
                  <input
                    className="field-input"
                    value={props.storeName}
                    onChange={(e) => props.setStoreName(e.target.value)}
                    placeholder="e.g. Jane's Electronics"
                    required
                  />
                </Field>
              </div>
            </>
          )}

          {bStep === 3 && (
            <>
              <div className="mt-4 space-y-3">
                <p className="text-sm text-white/70">
                  Allow location access so we can open the map at your store's position, then
                  confirm the pin.
                </p>
                <MapPicker
                  lat={props.latitude}
                  lng={props.longitude}
                  onChange={(lat, lng) => {
                    props.setLatitude(lat);
                    props.setLongitude(lng);
                  }}
                />
              </div>
            </>
          )}

          {bStep === 4 && (
            <>
              <div className="mt-4 space-y-5">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <SelectableCard
                    active={props.categoryType === "goods"}
                    onClick={() => props.setCategoryType("goods")}
                    icon={ShoppingBasket}
                    title="Goods"
                    subtitle="Physical products"
                  />
                  <SelectableCard
                    active={props.categoryType === "services"}
                    onClick={() => props.setCategoryType("services")}
                    icon={Wrench}
                    title="Services"
                    subtitle="Professional services"
                  />
                  <SelectableCard
                    active={props.categoryType === "both"}
                    onClick={() => props.setCategoryType("both")}
                    icon={Store}
                    title="Both"
                    subtitle="Goods & services"
                  />
                </div>
                {(props.categoryType === "both"
                  ? [
                      { label: "Select goods you sell", items: GOODS_CATEGORIES },
                      { label: "Select services you offer", items: SERVICE_CATEGORIES },
                    ]
                  : props.categories.length > 0
                    ? [
                        {
                          label: `Select ${props.categoryType === "goods" ? "goods" : "services"} you sell`,
                          items: props.categories,
                        },
                      ]
                    : []
                ).map((group) => (
                  <div key={group.label}>
                    <label className="mb-2 block text-sm font-bold text-white/90">
                      {group.label} <span className="text-primary">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {group.items.map((name) => {
                        const Icon = CATEGORY_ICONS[name] ?? Store;
                        const isSelected = props.selected.includes(name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => props.toggleCategory(name)}
                            className={`group flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-xs font-semibold transition ${
                              isSelected
                                ? "border-primary bg-primary/25 text-white shadow-md ring-1 ring-primary/50"
                                : "border-white/15 bg-white/5 text-white/70 hover:border-primary/50 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            <Icon
                              className={`size-4 shrink-0 ${isSelected ? "text-primary" : "text-white/50 group-hover:text-primary"}`}
                            />
                            <span className="flex-1 leading-tight">{name}</span>
                            <span
                              className={`grid size-4 shrink-0 place-items-center rounded-full border ${
                                isSelected ? "border-primary bg-primary" : "border-white/25"
                              }`}
                            >
                              {isSelected && <Check className="size-3 text-white" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {(props.formError || stepError) && (
          <p className="rounded-xl border border-red-400/40 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-200">
            {props.formError || stepError}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold text-white/80 transition hover:bg-white/20 hover:text-white"
          >
            <ArrowLeft className="size-4" /> Back
          </button>
          {bStep < 4 ? (
            <Button
              type="button"
              onClick={handleNext}
              className="h-12 flex-1 rounded-xl bg-gradient-to-r from-primary to-amber-600 text-sm font-black text-white shadow-lg transition hover:from-orange-600 hover:to-amber-700"
            >
              <span className="flex items-center gap-2">
                Next <ArrowRight className="size-5" />
              </span>
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={props.submitting}
              className="h-12 flex-1 rounded-xl bg-gradient-to-r from-primary to-amber-600 text-sm font-black text-white shadow-lg transition hover:from-orange-600 hover:to-amber-700 disabled:opacity-60"
            >
              {props.submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-5 animate-spin" /> Creating your store...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Create my store <ArrowRight className="size-5" />
                </span>
              )}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

function SelectableCard({
  active,
  onClick,
  icon: Icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition sm:p-4 ${
        active
          ? "border-primary bg-primary/25 ring-1 ring-primary/50"
          : "border-white/15 bg-white/5 hover:border-primary/50 hover:bg-white/10"
      }`}
    >
      {active && (
        <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-primary">
          <Check className="size-3 text-white" />
        </span>
      )}
      <Icon className={`size-7 ${active ? "text-primary" : "text-white/60"}`} />
      <span className={`text-sm font-bold ${active ? "text-white" : "text-white/80"}`}>
        {title}
      </span>
      <span className="text-[11px] text-white/50">{subtitle}</span>
    </button>
  );
}
