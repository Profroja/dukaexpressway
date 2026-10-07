import { Package, Search, Store, Wrench } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ServicePrice } from "@/components/ServicePrice";

export type CatalogItem = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  subcategory?: string;
  store?: string;
  image_url?: string;
  price?: string | number;
  currency?: string;
  discount?: string | number | null;
  sale?: string;
  tag: "product" | "service";
};

const categoryRoutes: Record<string, number> = {
  electronics: 0,
  fashion: 1,
  "home & living": 2,
  "beauty & health": 3,
  groceries: 4,
  automotive: 5,
  "sports & outdoors": 6,
  "books & stationery": 7,
  services: 8,
};

function resultHref(item: CatalogItem) {
  if (item.tag === "service") return "/#services";
  const category = (item.category || "").toLowerCase();
  const index = categoryRoutes[category];
  return index === undefined ? "/#products" : `/category/${index}`;
}

export function SmartSearch({ placeholder, compact = false, onSelect }: { placeholder: string; compact?: boolean; onSelect?: (item: CatalogItem) => boolean | void }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 3) {
      setItems([]);
      setLoading(false);
      return;
    }

    const currentRequest = ++requestId.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      fetch("/api/catalog/")
        .then((response) => response.ok ? response.json() : null)
        .then((data) => {
          if (currentRequest !== requestId.current || !data) return;
          const products = Array.isArray(data.products)
            ? data.products.map((item: Omit<CatalogItem, "tag">) => ({ ...item, tag: "product" as const }))
            : [];
          const services = Array.isArray(data.services)
            ? data.services.map((item: Omit<CatalogItem, "tag">) => ({ ...item, tag: "service" as const }))
            : [];
          setItems([...products, ...services]);
        })
        .catch(() => {
          if (currentRequest === requestId.current) setItems([]);
        })
        .finally(() => {
          if (currentRequest === requestId.current) setLoading(false);
        });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 3) return [];
    return items.filter((item) => [
      item.title,
      item.description,
      item.category,
      item.subcategory,
      item.store,
      item.tag,
    ].some((value) => value?.toLowerCase().includes(term))).slice(0, 8);
  }, [items, query]);

  const showResults = open && query.trim().length >= 3;

  return (
    <div className="relative min-w-0">
      <form onSubmit={(event) => event.preventDefault()}>
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground ${compact ? "size-4" : "left-4 size-5"}`} />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          className={`${compact ? "h-10 pl-10" : "h-11 pl-12"} w-full rounded-full border border-border bg-muted/50 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20`}
          placeholder={placeholder}
          aria-label="Search products and services"
          autoComplete="off"
        />
      </form>

      {showResults && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[430px] overflow-y-auto rounded-2xl border border-border bg-white p-2 shadow-2xl">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
              <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Searching...
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              <div className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                {results.length} result{results.length === 1 ? "" : "s"}
              </div>
              {results.map((item) => (
                <a
                  key={`${item.tag}-${item.id}`}
                  href={resultHref(item)}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={(event) => {
                    if (!onSelect) return;
                    const handled = onSelect(item);
                    if (handled === false) return;
                    event.preventDefault();
                    setOpen(false);
                    setQuery("");
                  }}
                  className="group flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-orange-50"
                >
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted sm:size-20">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                    ) : item.tag === "service" ? (
                      <Wrench className="size-7 text-primary" />
                    ) : (
                      <Package className="size-7 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-extrabold text-navy group-hover:text-primary">{item.title}</p>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-black uppercase text-primary">{item.tag}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {item.store && <><Store className="mr-1 inline size-3" />{item.store} · </>}
                      {item.subcategory || item.category || item.description || "Duka Magic Expressway"}
                    </p>
                  </div>
                  {item.tag === "service" ? (
                    <ServicePrice
                      price={item.price}
                      currency={item.currency || "TZS"}
                      className="shrink-0 text-xs font-black text-primary"
                    />
                  ) : (
                    item.price != null && (
                      <p className="shrink-0 text-xs font-black text-primary">
                        {item.currency || "TZS"} {Number(item.price).toLocaleString()}
                      </p>
                    )
                  )}
                </a>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <Search className="mx-auto mb-2 size-7 text-muted-foreground/50" />
              <p className="text-sm font-bold text-navy">No matching products or services</p>
              <p className="mt-1 text-xs text-muted-foreground">Try another name, category, or store.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
