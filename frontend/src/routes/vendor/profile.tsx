import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  LayoutDashboard,
  Mail,
  MapPin,
  Phone,
  Star,
  Store,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/vendor/profile")({
  component: VendorProfile,
});

type ProfileData = {
  name: string;
  role: string;
  profile: {
    first_name: string;
    last_name: string;
    phone_number: string;
    email: string;
    email_verified: boolean;
    member_since: string | null;
  };
  store: {
    name: string;
    slug: string;
    description: string;
    category: string;
    additional_categories: string[];
    region: string;
    latitude: string | null;
    longitude: string | null;
    logo_url: string;
    banner_url: string;
    status: string;
    rating_avg: string;
    rating_count: number;
    created_at: string | null;
  } | null;
};

function VendorProfile() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/profile/", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (alive) setData(json);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const initials = (data?.name || "V")
    .split(" ")
    .slice(0, 2)
    .map((s) => s.charAt(0))
    .join("")
    .toUpperCase();

  const memberSince = data?.profile?.member_since
    ? new Date(data.profile.member_since).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : "—";

  const storeCreated = data?.store?.created_at
    ? new Date(data.store.created_at).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : "—";

  const statusStyles: Record<string, string> = {
    approved: "bg-green-100 text-green-700",
    pending: "bg-orange-100 text-orange-700",
    suspended: "bg-red-100 text-red-700",
    rejected: "bg-red-100 text-red-700",
  };

  return (
    <>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
          <p className="text-sm font-medium">Loading your profile...</p>
        </div>
      ) : !data ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-slate-500">Could not load your profile. Please log in again.</p>
          <a
            href="/login"
            className="inline-block mt-4 text-sm font-semibold text-primary hover:underline"
          >
            Go to login
          </a>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-6">
            <a
              href="/vendor"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition"
            >
              <ArrowLeft className="size-4" />
              Back to dashboard
            </a>
          </div>

          {/* Identity Header */}
          <div className="bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 rounded-2xl p-6 text-white mb-6 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center text-xl font-black">
              {initials}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-black">{data.name}</h1>
              <p className="text-white/90 text-sm capitalize">{data.role.replace("_", " ")}</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-white/90">
              {data.profile?.email_verified && (
                <span className="inline-flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
                  <BadgeCheck className="size-4" /> Email verified
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Account details */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <User className="size-5 text-primary" /> Account
              </h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <User className="size-4 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-slate-400 uppercase tracking-wide">Full name</div>
                    <div className="text-sm font-semibold text-slate-900 truncate">{data.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Mail className="size-4 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-slate-400 uppercase tracking-wide">Email</div>
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {data.profile?.email || "—"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Phone className="size-4 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-slate-400 uppercase tracking-wide">Phone</div>
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {data.profile?.phone_number || "—"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Calendar className="size-4 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-slate-400 uppercase tracking-wide">
                      Member since
                    </div>
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {memberSince}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Store details */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Store className="size-5 text-primary" /> Store
              </h2>
              {data.store ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-slate-400 uppercase tracking-wide">
                        Store name
                      </div>
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {data.store.name}
                      </div>
                      <div className="text-xs text-slate-400 truncate">@{data.store.slug}</div>
                    </div>
                    <span
                      className={`shrink-0 text-xs px-2 py-0.5 rounded-full capitalize ${
                        statusStyles[data.store.status] || "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {data.store.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <BadgeCheck className="size-4 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-slate-400 uppercase tracking-wide">Category</div>
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {data.store.category}
                        {data.store.additional_categories?.length
                          ? ` · ${data.store.additional_categories.join(", ")}`
                          : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <MapPin className="size-4 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-slate-400 uppercase tracking-wide">Location</div>
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {data.store.region ||
                          (data.store.latitude && data.store.longitude
                            ? `${data.store.latitude}, ${data.store.longitude}`
                            : "Not set yet")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Star className="size-4 text-amber-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-slate-400 uppercase tracking-wide">Rating</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {data.store.rating_avg} / 5 · {data.store.rating_count} reviews
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Calendar className="size-4 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-slate-400 uppercase tracking-wide">
                        Store opened
                      </div>
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {storeCreated}
                      </div>
                    </div>
                  </div>
                  {data.store.description && (
                    <p className="text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
                      {data.store.description}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No store linked to this account yet.</p>
              )}
            </div>
          </div>

          <a
            href="/vendor"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            <LayoutDashboard className="size-4" />
            Back to dashboard
          </a>
        </>
      )}
    </>
  );
}
