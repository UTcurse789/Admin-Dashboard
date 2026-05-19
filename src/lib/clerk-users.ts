import { clerkClient } from "@clerk/nextjs/server";
import type { DailyCount, DbUser } from "@/lib/db";

function parseBoundedInt(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, minimum), maximum);
}

const CLERK_PAGE_SIZE = parseBoundedInt(
  process.env.DASHBOARD_CLERK_PAGE_SIZE,
  500,
  50,
  500
);
const CLERK_MAX_PAGES = parseBoundedInt(
  process.env.DASHBOARD_MAX_CLERK_PAGES,
  4,
  1,
  20
);
const CLERK_LOOKBACK_DAYS = parseBoundedInt(
  process.env.DASHBOARD_CLERK_LOOKBACK_DAYS,
  400,
  30,
  3650
);

export interface ClerkUserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: number;
  lastSignInAt: number | null;
}

export interface ClerkUsersSnapshot {
  users: ClerkUserRecord[];
  totalCount: number;
}

interface ClerkUsersSnapshotOptions {
  minimumCreatedAtMs?: number | null;
  maximumCreatedAtMs?: number | null;
  bypassDefaultLookback?: boolean;
}

function toDateKey(ts: number) {
  return new Date(ts).toISOString().slice(0, 10);
}

export async function getClerkUsersSnapshot(
  options: ClerkUsersSnapshotOptions = {}
): Promise<ClerkUsersSnapshot> {
  const client = await clerkClient();
  const users: ClerkUserRecord[] = [];
  let offset = 0;
  const limit = CLERK_PAGE_SIZE;
  let totalCount = 0;
  let pagesFetched = 0;
  const minimumCreatedAtMs = options.minimumCreatedAtMs ?? null;
  const maximumCreatedAtMs = options.maximumCreatedAtMs ?? null;
  const lookbackCutoff =
    Date.now() - CLERK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

  while (true) {
    const response = await client.users.getUserList({
      limit,
      offset,
      orderBy: "-created_at",
    });

    totalCount = response.totalCount;
    pagesFetched += 1;

    users.push(
      ...response.data.map((user) => {
        const primaryEmail =
          user.emailAddresses.find(
            (emailAddress) => emailAddress.id === user.primaryEmailAddressId
          )?.emailAddress ??
          user.emailAddresses[0]?.emailAddress ??
          "No email";

        return {
          id: user.id,
          email: primaryEmail,
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          createdAt: user.createdAt,
          lastSignInAt: user.lastSignInAt,
        };
      })
    );

    const oldestFetchedCreatedAt =
      response.data[response.data.length - 1]?.createdAt ?? null;
    const crossedRequestedRange =
      minimumCreatedAtMs != null &&
      oldestFetchedCreatedAt !== null &&
      oldestFetchedCreatedAt < minimumCreatedAtMs;
    const crossedDefaultLookback =
      !options.bypassDefaultLookback &&
      oldestFetchedCreatedAt !== null &&
      oldestFetchedCreatedAt < lookbackCutoff;
    const reachedPageLimit =
      !options.bypassDefaultLookback && pagesFetched >= CLERK_MAX_PAGES;

    if (
      response.data.length < limit ||
      reachedPageLimit ||
      crossedDefaultLookback ||
      crossedRequestedRange
    ) {
      break;
    }

    offset += limit;
  }

  const filteredUsers = users.filter((user) => {
    if (minimumCreatedAtMs != null && user.createdAt < minimumCreatedAtMs) {
      return false;
    }

    if (maximumCreatedAtMs != null && user.createdAt > maximumCreatedAtMs) {
      return false;
    }

    return true;
  });

  return {
    users: filteredUsers,
    totalCount:
      minimumCreatedAtMs != null || maximumCreatedAtMs != null
        ? filteredUsers.length
        : Math.max(totalCount, users.length),
  };
}

export function buildDailyRegistrationsFromClerkUsers(
  users: ClerkUserRecord[]
): DailyCount[] {
  const signups = new Map<string, number>();

  users.forEach((user) => {
    const key = toDateKey(user.createdAt);
    signups.set(key, (signups.get(key) ?? 0) + 1);
  });

  return Array.from(signups.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function mapClerkUsersToDbUsers(users: ClerkUserRecord[]): DbUser[] {
  return users.map((user) => ({
    id: user.id,
    clerk_id: user.id,
    email: user.email,
    first_name: user.firstName || null,
    last_name: user.lastName || null,
    phone: null,
    country: null,
    state: null,
    job_title: null,
    organization: null,
    onboarding_completed: Boolean(user.lastSignInAt),
    created_at: new Date(user.createdAt),
    source: null,
    data_source: "Clerk fallback",
    salutation: null,
    registration_method: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
  }));
}

export async function getClerkUserById(userId: string): Promise<DbUser | null> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    if (!user) return null;
    
    const primaryEmail =
      user.emailAddresses.find(
        (emailAddress) => emailAddress.id === user.primaryEmailAddressId
      )?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      "No email";

    return {
      id: user.id,
      clerk_id: user.id,
      email: primaryEmail,
      first_name: user.firstName || null,
      last_name: user.lastName || null,
      phone: null,
      country: null,
      state: null,
      job_title: null,
      organization: null,
      onboarding_completed: Boolean(user.lastSignInAt),
      created_at: new Date(user.createdAt),
      source: null,
      data_source: "Clerk fallback",
      salutation: null,
      registration_method: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
    };
  } catch (error) {
    console.error(`Error fetching user ${userId} from Clerk:`, error);
    return null;
  }
}

