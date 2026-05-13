import { getAdByDocumentId } from "@/lib/ads";
import { notFound } from "next/navigation";
import { AdDetailClient } from "./AdDetailClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = ["bom1", "sin1"];
export const maxDuration = 30;

interface PageProps {
  params: Promise<{ documentId: string }>;
}

export default async function AdDetailPage({ params }: PageProps) {
  const { documentId } = await params;
  const ad = await getAdByDocumentId(documentId);
  if (!ad) notFound();
  return <AdDetailClient ad={ad} />;
}
