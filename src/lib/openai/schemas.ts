export const DRAFT_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    body: { type: "string" },
    hashtags: { type: "string" },
  },
  required: ["title", "body", "hashtags"],
  additionalProperties: false,
} as const;

export const CAMPAIGN_POST_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    body: { type: "string" },
    hashtags: { type: "string" },
  },
  required: ["title", "body", "hashtags"],
  additionalProperties: false,
} as const;

export const CAMPAIGN_BATCH_JSON_SCHEMA = {
  type: "object",
  properties: {
    posts: {
      type: "array",
      items: CAMPAIGN_POST_JSON_SCHEMA,
    },
  },
  required: ["posts"],
  additionalProperties: false,
} as const;
