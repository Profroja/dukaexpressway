import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { 
  Mail, Lock, Eye, EyeOff, ArrowRight,
  Store
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/LanguageContext";
import { BrandLogo } from "@/components/BrandLogo";
import heroImage from "@/assets/market-hero.jpg";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [
    { title: "Login | Duka Magic Expressway" },
    { name: "description", content: "Login to your Duka Magic Expressway account" },
  ]}),
  component: LoginPage,
});

function LoginPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { default: Swal } = await import("sweetalert2");

    try {
      const res = await fetch("/api/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      let data: {
        authenticated?: boolean;
        error?: string;
        is_superuser?: boolean;
        is_staff?: boolean;
        role?: string;
        redirect?: string;
      } | null = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !data || !data.authenticated) {
        setLoading(false);
        Swal.fire({
          position: "center",
          icon: "error",
          title: "Login failed",
          text: data?.error || "Invalid email or password.",
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true,
          background: "#ffffff",
          color: "#0f172a",
        });
        return;
      }

      setLoading(false);
      const target =
        data.redirect ||
        (data.is_superuser || data.is_staff
          ? "/admin"
          : data.role === "vendor_owner"
            ? "/vendor"
            : "/");

      Swal.fire({
        position: "center",
        icon: "success",
        title: "Welcome back!",
        text: "Login successful. Redirecting...",
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        background: "#ffffff",
        color: "#0f172a",
      }).then(() => {
        navigate({ to: target });
      });
    } catch {
      setLoading(false);
      Swal.fire({
        position: "center",
        icon: "error",
        title: "Connection error",
        text: "Unable to reach the server. Please make sure the backend is running.",
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        background: "#ffffff",
        color: "#0f172a",
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

      {/* Main Content */}
      <div className="relative z-10 flex min-h-screen items-start justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex items-center gap-2">
              <BrandLogo className="size-14 rounded-2xl ring-2 ring-white/20" />
              <div>
                <strong className="block text-3xl font-black leading-none text-white">
                  Duka Magic <em className="not-italic text-primary">Expressway</em>
                </strong>
                <small className="text-xs font-bold text-white/70">{t('goodsServices')}</small>
              </div>
            </div>
          </div>

          {/* Login Card */}
          <div className="rounded-2xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-black text-white">Welcome Back!</h1>
              <p className="mt-1 text-sm text-white/70">Sign in to your account to continue</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="mb-2 block text-sm font-bold text-white/90">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-white/50" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-12 w-full rounded-xl border border-white/20 bg-white/10 pl-12 pr-4 text-sm text-white placeholder:text-white/40 outline-none backdrop-blur-sm transition focus:border-primary focus:bg-white/20 focus:ring-2 focus:ring-primary/30"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="mb-2 block text-sm font-bold text-white/90">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-white/50" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-12 w-full rounded-xl border border-white/20 bg-white/10 pl-12 pr-12 text-sm text-white placeholder:text-white/40 outline-none backdrop-blur-sm transition focus:border-primary focus:bg-white/20 focus:ring-2 focus:ring-primary/30"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 transition hover:text-white"
                  >
                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>

              {/* Remember & Forgot */}
              <div className="flex items-center justify-between text-sm">
                <label className="flex cursor-pointer items-center gap-2 text-white/70">
                  <input type="checkbox" className="size-4 rounded border-white/30 bg-white/10 accent-primary" />
                  Remember me
                </label>
                <a href="#" className="font-semibold text-primary transition hover:text-orange-400">
                  Forgot password?
                </a>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-primary to-amber-600 text-sm font-black text-white shadow-lg transition hover:from-orange-600 hover:to-amber-700 disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Sign In <ArrowRight className="size-5" />
                  </span>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/20"></div>
              <span className="text-xs font-semibold text-white/50">OR</span>
              <div className="h-px flex-1 bg-white/20"></div>
            </div>

            {/* Vendor CTA */}
            <div className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-xl">
              <Store className="size-5 text-primary" />
              <span className="text-sm text-white/80">Are you a vendor?</span>
              <a href="/register" className="font-bold text-primary transition hover:text-orange-400">
                Apply here →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
