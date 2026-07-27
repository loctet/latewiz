import "server-only";

import React from "react";
import { pdf } from "@react-pdf/renderer";
import { ResearchReportDocument } from "@/lib/pdf/research-report-pdf";
import type { StructuredResearchReport } from "@/lib/pdf/structure-research-report";

export async function renderResearchReportPdf(
  report: StructuredResearchReport,
  brandName = "LateWiz"
): Promise<Buffer> {
  const doc = React.createElement(ResearchReportDocument, {
    report,
    brandName,
  });
  // react-pdf's typings expect Document; our wrapper renders Document internally
  const instance = pdf(doc as Parameters<typeof pdf>[0]);
  // Node buffer API (preferred); fall back to blob if unavailable
  const maybeBuffer = instance as {
    toBuffer?: () => Promise<NodeJS.ReadableStream | Buffer>;
    toBlob?: () => Promise<Blob>;
  };
  if (typeof maybeBuffer.toBuffer === "function") {
    const result = await maybeBuffer.toBuffer();
    if (Buffer.isBuffer(result)) return result;
    const chunks: Buffer[] = [];
    for await (const chunk of result as NodeJS.ReadableStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  const blob = await maybeBuffer.toBlob!();
  const ab = await blob.arrayBuffer();
  return Buffer.from(ab);
}
