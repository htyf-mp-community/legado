import { restoreBackup, type BackupPayload } from '../data/backup';
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
  legacyFiles?: string[];
  warnings?: string[];
};
/** Activate an isolated media root before the rollback-protected storage merge. Old files remain intact. */
export async function restoreBackupPreview(
  preview: BackupPreview,
  ignore: Partial<RestoreIgnore> = loadRestoreIgnore(),
) {
  const plan = preview.mediaPlan;
  if (plan?.committed || plan?.discarded || plan?.restoring)
    throw new Error('备份恢复会话已结束或正在进行');
  if (plan) plan.restoring = true;
  try {
    if (plan) await activateLegacyMedia(plan, ignore.readConfig ? ['bg'] : []);
    const result = restoreBackup(preview.raw, undefined, undefined, ignore);
    if (plan) await commitLegacyMedia(plan);
    return result;
  } catch (error) {
    if (plan) {
      plan.restoring = false;
      await discardLegacyMedia(plan);
    }
    throw error;
  } finally {
    if (plan) plan.restoring = false;
  }
}
