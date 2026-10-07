import { CheckCircle2, MapPin, Search, ShoppingBag, Star, Truck, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { useLanguage } from "@/lib/LanguageContext";

/**
 * Store links for the mobile apps. Leave a link empty until the app is
 * published - its button then shows a "Coming soon" tag instead of linking.
 */
const APP_LINKS = {
  googlePlay: "",
  appStore: "",
};

function GooglePlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
      <path fill="#34A853" d="M3.6 1.8 13.8 12 3.6 22.2c-.4-.2-.6-.7-.6-1.2V3c0-.5.2-1 .6-1.2Z" />
      <path fill="#FBBC04" d="m17.2 8.6-3.4 3.4 3.4 3.4 3.8-2.2c.9-.5.9-1.9 0-2.4l-3.8-2.2Z" />
      <path fill="#4285F4" d="M3.6 22.2 13.8 12l3.4 3.4L5.3 22.2c-.6.3-1.2.3-1.7 0Z" />
      <path fill="#EA4335" d="M3.6 1.8c.5-.3 1.1-.3 1.7 0l11.9 6.8-3.4 3.4L3.6 1.8Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.5-1-2.5-3.9ZM14 5.4c.7-.8 1.1-1.9 1-3-.9 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.5 2.8-1.3Z"
      />
    </svg>
  );
}

function StoreBadge({
  href,
  icon,
  pre,
  name,
  comingSoon,
}: {
  href: string;
  icon: ReactNode;
  pre: string;
  name: string;
  comingSoon: string;
}) {
  const body = (
    <>
      {icon}
      <span className="flex flex-col text-left leading-none">
        <span className="text-[10px] font-semibold tracking-wide text-white/75">{pre}</span>
        <span className="mt-1 text-lg font-bold tracking-tight">{name}</span>
      </span>
      {!href && (
        <span className="absolute -right-2 -top-2 rounded-full bg-amber-300 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-900 shadow">
          {comingSoon}
        </span>
      )}
    </>
  );
  const className =
    "relative inline-flex h-14 min-w-[180px] items-center gap-3 rounded-xl bg-slate-950 px-4 text-white shadow-lg ring-1 ring-white/10 transition duration-300";
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} hover:-translate-y-0.5 hover:bg-black hover:shadow-xl`}
    >
      {body}
    </a>
  ) : (
    <span className={`${className} cursor-default opacity-95`} aria-disabled="true">
      {body}
    </span>
  );
}

/** Decorative phone showing a preview of the shopping app. */
function PhoneMockup() {
  const cards = [
    { tone: "from-orange-100 to-amber-50", icon: ShoppingBag, w: "w-3/4" },
    { tone: "from-sky-100 to-blue-50", icon: Wrench, w: "w-2/3" },
    { tone: "from-emerald-100 to-teal-50", icon: ShoppingBag, w: "w-4/5" },
    { tone: "from-rose-100 to-pink-50", icon: Wrench, w: "w-1/2" },
  ];
  return (
    <div aria-hidden="true" className="relative mx-auto w-[240px] sm:w-[260px]">
      <div className="absolute -inset-6 rounded-[3rem] bg-white/20 blur-2xl" />
      <div className="relative rounded-[2.6rem] bg-slate-950 p-2.5 shadow-2xl ring-1 ring-black/20">
        <div className="relative overflow-hidden rounded-[2.1rem] bg-slate-50">
          {/* notch */}
          <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-slate-950" />
          {/* app header */}
          <div className="bg-gradient-to-br from-primary to-orange-600 px-4 pb-4 pt-9 text-white">
            <div className="flex items-center gap-2">
              <BrandLogo className="size-7 rounded-lg ring-2 ring-white/40" />
              <span className="text-xs font-black">Duka Magic</span>
              <MapPin className="ml-auto size-3.5 opacity-80" />
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[10px] text-slate-400">
              <Search className="size-3" /> Search products & services
            </div>
          </div>
          {/* product grid */}
          <div className="grid grid-cols-2 gap-2 p-3">
            {cards.map((card, i) => (
              <div key={i} className="rounded-xl bg-white p-1.5 shadow-sm">
                <div
                  className={`flex aspect-square items-center justify-center rounded-lg bg-gradient-to-br ${card.tone}`}
                >
                  <card.icon className="size-6 text-slate-400/70" />
                </div>
                <div className={`mt-1.5 h-1.5 ${card.w} rounded-full bg-slate-200`} />
                <div className="mt-1 flex items-center justify-between">
                  <div className="h-1.5 w-8 rounded-full bg-primary/70" />
                  <Star className="size-2.5 fill-amber-400 text-amber-400" />
                </div>
              </div>
            ))}
          </div>
          {/* delivery toast */}
          <div className="mx-3 mb-4 flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-white shadow-lg">
            <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500">
              <Truck className="size-3.5" />
            </span>
            <div className="leading-tight">
              <div className="text-[9px] font-black">On the way</div>
              <div className="text-[8px] text-white/60">Arriving today</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Home page section inviting shoppers to download the mobile app. */
export function AppDownloadSection() {
  const { t } = useLanguage();
  const features = [t("appFeature1"), t("appFeature2"), t("appFeature3")];

  return (
    <section
      id="app"
      aria-labelledby="app-title"
      className="relative mt-10 overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-orange-500 to-amber-500 px-4 py-10 text-white shadow-xl sm:px-8 lg:px-12 lg:py-14"
    >
      {/* Decorative shapes */}
      <div className="pointer-events-none absolute -left-20 -top-20 size-72 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 right-1/3 size-80 rounded-full bg-orange-700/30 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.12)_1px,transparent_0)] [background-size:22px_22px]" />

      <div className="relative mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-[1.2fr_1fr]">
        {/* Copy */}
        <div className="text-center md:text-left">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ring-1 ring-white/25">
            <span className="size-1.5 rounded-full bg-white" /> {t("appEyebrow")}
          </p>
          <h2 id="app-title" className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
            {t("appTitle")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/85 sm:text-base">
            {t("appSubtitle")}
          </p>

          <ul className="mt-6 space-y-2.5 text-left md:max-w-sm">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-2.5 text-sm font-semibold">
                <CheckCircle2 className="size-5 shrink-0 text-white" />
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
            <StoreBadge
              href={APP_LINKS.googlePlay}
              icon={<GooglePlayIcon />}
              pre={t("appGooglePre")}
              name="Google Play"
              comingSoon={t("appComingSoon")}
            />
            <StoreBadge
              href={APP_LINKS.appStore}
              icon={<AppleIcon />}
              pre={t("appApplePre")}
              name="App Store"
              comingSoon={t("appComingSoon")}
            />
          </div>
        </div>

        {/* Phone */}
        <div className="md:justify-self-end">
          <PhoneMockup />
        </div>
      </div>
    </section>
  );
}
