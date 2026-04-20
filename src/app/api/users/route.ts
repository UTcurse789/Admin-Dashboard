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

    interface ApiUser {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      createdAt: number;
      lastSignInAt: number | null;
    }

    const users: ApiUser[] = [];
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
        ...response.data.map((user) => {
          const primaryEmail =
            user.emailAddresses.find(
              (emailAddress) =>
                emailAddress.id === user.primaryEmailAddressId
            )?.emailAddress ??
            user.emailAddresses[0]?.emailAddress ??
            "No email";

          return {
            id: user.id,
            email: primaryEmail,
            firstName: user.firstName,
            lastName: user.lastName,
            createdAt: user.createdAt,
            lastSignInAt: user.lastSignInAt,
          };
        })
      );
      totalCount = response.totalCount;

      if (response.data.length < limit) break;
      offset += limit;
    }

    return NextResponse.json({
      totalCount,
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
