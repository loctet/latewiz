export type CampaignStoreData = {
  campaigns: unknown[];
};

/** Multi-user campaigns are stored in the local SQLite database. */
export function getScheduledCampaignStorageMode(): "sqlite" {
  return "sqlite";
}

export function getScheduledCampaignStorageError(): string | null {
  return null;
}

/** @deprecated Legacy Redis/FS store removed — campaigns live in SQLite. */
export async function readCampaignStore(): Promise<CampaignStoreData> {
  throw new Error(
    "readCampaignStore is deprecated. Use scheduled-campaign-store SQLite APIs."
  );
}

/** @deprecated Legacy Redis/FS store removed — campaigns live in SQLite. */
export async function writeCampaignStore(
  _store: CampaignStoreData
): Promise<void> {
  throw new Error(
    "writeCampaignStore is deprecated. Use scheduled-campaign-store SQLite APIs."
  );
}
