"use client";

import { useState, useCallback, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DataFilter, FilterRule, FilterField } from "@/components/ui/data-filter";
import { Card, CardContent } from "@/components/ui/card";

interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: number;
  lastSignInAt: number | null;
}

interface UsersClientProps {
  users: UserRecord[];
  totalCount: number;
}

function getUserStatus(user: UserRecord): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  if (!user.lastSignInAt) {
    return { label: "Never", variant: "destructive" };
  }
  if (user.lastSignInAt >= sevenDaysAgo) {
    return { label: "Active", variant: "default" };
  }
  return { label: "Inactive", variant: "secondary" };
}

const avatarColors = [
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-orange-100 text-orange-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-cyan-100 text-cyan-700",
];

function hashCode(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

const FILTER_FIELDS: FilterField[] = [
  { key: "name", label: "User Name", type: "text" },
  { key: "email", label: "Email", type: "text" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Active (Last 7d)", value: "Active" },
      { label: "Inactive", value: "Inactive" },
      { label: "Never Signed In", value: "Never" },
    ],
  },
];

function filterUsers(users: UserRecord[], rules: FilterRule[]) {
  if (rules.length === 0) {
    return users;
  }

  let result = [...users];

  for (const rule of rules) {
    if (!rule.value) continue;
    const searchVal = rule.value.toLowerCase();

    result = result.filter((u) => {
      let fieldVal = "";

      if (rule.field === "name") {
        fieldVal = `${u.firstName} ${u.lastName}`.toLowerCase();
      } else if (rule.field === "email") {
        fieldVal = u.email.toLowerCase();
      } else if (rule.field === "status") {
        fieldVal = getUserStatus(u).label.toLowerCase();
      }

      if (rule.operator === "equals") {
        return fieldVal === searchVal;
      } else if (rule.operator === "not_equals") {
        return fieldVal !== searchVal;
      } else if (rule.operator === "contains") {
        return fieldVal.includes(searchVal);
      }

      return true;
    });
  }

  return result;
}

export function UsersClient({ users, totalCount }: UsersClientProps) {
  const [activeRules, setActiveRules] = useState<FilterRule[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserRecord[]>(users);

  const applyFilters = useCallback((rules: FilterRule[]) => {
    setActiveRules(rules);
    setFilteredUsers(filterUsers(users, rules));
  }, [users]);

  useEffect(() => {
    setFilteredUsers(filterUsers(users, activeRules));
  }, [activeRules, users]);

  return (
    <div className="space-y-4">
      {/* ── Filter Bar ────────────────────────────────────────────── */}
      <DataFilter
        fields={FILTER_FIELDS}
        storageKey="users-module"
        onFilterChange={applyFilters}
      />

      {/* ── Table ─────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                <TableHead className="w-[250px] font-semibold text-gray-500">User</TableHead>
                <TableHead className="font-semibold text-gray-500">Email</TableHead>
                <TableHead className="font-semibold text-gray-500">Joined</TableHead>
                <TableHead className="font-semibold text-gray-500">Last Seen</TableHead>
                <TableHead className="text-right font-semibold text-gray-500">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const status = getUserStatus(user);
                const colorClass =
                  avatarColors[hashCode(user.id) % avatarColors.length];
                const initial = user.firstName?.charAt(0) || user.email.charAt(0).toUpperCase();

                return (
                  <TableRow key={user.id} className="transition-colors hover:bg-gray-50/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className={`text-xs font-semibold ${colorClass}`}>
                            {initial}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900 leading-tight">
                            {user.firstName} {user.lastName}
                            {!user.firstName && !user.lastName && (
                              <span className="italic text-gray-400">Unknown</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600 font-mono text-xs">{user.email}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {new Date(user.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {user.lastSignInAt
                        ? formatDistanceToNow(new Date(user.lastSignInAt), { addSuffix: true })
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={status.variant} className="shadow-none">
                        {status.label === "Active" && (
                          <span className="mr-1.5 inline-block size-1.5 rounded-full bg-emerald-500" />
                        )}
                        {status.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-sm text-gray-500">
                    No users match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          <p className="text-[12px] font-medium text-gray-500">
            Showing <span className="text-gray-900">{filteredUsers.length}</span> of <span className="text-gray-900">{users.length}</span> recorded users {totalCount > users.length ? `(total platform: ${totalCount})` : ''}
          </p>
        </div>
      </Card>
    </div>
  );
}
