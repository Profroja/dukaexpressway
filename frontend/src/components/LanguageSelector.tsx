import { useState, useRef, useEffect } from "react";
import { Globe, Check } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import type { Language } from "@/lib/i18n";

export function LanguageSelector() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const languages: { code: Language; label: string; flag: string }[] = [
    { code: "en", label: "English", flag: "🇬🇧" },
    { code: "sw", label: "Kiswahili", flag: "🇹🇿" },
  ];

  const current = languages.find((l) => l.code === lang);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-sm transition hover:bg-white/30"
        aria-label="Select language"
      >
        <Globe className="size-3.5" />
        <span className="hidden sm:inline">{current?.flag} {current?.label}</span>
        <span className="sm:hidden">{current?.flag}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-lg border border-white/20 bg-slate-900/95 shadow-xl backdrop-blur-xl">
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium transition ${
                lang === l.code
                  ? "bg-primary/20 text-primary"
                  : "text-white/90 hover:bg-white/10"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-base">{l.flag}</span>
                {l.label}
              </span>
              {lang === l.code && <Check className="size-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
