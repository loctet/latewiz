/** Shared env flags safe for both client and server modules. */
export function allowEnvKeyFallback(): boolean {
  return process.env.ALLOW_ENV_KEY_FALLBACK === "true";
}
