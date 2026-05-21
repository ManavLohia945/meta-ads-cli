import { NextRequest, NextResponse } from "next/server";

// Token is read from process.env[SLUG_TOKEN] — never exposed to the client.
// e.g. for slug "akshay-paliwal", reads AKSHAY_PALIWAL_TOKEN.
function getToken(slug: string): string | null {
  const key = slug.toUpperCase().replace(/-/g, "_") + "_TOKEN";
  return process.env[key] ?? null;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const token = getToken(slug);
  if (!token) {
    return NextResponse.json({ error: "token_not_configured" }, { status: 401 });
  }

  // Placeholder — full sync logic will call Meta API and return today's DailyEntry.
  // For now returns a 501 so the Sync Now button can be wired up without crashing.
  return NextResponse.json(
    { error: "sync_not_implemented" },
    { status: 501 }
  );
}
