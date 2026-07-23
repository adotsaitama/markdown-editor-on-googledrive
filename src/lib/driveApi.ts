// Thin wrapper over the Google Drive REST API (v3).
// Reference: https://developers.google.com/drive/api/reference/rest/v3/files/get
// Upload:    https://developers.google.com/drive/api/guides/manage-uploads#simple

const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/drive/v3/files";

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  /** RFC 3339 timestamp of the last content modification. */
  modifiedTime?: string;
}

/** Error carrying the HTTP status so the UI can branch on 401 / 403 / 404. */
export class DriveApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "DriveApiError";
    this.status = status;
  }
}

function authHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

async function toApiError(res: Response): Promise<DriveApiError> {
  // Drive returns a JSON error body; fall back to status text if it isn't JSON.
  let detail = res.statusText;
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    if (body?.error?.message) detail = body.error.message;
  } catch {
    /* ignore non-JSON bodies */
  }
  return new DriveApiError(res.status, detail);
}

/** Fetch file metadata (name / mimeType) for display. */
export async function fetchDriveFileMeta(
  fileId: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<DriveFileMeta> {
  const url = `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(fileId)}?fields=id,name,mimeType,modifiedTime`;
  const res = await fetch(url, { headers: authHeaders(accessToken), signal });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as DriveFileMeta;
}

/**
 * Overwrite the file's content via a simple media upload (PATCH).
 * Drive keeps previous revisions automatically; metadata (name etc.) is untouched.
 */
export async function updateDriveFileContent(
  fileId: string,
  accessToken: string,
  content: string,
): Promise<DriveFileMeta> {
  const url = `${DRIVE_UPLOAD_ENDPOINT}/${encodeURIComponent(fileId)}?uploadType=media&fields=id,name,mimeType,modifiedTime`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      ...authHeaders(accessToken),
      "Content-Type": "text/markdown; charset=UTF-8",
    },
    body: content,
  });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as DriveFileMeta;
}

/** Fetch the raw file content as text via `alt=media`. */
export async function fetchDriveFileContent(
  fileId: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<string> {
  const url = `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(fileId)}?alt=media`;
  const res = await fetch(url, { headers: authHeaders(accessToken), signal });
  if (!res.ok) throw await toApiError(res);
  return res.text();
}
