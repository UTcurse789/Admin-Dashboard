"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Users,
  UserPlus,
  Activity,
  UserX,
  Download,
  Loader2,
  Copy,
  ExternalLink,
  Calendar,
  Clock,
  Hash,
  Timer,
  Mail,
  Shield,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { SerializedUser } from "./page";

// ─── Helpers ─────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-orange-100 text-orange-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-cyan-100 text-cyan-700",
];

const LARGE_AVATAR_COLORS = [
  "bg-emerald-200 text-emerald-800",
  "bg-blue-200 text-blue-800",
  "bg-violet-200 text-violet-800",
  "bg-orange-200 text-orange-800",
  "bg-rose-200 text-rose-800",
  "bg-amber-200 text-amber-800",
  "bg-cyan-200 text-cyan-800",
];

function getInitials(user: SerializedUser): string {
  if (user.firstName && user.lastName)
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  if (user.firstName) return user.firstName[0].toUpperCase();
  return user.email[0].toUpperCase();
}

function getFullName(user: SerializedUser): string {
  const name = `${user.firstName} ${user.lastName}`.trim();
  return name || "Unknown User";
}

function getUserStatus(
  lastSignInAt: number | null,
  sevenDaysAgo: number
): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (!lastSignInAt) return { label: "Never Signed In", variant: "destructive" };
  if (lastSignInAt >= sevenDaysAgo) return { label: "Active", variant: "default" };
  return { label: "Inactive", variant: "secondary" };
}

function daysAgo(timestamp: number): number {
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Component ───────────────────────────────────────────

export default function UsersDashboard({
  users,
  totalCount,
}: {
  users: SerializedUser[];
  totalCount: number;
}) {
  const [selectedUser, setSelectedUser] = useState<SerializedUser | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const newThisMonth = users.filter((u) => u.createdAt >= thirtyDaysAgo).length;
  const activeLast7Days = users.filter(
    (u) => u.lastSignInAt && u.lastSignInAt >= sevenDaysAgo
  ).length;
  const neverSignedIn = users.filter((u) => !u.lastSignInAt).length;

  const stats = [
    { label: "Total Users", value: totalCount, icon: Users, color: "text-emerald-600 bg-emerald-50" },
    { label: "New This Month", value: newThisMonth, icon: UserPlus, color: "text-blue-600 bg-blue-50" },
    { label: "Active Last 7 Days", value: activeLast7Days, icon: Activity, color: "text-violet-600 bg-violet-50" },
    { label: "Never Signed In", value: neverSignedIn, icon: UserX, color: "text-orange-600 bg-orange-50" },
  ];

  // ── Row click handler ──
  function handleRowClick(user: SerializedUser) {
    setSelectedUser(user);
    setSheetOpen(true);
  }

  // ── Copy to clipboard ──
  async function copyToClipboard(text: string, fieldName: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      toast.success(`${fieldName} copied to clipboard`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

  // ── Export CSV ──
  async function handleExportCSV() {
    setExporting(true);
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();

      const header = "Name,Email,Joined Date,Last Seen,Status\n";
      const rows = data.users
        .map((u: any) => {
          const name = `${u.firstName || ""} ${u.lastName || ""}`.trim() || "Unknown";
          const email = u.email;
          const joined = formatDate(u.createdAt);
          const lastSeen = u.lastSignInAt
            ? formatDate(u.lastSignInAt)
            : "Never";
          const status = !u.lastSignInAt
            ? "Never Signed In"
            : u.lastSignInAt >= sevenDaysAgo
            ? "Active"
            : "Inactive";
          // Escape commas in fields
          return `"${name}","${email}","${joined}","${lastSeen}","${status}"`;
        })
        .join("\n");

      const csv = header + rows;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().split("T")[0];
      const link = document.createElement("a");
      link.href = url;
      link.download = `energdive-users-${dateStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Export complete — ${data.users.length} users downloaded`);
    } catch (err) {
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  // ── Selected user detail helpers ──
  const selectedIndex = selectedUser
    ? users.findIndex((u) => u.id === selectedUser.id)
    : 0;

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(users.length / ITEMS_PER_PAGE));
  const paginatedUsers = users.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            User Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and monitor all registered users.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={exporting}
          className="gap-2"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {exporting ? "Exporting…" : "Export CSV"}
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="transition-shadow duration-200 hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  {stat.label}
                </CardTitle>
                <div className={`flex size-8 items-center justify-center rounded-lg ${stat.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[250px]">User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.map((user, index) => {
                const status = getUserStatus(user.lastSignInAt, sevenDaysAgo);
                const colorClass = AVATAR_COLORS[index % AVATAR_COLORS.length];

                return (
                  <TableRow
                    key={user.id}
                    className="group cursor-pointer transition-colors hover:bg-gray-50/80"
                    onClick={() => handleRowClick(user)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className={`text-xs font-semibold ${colorClass}`}>
                            {getInitials(user)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-gray-900 group-hover:text-blue-700 transition-colors">
                          {getFullName(user)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{user.email}</TableCell>
                    <TableCell className="text-gray-600">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {user.lastSignInAt
                        ? formatDistanceToNow(new Date(user.lastSignInAt), { addSuffix: true })
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={status.variant}>
                        {status.label === "Active" && (
                          <span className="mr-1 inline-block size-1.5 rounded-full bg-emerald-500" />
                        )}
                        {status.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-gray-500">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <div className="flex items-center justify-between border-t px-6 py-4">
          <p className="text-sm text-gray-500">
            Showing{" "}
            <span className="font-medium text-gray-700">
              {(currentPage - 1) * ITEMS_PER_PAGE + 1}
            </span>
            –
            <span className="font-medium text-gray-700">
              {Math.min(currentPage * ITEMS_PER_PAGE, users.length)}
            </span>{" "}
            of{" "}
            <span className="font-medium text-gray-700">
              {users.length}
            </span>{" "}
            users
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 gap-1 text-sm"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            {/* Page numbers */}
            <div className="hidden items-center gap-1 sm:flex">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  if (p === 1 || p === totalPages) return true;
                  if (Math.abs(p - currentPage) <= 1) return true;
                  return false;
                })
                .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                    acc.push("ellipsis");
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "ellipsis" ? (
                    <span key={`ellipsis-${idx}`} className="px-1 text-gray-400">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setCurrentPage(item as number)}
                      className={`flex h-8 min-w-[32px] items-center justify-center rounded-md text-sm font-medium transition-all ${
                        currentPage === item
                          ? "bg-gray-900 text-white shadow-sm"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 gap-1 text-sm"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* ── User Detail Sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-96 overflow-y-auto p-0">
          {selectedUser && (
            <>
              {/* Header section */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/80 p-6 pb-5">
                <SheetTitle className="sr-only">
                  User Details — {getFullName(selectedUser)}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Detailed information for {getFullName(selectedUser)}
                </SheetDescription>

                <div className="flex flex-col items-center text-center">
                  <Avatar className="size-20 border-4 border-white shadow-lg">
                    <AvatarFallback
                      className={`text-2xl font-bold ${
                        LARGE_AVATAR_COLORS[selectedIndex % LARGE_AVATAR_COLORS.length]
                      }`}
                    >
                      {getInitials(selectedUser)}
                    </AvatarFallback>
                  </Avatar>

                  <h2 className="mt-4 text-lg font-bold text-gray-900">
                    {getFullName(selectedUser)}
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {selectedUser.email}
                  </p>

                  <div className="mt-3">
                    {(() => {
                      const s = getUserStatus(selectedUser.lastSignInAt, sevenDaysAgo);
                      return (
                        <Badge variant={s.variant} className="text-xs">
                          {s.label === "Active" && (
                            <span className="mr-1 inline-block size-1.5 rounded-full bg-emerald-500" />
                          )}
                          {s.label}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 px-6 py-5">
                <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium uppercase tracking-wider">
                      Joined
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-gray-900">
                    {formatDate(selectedUser.createdAt)}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium uppercase tracking-wider">
                      Last Seen
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-gray-900">
                    {selectedUser.lastSignInAt
                      ? formatDistanceToNow(new Date(selectedUser.lastSignInAt), {
                          addSuffix: true,
                        })
                      : "Never"}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Hash className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium uppercase tracking-wider">
                      Sessions
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-gray-900">
                    {selectedUser.lastSignInAt ? "1+" : "0"}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Timer className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium uppercase tracking-wider">
                      Account Age
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-gray-900">
                    {daysAgo(selectedUser.createdAt)} days
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 px-6 pb-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(selectedUser.email, "Email");
                  }}
                >
                  {copiedField === "Email" ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copiedField === "Email" ? "Copied!" : "Copy Email"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(
                      `https://dashboard.clerk.com`,
                      "_blank",
                      "noopener"
                    );
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  View in Clerk
                </Button>
              </div>

              <Separator />

              {/* Account Details */}
              <div className="px-6 py-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
                  Account Details
                </h3>

                <div className="space-y-4">
                  {/* User ID */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
                      <Shield className="h-3 w-3" />
                      User ID
                    </label>
                    <div
                      className="group/id flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 cursor-pointer hover:border-gray-200 transition-colors"
                      onClick={() =>
                        copyToClipboard(selectedUser.id, "User ID")
                      }
                    >
                      <code className="text-xs font-mono text-gray-700 truncate mr-2">
                        {selectedUser.id}
                      </code>
                      {copiedField === "User ID" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-gray-300 group-hover/id:text-gray-500 shrink-0 transition-colors" />
                      )}
                    </div>
                  </div>

                  {/* Created via */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
                      <Mail className="h-3 w-3" />
                      Created via
                    </label>
                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <span className="text-sm text-gray-700 capitalize">
                        {selectedUser.externalProvider
                          ? selectedUser.externalProvider.replace("oauth_", "")
                          : "Email"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
