import { NextResponse } from "next/server";
import { getStorage } from "../../../../lib/storage";

export const dynamic = "force-dynamic";

/**
 * Serves generated slide images from the storage driver.
 * Public by design: the Instagram Graph API must be able to fetch these URLs
 * when publishing. Keys are unguessable (cuid-based paths).
 */
export async function GET(_req: Request, { params }: { params: { path: string[] } }) {
  const key = params.path.join("/");
  if (key.includes("..") || key.startsWith("/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  try {
    const buf = await getStorage().read(key);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type": key.endsWith(".png") ? "image/png" : "application/octet-stream",
        "cache-control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
