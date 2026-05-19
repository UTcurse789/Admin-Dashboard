import { notFound } from "next/navigation";
import { getDbUserById, getDbUserEnrichment, isDatabaseOffline, getDatabaseOfflineReason } from "@/lib/db";
import { getBrevoUserActivity } from "@/lib/brevo";
import { getClerkUserById } from "@/lib/clerk-users";
import { UserDetailClient } from "./UserDetailClient";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  
  console.log(`[UserDetailPage] Fetching user details for userId: ${userId}`);

  let user = null;
  let enrichment = null;
  const dbOffline = isDatabaseOffline();
  const dbOfflineReason = getDatabaseOfflineReason();

  const isClerkId = userId.startsWith("user_");
  const isNumericId = /^\d+$/.test(userId);

  if (!dbOffline) {
    try {
      // Only query database if it is not flagged as offline
      if (isNumericId) {
        user = await getDbUserById(parseInt(userId, 10));
        if (user) {
          enrichment = await getDbUserEnrichment(parseInt(userId, 10));
        }
      } else if (!isClerkId) {
        // Fallback for non-numeric, non-Clerk ID formats (just in case)
        user = await getDbUserById(userId);
        if (user) {
          enrichment = await getDbUserEnrichment(userId);
        }
      }
    } catch (error) {
      console.error("[UserDetailPage] Database fetch error:", error);
    }
  }

  // Fallback to Clerk if database is offline, user is not found, or it's a Clerk ID
  if (!user && (isClerkId || dbOffline || !isNumericId)) {
    console.log(`[UserDetailPage] DB search returned no user. Attempting Clerk lookup for: ${userId}`);
    const clerkUser = await getClerkUserById(userId).catch(() => null);
    if (clerkUser) {
      user = clerkUser;
    }
  }

  // If we still don't have a user, trigger 404
  if (!user) {
    console.warn(`[UserDetailPage] User not found in DB or Clerk. Triggering notFound().`);
    notFound();
  }

  // Fetch Brevo activity (if they have an email)
  const brevoActivity = user.email && user.email !== "No email" 
    ? await getBrevoUserActivity(user.email) 
    : null;

  const showOfflineBanner = dbOffline || user.data_source === "Clerk fallback";

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      {showOfflineBanner && (
        <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-amber-700 mt-0.5">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-950">
                Database is offline. Displaying Clerk authentication fallback.
              </p>
              <p className="text-xs text-amber-800 leading-relaxed mt-0.5">
                PostgreSQL database is currently unreachable{dbOfflineReason ? ` (${dbOfflineReason})` : ""}. 
                Rich profile attributes, industries, and communities might be temporarily outdated or unavailable, but basic account info remains active.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <UserDetailClient 
        user={user} 
        enrichment={enrichment}
        brevoActivity={brevoActivity} 
      />
    </div>
  );
}
