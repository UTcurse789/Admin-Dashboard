"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Briefcase } from "lucide-react";
import { DataFilter, FilterRule, FilterField } from "@/components/ui/data-filter";
import { Card, CardContent } from "@/components/ui/card";

interface EnrichedUser {
  id: string;
  clerk_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  salutation: string | null;
  job_title: string | null;
  organization: string | null;
  source: string | null;
  state: string | null;
  onboarding_completed: boolean | null;
  created_at: Date | null;
  lastSignIn: number | null;
  isActive: boolean;
  isRecent: boolean;
}

interface UserActivityClientProps {
  enrichedUsers: EnrichedUser[];
  totalDbUsers: number;
}

const FILTER_FIELDS: FilterField[] = [
  { key: "name", label: "User Name / Email", type: "text" },
  { key: "organization", label: "Organization", type: "text" },
  { key: "source", label: "Source", type: "text" },
  { key: "state", label: "State", type: "text" },
  { key: "onboarded", label: "Onboarded", type: "boolean" },
  {
    key: "activity",
    label: "Activity Status",
    type: "select",
    options: [
      { label: "Active (7d)", value: "active" },
      { label: "Recent (30d)", value: "recent" },
      { label: "Inactive", value: "inactive" },
    ],
  },
];

function filterUsers(users: EnrichedUser[], rules: FilterRule[]) {
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
        fieldVal = `${u.first_name || ""} ${u.last_name || ""} ${u.email}`.toLowerCase();
      } else if (rule.field === "organization") {
        fieldVal = (u.organization || "").toLowerCase();
      } else if (rule.field === "source") {
        fieldVal = (u.source || "").toLowerCase();
      } else if (rule.field === "state") {
        fieldVal = (u.state || "").toLowerCase();
      } else if (rule.field === "onboarded") {
        fieldVal = u.onboarding_completed ? "true" : "false";
      } else if (rule.field === "activity") {
        if (u.isActive) fieldVal = "active";
        else if (u.isRecent) fieldVal = "recent";
        else fieldVal = "inactive";
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

export function UserActivityClient({
  enrichedUsers,
  totalDbUsers,
}: UserActivityClientProps) {
  const [activeRules, setActiveRules] = useState<FilterRule[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<EnrichedUser[]>(enrichedUsers);

  const applyFilters = useCallback((rules: FilterRule[]) => {
    setActiveRules(rules);
    setFilteredUsers(filterUsers(enrichedUsers, rules));
  }, [enrichedUsers]);

  useEffect(() => {
    setFilteredUsers(filterUsers(enrichedUsers, activeRules));
  }, [activeRules, enrichedUsers]);

  return (
    <div className="space-y-4">
      <DataFilter
        fields={FILTER_FIELDS}
        storageKey="user-activity-module"
        onFilterChange={applyFilters}
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100 bg-gray-50/50 hover:bg-gray-50/50">
                  <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-wider text-gray-400">User</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Organization</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Source</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">State</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Onboarded</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Activity</TableHead>
                  <TableHead className="pr-6 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={u.id} className="border-b border-gray-50 transition-colors hover:bg-gray-50/60">
                    <TableCell className="pl-6">
                      <div className="min-w-[180px]">
                        <p className="text-sm font-medium text-gray-900">
                          {u.salutation ? `${u.salutation} ` : ""}
                          {u.first_name || ""} {u.last_name || ""}
                          {!u.first_name && !u.last_name && (
                            <span className="italic text-gray-400">Unknown</span>
                          )}
                        </p>
                        <p className="max-w-[200px] truncate font-mono text-[11px] text-gray-400">{u.email}</p>
                        {u.job_title && (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400">
                            <Briefcase className="h-3 w-3" />
                            {u.job_title}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-gray-600">{u.organization || "-"}</span>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-[11px] ${
                          u.source === "zoho_form"
                            ? "bg-violet-50 text-violet-700"
                            : u.source === "website"
                            ? "bg-emerald-50 text-emerald-700"
                            : ""
                        }`}
                      >
                        {u.source || "-"}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-gray-500">{u.state || "-"}</span>
                    </TableCell>

                    <TableCell>
                      {u.onboarding_completed ? (
                        <Badge variant="secondary" className="border border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700 shadow-none">
                          <span className="mr-1 inline-block size-1.5 rounded-full bg-emerald-500" />
                          Yes
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="border border-gray-200 bg-gray-100 text-[11px] text-gray-500 shadow-none">
                          <span className="mr-1 inline-block size-1.5 rounded-full bg-gray-400" />
                          No
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      {u.isActive ? (
                        <Badge variant="secondary" className="border border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700 shadow-none">Active</Badge>
                      ) : u.isRecent ? (
                        <Badge variant="secondary" className="border border-blue-200 bg-blue-50 text-[11px] text-blue-700 shadow-none">Recent</Badge>
                      ) : (
                        <Badge variant="secondary" className="border border-gray-200 bg-gray-100 text-[11px] text-gray-500 shadow-none">Inactive</Badge>
                      )}
                    </TableCell>

                    <TableCell className="pr-6 text-right">
                      <span className="text-xs text-gray-500">
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "-"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}

                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-sm text-gray-400">
                      No users match your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
            <p className="text-[12px] font-medium text-gray-500">
              Showing <span className="text-gray-900">{filteredUsers.length}</span> of <span className="text-gray-900">{enrichedUsers.length}</span> documented profiles
              {totalDbUsers > enrichedUsers.length
                ? ` (database total: ${totalDbUsers})`
                : ""}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
