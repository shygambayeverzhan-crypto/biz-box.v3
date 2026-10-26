import type { AppState } from '../types';
import { isWorkspaceState } from './cloudWorkspace.ts';

interface LocalStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface WorkspaceRecovery {
  version: 1;
  userId: string;
  // Undefined only when recovering an older cache with no known cloud revision.
  baseRevision?: string | null;
  state: AppState;
  attempted?: AppState;
  commitUncertain?: string;
  synced?: boolean;
}

const keyFor = (userId: string) => `bizbox_recovery_v3_${userId}`;
const checkpointKeyFor = (userId: string) => `bizbox_checkpoint_v3_${userId}`;
const legacyKeyFor = (userId: string) => `bizbox_cache_v2_${userId}`;
const localStore = (): LocalStorageLike | null => {
  try { return globalThis.localStorage; } catch { return null; }
};

/** Plan is derived from verified billing/access, never trusted from a local copy. */
export function sameWorkspaceState(left: AppState | null, right: AppState | null): boolean {
  const canonical = (state: AppState | null) => JSON.stringify(state?.user ? { ...state, user: { ...state.user, plan: 'free' } } : state, (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(Object.keys(value).sort().map(name => [name, value[name]]));
    }
    return value;
  });
  return left === right || canonical(left) === canonical(right);
}

export function readWorkspaceRecovery(userId: string, storage = localStore()): WorkspaceRecovery | null {
  if (!storage || !/^\d+$/.test(userId)) return null;
  try {
    const raw = storage.getItem(keyFor(userId));
    if (raw) {
      const value = JSON.parse(raw);
      if (value?.version === 1 && value.userId === userId && isWorkspaceState(value.state)
        && (value.baseRevision === undefined || value.baseRevision === null || typeof value.baseRevision === 'string')
        && (value.attempted === undefined || isWorkspaceState(value.attempted))
        && (value.commitUncertain === undefined || typeof value.commitUncertain === 'string')
        && (value.synced === undefined || typeof value.synced === 'boolean')) return value;
      return null;
    }
    // Earlier releases wrote this account-scoped copy but never read it back.
    const cached = JSON.parse(storage.getItem(legacyKeyFor(userId)) || 'null');
    if (isWorkspaceState(cached)) return { version: 1, userId, state: cached };
    const checkpoint = JSON.parse(storage.getItem(checkpointKeyFor(userId)) || 'null');
    if (checkpoint?.version === 1 && checkpoint.userId === userId && checkpoint.synced === true
      && (checkpoint.baseRevision === null || typeof checkpoint.baseRevision === 'string') && isWorkspaceState(checkpoint.state)) return checkpoint;
  } catch { /* Browser storage is optional; cloud loading still works. */ }
  return null;
}

export function writeWorkspaceCheckpoint(userId: string, state: AppState, revision: string | null, storage = localStore()): void {
  if (!storage || !/^\d+$/.test(userId) || !isWorkspaceState(state)) return;
  try { storage.setItem(checkpointKeyFor(userId), JSON.stringify({ version: 1, userId, baseRevision: revision, state, synced: true })); } catch { /* Pending recovery remains independent from the optional offline cache. */ }
}

export function archiveWorkspaceVersion(userId: string, state: AppState, revision: string | null, storage = localStore()): boolean {
  if (!storage || !/^\d+$/.test(userId)) return false;
  try {
    const key = `bizbox_conflict_backup_v3_${userId}_${Date.now()}_${globalThis.crypto.randomUUID()}`;
    const raw = JSON.stringify({ userId, revision, savedAt: new Date().toISOString(), state });
    storage.setItem(key, raw);
    return storage.getItem(key) === raw;
  } catch { return false; }
}

export function writeWorkspaceRecovery(value: WorkspaceRecovery, storage = localStore()): boolean {
  if (!storage || !/^\d+$/.test(value.userId) || !isWorkspaceState(value.state)) return false;
  try {
    const raw = JSON.stringify(value);
    storage.setItem(keyFor(value.userId), raw);
    // A successful, readable write is required before disabling the close warning.
    return storage.getItem(keyFor(value.userId)) === raw;
  } catch { return false; }
}

export function clearWorkspaceRecovery(userId: string, storage = localStore()): void {
  if (!storage) return;
  try {
    storage.removeItem(keyFor(userId));
    storage.removeItem(legacyKeyFor(userId));
  } catch { /* A stale copy is compared with the cloud before it can be replayed. */ }
}

/** Only replay local edits against their base, or our own acknowledged snapshot. */
export function reconcileWorkspaceRecovery(recovery: WorkspaceRecovery, cloud: { state: AppState | null; revision: string | null }): 'saved' | 'resume' | 'conflict' | 'waiting' {
  // The original request may still land after this read. An unchanged base is
  // not proof that it failed, and must never authorize a newer manifest write.
  if (recovery.commitUncertain && cloud.revision !== recovery.commitUncertain) return 'waiting';
  if (recovery.synced) return 'saved';
  if (sameWorkspaceState(recovery.state, cloud.state)) return 'saved';
  if (recovery.baseRevision !== undefined && recovery.baseRevision === cloud.revision) return 'resume';
  if (recovery.attempted && sameWorkspaceState(recovery.attempted, cloud.state)) return 'resume';
  return 'conflict';
}
