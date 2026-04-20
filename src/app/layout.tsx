import type { Metadata } from "next";
import { CSPostHogProvider } from "@/providers/PostHogProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ENERGDIVE Admin",
  description: "ENERGDIVE Admin Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <CSPostHogProvider>{children}</CSPostHogProvider>
      </body>
    </html>
  );
}
