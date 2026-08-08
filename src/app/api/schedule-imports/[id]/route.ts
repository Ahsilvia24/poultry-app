import { readFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getScheduleImport } from "@/lib/schedule-imports";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const found = await getScheduleImport(id);
  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const bytes = await readFile(found.absolutePath);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": found.meta.mimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${found.meta.originalName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
