import type { InboxComment } from "@/lib/zernio-api";

export function getCommentText(comment: InboxComment): string {
  return (comment.message ?? comment.text ?? "").trim();
}

export function getCommenterId(comment: InboxComment): string | undefined {
  return comment.from?.id ?? comment.from?.username;
}

export function isTopLevelComment(comment: InboxComment): boolean {
  const parent = comment.parentId ?? comment.parentCommentId;
  return !parent;
}

/** Flatten nested replies into a single list */
export function flattenComments(comments: InboxComment[]): InboxComment[] {
  const out: InboxComment[] = [];
  const walk = (items: InboxComment[]) => {
    for (const c of items) {
      out.push(c);
      if (c.replies?.length) walk(c.replies);
    }
  };
  walk(comments);
  return out;
}

export function matchesKeywords(text: string, keywords: string[]): boolean {
  if (!keywords.length) return true;
  const lower = text.toLowerCase();
  return keywords.some((k) => k.trim() && lower.includes(k.trim().toLowerCase()));
}

export function formatReplyMessage(
  template: string,
  comment: InboxComment
): string {
  const author =
    comment.from?.name ??
    comment.from?.username ??
    "there";
  return template.replace(/\{\{author\}\}/gi, author);
}
