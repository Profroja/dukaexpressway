import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogIn, Store, ArrowRight, Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
    const timer = setTimeout(() => setMounted(false), 300);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center px-4 transition-all duration-300 ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-navy/70 backdrop-blur-md transition-all duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative z-10 w-full max-w-lg transition-all duration-500 ${
          open ? "scale-100 translate-y-0 opacity-100" : "scale-95 translate-y-8 opacity-0"
        }`}
      >
        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl">
          {/* Header - Gradient Banner */}
          <div className="relative overflow-hidden bg-gradient-to-br from-navy via-slate-800 to-primary px-8 py-8 text-center">
            {/* Animated background circles */}
            <div className="absolute -left-10 -top-10 size-40 animate-pulse rounded-full bg-primary/20 blur-2xl" />
            <div className="absolute -right-10 top-10 size-32 animate-pulse rounded-full bg-amber-500/20 blur-2xl" style={{ animationDelay: "0.5s" }} />
            <div className="absolute bottom-0 left-1/2 size-24 animate-pulse rounded-full bg-orange-400/20 blur-xl" style={{ animationDelay: "1s" }} />

            {/* Logo */}
            <div className="relative z-10 mb-3 flex items-center justify-center gap-2">
              <span className="brand-mark text-white">ME</span>
              <strong className="text-2xl font-black text-white">
                Duka Magic <em className="not-italic text-primary">Expressway</em>
              </strong>
            </div>

            {/* Heading */}
            <h2 className="relative z-10 text-xl font-black text-white">
              {t('goodsServices')}
            </h2>
            <p className="relative z-10 mt-1 text-sm text-white/70">
              Choose how you want to join us
            </p>

          </div>

          {/* Body - Two Options */}
          <div className="grid gap-4 p-8">
            {/* Option 1: Login */}
            <button
              onClick={() => {
                onClose();
                navigate({ to: "/login" });
              }}
              className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-50 p-5 text-left transition-all duration-300 hover:border-primary hover:bg-orange-50 hover:shadow-lg"
            >
              {/* Icon */}
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-navy to-slate-700 text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                <LogIn className="size-6" />
              </div>

              {/* Text */}
              <div className="flex-1">
                <h3 className="text-lg font-black text-navy transition group-hover:text-primary">
                  Login
                </h3>
                <p className="text-sm text-slate-500">
                  Sign in to your account and continue shopping
                </p>
              </div>

              {/* Arrow */}
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm transition-all duration-300 group-hover:bg-primary group-hover:text-white group-hover:translate-x-1">
                <ArrowRight className="size-5" />
              </div>

              {/* Shine effect */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </button>

            {/* Option 2: Become a Vendor (Jiunge Nasi) */}
            <button
              onClick={() => {
                onClose();
                navigate({ to: "/register" });
              }}
              className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-orange-50 to-amber-50 p-5 text-left transition-all duration-300 hover:border-primary hover:shadow-xl hover:shadow-primary/20"
            >
              {/* Icon */}
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-600 text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                <Store className="size-6" />
              </div>

              {/* Text */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-navy transition group-hover:text-primary">
                    Jiunge Nasi
                  </h3>
                  <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    <Sparkles className="size-3" /> Vendor
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  Become a seller and grow your business with us
                </p>
              </div>

              {/* Arrow */}
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm transition-all duration-300 group-hover:bg-primary group-hover:text-white group-hover:translate-x-1">
                <ArrowRight className="size-5" />
              </div>

              {/* Shine effect */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </button>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 bg-slate-50 px-8 py-4 text-center">
            <p className="text-xs text-slate-400">
              By continuing, you agree to Duka Magic Expressway's{" "}
              <span className="font-semibold text-slate-500">Terms of Service</span> &{" "}
              <span className="font-semibold text-slate-500">Privacy Policy</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
