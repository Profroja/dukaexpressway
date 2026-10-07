import { Phone, Mail, MapPin, Facebook, Instagram, Twitter } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/lib/LanguageContext";

export function TopBar() {
  const { t } = useLanguage();

  return (
    <div className="bg-gradient-to-r from-navy via-slate-800 to-primary text-white">
      <div className="mx-auto max-w-[1500px] px-4 lg:px-7">
        <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs font-medium">
          {/* Left side - Contact info */}
          <div className="flex flex-wrap items-center gap-4">
            <a 
              href="tel:+255123456789" 
              className="flex items-center gap-1.5 transition hover:text-yellow-200"
              aria-label={t('callUs')}
            >
              <Phone className="size-3.5" />
              <span className="hidden sm:inline">+255 123 456 789</span>
            </a>
            <a 
              href="mailto:info@moexpressway.co.tz" 
              className="flex items-center gap-1.5 transition hover:text-yellow-200"
              aria-label={t('emailUs')}
            >
              <Mail className="size-3.5" />
              <span className="hidden md:inline">info@moexpressway.co.tz</span>
            </a>
            <div className="hidden items-center gap-1.5 lg:flex">
              <MapPin className="size-3.5" />
              <span>{t('darEsSalaam')}</span>
            </div>
          </div>

          {/* Right side - Social, Promo & Language */}
          <div className="flex items-center gap-4">
            <span className="hidden items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold backdrop-blur-sm sm:flex">
              <span className="animate-pulse">⚡</span>
              <span>{t('freeDelivery')}</span>
            </span>
            <LanguageSelector />
            <div className="flex items-center gap-2">
              <a 
                href="https://facebook.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="transition hover:scale-110 hover:text-yellow-200"
                aria-label="Facebook"
              >
                <Facebook className="size-4" />
              </a>
              <a 
                href="https://instagram.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="transition hover:scale-110 hover:text-yellow-200"
                aria-label="Instagram"
              >
                <Instagram className="size-4" />
              </a>
              <a 
                href="https://twitter.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="transition hover:scale-110 hover:text-yellow-200"
                aria-label="Twitter"
              >
                <Twitter className="size-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
