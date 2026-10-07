export type CustomerOrderStatus =
  "new" | "contacted" | "confirmed" | "sourcing" | "picked_up" | "delivered" | "cancelled";

/** Orders still moving through the pipeline (not delivered or cancelled). */
export function isActiveCustomerOrder(status: CustomerOrderStatus) {
  return status !== "delivered" && status !== "cancelled";
}

export type CustomerOrder = {
  id: string;
  listingId: string;
  title: string;
  imageUrl: string;
  store: string;
  quantity: number;
  total: number;
  currency: string;
  phone: string;
  status: CustomerOrderStatus;
  createdAt: string;
};

const STORAGE_KEY = "magic-expressway-customer-orders";
export const CUSTOMER_ORDERS_EVENT = "magic-expressway-orders-changed";

export function getCustomerOrders(): CustomerOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function saveCustomerOrder(order: CustomerOrder) {
  const orders = getCustomerOrders();
  const next = [order, ...orders.filter((item) => item.id !== order.id)].slice(0, 50);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(CUSTOMER_ORDERS_EVENT));
}

export function updateCustomerOrderStatus(id: string, status: CustomerOrderStatus) {
  const orders = getCustomerOrders();
  const next = orders.map((order) => (order.id === id ? { ...order, status } : order));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(CUSTOMER_ORDERS_EVENT));
}
