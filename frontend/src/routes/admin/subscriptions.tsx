import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Coins,
  Crown,
  Receipt,
  Pencil,
  Plus,
  ReceiptIndianRupee,
  Search,
  Store as StoreIcon,
  UserRound,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MonthPicker } from "@/components/MonthPicker";

export const Route = createFileRoute("/admin/subscriptions")({
  component: AdminSubscriptionsPage,
});

type RevenueRow = {
  store_id: string;
  store: string;
  owner: string;
  listings: number;
  amount: string;
  status: "not_billed" | "unpaid" | "paid";
  invoice_id: string;
  paid_at: string | null;
  plan: "free" | "monthly";
  plan_label: string;
  monthly_fee: string;
};

type RevenueData = {
  month: string;
  summary: {
    expected: string;
    paid: string;
    pending: string;
    stores: number;
    not_billed: number;
    free_stores: number;
    monthly_stores: number;
  };
  stores: RevenueRow[];
};

const STATUS_BADGE = {
  not_billed: "bg-slate-100 text-slate-600",
  unpaid: "bg-red-100 text-red-700",
  paid: "bg-emerald-100 text-emerald-700",
} as const;

const STATUS_LABEL = {
  not_billed: "Not billed",
  unpaid: "Unpaid",
  paid: "Paid",
} as const;

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function AdminSubscriptionsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [assignMonth, setAssignMonth] = useState(currentMonth());
  const [assignData, setAssignData] = useState<RevenueData | null>(null);
  const [assignLoading, setAssignLoading] = useState(true);

  const [assigning, setAssigning] = useState<RevenueRow | null>(null);
  const [modalMonth, setModalMonth] = useState(currentMonth());
  const [modalAmount, setModalAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const [planStore, setPlanStore] = useState<RevenueRow | null>(null);
  const [planChoice, setPlanChoice] = useState<"free" | "monthly">("free");
  const [planFee, setPlanFee] = useState("");
  const [billingAll, setBillingAll] = useState(false);

  const fetchMonth = async (m: string): Promise<RevenueData | null> => {
    try {
      const response = await fetch(`/api/admin/revenue/?month=${encodeURIComponent(m)}`, {
        credentials: "include",
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        Swal.fire({
          icon: "error",
          title: "Failed to load subscriptions",
          text: json?.error || "Please try again.",
          confirmButtonColor: "#ea580c",
        });
        return null;
      }
      return json;
    } catch {
      Swal.fire({
        icon: "error",
        title: "Network error",
        text: "Could not reach the server.",
        confirmButtonColor: "#ea580c",
      });
      return null;
    }
  };

  const loadMonth = async (m: string) => {
    setLoading(true);
    setData(await fetchMonth(m));
    setLoading(false);
  };

  const loadAssignMonth = async (m: string) => {
    setAssignLoading(true);
    setAssignData(await fetchMonth(m));
    setAssignLoading(false);
  };

  const reloadAll = async () => {
    await Promise.all([loadMonth(month), loadAssignMonth(assignMonth)]);
  };

  useEffect(() => {
    loadMonth(month);
  }, [month]);

  useEffect(() => {
    loadAssignMonth(assignMonth);
  }, [assignMonth]);

  const assignFiltered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return assignData?.stores ?? [];
    return (assignData?.stores ?? []).filter(
      (row) => row.store.toLowerCase().includes(term) || row.owner.toLowerCase().includes(term),
    );
  }, [assignData, search]);

  const paidFiltered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = (data?.stores ?? []).filter(
      (row) => row.status === "paid" || row.status === "unpaid",
    );
    if (!term) return rows;
    return rows.filter(
      (row) => row.store.toLowerCase().includes(term) || row.owner.toLowerCase().includes(term),
    );
  }, [data, search]);

  const openAssignModal = (row: RevenueRow) => {
    setAssigning(row);
    setModalMonth(assignMonth);
    setModalAmount(row.amount || "");
  };

  const saveAssignment = async () => {
    if (!assigning) return;
    const amount = modalAmount.trim();
    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      Swal.fire({
        icon: "error",
        title: "Invalid amount",
        text: "Enter a valid fee amount greater than zero.",
        confirmButtonColor: "#ea580c",
      });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/revenue/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: modalMonth,
          entries: [{ store_id: assigning.store_id, amount }],
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        Swal.fire({
          icon: "error",
          title: "Save failed",
          text: json.error || "Please try again.",
          confirmButtonColor: "#ea580c",
        });
        return;
      }
      setAssigning(null);
      await reloadAll();
      Swal.fire({
        icon: "success",
        title: "Fee assigned",
        text: `${assigning.store} will be billed TZS ${Number(amount).toLocaleString()} for ${monthLabel(modalMonth)}.`,
        confirmButtonColor: "#ea580c",
        timer: 2200,
        showConfirmButton: false,
      });
    } catch {
      Swal.fire({
        icon: "error",
        title: "Network error",
        text: "Could not reach the server.",
        confirmButtonColor: "#ea580c",
      });
    } finally {
      setSaving(false);
    }
  };

  const openPlanModal = (row: RevenueRow) => {
    setPlanStore(row);
    setPlanChoice(row.plan);
    setPlanFee(row.monthly_fee || row.amount || "");
  };

  const savePlan = async () => {
    if (!planStore) return;
    if (planChoice === "monthly" && !(Number(planFee) > 0)) {
      Swal.fire({
        icon: "error",
        title: "Invalid fee",
        text: "Enter a monthly fee greater than zero.",
        confirmButtonColor: "#ea580c",
      });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/revenue/stores/${planStore.store_id}/plan/`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planChoice, monthly_fee: planFee }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        Swal.fire({
          icon: "error",
          title: "Save failed",
          text: json.error || "Please try again.",
          confirmButtonColor: "#ea580c",
        });
        return;
      }
      setPlanStore(null);
      await reloadAll();
      Swal.fire({
        icon: "success",
        title: "Plan updated",
        text:
          planChoice === "free"
            ? `${planStore.store} is now on the Free plan.`
            : `${planStore.store} is now on the Monthly plan (TZS ${Number(planFee).toLocaleString()} / month).`,
        timer: 2200,
        showConfirmButton: false,
      });
    } catch {
      Swal.fire({
        icon: "error",
        title: "Network error",
        text: "Could not reach the server.",
        confirmButtonColor: "#ea580c",
      });
    } finally {
      setSaving(false);
    }
  };

  const unbilledMonthly = (assignData?.stores ?? []).filter(
    (row) => row.plan === "monthly" && row.status === "not_billed" && Number(row.monthly_fee) > 0,
  );

  const billAllMonthly = async () => {
    if (unbilledMonthly.length === 0) return;
    const confirm = await Swal.fire({
      title: `Bill ${unbilledMonthly.length} store${unbilledMonthly.length > 1 ? "s" : ""}?`,
      text: `Create ${monthLabel(assignMonth)} invoices for every Monthly-plan store not yet billed, using each store's monthly fee.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Bill them",
      confirmButtonColor: "#ea580c",
      cancelButtonColor: "#64748b",
    });
    if (!confirm.isConfirmed) return;
    setBillingAll(true);
    try {
      const response = await fetch("/api/admin/revenue/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: assignMonth,
          entries: unbilledMonthly.map((row) => ({
            store_id: row.store_id,
            amount: row.monthly_fee,
          })),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        Swal.fire({
          icon: "error",
          title: "Billing failed",
          text: json.error || "Please try again.",
          confirmButtonColor: "#ea580c",
        });
        return;
      }
      await reloadAll();
    } finally {
      setBillingAll(false);
    }
  };

  const setInvoiceStatus = async (row: RevenueRow, status: "paid" | "unpaid") => {
    if (!row.invoice_id) return;
    setUpdating(row.store_id);
    try {
      const response = await fetch(`/api/admin/revenue/invoices/${row.invoice_id}/`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        Swal.fire({
          icon: "error",
          title: "Update failed",
          text: json.error || "Please try again.",
          confirmButtonColor: "#ea580c",
        });
        return;
      }
      await reloadAll();
    } catch {
      Swal.fire({
        icon: "error",
        title: "Network error",
        text: "Could not reach the server.",
        confirmButtonColor: "#ea580c",
      });
    } finally {
      setUpdating(null);
    }
  };

  const summary = data?.summary ?? {
    expected: "0",
    paid: "0",
    pending: "0",
    stores: 0,
    not_billed: 0,
  };

  const stats = [
    {
      label: `Expected · ${monthLabel(month)}`,
      value: summary.expected,
      icon: CircleDollarSign,
      iconBg: "bg-slate-100 text-slate-600",
    },
    {
      label: "Paid",
      value: summary.paid,
      icon: Coins,
      iconBg: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Pending",
      value: summary.pending,
      icon: Clock3,
      iconBg: "bg-red-50 text-red-600",
    },
    {
      label: "Billed stores",
      value: String(summary.stores - summary.not_billed),
      icon: ReceiptIndianRupee,
      iconBg: "bg-sky-50 text-sky-600",
    },
  ];

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Monthly Subscriptions</h1>
          <p className="mt-1 text-sm text-slate-500">
            Stores are on a Free or Monthly subscription plan. Monthly stores are billed a flat fee
            each month; while a Monthly store's invoice is unpaid, its products are hidden from the
            public portal.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MonthPicker value={month} onChange={setMonth} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-lg sm:p-6"
          >
            <div
              className={`mb-4 flex size-11 items-center justify-center rounded-lg ${stat.iconBg}`}
            >
              <stat.icon className="size-6" />
            </div>
            <div className="text-xl font-black text-slate-900 sm:text-2xl">
              TZS {Number(stat.value).toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-slate-500 sm:text-sm">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mt-6 mb-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by store or owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table 1: Assign monthly subscription fee (per-row modal + month filter) */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 sm:px-6">
          <div>
            <h2 className="text-base font-black text-slate-900">Subscription Plans & Fees</h2>
            <p className="text-xs text-slate-500">
              Set each store's plan: <b>Free</b> (never billed) or <b>Monthly</b> (billed its fee
              every month). Vendors see their plan on their dashboard.
              {assignData && (
                <>
                  {" "}
                  {assignData.summary.free_stores} free · {assignData.summary.monthly_stores}{" "}
                  monthly.
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={billingAll || unbilledMonthly.length === 0}
              onClick={billAllMonthly}
              className="h-9 gap-1.5 bg-gradient-to-r from-primary to-orange-600 text-xs font-bold text-white"
              title="Create this month's invoices for Monthly-plan stores not yet billed"
            >
              <Receipt className="size-3.5" />
              {billingAll ? "Billing..." : `Bill monthly stores (${unbilledMonthly.length})`}
            </Button>
            <MonthPicker value={assignMonth} onChange={setAssignMonth} />
          </div>
        </div>
        {assignLoading ? (
          <div className="py-16 text-center text-sm text-slate-500">Loading stores...</div>
        ) : assignFiltered.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">No stores found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="py-3 pr-3">Store</th>
                  <th className="py-3 pr-3">Owner</th>
                  <th className="py-3 pr-3">Listings</th>
                  <th className="py-3 pr-3">Plan</th>
                  <th className="py-3 pr-3">Fee · {monthLabel(assignMonth)}</th>
                  <th className="py-3 pr-3">Status</th>
                  <th className="py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {assignFiltered.map((row) => (
                  <tr
                    key={row.store_id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100">
                          <StoreIcon className="size-4 text-slate-400" />
                        </div>
                        <span className="font-semibold text-slate-900">{row.store}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <UserRound className="size-4 text-slate-400" />
                        <span>{row.owner || "—"}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-3 font-bold text-slate-700">{row.listings}</td>
                    <td className="py-3 pr-3">
                      <Badge
                        className={`font-medium normal-case ${
                          row.plan === "free"
                            ? "bg-sky-100 text-sky-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {row.plan_label}
                      </Badge>
                      {row.plan === "monthly" && row.monthly_fee && (
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          TZS {Number(row.monthly_fee).toLocaleString()} / month
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-3 font-bold text-slate-900">
                      {row.plan === "free" && row.status === "not_billed"
                        ? "—"
                        : row.amount
                          ? `TZS ${Number(row.amount).toLocaleString()}`
                          : "—"}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge
                        className={`font-medium normal-case ${
                          row.plan === "free" && row.status === "not_billed"
                            ? "bg-sky-50 text-sky-600"
                            : STATUS_BADGE[row.status]
                        }`}
                      >
                        {row.plan === "free" && row.status === "not_billed"
                          ? "No fee"
                          : STATUS_LABEL[row.status]}
                      </Badge>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPlanModal(row)}
                          className="h-8 gap-1.5 text-xs font-bold"
                        >
                          <Crown className="size-3.5" /> Set Plan
                        </Button>
                        {row.plan === "monthly" && (
                          <Button
                            size="sm"
                            onClick={() => openAssignModal(row)}
                            className={`h-8 gap-1.5 text-xs font-bold ${
                              row.status === "not_billed"
                                ? "bg-gradient-to-r from-primary to-orange-600 text-white"
                                : ""
                            }`}
                            variant={row.status === "not_billed" ? "default" : "outline"}
                          >
                            {row.status === "not_billed" ? (
                              <Plus className="size-3.5" />
                            ) : (
                              <Pencil className="size-3.5" />
                            )}
                            {row.status === "not_billed" ? "Assign Fee" : "Edit Fee"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Table 2: Payment status for the month */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 sm:px-6">
          <h2 className="text-base font-black text-slate-900">
            Payment Status · {monthLabel(month)}
          </h2>
          <p className="text-xs text-slate-500">
            Billed stores for this month. Mark each invoice as paid or not paid. Unpaid stores are
            hidden from the public portal.
          </p>
        </div>
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Loading invoices...</div>
        ) : paidFiltered.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            No invoices for this month yet. Assign fees in the table above first.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="py-3 pr-3">Store</th>
                  <th className="py-3 pr-3">Owner</th>
                  <th className="py-3 pr-3">Amount (TZS)</th>
                  <th className="py-3 pr-3">Paid / Not Paid</th>
                  <th className="py-3 pr-3">Paid at</th>
                  <th className="py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {paidFiltered.map((row) => (
                  <tr
                    key={row.store_id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100">
                          {row.status === "paid" ? (
                            <CheckCircle2 className="size-4 text-emerald-500" />
                          ) : (
                            <Clock3 className="size-4 text-red-400" />
                          )}
                        </div>
                        <span className="font-semibold text-slate-900">{row.store}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <UserRound className="size-4 text-slate-400" />
                        <span>{row.owner || "—"}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-3 font-bold text-slate-900">
                      {Number(row.amount).toLocaleString()}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge className={`font-medium normal-case ${STATUS_BADGE[row.status]}`}>
                        {STATUS_LABEL[row.status]}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 text-xs text-slate-500">
                      {row.paid_at
                        ? new Date(row.paid_at).toLocaleDateString([], {
                            dateStyle: "medium",
                          })
                        : "—"}
                    </td>
                    <td className="py-3 text-right">
                      {row.status === "paid" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updating === row.store_id}
                          onClick={() => setInvoiceStatus(row, "unpaid")}
                          className="h-8 text-xs font-bold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        >
                          Mark Not Paid
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updating === row.store_id || !row.invoice_id}
                          onClick={() => setInvoiceStatus(row, "paid")}
                          className="h-8 gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-xs font-bold text-white"
                        >
                          <CheckCircle2 className="size-3.5" />
                          Mark Paid
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

      {/* Set Plan Modal */}
      {planStore && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-navy/55 backdrop-blur-sm"
            onClick={() => setPlanStore(null)}
            aria-label="Close"
          />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Subscription Plan</h3>
                <p className="text-xs text-slate-500">{planStore.store}</p>
              </div>
              <button
                type="button"
                onClick={() => setPlanStore(null)}
                className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { key: "free", title: "Free", desc: "No monthly fee. Never billed." },
                    { key: "monthly", title: "Monthly", desc: "Billed a fixed fee every month." },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setPlanChoice(option.key)}
                    className={`rounded-xl border p-4 text-left transition ${
                      planChoice === option.key
                        ? "border-primary bg-orange-50 ring-2 ring-primary/20"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <p className="font-black text-slate-900">{option.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{option.desc}</p>
                  </button>
                ))}
              </div>

              {planChoice === "monthly" && (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Monthly fee (TZS)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={planFee}
                    onChange={(e) => setPlanFee(e.target.value)}
                    placeholder="e.g. 20000"
                    className="w-full font-bold"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Used when you bill this store each month. Unpaid monthly stores are hidden from
                    the public portal.
                  </p>
                </div>
              )}
              {planChoice === "free" && planStore.plan === "monthly" && (
                <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">
                  The store's products become visible right away, even if an earlier invoice is
                  unpaid. Existing invoices are kept for your records.
                </p>
              )}
            </div>

            <div className="flex gap-3 border-t border-slate-100 px-5 py-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPlanStore(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-primary to-orange-600 text-white"
                onClick={savePlan}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Plan"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Fee Modal */}
      {assigning && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-navy/55 backdrop-blur-sm"
            onClick={() => setAssigning(null)}
            aria-label="Close"
          />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Assign Fee</h3>
                <p className="text-xs text-slate-500">{assigning.store}</p>
              </div>
              <button
                type="button"
                onClick={() => setAssigning(null)}
                className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Month & year
                </label>
                <MonthPicker
                  value={modalMonth}
                  onChange={setModalMonth}
                  className="w-full"
                  contentClassName="z-[10000]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Subscription fee (TZS)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={modalAmount}
                  onChange={(e) => setModalAmount(e.target.value)}
                  placeholder="e.g. 20000"
                  className="w-full font-bold"
                />
                <p className="mt-1 text-xs text-slate-400">
                  The store will be billed this amount for{" "}
                  {monthLabel(modalMonth || currentMonth())}.
                </p>
              </div>
            </div>

            <div className="flex gap-3 border-t border-slate-100 px-5 py-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setAssigning(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-primary to-orange-600 text-white"
                onClick={saveAssignment}
                disabled={saving}
              >
                {saving ? "Saving..." : "Set Fee"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
