import { useQuery } from "@tanstack/react-query";
import {
  DriveApiError,
  fetchDriveFileContent,
  fetchDriveFileMeta,
  type DriveFileMeta,
} from "../lib/driveApi";

export interface DriveFile {
  meta: DriveFileMeta;
  content: string;
}

/** Auth/permission errors that should not be retried. */
const NON_RETRYABLE = new Set([401, 403, 404]);

/**
 * Fetch a Drive file's metadata + text content via TanStack Query.
 * Disabled until both `fileId` and `accessToken` are available.
 */
export function useDriveFile(fileId: string | null, accessToken: string | null) {
  return useQuery<DriveFile, Error>({
    queryKey: ["driveFile", fileId, accessToken],
    enabled: Boolean(fileId) && Boolean(accessToken),
    queryFn: async ({ signal }) => {
      // Non-null: `enabled` guarantees both are present when queryFn runs.
      const id = fileId as string;
      const token = accessToken as string;
      const [meta, content] = await Promise.all([
        fetchDriveFileMeta(id, token, signal),
        fetchDriveFileContent(id, token, signal),
      ]);
      return { meta, content };
    },
    retry: (failureCount, error) => {
      if (error instanceof DriveApiError && NON_RETRYABLE.has(error.status)) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 30_000,
  });
}
