import { useCallback, useRef } from "react";
import {
  createFolder,
  fetchDriveFileBlob,
  findChildByName,
  findImagesFolder,
  uploadBinaryFile,
  type DriveFileMeta,
} from "../lib/driveApi";

const IMAGES_DIR = "images";

/** `images/foo.png` -> relative reference this hook manages. */
function isManagedSrc(src: string): boolean {
  return src.startsWith(`${IMAGES_DIR}/`);
}

/**
 * Upload pasted images into an `images/` folder beside the Markdown file and
 * resolve `images/...` relative references to blob URLs for the preview.
 *
 * Design notes (drive.file scope): the app can only see files it created or
 * opened, so an `images` folder created by other tools is invisible here —
 * such references simply fail to resolve in this app's preview (they still
 * work in local viewers after sync). The folder id and resolved blob URLs
 * are cached per session.
 */
export function useDriveImages(meta: DriveFileMeta | undefined, accessToken: string | null) {
  const folderIdRef = useRef<string | null>(null);
  const urlCacheRef = useRef(new Map<string, string>());
  const seqRef = useRef(0);

  const getImagesFolder = useCallback(
    async (createIfMissing: boolean): Promise<string | null> => {
      if (folderIdRef.current) return folderIdRef.current;
      const parentId = meta?.parents?.[0];
      if (!parentId || !accessToken) return null;
      let folder = await findImagesFolder(parentId, accessToken);
      if (!folder && createIfMissing) {
        folder = await createFolder(parentId, IMAGES_DIR, accessToken);
      }
      if (!folder) return null;
      folderIdRef.current = folder.id;
      return folder.id;
    },
    [meta?.parents, accessToken],
  );

  /** Upload a pasted image; returns the relative Markdown path (`images/...`). */
  const uploadImage = useCallback(
    async (blob: Blob): Promise<string> => {
      if (!accessToken) throw new Error("認証されていません。");
      const folderId = await getImagesFolder(true);
      if (!folderId) throw new Error("親フォルダを特定できませんでした。");

      const ext = (blob.type.split("/")[1] ?? "png").replace("jpeg", "jpg");
      const stamp = new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\..+/, "")
        .replace("T", "-");
      const name = `img-${stamp}-${++seqRef.current}.${ext}`;
      const created = await uploadBinaryFile(folderId, name, blob, accessToken);
      return `${IMAGES_DIR}/${created.name}`;
    },
    [accessToken, getImagesFolder],
  );

  /**
   * Resolve a relative `images/...` src to a blob URL, or null when it cannot
   * be resolved (external URLs are returned untouched by the caller).
   */
  const resolveImage = useCallback(
    async (src: string): Promise<string | null> => {
      if (!isManagedSrc(src) || !accessToken) return null;
      const cached = urlCacheRef.current.get(src);
      if (cached) return cached;

      const folderId = await getImagesFolder(false);
      if (!folderId) return null;
      const name = decodeURIComponent(src.slice(IMAGES_DIR.length + 1));
      const child = await findChildByName(folderId, name, accessToken);
      if (!child) return null;
      const blob = await fetchDriveFileBlob(child.id, accessToken);
      const url = URL.createObjectURL(blob);
      urlCacheRef.current.set(src, url);
      return url;
    },
    [accessToken, getImagesFolder],
  );

  return { uploadImage, resolveImage };
}
