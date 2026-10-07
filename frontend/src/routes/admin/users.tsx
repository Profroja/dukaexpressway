import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Sparkles,
  Pencil,
  Power,
  Search,
  ShieldCheck,
  Store,
  UserRound,
  Users as UsersIcon,
} from "lucide-react";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

type AdminUser = {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  phone_number: string;
  email: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  email_verified: boolean;
  is_superuser: boolean;
  is_staff: boolean;
  created_at: string | null;
  store: { name: string; status: string; category: string } | null;
};

type UserCounts = {
  total: number;
  active: number;
  inactive: number;
  vendors: number;
  admins: number;
};

const ROLE_LABELS: Record<string, string> = {
  customer: "Customer",
  vendor_owner: "Vendor Owner",
  admin: "Administrator",
  delivery_agent: "Delivery Agent",
};

const ROLE_STYLES: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  vendor_owner: "bg-blue-100 text-blue-700",
  customer: "bg-emerald-100 text-emerald-700",
  delivery_agent: "bg-amber-100 text-amber-700",
};

const STORE_STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  suspended: "bg-red-100 text-red-700",
  rejected: "bg-slate-200 text-slate-600",
};

const FILTERS = [
  { key: "all", label: "All Users" },
  { key: "vendor_owner", label: "Vendors" },
  { key: "admin", label: "Admins" },
  { key: "customer", label: "Customers" },
  { key: "delivery_agent", label: "Delivery Agents" },
  { key: "inactive", label: "Inactive" },
];

function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [counts, setCounts] = useState<UserCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState<AdminUser | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/users/", { credentials: "include" });
      if (!response.ok) return;
      const data = await response.json();
      setUsers(data.users || []);
      setCounts(data.counts || null);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const toggleActive = async (user: AdminUser, next: boolean) => {
    if (!next) {
      const result = await Swal.fire({
        title: "Deactivate user?",
        text: `${user.name || user.phone_number} will no longer be able to sign in.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#dc2626",
        confirmButtonText: "Yes, deactivate",
        cancelButtonText: "Cancel",
      });
      if (!result.isConfirmed) return;
    }
    const response = await fetch(`/api/admin/users/${user.id}/`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: next }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      Swal.fire({
        title: "Update failed",
        text: data.error || "Something went wrong.",
        icon: "error",
      });
      return;
    }
    const data = await response.json();
    setUsers((prev) => prev.map((u) => (u.id === data.user.id ? data.user : u)));
    if (counts) {
      setCounts({
        ...counts,
        active: counts.active + (next ? 1 : -1),
        inactive: counts.inactive + (next ? -1 : 1),
      });
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === "inactive" && u.is_active) return false;
      if (filter !== "all" && filter !== "inactive" && u.role !== filter) return false;
      if (!term) return true;
      return (
        u.name.toLowerCase().includes(term) ||
        u.phone_number.toLowerCase().includes(term) ||
        (u.email || "").toLowerCase().includes(term) ||
        (u.store?.name || "").toLowerCase().includes(term)
      );
    });
  }, [users, search, filter]);

  const stats = [
    {
      label: "Total Users",
      value: counts?.total ?? "—",
      icon: UsersIcon,
      iconStyle: "bg-blue-50 text-blue-600",
    },
    {
      label: "Active",
      value: counts?.active ?? "—",
      icon: Activity,
      iconStyle: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Vendors",
      value: counts?.vendors ?? "—",
      icon: Store,
      iconStyle: "bg-orange-50 text-orange-600",
    },
    {
      label: "Inactive",
      value: counts?.inactive ?? "—",
      icon: Power,
      iconStyle: "bg-slate-100 text-slate-600",
    },
  ];

  return (
    <>
      {/* Page Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage every account on the platform — edit details, activate or deactivate access.
          </p>
        </div>
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
            placeholder="Search by name, phone, email or store..."
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

      {/* Users Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Loading users...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <UsersIcon className="mx-auto size-10 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-500">No users found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="py-3 pr-3">S/N</th>
                  <th className="py-3 pr-3">User</th>
                  <th className="py-3 pr-3">Phone</th>
                  <th className="py-3 pr-3">Email</th>
                  <th className="py-3 pr-3">Role</th>
                  <th className="py-3 pr-3">Store</th>
                  <th className="py-3 pr-3">Status</th>
                  <th className="py-3 pr-3">Joined</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                  >
                    <td className="py-3 pr-3 text-slate-500">{filtered.indexOf(user) + 1}</td>
                    <td className="py-3 pr-3">
                      <p className="max-w-[180px] truncate font-semibold text-slate-900">
                        {user.name || "—"}
                      </p>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 font-medium text-slate-700">
                      {user.phone_number || "—"}
                    </td>
                    <td className="py-3 pr-3">
                      {user.email ? (
                        <span className="max-w-[200px] truncate text-slate-600">{user.email}</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge
                        className={`font-medium normal-case ${ROLE_STYLES[user.role] || "bg-slate-100 text-slate-700"}`}
                      >
                        {ROLE_LABELS[user.role] || user.role}
                      </Badge>
                    </td>
                    <td className="py-3 pr-3">
                      {user.store ? (
                        <div className="flex items-center gap-2">
                          <Store className="size-4 shrink-0 text-slate-300" />
                          <span className="max-w-[160px] truncate font-medium text-slate-700">
                            {user.store.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge
                        className={`font-medium normal-case ${user.is_active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}`}
                      >
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 text-xs text-slate-500">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString([], { dateStyle: "medium" })
                        : "—"}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditing(user)}>
                          <Pencil className="size-4" />{" "}
                          <span className="hidden sm:inline">Edit</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setResetting(user)}
                          title="Reset password"
                        >
                          <KeyRound className="size-4" />{" "}
                          <span className="hidden sm:inline">Reset Password</span>
                        </Button>
                        <Button
                          variant={user.is_active ? "destructive" : "default"}
                          size="sm"
                          className={
                            user.is_active ? "" : "bg-gradient-to-r from-primary to-orange-600"
                          }
                          onClick={() => toggleActive(user, !user.is_active)}
                        >
                          <Power className="size-4" />{" "}
                          <span className="hidden sm:inline">
                            {user.is_active ? "Deactivate" : "Activate"}
                          </span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <EditUserDialog
        user={editing}
        saving={saving}
        onSave={async (payload) => {
          if (!editing) return;
          setSaving(true);
          try {
            const response = await fetch(`/api/admin/users/${editing.id}/`, {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
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
            setUsers((prev) => prev.map((u) => (u.id === data.user.id ? data.user : u)));
            if (counts) {
              const before = users.find((u) => u.id === data.user.id);
              setCounts({
                ...counts,
                active: counts.active - (before?.is_active ? 1 : 0) + (data.user.is_active ? 1 : 0),
                inactive:
                  counts.inactive - (before?.is_active ? 0 : 1) + (data.user.is_active ? 0 : 1),
                vendors:
                  counts.vendors -
                  (before?.role === "vendor_owner" ? 1 : 0) +
                  (data.user.role === "vendor_owner" ? 1 : 0),
                admins:
                  counts.admins -
                  (before?.role === "admin" ? 1 : 0) +
                  (data.user.role === "admin" ? 1 : 0),
                total: counts.total,
              });
            }
            setEditing(null);
            Swal.fire({
              title: "Saved",
              text: "User details updated.",
              icon: "success",
              timer: 1500,
              showConfirmButton: false,
            });
          } finally {
            setSaving(false);
          }
        }}
        onClose={() => setEditing(null)}
      />

      <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
    </>
  );
}

function ResetPasswordDialog({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const [mode, setMode] = useState<"generate" | "manual">("generate");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      setMode("generate");
      setPassword("");
      setConfirm("");
      setShow(false);
      setError("");
      setResult(null);
      setCopied(false);
    }
  }, [user]);

  const submit = async () => {
    if (!user) return;
    if (mode === "manual") {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}/password/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "generate" ? { generate: true } : { password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Could not reset the password.");
        return;
      }
      setResult(data.password);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const who = user ? user.name || user.phone_number : "";

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" />
            Reset Password
          </DialogTitle>
          <DialogDescription>
            {result
              ? `The password for ${who} has been changed.`
              : `Set a new password for ${who}. They will be signed out of all devices.`}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <code className="flex-1 break-all font-mono text-lg font-bold text-slate-900">
                {result}
              </code>
              <Button size="sm" variant="outline" onClick={copy}>
                <Copy className="size-4" /> {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Share this password with the user privately (e.g. by phone: {user?.phone_number}). It
              won't be shown again — ask them to change it after signing in.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: "generate", label: "Generate strong", icon: Sparkles },
                  { key: "manual", label: "Type my own", icon: Pencil },
                ] as const
              ).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    setMode(option.key);
                    setError("");
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-semibold transition ${
                    mode === option.key
                      ? "border-primary bg-orange-50 text-slate-900 ring-2 ring-primary/20"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <option.icon className="size-4" /> {option.label}
                </button>
              ))}
            </div>

            {mode === "generate" ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                A random 10-character password will be created and shown to you once.
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="new-password">New password</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="new-password"
                      type={show ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError("");
                      }}
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={show ? "Hide password" : "Show password"}
                    >
                      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    type={show ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => {
                      setConfirm(e.target.value);
                      setError("");
                    }}
                    autoComplete="new-password"
                    className="mt-1.5"
                  />
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={onClose} className="bg-gradient-to-r from-primary to-orange-600">
              Done
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={submit}
                disabled={submitting}
                className="bg-gradient-to-r from-primary to-orange-600"
              >
                {submitting ? "Resetting..." : "Reset Password"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type EditPayload = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  role?: string;
  is_verified?: boolean;
  email_verified?: boolean;
  is_active?: boolean;
};

function EditUserDialog({
  user,
  saving,
  onSave,
  onClose,
}: {
  user: AdminUser | null;
  saving: boolean;
  onSave: (payload: EditPayload) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<EditPayload>({});

  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email || "",
        phone_number: user.phone_number,
        role: user.role,
        is_verified: user.is_verified,
        email_verified: user.email_verified,
        is_active: user.is_active,
      });
    }
  }, [user]);

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Edit User
          </DialogTitle>
          <DialogDescription>Update account details, role and access status.</DialogDescription>
        </DialogHeader>

        {user && (
          <div className="grid gap-4 py-1 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="edit-name">Full name</Label>
              <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
                <Input
                  id="edit-first-name"
                  placeholder="First name"
                  value={form.first_name || ""}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                />
                <Input
                  id="edit-last-name"
                  placeholder="Last name"
                  value={form.last_name || ""}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="edit-phone">Phone number</Label>
              <Input
                id="edit-phone"
                className="mt-1.5"
                placeholder="+255712345678"
                value={form.phone_number || ""}
                onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="edit-email">
                <Mail className="mr-1 inline size-4 text-slate-400" />
                Email
              </Label>
              <Input
                id="edit-email"
                className="mt-1.5"
                type="email"
                placeholder="user@example.com"
                value={form.email || ""}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div className="sm:col-span-2">
              <Label>Role</Label>
              <Select
                value={form.role || ""}
                onValueChange={(value) => setForm((f) => ({ ...f, role: value }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center justify-between gap-6">
                  <span className="text-sm font-medium text-slate-700">
                    <UserRound className="mr-1 inline size-4 text-slate-400" />
                    Account active
                  </span>
                  <Switch
                    checked={!!form.is_active}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, is_active: checked }))}
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between gap-6">
                  <span className="text-sm font-medium text-slate-700">
                    <ShieldCheck className="mr-1 inline size-4 text-slate-400" />
                    Verified
                  </span>
                  <Switch
                    checked={!!form.is_verified}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, is_verified: checked }))}
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between gap-6">
                  <span className="text-sm font-medium text-slate-700">
                    <Mail className="mr-1 inline size-4 text-slate-400" />
                    Email verified
                  </span>
                  <Switch
                    checked={!!form.email_verified}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({ ...f, email_verified: checked }))
                    }
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => onSave(form)}
            disabled={saving}
            className="bg-gradient-to-r from-primary to-orange-600"
          >
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
