import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateDriveFileContent, type DriveFileMeta } from "../lib/driveApi";
import type { DriveFile } from "./useDriveFile";

/**
 * Save (overwrite) a Drive file's content via TanStack Query mutation.
 * On success the cached `driveFile` query is updated in place so the
 * saved content becomes the new baseline for dirty-state comparison.
 */
export function useSaveDriveFile(fileId: string | null, accessToken: string | null) {
  const queryClient = useQueryClient();

  return useMutation<DriveFileMeta, Error, string>({
    mutationFn: (content) => {
      if (!fileId || !accessToken) {
        return Promise.reject(new Error("Not ready to save (missing file id or token)."));
      }
      return updateDriveFileContent(fileId, accessToken, content);
    },
    onSuccess: (meta, content) => {
      queryClient.setQueryData<DriveFile>(["driveFile", fileId, accessToken], (prev) =>
        prev ? { meta, content } : prev,
      );
    },
  });
}
