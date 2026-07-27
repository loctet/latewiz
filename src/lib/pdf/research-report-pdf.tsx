import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Rect,
  Line,
} from "@react-pdf/renderer";
import type { StructuredResearchReport } from "@/lib/pdf/structure-research-report";

const colors = {
  ink: "#0B1F2A",
  muted: "#5A6B75",
  teal: "#0E4B62",
  tealSoft: "#E6F1F4",
  navy: "#0E2162",
  line: "#D5DEE3",
  paper: "#FAFCFD",
  white: "#FFFFFF",
  accent: "#1A7A8C",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.paper,
    color: colors.ink,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.45,
  },
  coverPage: {
    backgroundColor: colors.paper,
    paddingTop: 64,
    paddingBottom: 56,
    paddingHorizontal: 48,
  },
  brand: {
    fontSize: 11,
    letterSpacing: 2,
    color: colors.teal,
    textTransform: "uppercase",
    marginBottom: 28,
    fontFamily: "Helvetica-Bold",
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.tealSoft,
    color: colors.teal,
    paddingVertical: 4,
    paddingHorizontal: 10,
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 20,
    fontFamily: "Helvetica-Bold",
  },
  coverTitle: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: colors.ink,
    lineHeight: 1.25,
    marginBottom: 14,
    maxWidth: 460,
  },
  coverSubtitle: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 1.5,
    maxWidth: 420,
    marginBottom: 28,
  },
  coverMeta: {
    fontSize: 9,
    color: colors.muted,
    marginTop: 8,
  },
  coverRule: {
    marginTop: 36,
    height: 3,
    width: 72,
    backgroundColor: colors.teal,
  },
  kpiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 36,
    marginBottom: 8,
  },
  kpiCard: {
    width: "48%",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 4,
    padding: 12,
  },
  kpiLabel: {
    fontSize: 8,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
  },
  kpiValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: colors.teal,
  },
  kpiContext: {
    fontSize: 8,
    color: colors.muted,
    marginTop: 4,
  },
  sectionHeading: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: colors.navy,
    marginTop: 18,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  paragraph: {
    fontSize: 10,
    color: colors.ink,
    marginBottom: 8,
    textAlign: "justify",
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 4,
    paddingRight: 8,
  },
  bulletDot: {
    width: 12,
    fontSize: 10,
    color: colors.teal,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    color: colors.ink,
  },
  table: {
    marginBottom: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 3,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: colors.teal,
  },
  tableRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  tableRowAlt: {
    backgroundColor: colors.tealSoft,
  },
  tableCell: {
    flex: 1,
    padding: 6,
    fontSize: 8,
    color: colors.ink,
  },
  tableHeaderCell: {
    flex: 1,
    padding: 6,
    fontSize: 8,
    color: colors.white,
    fontFamily: "Helvetica-Bold",
  },
  chartWrap: {
    marginTop: 20,
    marginBottom: 8,
    padding: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 4,
  },
  chartTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.muted,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  footer: {
    position: "absolute",
    left: 48,
    right: 48,
    bottom: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: colors.muted,
    maxWidth: 360,
  },
  pageNumber: {
    fontSize: 8,
    color: colors.muted,
  },
  disclaimer: {
    marginTop: 24,
    padding: 12,
    backgroundColor: colors.tealSoft,
    borderRadius: 4,
    fontSize: 8,
    color: colors.muted,
    lineHeight: 1.4,
  },
});

function parseNumericWeight(value: string): number | null {
  const cleaned = value.replace(/,/g, "");
  const pct = cleaned.match(/(-?\d+(?:\.\d+)?)\s*%/);
  if (pct) return Math.abs(parseFloat(pct[1]));
  const num = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!num) return null;
  let n = Math.abs(parseFloat(num[0]));
  if (/bn|billion/i.test(cleaned)) n *= 1000;
  if (/trillion|tn/i.test(cleaned)) n *= 1_000_000;
  return n;
}

function MetricsBarChart({
  metrics,
}: {
  metrics: { label: string; value: string }[];
}) {
  const weights = metrics.map((m) => parseNumericWeight(m.value));
  if (weights.every((w) => w == null)) return null;
  const nums = weights.map((w, i) => w ?? (i + 1) * 10);
  const max = Math.max(...nums, 1);
  const width = 480;
  const barH = 14;
  const gap = 10;
  const height = metrics.length * (barH + gap) + 8;

  return (
    <View style={styles.chartWrap} wrap={false}>
      <Text style={styles.chartTitle}>Key metrics snapshot</Text>
      <Svg width={width} height={height}>
        {metrics.map((m, i) => {
          const w = Math.max(8, (nums[i] / max) * (width - 140));
          const y = i * (barH + gap);
          return (
            <Rect
              key={`${m.label}-${i}`}
              x={0}
              y={y}
              width={w}
              height={barH}
              fill={colors.accent}
              rx={2}
            />
          );
        })}
        <Line
          x1={0}
          y1={height - 2}
          x2={width - 120}
          y2={height - 2}
          stroke={colors.line}
          strokeWidth={1}
        />
      </Svg>
      <View style={{ marginTop: 4 }}>
        {metrics.map((m, i) => (
          <View
            key={`lbl-${i}`}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 3,
            }}
          >
            <Text style={{ fontSize: 8, color: colors.ink, maxWidth: 280 }}>
              {m.label}
            </Text>
            <Text
              style={{
                fontSize: 8,
                fontFamily: "Helvetica-Bold",
                color: colors.teal,
              }}
            >
              {m.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TableBlock({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  const colCount = Math.max(headers.length, 1);
  return (
    <View style={styles.table} wrap={false}>
      <View style={styles.tableHeaderRow}>
        {headers.map((h, i) => (
          <Text
            key={`h-${i}`}
            style={[styles.tableHeaderCell, { flex: colCount > 4 ? 1 : 1 }]}
          >
            {h}
          </Text>
        ))}
      </View>
      {rows.slice(0, 24).map((row, ri) => (
        <View
          key={`r-${ri}`}
          style={[styles.tableRow, ri % 2 === 1 ? styles.tableRowAlt : {}]}
        >
          {Array.from({ length: colCount }).map((_, ci) => (
            <Text key={`c-${ri}-${ci}`} style={styles.tableCell}>
              {row[ci] ?? ""}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function Footer({ disclaimer }: { disclaimer?: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        {(disclaimer || "Informational only — not investment advice.").slice(
          0,
          120
        )}
      </Text>
      <Text
        style={styles.pageNumber}
        render={({ pageNumber, totalPages }) =>
          `${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}

export function ResearchReportDocument({
  report,
  brandName,
}: {
  report: StructuredResearchReport;
  brandName: string;
}) {
  const dateLabel = new Date(report.generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Document
      title={report.title}
      author={brandName}
      subject="Deep Research Report"
    >
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.brand}>{brandName}</Text>
        <Text style={styles.badge}>Deep Research Report</Text>
        <Text style={styles.coverTitle}>{report.title}</Text>
        {report.subtitle ? (
          <Text style={styles.coverSubtitle}>{report.subtitle}</Text>
        ) : null}
        <Text style={styles.coverMeta}>{dateLabel}</Text>
        <View style={styles.coverRule} />

        {report.keyMetrics.length > 0 ? (
          <View style={styles.kpiRow}>
            {report.keyMetrics.slice(0, 4).map((m, i) => (
              <View key={`kpi-${i}`} style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>{m.label}</Text>
                <Text style={styles.kpiValue}>{m.value}</Text>
                {m.context ? (
                  <Text style={styles.kpiContext}>{m.context}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {report.keyMetrics.length >= 2 ? (
          <MetricsBarChart metrics={report.keyMetrics.slice(0, 5)} />
        ) : null}

        <Footer disclaimer={report.disclaimer} />
      </Page>

      <Page size="A4" style={styles.page} wrap>
        {report.sections.map((section, si) => (
          <View key={`sec-${si}`} wrap>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            {section.blocks.map((block, bi) => {
              if (block.type === "paragraph") {
                return (
                  <Text key={`b-${si}-${bi}`} style={styles.paragraph}>
                    {block.text}
                  </Text>
                );
              }
              if (block.type === "bullets") {
                return (
                  <View key={`b-${si}-${bi}`} style={{ marginBottom: 8 }}>
                    {block.items.map((item, ii) => (
                      <View key={`bu-${ii}`} style={styles.bulletRow}>
                        <Text style={styles.bulletDot}>•</Text>
                        <Text style={styles.bulletText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                );
              }
              return (
                <TableBlock
                  key={`b-${si}-${bi}`}
                  headers={block.headers}
                  rows={block.rows}
                />
              );
            })}
          </View>
        ))}

        {report.disclaimer ? (
          <Text style={styles.disclaimer}>{report.disclaimer}</Text>
        ) : null}

        <Footer disclaimer={report.disclaimer} />
      </Page>
    </Document>
  );
}
