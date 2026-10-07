import { ArrowRight, CheckCircle2, LogIn, Store } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useLanguage } from "@/lib/LanguageContext";

/**
 * Home page section for vendors and staff: vendor sign-up ("Jiunge Nasi")
 * and the login entry point. Kept off the header so shoppers see the store first.
 */
export function PartnersSection() {
  const { t } = useLanguage();
  const perks = [t("joinUsPerk1"), t("joinUsPerk2"), t("joinUsPerk3")];

  return (
    <section
      id="partners"
      aria-labelledby="partners-title"
      className="relative mt-10 overflow-hidden rounded-2xl bg-gradient-to-br from-navy via-slate-900 to-slate-950 px-4 py-10 text-white shadow-xl sm:px-8 lg:px-12 lg:py-14"
    >
      {/* Decorative glows */}
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 size-72 rounded-full bg-orange-500/15 blur-3xl" />

      <div className="relative">
        {/* Heading */}
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 flex justify-center">
            <BrandLogo className="size-14 rounded-2xl ring-4 ring-white/10" />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
            {t("partnersEyebrow")}
          </p>
          <h2 id="partners-title" className="mt-2 text-2xl font-black leading-tight sm:text-3xl">
            {t("partnersTitle")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-base">
            {t("partnersSubtitle")}
          </p>
        </div>

        {/* Cards */}
        <div className="mx-auto mt-8 grid max-w-5xl gap-4 md:grid-cols-[1.35fr_1fr] md:gap-5">
          {/* Jiunge Nasi */}
          <a
            href="/register"
            className="group relative flex flex-col overflow-hidden rounded-2xl bg-white p-6 text-navy shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-2xl sm:p-7"
          >
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-orange-400 to-amber-400" />
            <div className="flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-orange-600 text-white shadow-md transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
                <Store className="size-7" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xl font-black sm:text-2xl">{t("joinUsTitle")}</h3>
                <p className="mt-1 text-sm text-slate-500">{t("joinUsDesc")}</p>
              </div>
            </div>

            <ul className="mt-5 space-y-2.5">
              {perks.map((perk) => (
                <li
                  key={perk}
                  className="flex items-center gap-2.5 text-sm font-semibold text-slate-700"
                >
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
                  {perk}
                </li>
              ))}
            </ul>

            <span className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-600 px-6 text-sm font-black text-white shadow-lg shadow-primary/25 transition group-hover:shadow-xl group-hover:shadow-primary/30 sm:self-start">
              {t("joinUsCta")}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </a>

          {/* Login */}
          <a
            href="/login"
            className="group flex flex-col justify-between rounded-2xl border border-white/15 bg-white/[0.06] p-6 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-white/30 hover:bg-white/10 sm:p-7"
          >
            <div>
              <div className="flex size-14 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/15 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
                <LogIn className="size-7" />
              </div>
              <h3 className="mt-4 text-xl font-black sm:text-2xl">{t("loginCardTitle")}</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/65">{t("loginCardDesc")}</p>
            </div>

            <span className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-white/80 px-6 text-sm font-black text-white transition group-hover:bg-white group-hover:text-navy">
              <LogIn className="size-4" />
              {t("loginCardCta")}
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
