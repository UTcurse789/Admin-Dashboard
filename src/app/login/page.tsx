"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoaderCircle, Lock } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Checking credentials...");
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setLoadingMessage("Checking credentials...");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      setLoadingMessage("Opening dashboard...");
      router.replace("/");
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Image
            src="/energdive-logo.png"
            alt="EnerDive"
            width={160}
            height={40}
            preload
            style={{ width: "auto", height: "auto" }}
            className="h-10 w-auto"
          />
        </div>

        <Card className="relative overflow-hidden shadow-lg">
          {loading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/85 backdrop-blur-sm">
              <div className="mx-6 flex w-full max-w-xs flex-col items-center rounded-2xl border border-gray-200 bg-white px-5 py-6 text-center shadow-lg">
                <div className="flex size-12 items-center justify-center rounded-full bg-gray-100">
                  <LoaderCircle className="h-6 w-6 animate-spin text-gray-700" />
                </div>
                <p className="mt-4 text-sm font-medium text-gray-900">
                  {loadingMessage}
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Preparing the admin dashboard and loading the latest data.
                </p>
              </div>
            </div>
          ) : null}

          <CardHeader className="pb-4 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-gray-100">
              <Lock className="h-5 w-5 text-gray-600" />
            </div>
            <CardTitle className="text-xl font-semibold text-gray-900">
              Admin Login
            </CardTitle>
            <p className="mt-1 text-sm text-gray-500">
              Enter your credentials to access the dashboard.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4" aria-busy={loading}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="admin@energdive.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading}
                  className="border-gray-200 bg-gray-50 focus:bg-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Password
                </label>
                <Input
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  className="border-gray-200 bg-gray-50 focus:bg-white"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 text-white hover:bg-gray-800"
              >
                {loading ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-gray-400">
          Secured access | EnerDive Admin Dashboard
        </p>
      </div>
    </div>
  );
}
