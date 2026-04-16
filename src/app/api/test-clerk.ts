import { clerkClient } from "@clerk/nextjs/server";

export async function checkClerkUsers() {
  try {
    const client = await clerkClient();
    const response = await client.users.getUserList({
      limit: 100,
      orderBy: "-created_at",
    });
    console.log(`Total users in Clerk: ${response.totalCount}`);
    console.log(response.data.map(u => `${u.firstName} ${u.lastName} (${u.emailAddresses[0]?.emailAddress})`));
  } catch (err) {
    console.error("Clerk error!", err);
  }
}
