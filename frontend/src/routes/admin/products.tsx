import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Package, Search, Store as StoreIcon, Wrench } from "lucide-react";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/products")({
  component: AdminProductsPage,
});

type AdminProduct = {
  id: string;
  title: string;
  description: string;
  listing_type: string;
  price: string;
  currency: string;
  is_active: boolean;
  image_url: string;
  category: string;
  subcategory: string;
  store: string;
  store_id: string;
  store_status: string;
  unit: string;
  created_at: string | null;
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "product", label: "Products" },
  { key: "service", label: "Services" },
  { key: "active", label: "Active" },
  { key: "hidden", label: "Hidden" },
];

function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/products/", { credentials: "include" });
      if (!response.ok) return;
      const data = await response.json();
      setProducts(data.products || []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const toggleActive = async (product: AdminProduct, next: boolean) => {
    setBusyId(product.id);
    try {
      const response = await fetch(`/api/admin/products/${product.id}/`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: next }),
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
      setProducts((prev) => prev.map((p) => (p.id === data.product.id ? data.product : p)));
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if (filter === "product" && p.listing_type !== "product") return false;
      if (filter === "service" && p.listing_type !== "service") return false;
      if (filter === "active" && !p.is_active) return false;
      if (filter === "hidden" && p.is_active) return false;
      if (!term) return true;
      return (
        p.title.toLowerCase().includes(term) ||
        p.store.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        p.subcategory.toLowerCase().includes(term)
      );
    });
  }, [products, search, filter]);

  const counts = useMemo(
    () => ({
      total: products.length,
      products: products.filter((p) => p.listing_type === "product").length,
      services: products.filter((p) => p.listing_type === "service").length,
      hidden: products.filter((p) => !p.is_active).length,
    }),
    [products],
  );

  const stats = [
    {
      label: "Total Listings",
      value: counts.total,
      icon: Package,
      iconStyle: "bg-blue-50 text-blue-600",
    },
    {
      label: "Products",
      value: counts.products,
      icon: Package,
      iconStyle: "bg-sky-50 text-sky-600",
    },
    {
      label: "Services",
      value: counts.services,
      icon: Wrench,
      iconStyle: "bg-violet-50 text-violet-600",
    },
    {
      label: "Hidden",
      value: counts.hidden,
      icon: EyeOff,
      iconStyle: "bg-slate-100 text-slate-600",
    },
  ];

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Products &amp; Services</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every product and service listed across all stores. Hide any listing to remove it from the
          public portal.
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
            placeholder="Search by name, store or category..."
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

      {/* Products Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Loading products...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="mx-auto size-10 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-500">No products found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="py-3 pr-3">S/N</th>
                  <th className="py-3 pr-3">Product</th>
                  <th className="py-3 pr-3">Store</th>
                  <th className="py-3 pr-3">Category</th>
                  <th className="py-3 pr-3">Type</th>
                  <th className="py-3 pr-3">Price</th>
                  <th className="py-3 pr-3">Status</th>
                  <th className="py-3 pr-3">Added</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product, index) => (
                  <tr
                    key={product.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                  >        
                  <td className="py-3 pr-3 text-slate-500">{filtered.indexOf(product) + 1}</td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package className="size-4 text-slate-300" />
                          )}
                        </div>
                        <span className="max-w-[200px] truncate font-semibold text-slate-900">
                          {product.title}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <StoreIcon className="size-4 shrink-0 text-slate-300" />
                        <div>
                          <p className="max-w-[150px] truncate font-medium text-slate-700">
                            {product.store}
                          </p>
                          {product.store_status === "suspended" && (
                            <span className="text-[11px] font-medium text-red-500">
                              Store suspended
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="font-medium text-slate-700">{product.category || "—"}</span>
                      {product.subcategory && (
                        <p className="text-xs text-slate-400">{product.subcategory}</p>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge
                        className={`font-medium normal-case ${
                          product.listing_type === "service"
                            ? "bg-violet-100 text-violet-700"
                            : "bg-sky-100 text-sky-700"
                        }`}
                      >
                        {product.listing_type === "service" ? "Service" : "Product"}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 font-bold text-slate-900">
                      {product.currency} {Number(product.price).toLocaleString()}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge
                        className={`font-medium normal-case ${
                          product.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {product.is_active ? "Active" : "Hidden"}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 text-xs text-slate-500">
                      {product.created_at
                        ? new Date(product.created_at).toLocaleDateString([], {
                            dateStyle: "medium",
                          })
                        : "—"}
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        variant={product.is_active ? "outline" : "default"}
                        size="sm"
                        className={
                          product.is_active
                            ? "border-red-200 text-red-600 hover:bg-red-50"
                            : "bg-gradient-to-r from-primary to-orange-600"
                        }
                        disabled={busyId === product.id}
                        onClick={() => toggleActive(product, !product.is_active)}
                      >
                        {product.is_active ? (
                          <>
                            <EyeOff className="size-4" />{" "}
                            <span className="hidden sm:inline">Hide</span>
                          </>
                        ) : (
                          <>
                            <Eye className="size-4" />{" "}
                            <span className="hidden sm:inline">Show</span>
                          </>
                        )}
                      </Button>
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
