import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Bike, BookOpen, ChevronLeft, ChevronRight, CircleUserRound, Flame,
  Heart, Home, Laptop, Store,
  ShoppingCart, Sparkles, Wrench, Zap,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";
import { AuthModal } from "@/components/AuthModal";
import { OrderModal } from "@/components/OrderModal";
import { ServicePrice } from "@/components/ServicePrice";
import { CustomerOrders } from "@/components/CustomerOrders";
import { CustomerCart } from "@/components/CustomerCart";
import { SmartSearch, type CatalogItem } from "@/components/SmartSearch";
import { addToCart } from "@/lib/customerCart";
import { useLanguage } from "@/lib/LanguageContext";
import heroImage from "@/assets/market-hero.jpg";
import homeHeroImage from "@/assets/market-hero-home.jpg";
import fashionHeroImage from "@/assets/market-hero-fashion.jpg";
import serviceHeroImage from "@/assets/service-hero.png";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Duka Magic Expressway | Products & Services at Your Fingertips" },
    { name: "description", content: "Shop quality products and book trusted services with fast delivery across Tanzania." },
    { property: "og:title", content: "Duka Magic Expressway | Everything in One Place" },
    { property: "og:description", content: "Shop quality products and book trusted services with fast delivery across Tanzania." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: Storefront,
});

const categoryIcons = [
  [Laptop, "electric"], [Sparkles, "rose"], [Home, "green"],
  [Heart, "violet"], [ShoppingCart, "orange"], [Zap, "red"],
  [Bike, "teal"], [BookOpen, "indigo"], [Wrench, "slate"],
] as const;

const categoryKeys = [
  "electronics", "fashion", "homeLiving", "beautyHealth", "groceries",
  "automotive", "sportsOutdoors", "booksStationery", "services"
] as const;

const bannerConfigs = [
  { image: heroImage, kickerKey: "oneStopMarketplace", titleKey: "moExpressway", accentKey: "goodsServicesTagline", badgeKey: "bestDealsToday" },
  { image: homeHeroImage, kickerKey: "refreshYourSpace", titleKey: "homeMeets", accentKey: "smartLiving", badgeKey: "upTo30Off" },
  { image: fashionHeroImage, kickerKey: "styleForEveryone", titleKey: "freshLooks", accentKey: "youllLove", badgeKey: "newArrivals" },
  { image: serviceHeroImage, kickerKey: "professionalServices", titleKey: "expertHelp", accentKey: "whenYouNeedIt", badgeKey: "bookNow" },
] as const;

type ApiProduct = {
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
  listing_type?: "product" | "service";
};

type ApiService = {
  id: string;
  title: string;
  description?: string;
  image_url: string;
  store?: string;
  category?: string;
  subcategory?: string;
  price: string | number;
  currency: string;
  discount?: string | number | null;
  sale?: string;
  listing_type?: "product" | "service";
};

function Storefront() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ApiProduct | null>(null);
  const [banner, setBanner] = useState(0);
  const [bannerPaused, setBannerPaused] = useState(false);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [services, setServices] = useState<ApiService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/catalog/")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          if (Array.isArray(data.products)) setProducts(data.products);
          if (Array.isArray(data.services)) setServices(data.services);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSearchSelect = (item: CatalogItem) => {
    if (item.tag === "service") return false;
    setSelectedProduct(item as ApiProduct);
    setOrderModalOpen(true);
    return true;
  };

  const categories = categoryIcons.map(([Icon, color], i) => [Icon, t(categoryKeys[i] as any), color] as const);

  const banners = bannerConfigs.map((b) => ({
    image: b.image,
    kicker: t(b.kickerKey as any),
    title: t(b.titleKey as any),
    accent: t(b.accentKey as any),
    badge: t(b.badgeKey as any),
  }));

  useEffect(() => {
    if (bannerPaused) return;
    const timer = window.setInterval(() => setBanner((current) => (current + 1) % banners.length), 5000);
    return () => window.clearInterval(timer);
  }, [bannerPaused]);

  return <div className="min-h-screen bg-background text-foreground">
    <TopBar />
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 shadow-nav backdrop-blur">
      {/* Desktop Layout */}
      <div className="mx-auto hidden h-20 max-w-[1500px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 lg:grid lg:gap-10 lg:px-7">
        <a href="#" className="flex shrink-0 items-center gap-2" aria-label="Magic Expressway home">
          <span className="brand-mark">ME</span><span className="hidden sm:block"><strong className="block text-2xl font-black leading-none text-navy">Duka Magic <em className="not-italic text-primary">Expressway</em></strong><small className="text-[10px] font-bold text-muted-foreground">{t('goodsServices')}</small></span>
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
        {/* Top Row: Logo + Icons */}
        <div className="flex items-center justify-between mb-3">
<a href="#" className="flex shrink-0 items-center gap-2" aria-label="Duka Magic Expressway home">
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
        
        {/* Bottom Row: Search Bar */}
        <SmartSearch placeholder={t('searchPlaceholder')} compact onSelect={handleSearchSelect} />
      </div>
    </header>

    <main className="mx-auto max-w-[1500px] px-4 py-5 lg:px-7">
      <section>
        <div className="-mx-4 lg:mx-0">
          <div className="hero relative min-h-[360px] overflow-hidden md:min-h-[370px] lg:rounded-lg lg:border lg:border-border" onMouseEnter={() => setBannerPaused(true)} onMouseLeave={() => setBannerPaused(false)}>
            {banners.map((item, index) => <img key={item.title} src={item.image} width={1600} height={800} alt={item.title} className={`absolute inset-0 h-full w-full object-cover object-center transition-all duration-700 ${index === banner ? "scale-100 opacity-100" : "scale-105 opacity-0"}`} />)}
            <div className="absolute inset-0 bg-hero-fade" />
            {banners[banner] && (
              <>
                <div key={banner} className="relative z-10 flex min-h-[360px] max-w-xl animate-banner-in flex-col justify-center px-7 py-12 sm:px-14 md:min-h-[370px]">
                  <span className="mb-3 w-fit rounded-full bg-primary px-3 py-1 text-xs font-extrabold uppercase text-primary-foreground shadow-md sm:bg-primary/10 sm:text-primary">{banners[banner].kicker}</span>
                  <h1 className="text-4xl font-black leading-[1.08] text-white drop-shadow-lg sm:text-navy sm:drop-shadow-none">{banners[banner].title} <span className="block text-primary drop-shadow-lg sm:drop-shadow-none">{banners[banner].accent}</span></h1>
                  <Button className="mt-7 w-fit rounded-full px-7" onClick={() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" })}>{t('shopNow')} <ChevronRight /></Button>
                </div>
                <span className="absolute right-6 top-6 grid size-20 rotate-6 place-items-center rounded-full bg-primary px-2 text-center text-sm font-black leading-tight text-primary-foreground shadow-card animate-float">{banners[banner].badge}</span>
              </>
            )}
            <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">{banners.map((item, index) => <button key={item.title} type="button" onClick={() => setBanner(index)} className={`h-2.5 rounded-full transition-all ${index === banner ? "w-8 bg-primary" : "w-2.5 bg-navy/25 hover:bg-navy/50"}`} aria-label={`Show banner ${index + 1}`} />)}</div>
          </div>
          <div id="categories" className="mt-4 grid grid-cols-5 gap-2 rounded-lg border border-border bg-card p-3 shadow-card sm:grid-cols-9">{categories.map(([Icon,label,color], i) => <a href={`/category/${i}`} key={label} className="group flex min-w-0 flex-col items-center gap-2 rounded-md py-2 text-center"><span className={`category-icon category-${color}`}><Icon /></span><span className="text-[10px] font-bold leading-tight text-navy group-hover:text-primary sm:text-xs">{label}</span></a>)}</div>
        </div>
      </section>

      <section id="products" className="py-8">
        <SectionHead icon={<Flame />} title={t('popularProducts')} />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {loading ? (
            <div className="col-span-full py-20 text-center text-sm text-muted-foreground">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="col-span-full py-20 text-center text-sm text-muted-foreground">No products available yet.</div>
          ) : (
            products.slice(0, 10).map((p) => (
              <article key={p.id} className="group overflow-hidden rounded-md border border-border bg-card p-3 shadow-card transition hover:-translate-y-1 hover:shadow-card-hover">
                <div className="relative aspect-square overflow-hidden rounded-sm bg-muted">
                  <img src={p.image_url} width={816} height={816} loading="lazy" alt={p.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  {p.sale && <span className="absolute left-2 top-2 rounded-full bg-sale px-2 py-1 text-[10px] font-black text-sale-foreground">{p.sale}</span>}
                </div>
                {p.store && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1">
                    <Store className="size-3 text-primary" />
                    <span className="truncate text-[10px] font-bold text-navy">{p.store}</span>
                  </div>
                )}
                <h3 className="mt-2 truncate text-sm font-extrabold text-navy">{p.title}</h3>
                <p className="mt-1 truncate text-[10px] font-medium text-muted-foreground">{p.subcategory || p.category || ""}</p>
                <p className="mt-2 text-base font-black text-primary">{p.currency} {Number(p.price).toLocaleString()}</p>
                {p.discount && <p className="text-[11px] text-muted-foreground line-through">{p.currency} {Number(p.discount).toLocaleString()}</p>}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="h-9 min-w-0 px-1 text-[10px] sm:text-xs"
                    onClick={() => {
                      setSelectedProduct(p);
                      setOrderModalOpen(true);
                    }}
                  >
                    <Zap className="size-3.5" /> {t('orderNow')}
                  </Button>
                  <Button className="h-9 min-w-0 px-1 text-[10px] sm:text-xs" onClick={() => addToCart(p)}>
                    <ShoppingCart className="size-3.5" /> {t('addToCart')}
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section id="services" className="rounded-lg bg-services px-4 py-6 sm:px-6">
        <SectionHead icon={<Wrench />} title={t('ourServices')} />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {loading ? (
            <div className="col-span-full py-20 text-center text-sm text-muted-foreground">Loading services...</div>
          ) : services.length === 0 ? (
            <div className="col-span-full py-20 text-center text-sm text-muted-foreground">No services available yet.</div>
          ) : (
            services.slice(0, 10).map((s) => (
              <article key={s.id} className="group overflow-hidden rounded-md border border-border bg-card shadow-card transition hover:-translate-y-1 hover:shadow-card-hover">
                <div className="aspect-square overflow-hidden bg-muted">
                  <img src={s.image_url} alt={`${s.title} professional`} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                </div>
                <div className="p-3">
                  {s.store && (
                    <div className="mb-2 flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1">
                      <Store className="size-3 text-primary" />
                      <span className="truncate text-[10px] font-bold text-navy">{s.store}</span>
                    </div>
                  )}
                  <h3 className="truncate text-sm font-extrabold text-navy">{s.title}</h3>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{s.description || ""}</p>
                  <ServicePrice price={s.price} currency={s.currency} />
                  <Button
                    className="mt-4 h-9 w-full px-2 text-xs"
                    type="button"
                    onClick={() => {
                      setSelectedProduct(s as ApiProduct);
                      setOrderModalOpen(true);
                    }}
                  ><Wrench className="size-4" /> {t('bookNow')}</Button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
    <Footer />
    <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    <OrderModal
      product={selectedProduct}
      open={orderModalOpen}
      onClose={() => setOrderModalOpen(false)}
    />
  </div>;
}

function AutoCarousel({ children, label, className = "mt-4" }: { children: ReactNode; label: string; className?: string }) {
  const rail = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const move = (direction: number) => {
    const node = rail.current;
    if (!node) return;
    const amount = Math.max(node.clientWidth * 0.82, 280);
    const atEnd = node.scrollLeft + node.clientWidth >= node.scrollWidth - 10;
    if (direction > 0 && atEnd) node.scrollTo({ left: 0, behavior: "smooth" });
    else node.scrollBy({ left: direction * amount, behavior: "smooth" });
  };
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => move(1), 4200);
    return () => window.clearInterval(timer);
  });
  return <div className={`relative ${className}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
    <div ref={rail} className="carousel-rail flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3" aria-label={`${label} carousel`}>{children}</div>
    <Button variant="icon" className="absolute -left-2 top-1/2 z-10 size-9 -translate-y-1/2 bg-card shadow-card" onClick={() => move(-1)} aria-label={`Previous ${label}`}><ChevronLeft /></Button>
    <Button variant="icon" className="absolute -right-2 top-1/2 z-10 size-9 -translate-y-1/2 bg-card shadow-card" onClick={() => move(1)} aria-label={`Next ${label}`}><ChevronRight /></Button>
  </div>;
}

function SectionHead({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return <div className="flex min-w-0 items-center gap-3"><span className="text-primary [&_svg]:size-7">{icon}</span><div className="min-w-0"><h2 className="truncate text-xl font-black text-navy">{title}</h2>{subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}</div></div>;
}