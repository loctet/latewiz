/** Zernio post statuses — @see https://docs.zernio.com/ */
export const POST_STATUSES = [
  "draft",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "partial",
  "cancelled",
] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

export function isPostStatus(value: string): value is PostStatus {
  return (POST_STATUSES as readonly string[]).includes(value);
}

export type PostStatusBadgeConfig = {
  variant: "default" | "secondary" | "destructive" | "outline";
  label: string;
  className?: string;
};

const POST_STATUS_BADGE: Record<PostStatus, PostStatusBadgeConfig> = {
  draft: { variant: "outline", label: "Draft" },
  scheduled: {
    variant: "secondary",
    label: "Scheduled",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  publishing: {
    variant: "secondary",
    label: "Publishing",
    className:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  },
  published: {
    variant: "secondary",
    label: "Published",
    className:
      "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  failed: { variant: "destructive", label: "Failed" },
  partial: {
    variant: "secondary",
    label: "Partial",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  cancelled: { variant: "outline", label: "Cancelled" },
};

export function getPostStatusBadgeConfig(status: string): PostStatusBadgeConfig {
  if (isPostStatus(status)) {
    return POST_STATUS_BADGE[status];
  }
  const label = status
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { variant: "outline", label: label || "Unknown" };
}

export function getPostStatusCalendarClass(status: string): string {
  switch (status) {
    case "scheduled":
      return "bg-blue-50 dark:bg-blue-950/30 border-l-2 border-l-blue-500 hover:bg-blue-100 dark:hover:bg-blue-950/50";
    case "published":
      return "bg-green-50 dark:bg-green-950/30 border-l-2 border-l-green-500 hover:bg-green-100 dark:hover:bg-green-950/50";
    case "failed":
      return "bg-red-50 dark:bg-red-950/30 border-l-2 border-l-red-500 hover:bg-red-100 dark:hover:bg-red-950/50";
    case "publishing":
      return "bg-yellow-50 dark:bg-yellow-950/30 border-l-2 border-l-yellow-500";
    case "partial":
      return "bg-amber-50 dark:bg-amber-950/30 border-l-2 border-l-amber-500 hover:bg-amber-100 dark:hover:bg-amber-950/50";
    case "cancelled":
      return "bg-muted border-l-2 border-l-muted-foreground/40 hover:bg-muted/80";
    default:
      return "bg-muted hover:bg-muted/80";
  }
}
