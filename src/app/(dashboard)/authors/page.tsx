export const dynamic = 'force-dynamic';

import { strapiFetch, StrapiResponse, StrapiAuthor } from "@/lib/strapi";
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
import { PenTool, Users, FileSignature, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

async function getAuthors() {
  const data = await strapiFetch<StrapiResponse<StrapiAuthor>>(
    "/api/authors?populate=*&sort=createdAt:desc&pagination[limit]=100"
  );
  
  return {
    authors: data.data,
    total: data.meta.pagination.total
  };
}

export default async function AuthorsPage() {
  let authors: StrapiAuthor[] = [];
  let totalAuthors = 0;
  let fetchError = false;

  try {
    const res = await getAuthors();
    authors = res.authors;
    totalAuthors = res.total;
  } catch (err) {
    console.error("Failed to fetch authors from Strapi:", err);
    fetchError = true;
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const newThisMonth = authors.filter(
    (a) => new Date(a.createdAt) >= thirtyDaysAgo
  ).length;

  const stats = [
    {
      label: "Total Authors",
      value: totalAuthors,
      icon: Users,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "New This Month",
      value: newThisMonth,
      icon: Calendar,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Contributors",
      value: authors.length, // Since we only fetch top 100, showing length
      icon: PenTool,
      color: "text-violet-600 bg-violet-50",
    },
    {
      label: "Active Roles",
      value: authors.filter(a => a.designation).length,
      icon: FileSignature,
      color: "text-orange-600 bg-orange-50",
    },
  ];

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
    <div className="mx-auto max-w-6xl space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Authors Management
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage authors and contributors synced from Strapi.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className="transition-shadow duration-200 hover:shadow-md border border-gray-100"
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

      {/* Error state */}
      {fetchError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6 text-center">
            <p className="text-sm font-medium text-red-700">
              Failed to connect to Strapi CMS
            </p>
            <p className="mt-1 text-xs text-red-500">
              Check that STRAPI_URL and STRAPI_ADMIN_TOKEN are configured
              correctly.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Authors Table */}
      <Card className="border border-gray-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow className="hover:bg-transparent border-gray-100">
                <TableHead className="w-[300px]">Author</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {authors.map((author, index) => {
                const colorClass = avatarColors[index % avatarColors.length];
                const initial = author.name ? author.name.charAt(0).toUpperCase() : "?";

                return (
                  <TableRow key={author.id} className="group border-gray-100 transition-colors hover:bg-gray-50/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9 border border-white shadow-sm transition-transform group-hover:scale-105">
                          <AvatarFallback
                            className={`text-sm font-semibold ${colorClass}`}
                          >
                            {initial}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-gray-900 truncate">
                            {author.name || "Unnamed Author"}
                          </span>
                          <span className="text-xs text-gray-400 truncate">
                            /{author.slug || "no-slug"}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600 line-clamp-1 max-w-[250px]" title={author.designation || ""}>
                        {author.designation || <span className="text-gray-400 italic">No designation</span>}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-full bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] gap-1">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        Active
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-gray-600">
                      <span className="text-sm">
                        {new Date(author.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {authors.length === 0 && !fetchError && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center py-12 text-gray-500"
                  >
                    No authors found in Strapi.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        {/* Table footer */}
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/30 px-6 py-4">
          <p className="text-sm text-gray-500">
            Showing {authors.length} of {totalAuthors} authors
          </p>
        </div>
      </Card>
    </div>
  );
}
