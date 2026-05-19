"use client";

import { type JourneyEventName } from "@/lib/journey-events";

const TRACK_ENDPOINT = "/api/track-event";
const VISITOR_KEY = "journey_visitor_id";
const SESSION_KEY = "journey_session_id";
const SOURCE_KEY = "journey_source";
const LAST_SEEN_KEY = "journey_last_seen_at";
const RETURN_VISIT_KEY = "journey_return_visit_sent";
const SESSION_INACTIVITY_MS = 30 * 60 * 1000;

export interface JourneyTrackOptions {
  userId?: string | null;
  clerkId?: string | null;
  pageUrl?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface JourneyTrackingContext {
  visitorId: string;
  sessionId: string;
  source: string;
}

function createId(prefix: string) {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);

  return `${prefix}_${randomPart}`;
}

function readStorage(key: string, storage: Storage | null) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string, storage: Storage | null) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Ignore storage failures in privacy-constrained environments.
  }
}

function normalizeSource(raw: string | null | undefined) {
  const value = raw?.trim();

  if (!value) {
    return "Direct";
  }

  const lower = value.toLowerCase();

  if (lower.includes("zoho")) {
    return "Zoho CRM";
  }

  if (lower.includes("linkedin")) {
    return "LinkedIn";
  }

  if (
    lower.includes("google") ||
    lower.includes("bing") ||
    lower.includes("duckduckgo") ||
    lower.includes("yahoo") ||
    lower.includes("organic")
  ) {
    return "Organic";
  }

  if (lower === "direct" || lower === "unknown") {
    return "Direct";
  }

  return value;
}

function resolveSource() {
  const params = new URLSearchParams(window.location.search);
  const explicit =
    params.get("utm_source") ||
    params.get("source") ||
    params.get("ref_source");

  if (explicit) {
    const normalized = normalizeSource(explicit);
    writeStorage(SOURCE_KEY, normalized, window.localStorage);
    return normalized;
  }

  const stored = readStorage(SOURCE_KEY, window.localStorage);

  if (stored) {
    return stored;
  }

  if (!document.referrer) {
    return "Direct";
  }

  try {
    const referrerUrl = new URL(document.referrer);
    const normalized = normalizeSource(referrerUrl.hostname);
    writeStorage(SOURCE_KEY, normalized, window.localStorage);
    return normalized;
  } catch {
    return normalizeSource(document.referrer);
  }
}

export function getJourneyVisitorId() {
  const stored = readStorage(VISITOR_KEY, window.localStorage);

  if (stored) {
    return stored;
  }

  const next = createId("visitor");
  writeStorage(VISITOR_KEY, next, window.localStorage);
  return next;
}

export function getJourneySessionId() {
  const stored = readStorage(SESSION_KEY, window.sessionStorage);

  if (stored) {
    return stored;
  }

  const next = createId("session");
  writeStorage(SESSION_KEY, next, window.sessionStorage);
  return next;
}

export function getJourneyTrackingContext(): JourneyTrackingContext {
  const visitorId = getJourneyVisitorId();
  const sessionId = getJourneySessionId();
  const source = resolveSource();

  writeStorage(LAST_SEEN_KEY, String(Date.now()), window.localStorage);

  return {
    visitorId,
    sessionId,
    source,
  };
}

function postEvent(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    const queued = navigator.sendBeacon(TRACK_ENDPOINT, blob);

    if (queued) {
      return;
    }
  }

  void fetch(TRACK_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    keepalive: true,
  }).catch(() => {
    // Tracking must stay fire-and-forget.
  });
}

export function trackEvent(
  eventName: JourneyEventName,
  options: JourneyTrackOptions = {}
) {
  const context = getJourneyTrackingContext();

  postEvent({
    eventName,
    visitorId: context.visitorId,
    sessionId: context.sessionId,
    userId: options.userId ?? null,
    clerkId: options.clerkId ?? null,
    pageUrl: options.pageUrl ?? window.location.href,
    source: options.source ?? context.source,
    metadata: options.metadata ?? {},
  });
}

export function initializeJourneyTracking(options: JourneyTrackOptions = {}) {
  const visitorAlreadyExisted = Boolean(readStorage(VISITOR_KEY, window.localStorage));
  const lastSeenAt = Number(readStorage(LAST_SEEN_KEY, window.localStorage) ?? "0");
  const context = getJourneyTrackingContext();
  const now = Date.now();
  const shouldTrackReturnVisit =
    visitorAlreadyExisted &&
    lastSeenAt > 0 &&
    now - lastSeenAt >= SESSION_INACTIVITY_MS &&
    readStorage(RETURN_VISIT_KEY, window.sessionStorage) !== "1";

  if (shouldTrackReturnVisit) {
    trackEvent("return_visit", options);
    writeStorage(RETURN_VISIT_KEY, "1", window.sessionStorage);
  }

  return context;
}
