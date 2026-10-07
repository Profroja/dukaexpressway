import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CircleUserRound,
  Package,
  Power,
  Search,
  Star,
  Store as StoreIcon,
  Wrench,
} from "lucide-react";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/stores")({
  component: AdminStoresPage,
});

type StoreListings = {
  id: string;
  title: string;
  listing_type: string;
  is_active: boolean;
};

type AdminStore = {
  id: string;
  name: string;
  slug: string;
  status: string;
  category: string;
  additional_categories: string[];
  rating_avg: string;
  rating_count: number;
  created_at: string | null;
  owner: { name: string; phone_number: string; email: string };
  listing_types: { products: number; services: number; total: number };
  listings: StoreListings[];
};

const STATUS_LABELS: Record<string, string> = {
  approved: "Active",
  pending: "Pending",
  suspended: "Suspended",
  rejected: "Rejected",
};

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  suspended: "bg-red-100 text-red-700",
  rejected: "bg-slate-200 text-slate-600",
};

const FILTERS = [
  { key: "all", label: "All Stores" },
  { key: "approved", label: "Active" },
  { key: "pending", label: "Pending" },
  { key: "suspended", label: "Suspended" },
  { key: "rejected", label: "Rejected" },
];

function AdminStoresPage() {
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadStores = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/stores/", { credentials: "include" });
      if (!response.ok) return;
      const data = await response.json();
      setStores(data.stores || []);
    } catch {
      setStores([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStores();
  }, []);

  const toggleStatus = async (store: AdminStore, activate: boolean) => {
    if (!activate) {
      const result = await Swal.fire({
        title: "Deactivate store?",
        text: `${store.name} will be suspended and its products/services will no longer appear on the public portal.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#dc2626",
        confirmButtonText: "Yes, deactivate",
        cancelButtonText: "Cancel",
      });
      if (!result.isConfirmed) return;
    }
    setBusyId(store.id);
    try {
      const response = await fetch(`/api/admin/stores/${store.id}/`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: activate ? "approved" : "suspended" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        Swal.fire({
          title: "Update failed",
          text: data.error || "Something went wrong.",
          icon: "error",
        });
        return;
      }
      setStores((prev) => prev.map((s) => (s.id === data.store.id ? data.store : s)));
      Swal.fire({
        title: activate ? "Store activated" : "Store deactivated",
        text: `"${data.store.name}" is now ${activate ? "live on the portal" : "hidden from the public portal"}.`,
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return stores.filter((s) => {
      if (filter !== "all" && s.status !== filter) return false;
      if (!term) return true;
      return (
        s.name.toLowerCase().includes(term) ||
        s.slug.toLowerCase().includes(term) ||
        s.category.toLowerCase().includes(term) ||
        s.owner.name.toLowerCase().includes(term) ||
        s.owner.phone_number.toLowerCase().includes(term) ||
        s.listings.some((l) => l.title.toLowerCase().includes(term))
      );
    });
  }, [stores, search, filter]);

  const counts = useMemo(
    () => ({
      total: stores.length,
      approved: stores.filter((s) => s.status === "approved").length,
      pending: stores.filter((s) => s.status === "pending").length,
      suspended: stores.filter((s) => s.status === "suspended").length,
    }),
    [stores],
  );

  const stats = [
    {
      label: "Total Stores",
      value: counts.total,
      icon: StoreIcon,
      iconStyle: "bg-blue-50 text-blue-600",
    },
    {
      label: "Active",
      value: counts.approved,
      icon: Star,
      iconStyle: "bg-green-50 text-green-600",
    },
    {
      label: "Pending",
      value: counts.pending,
      icon: StoreIcon,
      iconStyle: "bg-amber-50 text-amber-600",
    },
    {
      label: "Suspended",
      value: counts.suspended,
      icon: Power,
      iconStyle: "bg-red-50 text-red-600",
    },
  ];

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Stores</h1>
        <p className="mt-1 text-sm text-slate-500">
          See every store and what it provides. Deactivating a store hides all its products and
          services from the public portal.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-lg sm:p-6"
          >
            <div
              className={`mb-4 flex size-11 items-center justify-center rounded-lg ${stat.iconStyle}`}
            >
              <stat.icon className="size-6" />
            </div>
            <div className="text-xl font-black text-slate-900 sm:text-2xl">
              {loading ? "..." : stat.value}
            </div>
            <div className="mt-1 text-xs text-slate-500 sm:text-sm">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by store, category, owner, phone or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              onClick={() => setFilter(f.key)}
              className={filter === f.key ? "bg-gradient-to-r from-primary to-orange-600" : ""}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Stores Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Loading stores...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <StoreIcon className="mx-auto size-10 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-500">No stores found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="py-3 pr-3">S/N</th>
                  <th className="py-3 pr-3">Store</th>
                  <th className="py-3 pr-3">Owner</th>
                  <th className="py-3 pr-3">Category</th>
                  <th className="py-3 pr-3">What it provides</th>
                  <th className="py-3 pr-3">Status</th>
                  <th className="py-3 pr-3">Rating</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((store) => (
                  <tr
                    key={store.id}
                    className="border-b border-slate-100 last:border-0 align-top hover:bg-slate-50/50"
                  >
                    <td className="py-3 pr-3 text-slate-500">{filtered.indexOf(store) + 1}</td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-orange-600 text-white">
                          <StoreIcon className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{store.name}</p>
                          <p className="truncate text-xs text-slate-400">/{store.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <CircleUserRound className="size-4 shrink-0 text-slate-300" />
                        <div>
                          <p className="font-medium text-slate-800">{store.owner.name || "—"}</p>
                          <p className="text-xs text-slate-400">
                            {store.owner.phone_number}
                            {store.owner.email ? ` · ${store.owner.email}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="font-medium text-slate-700">{store.category || "—"}</span>
                      {store.additional_categories.length > 0 && (
                        <p className="mt-0.5 text-xs text-slate-400">
                          {store.additional_categories.join(", ")}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      {store.listings.length === 0 ? (
                        <span className="text-xs text-slate-400">Nothing yet</span>
                      ) : (
                        <div className="flex max-w-[300px] flex-wrap gap-1">
                          {store.listings.slice(0, 4).map((l) => (
                            <span
                              key={l.id}
                              title={`${l.title} (${l.listing_type === "service" ? "service" : "product"})`}
                              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                l.listing_type === "service"
                                  ? "bg-violet-50 text-violet-700"
                                  : "bg-sky-50 text-sky-700"
                              }`}
                            >
                              {l.listing_type === "service" ? (
                                <Wrench className="size-3" />
                              ) : (
                                <Package className="size-3" />
                              )}
                              <span className="max-w-[140px] truncate">{l.title}</span>
                            </span>
                          ))}
                          {store.listings.length > 4 && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                              +{store.listings.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge
                        className={`font-medium normal-case ${STATUS_STYLES[store.status] || "bg-slate-100 text-slate-700"}`}
                      >
                        {STATUS_LABELS[store.status] || store.status}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        <span className="font-semibold text-slate-700">
                          {Number(store.rating_avg || 0).toFixed(1)}
                        </span>
                        <span className="text-slate-400">({store.rating_count})</span>
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      {store.status === "suspended" ? (
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-gradient-to-r from-primary to-orange-600"
                          disabled={busyId === store.id}
                          onClick={() => toggleStatus(store, true)}
                        >
                          <Power className="size-4" />{" "}
                          <span className="hidden sm:inline">Activate</span>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-200 text-red-600 hover:bg-red-50"
                          disabled={busyId === store.id}
                          onClick={() => toggleStatus(store, false)}
                        >
                          <Power className="size-4" />{" "}
                          <span className="hidden sm:inline">Deactivate</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
