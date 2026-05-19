"use client";

import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import type { DbUser } from "@/lib/db";
import type { BrevoUserActivityData } from "@/lib/brevo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Building2,
  Calendar,
  ChevronRight,
  Mail,
  MapPin,
  MousePointerClick,
  Phone,
  User,
  CheckCircle2,
  XCircle
} from "lucide-react";

interface UserDetailClientProps {
  user: DbUser;
  enrichment: any; // Using any or importing DbUserEnrichment from db
  brevoActivity: BrevoUserActivityData | null;
}

function getInitials(user: DbUser) {
  const first = user.first_name?.charAt(0) ?? "";
  const last = user.last_name?.charAt(0) ?? "";
  const initials = `${first}${last}`.trim().toUpperCase();

  if (initials) {
    return initials;
  }

  return user.email.charAt(0).toUpperCase();
}

function getDisplayName(user: DbUser) {
  const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return fullName || "Unknown";
}

export function UserDetailClient({ user, enrichment, brevoActivity }: UserDetailClientProps) {
  const joinDate = user.created_at ? new Date(user.created_at) : null;
  const metrics = brevoActivity?.metrics;
  const events = brevoActivity?.events || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link
          href="/users"
          className="flex items-center gap-1 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Users
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-slate-900 font-medium">User Profile</span>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_400px]">
        {/* Main Info Column */}
        <div className="space-y-6">
          <Card className="border-slate-200 overflow-hidden">
            <div className="h-32 bg-gradient-to-r from-emerald-500/20 to-blue-500/20" />
            <CardContent className="px-6 pb-6 relative pt-0">
              <div className="flex items-end gap-5 -mt-10">
                <Avatar className="size-24 border-4 border-white shadow-sm">
                  <AvatarFallback className="bg-emerald-50 text-2xl font-bold text-emerald-700">
                    {getInitials(user)}
                  </AvatarFallback>
                </Avatar>
                <div className="mb-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                    {user.salutation ? `${user.salutation} ` : ""}
                    {getDisplayName(user)}
                  </h1>
                  <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
                    <Mail className="h-4 w-4" />
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-slate-50 p-2.5 text-slate-500">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Organization
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {user.organization || "-"}
                    </p>
                    <p className="text-xs text-slate-500">{user.job_title}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-slate-50 p-2.5 text-slate-500">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Location
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {user.state || "-"}
                    </p>
                    <p className="text-xs text-slate-500">{user.country || "India"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-slate-50 p-2.5 text-slate-500">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Phone
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {user.phone || "-"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-slate-50 p-2.5 text-slate-500">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Joined
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {joinDate ? format(joinDate, "MMM d, yyyy") : "-"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {joinDate ? formatDistanceToNow(joinDate, { addSuffix: true }) : ""}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Activity Timeline */}
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-900">
                    Recent Email Activity
                  </CardTitle>
                  <p className="text-sm text-slate-500 mt-1">
                    Interaction timeline from Brevo campaigns
                  </p>
                </div>
                <div className="rounded-full bg-blue-50 p-2 text-blue-600">
                  <Mail className="h-5 w-5" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {events.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  No recent email activity found for this user.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                  {events.slice(0, 30).map((event, idx) => {
                    const isPositive = event.event === "opened" || event.event === "click";
                    const isNegative =
                      event.event === "bounced" ||
                      event.event === "hardBounces" ||
                      event.event === "softBounces" ||
                      event.event === "spam" ||
                      event.event === "blocked" ||
                      event.event === "error";

                    return (
                      <div key={idx} className="flex gap-4 p-4 hover:bg-slate-50/50 transition-colors">
                        <div className="mt-1">
                          {isPositive ? (
                            <div className="rounded-full bg-emerald-100 p-1.5 text-emerald-600">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                          ) : isNegative ? (
                            <div className="rounded-full bg-red-100 p-1.5 text-red-600">
                              <XCircle className="h-4 w-4" />
                            </div>
                          ) : (
                            <div className="rounded-full bg-blue-100 p-1.5 text-blue-600">
                              <Mail className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900">
                            {event.event.charAt(0).toUpperCase() + event.event.slice(1)}
                            {event.event === "click" ? "ed" : ""}
                          </p>
                          <p className="mt-0.5 truncate text-sm text-slate-500">
                            {event.subject || "No Subject"}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {format(new Date(event.date), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preferences & Segmentation */}
          {(brevoActivity?.contact?.attributes || enrichment) && (
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Segmentation & Preferences
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  User preferences and classification from Database & CRM
                </p>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
                  {Object.entries({
                    "DB Industries": enrichment?.industries?.filter((i: any) => i.industry)?.length ? enrichment.industries.filter((i: any) => i.industry).map((i: any) => `${i.industry}${i.sub_industry ? ` (${i.sub_industry})` : ''}`).join(', ') : null,
                    "DB Communities": enrichment?.communities?.filter((c: any) => c.community)?.length ? enrichment.communities.filter((c: any) => c.community).map((c: any) => `${c.community}${c.sub_community ? ` (${c.sub_community})` : ''}`).join(', ') : null,
                    "CRM Community": brevoActivity?.contact?.attributes?.COMMUNITY,
                    "CRM Industry": brevoActivity?.contact?.attributes?.INDUSTRY,
                    "Preferred Formats": enrichment?.preferred_formats?.length ? enrichment.preferred_formats.join(', ') : brevoActivity?.contact?.attributes?.PREFERENCE,
                    "Email Frequency": enrichment?.preferred_frequency || brevoActivity?.contact?.attributes?.FREQUENCY,
                  }).map(([key, value]) => {
                    if (!value) return null;
                    return (
                      <div key={key}>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                          {key}
                        </p>
                        <p className="text-sm font-medium text-slate-900">
                          {String(value)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                System Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Onboarding Status</p>
                <Badge
                  variant="outline"
                  className={
                    user.onboarding_completed
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }
                >
                  {user.onboarding_completed ? "Completed" : "Pending"}
                </Badge>
              </div>
              
              <div>
                <p className="text-xs text-slate-500 mb-1">Acquisition Source</p>
                <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-700">
                  {user.source || "Unknown"}
                </Badge>
              </div>

              {user.utm_campaign && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">UTM Campaign</p>
                  <p className="text-sm font-medium text-slate-900 break-all">
                    {user.utm_campaign}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Brevo Campaign Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!brevoActivity ? (
                <p className="text-sm text-slate-500">Brevo analytics not available.</p>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-500">Delivered</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">
                        {metrics?.delivered || 0}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-500">Bounced</p>
                      <p className="mt-1 text-2xl font-semibold text-red-600">
                        {metrics?.bounced || 0}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium text-slate-700">Open Rate</span>
                        <span className="font-semibold text-slate-900">{metrics?.openRate || 0}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${Math.min(100, metrics?.openRate || 0)}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {metrics?.opened || 0} unique opens
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium text-slate-700">Click Rate</span>
                        <span className="font-semibold text-slate-900">{metrics?.clickRate || 0}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${Math.min(100, metrics?.clickRate || 0)}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {metrics?.clicked || 0} unique clicks
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
