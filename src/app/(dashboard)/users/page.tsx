export const dynamic = 'force-dynamic';

import { clerkClient } from "@clerk/nextjs/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, UserPlus, Activity, UserX } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

async function getUsers() {
  const client = await clerkClient();
  const response = await client.users.getUserList({
    limit: 100,
    orderBy: "-created_at",
  });

  const users = response.data.map((user) => ({
    id: user.id,
    email: user.emailAddresses[0]?.emailAddress || "No email",
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    createdAt: user.createdAt,
    lastSignInAt: user.lastSignInAt,
  }));

  return {
    totalCount: response.totalCount,
    users: users,
  };
}

export default async function UsersPage() {


  // Fetch users server-side
  const { totalCount, users } = await getUsers();

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const newThisMonth = users.filter((u) => u.createdAt >= thirtyDaysAgo).length;
  const activeLast7Days = users.filter(
    (u) => u.lastSignInAt && u.lastSignInAt >= sevenDaysAgo
  ).length;
  const neverSignedIn = users.filter((u) => !u.lastSignInAt).length;

  const stats = [
    {
      label: "Total Users",
      value: totalCount,
      icon: Users,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "New This Month",
      value: newThisMonth,
      icon: UserPlus,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Active Last 7 Days",
      value: activeLast7Days,
      icon: Activity,
      color: "text-violet-600 bg-violet-50",
    },
    {
      label: "Never Signed In",
      value: neverSignedIn,
      icon: UserX,
      color: "text-orange-600 bg-orange-50",
    },
  ];

  function getUserStatus(user: {
    lastSignInAt: number | null;
  }): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
    if (!user.lastSignInAt) {
      return { label: "Never", variant: "destructive" };
    }
    if (user.lastSignInAt >= sevenDaysAgo) {
      return { label: "Active", variant: "default" };
    }
    return { label: "Inactive", variant: "secondary" };
  }

  // Avatar color palette
  const avatarColors = [
    "bg-emerald-100 text-emerald-700",
    "bg-blue-100 text-blue-700",
    "bg-violet-100 text-violet-700",
    "bg-orange-100 text-orange-700",
    "bg-rose-100 text-rose-700",
    "bg-amber-100 text-amber-700",
    "bg-cyan-100 text-cyan-700",
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          User Management
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage and monitor all registered users.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className="transition-shadow duration-200 hover:shadow-md"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  {stat.label}
                </CardTitle>
                <div
                  className={`flex size-8 items-center justify-center rounded-lg ${stat.color}`}
                >
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
              {users.map((user, index) => {
                const status = getUserStatus(user);
                const colorClass = avatarColors[index % avatarColors.length];
                const initial =
                  user.firstName?.charAt(0) ||
                  user.email.charAt(0).toUpperCase();

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback
                            className={`text-xs font-semibold ${colorClass}`}
                          >
                            {initial}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                          {!user.firstName && !user.lastName && (
                            <span className="text-gray-400 italic">
                              Unknown
                            </span>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {user.email}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {new Date(user.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {user.lastSignInAt
                        ? formatDistanceToNow(new Date(user.lastSignInAt), {
                            addSuffix: true,
                          })
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
                  <TableCell
                    colSpan={5}
                    className="text-center py-12 text-gray-500"
                  >
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        {/* Table footer */}
        <div className="flex items-center justify-between border-t px-6 py-4">
          <p className="text-sm text-gray-500">
            Showing {users.length} of {totalCount} users
          </p>
        </div>
      </Card>
    </div>
  );
}
