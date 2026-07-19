// Parses the `state` parameter that Google Drive appends when launching an app
// via "Open with" (Drive UI Integration).
//
// The `state` value is a URL-encoded JSON string, e.g.:
//   ?state=%7B%22ids%22%3A%5B%22FILE_ID%22%5D%2C%22action%22%3A%22open%22%2C%22userId%22%3A%22...%22%7D
// which decodes to:
//   { "ids": ["FILE_ID"], "action": "open", "userId": "..." }
//
// Reference: https://developers.google.com/drive/api/guides/integrate-open

export interface DriveState {
  ids: string[];
  action: string;
  userId?: string;
  /** Present for the "create" action; unused in Phase 1. */
  folderId?: string;
}

/**
 * Parse and validate the raw `state` query string (e.g. `window.location.search`).
 * Returns the parsed state object, or `null` if absent or malformed.
 */
export function parseDriveState(search: string): DriveState | null {
  const params = new URLSearchParams(search);
  const raw = params.get("state");
  if (!raw) return null;

  let parsed: unknown;
  try {
    // URLSearchParams already percent-decodes the value; JSON.parse the result.
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("action" in parsed) ||
    !("ids" in parsed)
  ) {
    return null;
  }

  const candidate = parsed as Record<string, unknown>;
  if (typeof candidate.action !== "string") return null;
  if (!Array.isArray(candidate.ids)) return null;

  return {
    ids: candidate.ids.filter((id): id is string => typeof id === "string"),
    action: candidate.action,
    userId: typeof candidate.userId === "string" ? candidate.userId : undefined,
    folderId: typeof candidate.folderId === "string" ? candidate.folderId : undefined,
  };
}

/**
 * Extract the first file ID from an "open" launch.
 * Returns `null` unless the launch is a well-formed `action: "open"` with at least one id.
 */
export function extractOpenFileId(search: string): string | null {
  const state = parseDriveState(search);
  if (!state) return null;
  if (state.action !== "open") return null;
  if (state.ids.length === 0) return null;
  return state.ids[0];
}
