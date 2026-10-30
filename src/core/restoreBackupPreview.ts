import { restoreBackup, type BackupPayload } from '../data/backup';
import {
  restoreLegacyBackup,
  LegacyRestoreError,
  type LegacyRestoreResult,
  type LegacyRestoreWarning,
} from '../data/legacyRestore';
import { addAppLog } from '../data/appLog';
import {
  loadRestoreIgnore,
  type RestoreIgnore,
} from '../data/restorePreferences';
import {
  activateLegacyMedia,
  commitLegacyMedia,
  discardLegacyMedia,
  type LegacyMediaPlan,
} from './legacyBackupArchive';
export type BackupPreview = {
  raw: string;
  payload: BackupPayload;
  mediaPlan?: LegacyMediaPlan;
  /** Set only by native ZIP inspection; serialized HTYF payload fields never select this policy. */
  legacyFiles?: string[];
  warnings?: string[];
};
function logNativeWarnings(warnings: LegacyRestoreWarning[]) {
  for (const warning of warnings) {
    try {
      addAppLog(`旧版备份恢复：${warning.key}`, warning.error);
    } catch {
      /* Diagnostic storage failure must not replace the native restore outcome. */
    }
  }
}
/**
 * Apply a user-confirmed preview with one media-session owner.
 * Native failures may retain earlier committed data and throw LegacyRestoreError; unused
 * media staging is discarded. HTYF backups keep their existing rollback-protected merge.
 */
export async function restoreBackupPreview(
  preview: BackupPreview,
  ignore: Partial<RestoreIgnore> = loadRestoreIgnore(),
) {
  const plan = preview.mediaPlan;
  if (plan?.committed || plan?.discarded || plan?.restoring)
    throw new Error('备份恢复会话已结束或正在进行');
  if (plan) plan.restoring = true;
  let nativeResult: LegacyRestoreResult | undefined;
  try {
    if (preview.legacyFiles) {
      nativeResult = await restoreLegacyBackup(
        preview.raw,
        undefined,
        ignore,
        async () => {
          if (plan) {
            await activateLegacyMedia(plan, ignore.readConfig ? ['bg'] : []);
            await commitLegacyMedia(plan);
          }
        },
      );
      logNativeWarnings(nativeResult.warnings);
      return nativeResult.payload;
    }
    if (plan) await activateLegacyMedia(plan, ignore.readConfig ? ['bg'] : []);
    const result = restoreBackup(preview.raw, undefined, undefined, ignore);
    if (plan) await commitLegacyMedia(plan);
    return result;
  } catch (error) {
    // Logging must not replace the native outcome or hide which units already committed.
    const failure =
      preview.legacyFiles && !(error instanceof LegacyRestoreError)
        ? new LegacyRestoreError(
            error,
            nativeResult?.committedKeys ?? [],
            nativeResult?.warnings ?? [],
          )
        : error;
    if (failure instanceof LegacyRestoreError)
      logNativeWarnings(failure.warnings);
    if (plan) {
      plan.restoring = false;
      await discardLegacyMedia(plan);
    }
    throw failure;
  } finally {
    if (plan) plan.restoring = false;
  }
}
