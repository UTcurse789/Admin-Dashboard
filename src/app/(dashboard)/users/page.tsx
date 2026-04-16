export const dynamic = "force-dynamic";

import { clerkClient } from "@clerk/nextjs/server";
import UsersDashboard from "./users-dashboard";

export interface SerializedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: number;
  lastSignInAt: number | null;
  externalProvider: string | null;
}

async function getUsers() {
  const client = await clerkClient();
  let allUsers: any[] = [];
  let offset = 0;
  const limit = 500;
  let totalCount = 0;

  while (true) {
    const response = await client.users.getUserList({
      limit,
      offset,
      orderBy: "-created_at",
    });

    allUsers = [...allUsers, ...response.data];
    totalCount = response.totalCount;

    if (response.data.length < limit) break;
    offset += limit;
  }

  const users: SerializedUser[] = allUsers.map((user) => {
    // Determine sign-up method
    const externalAccounts = (user as any).externalAccounts;
    let externalProvider: string | null = null;
    if (externalAccounts && externalAccounts.length > 0) {
      externalProvider = externalAccounts[0].provider || "oauth";
    }

    return {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress || "No email",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      createdAt: user.createdAt,
      lastSignInAt: user.lastSignInAt,
      externalProvider,
    };
  });

  return {
    totalCount,
    users,
  };
}

export default async function UsersPage() {
  const { totalCount, users } = await getUsers();

  return <UsersDashboard users={users} totalCount={totalCount} />;
}
