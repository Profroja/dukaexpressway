import { useLanguage } from "@/lib/LanguageContext";

/**
 * Public price for a service. A service's listed price is only where it
 * starts - the final price depends on the job - so it reads "From TZS 10,000",
 * or "Price on request" when the provider gave no price.
 */
export function ServicePrice({
  price,
  currency = "TZS",
  className = "mt-2 text-base font-black text-primary",
}: {
  price: string | number | null | undefined;
  currency?: string;
  className?: string;
}) {
  const { t } = useLanguage();
  const amount = Number(price);
  if (!(amount > 0)) {
    return <p className={className}>{t("priceOnRequest")}</p>;
  }
  return (
    <p className={className}>
      <span className="text-[0.7em] font-bold opacity-80">{t("priceFrom")} </span>
      {currency} {amount.toLocaleString()}
    </p>
  );
}
