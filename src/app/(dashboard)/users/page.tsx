import { headers } from "next/headers";
import { auth, clerkClient } from "@clerk/nextjs/server";

async function getUsers() {
  // Rather than making an HTTP call to our own API route which requires explicit absolute URLs 
  // and forwarding auth cookies, it's safer to perform the same query on the server block directly.
  // We'll mimic the requested API structure response here.
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
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

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

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
          User Management
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          View and manage members on your platform.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Users", value: totalCount },
          { label: "New this month", value: newThisMonth },
          { label: "Active last 7 days", value: activeLast7Days },
          { label: "Never signed in", value: neverSignedIn },
        ].map((stat) => (
          <div
            key={stat.label}
            className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900/80"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative">
              <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-100">
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-zinc-800 bg-zinc-900/50 text-xs uppercase text-zinc-500">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-6 py-4 font-medium tracking-wider">
                  Email
                </th>
                <th scope="col" className="px-6 py-4 font-medium tracking-wider">
                  Joined Date
                </th>
                <th scope="col" className="px-6 py-4 font-medium tracking-wider text-right">
                  Last Seen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="transition-colors hover:bg-zinc-800/20"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-300">
                        {user.firstName?.charAt(0) || user.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="font-medium text-zinc-200">
                        {user.firstName} {user.lastName}
                        {(!user.firstName && !user.lastName) && (
                          <span className="text-zinc-500 italic">Unknown</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-400">{user.email}</td>
                  <td className="px-6 py-4 text-zinc-400">
                    {new Date(user.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {user.lastSignInAt ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                        <span className="size-1.5 rounded-full bg-emerald-500"></span>
                        {new Date(user.lastSignInAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-400 ring-1 ring-inset ring-zinc-700">
                        Never
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
