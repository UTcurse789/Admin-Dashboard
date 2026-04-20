import { clerkClient } from "@clerk/nextjs/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, UserPlus, Activity, UserX } from "lucide-react";
import { UsersClient } from "./UsersClient";

export const dynamic = "force-dynamic";

async function getUsers() {
  const client = await clerkClient();
  const users: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    createdAt: number;
    lastSignInAt: number | null;
  }> = [];
  let offset = 0;
  const limit = 500;
  let totalCount = 0;

  while (true) {
    const response = await client.users.getUserList({
      limit,
      offset,
      orderBy: "-created_at",
    });

    users.push(
      ...response.data.map((user) => ({
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || "No email",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
      }))
    );
    totalCount = response.totalCount;

    if (response.data.length < limit) {
      break;
    }

    offset += limit;
  }

  return {
    totalCount: users.length || totalCount,
    users,
  };
}

function buildUserStats(
  users: Awaited<ReturnType<typeof getUsers>>["users"],
  totalCount: number
) {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartTs = monthStart.getTime();

  const newThisMonth = users.filter((u) => u.createdAt >= monthStartTs).length;
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

  return { stats, totalCount };
}

export default async function UsersPage() {
  const { totalCount, users } = await getUsers();
  const { stats } = buildUserStats(users, totalCount);

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

      <UsersClient users={users} totalCount={totalCount} />
    </div>
  );
}
