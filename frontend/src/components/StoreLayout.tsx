import {
  Bike, BookOpen, CircleUserRound,
  Heart, Home, Laptop,
  ShoppingCart, Sparkles, Wrench, Zap,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/TopBar";
import { AuthModal } from "@/components/AuthModal";
import { OrderModal } from "@/components/OrderModal";
import { CustomerOrders } from "@/components/CustomerOrders";
import { CustomerCart } from "@/components/CustomerCart";
import { SmartSearch, type CatalogItem } from "@/components/SmartSearch";
import { useLanguage } from "@/lib/LanguageContext";

export const categoryIcons = [
  [Laptop, "electric"], [Sparkles, "rose"], [Home, "green"],
  [Heart, "violet"], [ShoppingCart, "orange"], [Zap, "red"],
  [Bike, "teal"], [BookOpen, "indigo"], [Wrench, "slate"],
] as const;

export const categoryKeys = [
  "electronics", "fashion", "homeLiving", "beautyHealth", "groceries",
  "automotive", "sportsOutdoors", "booksStationery", "services"
] as const;

// Maps frontend category keys to actual database category names
export const categoryDbNames: Record<string, string> = {
  electronics: "Electronics",
  fashion: "Fashion",
  homeLiving: "Home & Living",
  beautyHealth: "Beauty & Health",
  groceries: "Groceries",
  automotive: "Automotive",
  sportsOutdoors: "Sports & Outdoors",
  booksStationery: "Books & Stationery",
  services: "Services",
};

export type ApiProduct = {
  id: string;
  image_url: string;
  title: string;
  subcategory?: string;
  category?: string;
  price: string | number;
  currency: string;
  discount?: string | number | null;
  sale?: string;
  store?: string;
  description?: string;
  listing_type?: "product" | "service";
};

export async function fetchProducts(): Promise<ApiProduct[]> {
  try {
    const res = await fetch("/api/catalog/");
    if (!res.ok) return [];
    const data = await res.json();
    const products = Array.isArray(data.products) ? data.products : [];
    const services = Array.isArray(data.services) ? data.services : [];
    return [...products, ...services];
  } catch {
    return [];
  }
}

export async function fetchProductsByCategory(categoryIndex: number): Promise<ApiProduct[]> {
  const all = await fetchProducts();
  const categoryKey = categoryKeys[categoryIndex];
  if (!categoryKey) return all;
  if (categoryKey === "services") return all.filter((p) => p.listing_type === "service");
  const dbName = categoryDbNames[categoryKey];
  if (!dbName) return all;
  return all.filter((p) => {
    const cat = (p.category || p.subcategory || "").trim();
    return cat === dbName;
  });
}

interface StoreLayoutProps {
  children: React.ReactNode;
  activeCategory?: number | undefined;
}

export function StoreLayout({ children, activeCategory }: StoreLayoutProps) {
  const { t } = useLanguage();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ApiProduct | null>(null);

  const handleSearchSelect = (item: CatalogItem) => {
    if (item.tag === "service") return false;
    setSelectedProduct(item as ApiProduct);
    setOrderModalOpen(true);
    return true;
  };

  const categories = categoryIcons.map(([Icon, color], i) => [Icon, t(categoryKeys[i] as any), color] as const);

  return (
    <>
      <TopBar />
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 shadow-nav backdrop-blur">
        {/* Desktop Layout */}
        <div className="mx-auto hidden h-20 max-w-[1500px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 lg:grid lg:gap-10 lg:px-7">
          <a href="/" className="flex shrink-0 items-center gap-2" aria-label="Duka Magic Expressway home">
            <span className="brand-mark">ME</span>
            <span className="hidden sm:block">
              <strong className="block text-2xl font-black leading-none text-navy">Duka Magic <em className="not-italic text-primary">Expressway</em></strong>
              <small className="text-[10px] font-bold text-muted-foreground">{t('goodsServices')}</small>
            </span>
          </a>
          <SmartSearch placeholder={t('searchPlaceholder')} onSelect={handleSearchSelect} />
          <div className="flex items-center gap-1 md:gap-3">
            <CustomerCart />
            <CustomerOrders />
            <Button className="h-11 rounded-full px-5 text-sm font-bold" onClick={() => setAuthModalOpen(true)}><CircleUserRound className="size-4" /> Login</Button>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="mx-auto max-w-[1500px] px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between mb-3">
            <a href="/" className="flex shrink-0 items-center gap-2" aria-label="Duka Magic Expressway home">
              <div>
                <strong className="block text-xl font-black leading-none text-navy">Duka Magic <em className="not-italic text-primary">Expressway</em></strong>
              </div>
            </a>
            <div className="flex items-center gap-2">
              <CustomerCart />
              <CustomerOrders />
              <Button size="sm" className="h-9 rounded-full px-3 text-xs font-bold" onClick={() => setAuthModalOpen(true)}><CircleUserRound className="size-4" /> Login</Button>
            </div>
          </div>
          <SmartSearch placeholder={t('searchPlaceholder')} compact onSelect={handleSearchSelect} />
        </div>
      </header>

      {/* Sidebar + Content */}
      <div className="mx-auto w-full max-w-[1500px] px-4 py-5 lg:px-7">
        <div className="min-w-0">
          {/* Category Bar */}
          <div id="categories" className="grid grid-cols-5 gap-2 rounded-lg border border-border bg-card p-3 shadow-card sm:grid-cols-9">
            {categories.map(([Icon, label, color], i) => (
              <a
                href={`/category/${i}`}
                key={label}
                className={`group flex min-w-0 flex-col items-center gap-2 rounded-md py-2 text-center transition ${activeCategory === i ? "ring-2 ring-primary rounded-md" : ""}`}
              >
                <span className={`category-icon category-${color} ${activeCategory === i ? "scale-110" : ""} transition-transform`}><Icon /></span>
                <span className="text-[10px] font-bold leading-tight text-navy group-hover:text-primary sm:text-xs">{label}</span>
              </a>
            ))}
          </div>
          {/* Page Content */}
          {children}
        </div>
      </div>

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      <OrderModal
        product={selectedProduct}
        open={orderModalOpen}
        onClose={() => setOrderModalOpen(false)}
      />
    </>
  );
}
