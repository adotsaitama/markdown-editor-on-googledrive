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
  /** Parent folder ids (needed to locate the sibling `images/` folder). */
  parents?: string[];
}

export interface DriveChild {
  id: string;
  name: string;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";
const META_FIELDS = "id,name,mimeType,modifiedTime,parents";

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
  const url = `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(fileId)}?fields=${META_FIELDS}`;
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
  const url = `${DRIVE_UPLOAD_ENDPOINT}/${encodeURIComponent(fileId)}?uploadType=media&fields=${META_FIELDS}`;
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

/**
 * Find a direct child of `parentId` by exact name (optionally by MIME type).
 * NOTE: with the drive.file scope this only sees files this app created or
 * opened — externally created files/folders are invisible.
 */
export async function findChildByName(
  parentId: string,
  name: string,
  accessToken: string,
  mimeType?: string,
): Promise<DriveChild | null> {
  const escaped = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  let q = `'${parentId}' in parents and name = '${escaped}' and trashed = false`;
  if (mimeType) q += ` and mimeType = '${mimeType}'`;
  const url = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`;
  const res = await fetch(url, { headers: authHeaders(accessToken) });
  if (!res.ok) throw await toApiError(res);
  const body = (await res.json()) as { files?: DriveChild[] };
  return body.files?.[0] ?? null;
}

/** Find the `images` sibling folder of the given parent. */
export function findImagesFolder(parentId: string, accessToken: string) {
  return findChildByName(parentId, "images", accessToken, FOLDER_MIME);
}

/** Create a folder under `parentId`. */
export async function createFolder(
  parentId: string,
  name: string,
  accessToken: string,
): Promise<DriveChild> {
  const res = await fetch(`${DRIVE_FILES_ENDPOINT}?fields=id,name`, {
    method: "POST",
    headers: { ...authHeaders(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as DriveChild;
}

/** Upload a binary file (e.g. a pasted image) into a folder via multipart upload. */
export async function uploadBinaryFile(
  parentId: string,
  name: string,
  blob: Blob,
  accessToken: string,
): Promise<DriveChild> {
  const boundary = `md-editor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const metadata = { name, parents: [parentId] };
  const body = new Blob(
    [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\nContent-Type: ${blob.type || "application/octet-stream"}\r\n\r\n`,
      blob,
      `\r\n--${boundary}--`,
    ],
    { type: `multipart/related; boundary=${boundary}` },
  );
  const res = await fetch(`${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart&fields=id,name`, {
    method: "POST",
    headers: {
      ...authHeaders(accessToken),
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as DriveChild;
}

/** Fetch a file's binary content (for resolving image previews). */
export async function fetchDriveFileBlob(fileId: string, accessToken: string): Promise<Blob> {
  const url = `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(fileId)}?alt=media`;
  const res = await fetch(url, { headers: authHeaders(accessToken) });
  if (!res.ok) throw await toApiError(res);
  return res.blob();
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
