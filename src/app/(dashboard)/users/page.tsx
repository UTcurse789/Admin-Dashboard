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
  const response = await client.users.getUserList({
    limit: 100,
    orderBy: "-created_at",
  });

  const users: SerializedUser[] = response.data.map((user) => {
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
    totalCount: response.totalCount,
    users,
  };
}

export default async function UsersPage() {
  const { totalCount, users } = await getUsers();

  return <UsersDashboard users={users} totalCount={totalCount} />;
}
