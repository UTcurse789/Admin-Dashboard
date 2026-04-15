import { clerkClient } from "@clerk/nextjs/server";
import { strapiFetch, StrapiResponse, StrapiArticle } from "@/lib/strapi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  Users,
  UserPlus,
  Activity,
  FileText,
  ArrowUpRight,
  ArrowRight,
  BarChart3,
} from "lucide-react";
import Link from "next/link";

async function getDashboardData() {
  const client = await clerkClient();
  const userRes = await client.users.getUserList({
    limit: 100,
    orderBy: "-created_at",
  });

  const users = userRes.data.map((user) => ({
    id: user.id,
    email: user.emailAddresses[0]?.emailAddress || "No email",
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    createdAt: user.createdAt,
    lastSignInAt: user.lastSignInAt,
  }));

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const totalUsers = userRes.totalCount;
  const newThisMonth = users.filter((u) => u.createdAt >= thirtyDaysAgo).length;
  const activeLast7Days = users.filter(
    (u) => u.lastSignInAt && u.lastSignInAt >= sevenDaysAgo
  ).length;

  // Get Strapi articles
  let totalArticles = 0;
  let recentArticles: { title: string; type: string; publishedAt: string | null }[] = [];
  try {
    const data = await strapiFetch<StrapiResponse<StrapiArticle>>(
      "/api/contents?populate=*&sort=publishedAt:desc&pagination[limit]=5"
    );
    totalArticles = data.meta.pagination.total;
    recentArticles = data.data.map((article) => {
      const attrs = (article as any).attributes ?? article;
      return {
        title: attrs.Title ?? "Untitled",
        type:
          attrs.type_of_content?.data?.attributes?.name ??
          attrs.type_of_content?.name ??
          "Article",
        publishedAt: attrs.publishedAt ?? null,
      };
    });
  } catch (e) {
    console.error("Failed to fetch Strapi data for dashboard:", e);
  }

  return {
    totalUsers,
    newThisMonth,
    activeLast7Days,
    totalArticles,
    recentUsers: users.slice(0, 5),
    recentArticles,
  };
}

export default async function DashboardHome() {


  const {
    totalUsers,
    newThisMonth,
    activeLast7Days,
    totalArticles,
    recentUsers,
    recentArticles,
  } = await getDashboardData();

  const stats = [
    {
      label: "Total Users",
      value: totalUsers,
      icon: Users,
      color: "text-emerald-600 bg-emerald-50",
      trend: null,
    },
    {
      label: "New This Month",
      value: newThisMonth,
      icon: UserPlus,
      color: "text-blue-600 bg-blue-50",
      trend: null,
    },
    {
      label: "Active Last 7 Days",
      value: activeLast7Days,
      icon: Activity,
      color: "text-violet-600 bg-violet-50",
      trend: null,
    },
    {
      label: "Total Articles",
      value: totalArticles,
      icon: FileText,
      color: "text-orange-600 bg-orange-50",
      trend: null,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Welcome to Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your platform content, users, and analytics from one place.
        </p>
      </div>

      {/* Stats grid */}
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
              {stat.trend && (
                <CardFooter className="text-xs text-gray-500">
                  <ArrowUpRight className="mr-1 h-3 w-3 text-emerald-500" />
                  {stat.trend}
                </CardFooter>
              )}
            </Card>
          );
        })}
      </div>

      {/* Two-column activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Recent Users — 60% */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-900">
              Recent Users
            </CardTitle>
            <Link
              href="/users"
              className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50"
              >
                <Avatar className="size-9">
                  <AvatarFallback className="bg-gray-100 text-sm font-medium text-gray-600">
                    {user.firstName?.charAt(0) ||
                      user.email.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.firstName} {user.lastName}
                    {!user.firstName && !user.lastName && (
                      <span className="text-gray-400 italic">Unknown</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <Badge variant="secondary" className="text-[11px]">
                  {new Date(user.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </Badge>
              </div>
            ))}
            {recentUsers.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                No users yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent Content — 40% */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-900">
              Recent Content
            </CardTitle>
            <Link
              href="/content"
              className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentArticles.map((article, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {article.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="text-[11px]"
                    >
                      {article.type}
                    </Badge>
                    {article.publishedAt && (
                      <span className="text-[11px] text-gray-400">
                        {new Date(article.publishedAt).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {recentArticles.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                No content from Strapi.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="flex size-12 items-center justify-center rounded-full bg-gray-100">
                <BarChart3 className="h-6 w-6 text-gray-400" />
              </div>
              <p className="mt-4 text-sm font-medium text-gray-700">
                Connect analytics to view chart data
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Charts and graphs will populate once analytics are connected.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card className="transition-shadow duration-200 hover:shadow-md">
            <CardContent className="flex items-center justify-between py-6">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  User Management
                </p>
                <p className="text-xs text-gray-500">
                  View and manage all {totalUsers} registered users.
                </p>
              </div>
              <Link href="/users">
                <Badge className="cursor-pointer bg-gray-900 text-white hover:bg-gray-800 px-3 py-1.5 text-xs gap-1">
                  Go to Users <ArrowRight className="h-3 w-3" />
                </Badge>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content">
          <Card className="transition-shadow duration-200 hover:shadow-md">
            <CardContent className="flex items-center justify-between py-6">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Content Management
                </p>
                <p className="text-xs text-gray-500">
                  Browse all {totalArticles} articles synced from Strapi.
                </p>
              </div>
              <Link href="/content">
                <Badge className="cursor-pointer bg-gray-900 text-white hover:bg-gray-800 px-3 py-1.5 text-xs gap-1">
                  Go to Content <ArrowRight className="h-3 w-3" />
                </Badge>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
