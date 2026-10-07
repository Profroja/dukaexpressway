export type CartProduct = {
  id: string;
  title: string;
  image_url: string;
  price: string | number;
  currency: string;
  store?: string;
};

export type CartItem = CartProduct & { quantity: number };

const STORAGE_KEY = "magic-expressway-cart";
export const CART_EVENT = "magic-expressway-cart-changed";

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function save(items: CartItem[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(CART_EVENT));
}

export function addToCart(product: CartProduct, quantity = 1) {
  const items = getCart();
  const current = items.find((item) => item.id === product.id);
  if (current) current.quantity += quantity;
  else items.push({ ...product, quantity });
  save(items);
}

export function setCartQuantity(id: string, quantity: number) {
  if (quantity < 1) return removeFromCart(id);
  save(getCart().map((item) => item.id === id ? { ...item, quantity } : item));
}

export function removeFromCart(id: string) {
  save(getCart().filter((item) => item.id !== id));
}

export function getCartCount(items = getCart()) {
  return items.reduce((total, item) => total + item.quantity, 0);
}
