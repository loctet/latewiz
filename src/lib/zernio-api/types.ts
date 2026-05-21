import type { Platform } from "@/lib/late-api";

export interface ZernioCommentAuthor {
  id?: string;
  name?: string;
  username?: string;
}

export interface InboxComment {
  id: string;
  message?: string;
  text?: string;
  from?: ZernioCommentAuthor;
  createdAt?: string;
  timestamp?: string;
  parentId?: string | null;
  parentCommentId?: string | null;
  isHidden?: boolean;
  hasReply?: boolean;
  likeCount?: number;
  replies?: InboxComment[];
}

export interface CommentedPost {
  id: string;
  accountId: string;
  platform: Platform | string;
  content?: string;
  caption?: string;
  message?: string;
  commentCount?: number;
  commentsCount?: number;
  unrepliedCount?: number;
  platformPostId?: string;
  platformPostUrl?: string;
  postUrl?: string;
  thumbnailUrl?: string;
  mediaUrl?: string;
  createdAt?: string;
  isAd?: boolean;
  adId?: string;
  placement?: string;
}

export interface ListCommentedPostsResponse {
  data?: CommentedPost[];
  posts?: CommentedPost[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

export interface GetPostCommentsResponse {
  comments?: InboxComment[];
  meta?: {
    platform?: string;
    accountId?: string;
    postId?: string;
  };
  pagination?: {
    cursor?: string;
    hasMore?: boolean;
  };
}

export interface ReplyToCommentInput {
  accountId: string;
  message: string;
  commentId?: string;
}

export interface CommentAutomation {
  _id: string;
  name: string;
  profileId: string;
  accountId: string;
  platform: string;
  platformPostId?: string;
  keywords?: string[];
  dmMessage?: string;
  commentReply?: string;
  isActive?: boolean;
  stats?: {
    triggered?: number;
    sent?: number;
  };
}

export interface CreateCommentAutomationInput {
  profileId: string;
  accountId: string;
  name: string;
  platformPostId?: string;
  keywords?: string[];
  dmMessage?: string;
  commentReply?: string;
  isActive?: boolean;
}
