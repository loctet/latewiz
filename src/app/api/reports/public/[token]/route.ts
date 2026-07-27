import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { getGeneratedReportByPublicToken } from "@/lib/server/generated-report-files";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const found = await getGeneratedReportByPublicToken(token);
    if (!found) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const buffer = await fs.readFile(found.absolutePath);
    const safeName =
      found.entry.filename.replace(/[^\w.\-]+/g, "_") || "report.pdf";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "public, max-age=86400, immutable",
        "Content-Disposition": `inline; filename="${safeName}"`,
      },
    });
  } catch (err) {
    console.error("Serve public report error:", err);
    return NextResponse.json(
      { error: "Failed to load report" },
      { status: 500 }
    );
  }
}
