"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

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

      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <img
            src="/energdive-logo.png"
            alt="EnerDive"
            className="h-10 w-auto"
          />
        </div>

        <Card className="shadow-lg">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-gray-100">
              <Lock className="h-5 w-5 text-gray-600" />
            </div>
            <CardTitle className="text-xl font-semibold text-gray-900">
              Admin Login
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Enter your credentials to access the dashboard.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
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
                  className="bg-gray-50 border-gray-200 focus:bg-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Password
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-gray-50 border-gray-200 focus:bg-white"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 border border-red-200">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 text-white hover:bg-gray-800"
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-gray-400">
          Secured access · EnerDive Admin Dashboard
        </p>
      </div>
    </div>
  );
}
