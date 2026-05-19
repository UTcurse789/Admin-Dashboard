"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { Activity, AlertTriangle, ArrowUpRight, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { JourneyIntelligenceView } from "./JourneyIntelligenceView";
import type { JourneyIntelligenceData } from "@/lib/journey-intelligence";

const STORAGE_KEY = "ga4-dashboard-settings-v1";

interface StoredGa4Settings {
  propertyId: string;
  credentials: {
    type: string;
    client_email: string;
    private_key: string;
    token_uri?: string;
  };
}

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error"; message: string }
  | { status: "ready"; data: JourneyIntelligenceData };

async function loadJourneyData(
  query: string | null,
  pageQuery: string | null,
  startDate: string | null,
  endDate: string | null,
  rangePreset: string | null,
  setState: (state: LoadState) => void
) {
  setState({ status: "loading" });

  try {
    const settings = readStoredSettings();

    if (!settings) {
      setState({ status: "missing" });
      return;
    }

    const response = await fetch("/api/journey-intelligence/ga4", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        propertyId: settings.propertyId,
        credentials: settings.credentials,
        query,
        pageQuery,
        startDate,
        endDate,
        rangePreset,
        windowDays: 90,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    } & JourneyIntelligenceData;

    if (!response.ok) {
      throw new Error(payload.error || "Could not load journey data.");
    }

    startTransition(() => {
      setState({ status: "ready", data: payload });
    });
  } catch (error) {
    setState({
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not load journey data.",
    });
  }
}

function readStoredSettings() {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(raw) as Partial<StoredGa4Settings>;

  if (
    !parsed ||
    typeof parsed.propertyId !== "string" ||
    !parsed.credentials ||
    typeof parsed.credentials.client_email !== "string" ||
    typeof parsed.credentials.private_key !== "string"
  ) {
    return null;
  }

  return {
    propertyId: parsed.propertyId,
    credentials: parsed.credentials,
  } satisfies StoredGa4Settings;
}

function LoadingState() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-8 pb-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                Journey Intelligence
              </Badge>
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                Loading data
              </Badge>
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                Mapping the connected analytics source into the native journey view
              </h1>
              <p className="max-w-3xl text-sm leading-relaxed text-slate-500">
                Journey Intelligence is pulling from the same analytics connection used by
                the existing page intelligence screen.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-600">
            <div className="flex items-center gap-2 font-medium text-slate-900">
              <Activity className="h-4 w-4" />
              Fetching journey signals
            </div>
            <p className="mt-1">This usually takes a few seconds.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="space-y-3 p-5">
              <div className="h-3 w-28 rounded bg-slate-100" />
              <div className="h-9 w-24 rounded bg-slate-100" />
              <div className="h-3 w-full rounded bg-slate-100" />
              <div className="h-3 w-5/6 rounded bg-slate-100" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index} className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="space-y-4 p-5">
              <div className="h-5 w-40 rounded bg-slate-100" />
              <div className="h-3 w-5/6 rounded bg-slate-100" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((__, rowIndex) => (
                  <div key={rowIndex} className="h-20 rounded-2xl bg-slate-100" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MessageState({
  title,
  message,
  query,
  tone = "warning",
  onRetry,
}: {
  title: string;
  message: string;
  query: string | null;
  tone?: "warning" | "error";
  onRetry?: () => void;
}) {
  const toneClasses =
    tone === "error"
      ? "border-rose-200 bg-rose-50/70 text-rose-900"
      : "border-amber-200 bg-amber-50/70 text-amber-900";

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 pb-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                Journey Intelligence
              </Badge>
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                Data-backed
              </Badge>
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                Journey data is not ready in this browser yet
              </h1>
              <p className="max-w-3xl text-sm leading-relaxed text-slate-500">
                This page reads the same saved analytics connection used by the current
                page intelligence screen.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-600">
            <div className="flex items-center gap-2 font-medium text-slate-900">
              <Activity className="h-4 w-4" />
              Waiting for analytics connection
            </div>
            <p className="mt-1">Open the existing analytics setup once if this browser has not stored it yet.</p>
          </div>
        </div>

        <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${toneClasses}`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="leading-relaxed">{message}</p>
        </div>
      </section>

      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">{title}</p>
            <p className="mt-1 text-sm text-slate-500">
              Journey Intelligence is no longer waiting for custom DB fallback rows here. It
              expects the same analytics setup that already powers{" "}
              <a
                href="/ga4-dashboard.html"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-slate-700 underline underline-offset-4"
              >
                Page Intelligence
              </a>
              .
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onRetry ? (
              <Button variant="outline" className="h-10" onClick={onRetry}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            ) : null}
            {query ? (
              <Button asChild variant="ghost" className="h-10">
                <Link href="/journey-intelligence">Clear search</Link>
              </Button>
            ) : null}
            <Button asChild className="h-10">
              <a href="/ga4-dashboard.html" target="_blank" rel="noopener noreferrer">
                Open Page Intelligence
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function JourneyIntelligenceClient({
  query,
  pageQuery,
  startDate,
  endDate,
  rangePreset,
}: {
  query: string | null;
  pageQuery: string | null;
  startDate: string | null;
  endDate: string | null;
  rangePreset: string | null;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    void loadJourneyData(query, pageQuery, startDate, endDate, rangePreset, setState);
  }, [endDate, pageQuery, query, rangePreset, startDate]);

  if (state.status === "loading") {
    return <LoadingState />;
  }

  if (state.status === "missing") {
    return (
      <MessageState
        title="Analytics settings not found"
        message="This browser does not have the saved analytics connection from the existing page intelligence setup yet."
        query={query}
      />
    );
  }

  if (state.status === "error") {
    return (
      <MessageState
        title="Analytics fetch failed"
        message={state.message}
        query={query}
        tone="error"
        onRetry={() => {
          void loadJourneyData(
            query,
            pageQuery,
            startDate,
            endDate,
            rangePreset,
            setState
          );
        }}
      />
    );
  }

  return (
    <JourneyIntelligenceView
      data={state.data}
      query={query}
      pageQuery={pageQuery}
      startDate={startDate}
      endDate={endDate}
      rangePreset={rangePreset}
    />
  );
}
