/**
 * Dev helper: queue one standalone explainer render for a user, from post
 * text, the same way POST /api/ai/explainer does. Then run the worker.
 *
 *   npx tsx --conditions=react-server scripts/queue-test-explainer.ts <userId> "<post text>" [seconds]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { randomUUID } from "crypto";
import { generateExplainerScript } from "@/lib/openai/explainer-script";
import { STANDALONE_RENDER_CAMPAIGN_ID } from "@/lib/render-jobs";
import { enqueueRenderJob } from "@/lib/server/render-jobs";
import { getUserSecret } from "@/lib/server/vault";
import { getActiveWorkspaceId } from "@/lib/server/workspaces";

async function main() {
  const [userId, text, seconds] = process.argv.slice(2);
  if (!userId || !text) throw new Error("Usage: <userId> \"<post text>\"");
  const apiKey = await getUserSecret(userId, "openai");
  const { script, detail } = await generateExplainerScript({
    apiKey,
    title: text.split("\n")[0].slice(0, 120),
    body: text,
    targetSeconds: seconds ? Number(seconds) : undefined,
  });
  if (detail) console.log("detail:", detail);
  console.log(JSON.stringify(script, null, 2));
  const job = await enqueueRenderJob({
    userId,
    campaignId: STANDALONE_RENDER_CAMPAIGN_ID,
    slotId: randomUUID(),
    payload: {
      template: "explainer",
      script,
      captionDigest: text.slice(0, 120),
      workspaceId: await getActiveWorkspaceId(userId),
    },
  });
  console.log("queued job", job.id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
