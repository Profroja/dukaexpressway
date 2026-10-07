import { createFileRoute } from "@tanstack/react-router";
import { Circle, ImagePlus, Package, Pencil, Plus, ToggleLeft, ToggleRight, Wrench, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/vendor/products")({
  component: VendorProducts,
});

type Product = {
  id: string;
  title: string;
  price: string;
  currency: string;
  available: boolean;
  image_url: string;
  category: string;
  subcategory: string;
  description: string;
  listing_type: "product" | "service";
  created_at: string | null;
};

type CategoryOpt = {
  id: string;
  name: string;
  parent: string | null;
  listing_type: "product" | "service";
};

type StoreKind = "product" | "service" | "both";

function formatPriceInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [intPart, decPart] = cleaned.split(".");
  const grouped = intPart ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "";
  if (decPart !== undefined) return `${grouped}.${decPart.slice(0, 2)}`;
  return grouped;
}

function VendorProducts() {
  const [listings, setListings] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryOpt[]>([]);
  const [storeKind, setStoreKind] = useState<StoreKind>("product");
  const subCategories = categories.filter((c) => c.parent);
  const categoryOptions = subCategories.length ? subCategories : categories;
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState("");
  const [form, setForm] = useState({ title: "", description: "", price: "", available: true, category: "" });
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Page-level wording follows the store; the add/edit form follows the chosen
  // category, because a store selling both has products and services.
  const isMixed = storeKind === "both";
  const isServiceStore = storeKind === "service";
  const noun = isMixed ? "item" : isServiceStore ? "service" : "product";
  const nounTitle = isMixed ? "Item" : isServiceStore ? "Service" : "Product";
  const nounPlural = isMixed ? "Products & Services" : isServiceStore ? "Services" : "Products";
  const ListingIcon = isServiceStore ? Wrench : Package;
  const selectedCategory = categories.find((c) => c.id === form.category);
  const isService = selectedCategory
    ? selectedCategory.listing_type === "service"
    : isServiceStore;
  const formNoun = isService ? "service" : "product";
  const formNounTitle = isService ? "Service" : "Product";

  const loadListings = () => {
    fetch("/api/vendor/products/", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.listings) setListings(data.listings);
        if (data?.categories) setCategories(data.categories);
        const kind = data?.store?.listing_type;
        if (kind === "service" || kind === "product" || kind === "both") setStoreKind(kind);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadListings();
  }, []);

  // Categories can load after the modal opens; default the select once they arrive.
  useEffect(() => {
    if (modalOpen && !form.category && categoryOptions.length > 0) {
      const first = categoryOptions[0];
      if (first) setForm((f) => (f.category ? f : { ...f, category: first.id }));
    }
  }, [modalOpen, form.category, categoryOptions]);

  const openModal = () => {
    setEditingId(null);
    setExistingImageUrl("");
    setForm({
      title: "",
      description: "",
      price: "",
      available: true,
      category: subCategories[0]?.id || categories[0]?.id || "",
    });
    setImage(null);
    setImagePreview(null);
    setModalOpen(true);
  };

  const findCategoryId = (product: Product) => {
    if (product.subcategory) {
      const sub = categories.find(
        (c) => c.name === product.subcategory && c.parent === product.category,
      );
      if (sub) return sub.id;
    }
    const main = categories.find((c) => c.name === product.category && !c.parent);
    return main?.id || categories[0]?.id || "";
  };

  const openEdit = (product: Product) => {
    setEditingId(product.id);
    setExistingImageUrl(product.image_url || "");
    setForm({
      title: product.title,
      description: product.description || "",
      price: product.listing_type === "service" && Number(product.price) === 0 ? "" : product.price,
      available: product.available,
      category: findCategoryId(product),
    });
    setImage(null);
    setImagePreview(null);
    setModalOpen(true);
  };

  const toggleAvailability = async (product: Product) => {
    try {
      const res = await fetch("/api/vendor/products/", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, available: !product.available }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        Swal.fire({
          icon: "error",
          title: `Could not update ${noun}`,
          text: data.error || "Something went wrong.",
        });
        return;
      }
      loadListings();
    } catch {
      Swal.fire({
        icon: "error",
        title: "Network error",
        text: "Could not reach the server. Try again.",
      });
    }
  };

  const handleImagePick = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      Swal.fire({ icon: "error", title: "Not an image", text: "Choose an image file." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      Swal.fire({ icon: "error", title: "Too large", text: "Image must be 5MB or smaller." });
      return;
    }
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    const title = form.title.trim();
    const hasPrice = form.price.trim().length > 0;
    const price = hasPrice ? Number(form.price.replace(/,/g, "")) : 0;

    if (!title) {
      Swal.fire({ icon: "error", title: "Missing name", text: `Enter a ${formNoun} name.` });
      return;
    }
    if ((!isService && !hasPrice) || (hasPrice && (Number.isNaN(price) || price <= 0))) {
      Swal.fire({ icon: "error", title: "Invalid price", text: `Enter a valid ${isService ? "service price or leave it blank" : "price per unit"}.` });
      return;
    }
    if (!editingId && !image) {
      Swal.fire({ icon: "error", title: "Missing image", text: `Add a ${formNoun} image.` });
      return;
    }
    if (!form.category) {
      Swal.fire({ icon: "error", title: "Missing category", text: "Choose a category." });
      return;
    }

    setSaving(true);
    try {
      const body = new FormData();
      if (editingId) body.append("id", editingId);
      body.append("title", title);
      body.append("description", form.description.trim());
      body.append("price", String(price));
      body.append("available", String(form.available));
      body.append("category_id", form.category);
      if (image) body.append("image", image);

      const res = await fetch("/api/vendor/products/", {
        method: "POST",
        credentials: "include",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Swal.fire({
          icon: "error",
          title: editingId ? `Could not update ${formNoun}` : `Could not add ${formNoun}`,
          text: data.error || "Something went wrong.",
        });
        return;
      }
      await Swal.fire({
        icon: "success",
        title: editingId ? `${formNounTitle} updated!` : `${formNounTitle} added!`,
        text: editingId ? `${title} has been updated.` : `${title} is now live in your store.`,
        confirmButtonColor: "#ea580c",
      });
      setModalOpen(false);
      setImage(null);
      setImagePreview(null);
      setEditingId(null);
      setExistingImageUrl("");
      loadListings();
    } catch {
      Swal.fire({
        icon: "error",
        title: "Network error",
        text: "Could not reach the server. Try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const perUnit = (p: Product) => p.listing_type === "service" && Number(p.price) === 0
    ? "Price on request"
    : `${p.currency} ${Number(p.price).toLocaleString()}`;

  return (
    <>
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{nounPlural}</h1>
        </div>
        <Button onClick={openModal}>
          <Plus className="size-4" /> Add {nounTitle}
        </Button>
      </div>

      {/* List / table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          Loading your {nounPlural.toLowerCase()}...
        </div>
      ) : listings.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-orange-600/20 flex items-center justify-center mb-4">
            <ListingIcon className="size-7 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">No {nounPlural.toLowerCase()} yet</h3>
          <p className="text-sm text-slate-500 mb-6">
            Add your first {noun} so customers can find {isService ? "and book" : "and order from"} you.
          </p>
          <Button onClick={openModal}>
            <Plus className="size-4" /> Add your first {noun}
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-200 bg-slate-50">
                  <th className="py-3 px-6">S/N</th>
                  <th className="py-3 pr-3">{nounTitle} Image</th>
                  <th className="py-3 pr-3">{nounTitle} Name</th>
                  {isMixed && <th className="py-3 pr-3">Type</th>}
                  {storeKind !== "product" && <th className="py-3 pr-3">Description</th>}
                  <th className="py-3 pr-3">Category</th>
                  <th className="py-3 pr-3">Sub Category</th>
                  <th className="py-3 pr-3">
                    {isMixed ? "Price" : isServiceStore ? "Service Price" : "Price per each"}
                  </th>
                  <th className="py-3 pr-3">Availability</th>
                  <th className="py-3 pr-3">Added</th>
                  <th className="py-3 pr-6">Action</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((product, i) => (
                  <tr key={product.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 px-6 text-slate-500 font-medium">{i + 1}</td>
                    <td className="py-3 pr-3">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.title}
                          className="w-14 h-14 rounded-lg object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary/20 to-orange-600/20 flex items-center justify-center">
                          {product.listing_type === "service" ? (
                            <Wrench className="size-5 text-primary" />
                          ) : (
                            <Package className="size-5 text-primary" />
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <span className="font-semibold text-slate-900">{product.title}</span>
                    </td>
                    {isMixed && (
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            product.listing_type === "service"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {product.listing_type === "service" ? (
                            <Wrench className="size-3" />
                          ) : (
                            <Package className="size-3" />
                          )}
                          {product.listing_type === "service" ? "Service" : "Product"}
                        </span>
                      </td>
                    )}
                    {storeKind !== "product" && (
                      <td className="max-w-56 py-3 pr-3">
                        <span className="line-clamp-2 text-slate-500">
                          {product.listing_type === "service" ? product.description || "—" : "—"}
                        </span>
                      </td>
                    )}
                    <td className="py-3 pr-3">
                      <span className="text-slate-600 font-medium">{product.category || "—"}</span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="text-slate-600">{product.subcategory || "—"}</span>
                    </td>
                    <td className="py-3 pr-3 font-bold text-slate-900">{perUnit(product)}</td>
                    <td className="py-3 pr-3">
                      {product.available ? (
                        <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          <Circle className="size-2 fill-current" /> Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          <Circle className="size-2 fill-current" /> Unavailable
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-6 text-slate-400">
                      {product.created_at
                        ? new Date(product.created_at).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="py-3 pr-6">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleAvailability(product)}
                          title={product.available ? "Make unavailable" : "Make available"}
                          className={`p-1.5 rounded-lg transition ${
                            product.available
                              ? "text-green-600 hover:bg-green-50"
                              : "text-slate-400 hover:bg-slate-100"
                          }`}
                        >
                          {product.available ? (
                            <ToggleRight className="size-6" />
                          ) : (
                            <ToggleLeft className="size-6" />
                          )}
                        </button>
                        <button
                          onClick={() => openEdit(product)}
                          title={`Edit ${noun}`}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition"
                        >
                          <Pencil className="size-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add listing modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-md min-w-0 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-6">
              <h3 className="text-lg font-bold text-slate-900">
                {editingId ? `Edit ${formNounTitle}` : `Add ${formNounTitle}`}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg"
              >
                <X className="size-5 text-slate-500" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  {formNounTitle} image
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImagePick(e.target.files?.[0])}
                />
                {imagePreview || (editingId && existingImageUrl) ? (
                  <div className="relative">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      title="Click to replace image"
                      className="w-full block cursor-pointer"
                    >
                      <img
                        src={imagePreview || existingImageUrl}
                        alt={`${formNounTitle} preview`}
                        className="w-full h-44 object-contain rounded-xl border border-slate-200 bg-slate-100"
                      />
                    </button>
                    <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                      {imagePreview && (
                        <button
                          onClick={() => {
                            setImage(null);
                            setImagePreview(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="p-1.5 bg-slate-900/70 text-white rounded-lg hover:bg-slate-900"
                          title="Remove new image"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 bg-slate-900/70 text-white rounded-lg hover:bg-slate-900"
                        title="Replace image"
                      >
                        <Pencil className="size-4" />
                      </button>
                    </div>
                    <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider bg-slate-900/70 text-white px-2 py-0.5 rounded-md">
                      {editingId ? `${formNounTitle} image` : "Preview"}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 text-slate-500 hover:border-primary hover:text-primary transition"
                  >
                    <ImagePlus className="size-7" />
                    <span className="text-sm font-semibold">
                      {editingId ? "Replace image" : "Choose an image"}
                    </span>
                    <span className="text-xs">JPG, PNG, WEBP or GIF · max 5MB</span>
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  {formNounTitle} name
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={isService ? "e.g., Home Cleaning" : "e.g., Wireless Keyboard"}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {isService && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Service description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe what the service includes, coverage, and any requirements"
                    rows={3}
                    className="w-full resize-none px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                >
                  <option value="" disabled>
                    {categories.length === 0 ? "Loading categories..." : "Select category"}
                  </option>
                  {isMixed
                    ? (["product", "service"] as const).map((type) => (
                        <optgroup key={type} label={type === "product" ? "Goods" : "Services"}>
                          {categoryOptions
                            .filter((c) => c.listing_type === type)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </optgroup>
                      ))
                    : categoryOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                </select>
                {isMixed && (
                  <p className="text-xs text-slate-400 mt-1">
                    Goods categories add a product; services categories add a service.
                  </p>
                )}
                {categories.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    Categories come from what you selected on registration.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  {isService ? "Starting price (optional)" : "Price per each"}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    TZS
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: formatPriceInput(e.target.value) })}
                    placeholder={isService ? "Leave blank for price on request" : "0.00"}
                    className="w-full pl-14 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                {isService && (
                  <p className="mt-1 text-xs text-slate-400">
                    Customers see this as "From TZS …" — your lowest price for this service. The
                    final price is agreed per job. Leave blank to show "Price on request".
                  </p>
                )}
              </div>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={form.available}
                  onChange={(e) => setForm({ ...form, available: e.target.checked })}
                  className="mt-1 size-4 accent-orange-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Available</span>
                  <span className="block text-xs text-slate-500">
                    {isService
                      ? "Turn this off when customers cannot currently book this service."
                      : "We don't track how many you have — just whether customers can order it."}
                  </span>
                </span>
              </label>
            </div>

            <div className="flex shrink-0 gap-3 border-t border-slate-100 px-4 py-4 sm:px-6">
              <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editingId ? "Save Changes" : `Add ${nounTitle}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
