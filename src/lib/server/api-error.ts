export function storageErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.slice(0, 500);
  }
  return fallback;
}
