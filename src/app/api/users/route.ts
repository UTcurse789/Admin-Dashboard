import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const users = allUsers.map((user) => ({
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress || "No email",
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      lastSignInAt: user.lastSignInAt,
    }));

    return NextResponse.json({
      totalCount,
      users: users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
