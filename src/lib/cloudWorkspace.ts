import type { AppState } from '../types';

/** The official Telegram WebApp.CloudStorage callback API. */
export interface CloudStorage {
  getItem(key: string, callback: (error: string | null, value?: string) => void): unknown;
  getItems(keys: string[], callback: (error: string | null, values?: Record<string, string>) => void): unknown;
  setItem(key: string, value: string, callback: (error: string | null, stored?: boolean) => void): unknown;
  removeItems(keys: string[], callback: (error: string | null, removed?: boolean) => void): unknown;
}

export type WorkspaceStorageErrorCode = 'unavailable' | 'timeout' | 'commit_unknown' | 'corrupt' | 'conflict' | 'too_large' | 'invalid_state';

export class WorkspaceStorageError extends Error {
  readonly code: WorkspaceStorageErrorCode;
  readonly uncertainRevision?: string;
  constructor(code: WorkspaceStorageErrorCode, message: string, uncertainRevision?: string) {
    super(message);
    this.name = 'WorkspaceStorageError';
    this.code = code;
    this.uncertainRevision = uncertainRevision;
  }
}

export const WORKSPACE_MANIFEST_KEY = 'bizbox_workspace_v2';
export const CLOUD_STORAGE_TIMEOUT_MS = 12_000;
export const WORKSPACE_CHUNK_SIZE = 3_500;
export const WORKSPACE_MAX_CHUNKS = 48;

interface Generation { revision: string; chunks: number }
interface Manifest extends Generation {
  version: 2;
  length: number;
  sha256: string;
  previous?: Generation;
}

const conflict = () => new WorkspaceStorageError('conflict', 'Данные изменились в другом окне. Загрузите свежую версию перед сохранением.');
const corrupt = () => new WorkspaceStorageError('corrupt', 'Не удалось прочитать сохранённые данные. Они не будут заменены пустым профилем. Попробуйте ещё раз.');
const unresolved = (revision: string) => new WorkspaceStorageError('commit_unknown', 'Telegram ещё не подтвердил предыдущую отправку. Изменения сохранены отдельно; проверим облако перед следующей отправкой.', revision);
const commitOutcomes = new WeakMap<CloudStorage, Map<string, boolean>>();
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const fields = (value: Record<string, unknown>, keys: string[]) => keys.every(key => typeof value[key] === 'string');
const optionalStrings = (value: Record<string, unknown>, keys: string[]) => keys.every(key => value[key] === undefined || typeof value[key] === 'string');
const numbers = (value: Record<string, unknown>, keys: string[]) => keys.every(key => typeof value[key] === 'number' && Number.isFinite(value[key]));
const oneOf = (value: unknown, options: string[]) => typeof value === 'string' && options.includes(value);
const rows = (value: unknown, check: (row: Record<string, unknown>) => boolean) => Array.isArray(value) && value.every(item => record(item) && check(item));

/** Validate before saving and after loading so bad storage never becomes a new account. */
export function isWorkspaceState(value: unknown): value is AppState {
  if (!record(value) || typeof value.onboardingComplete !== 'boolean') return false;
  if (value.accessCode !== undefined && (typeof value.accessCode !== 'string' || value.accessCode.length > 4096)) return false;
  if (value.onboardingStep !== undefined && (!Number.isInteger(value.onboardingStep) || Number(value.onboardingStep) < 0 || Number(value.onboardingStep) > 2)) return false;
  const user = value.user;
  if (user !== null && !(record(user) && fields(user, ['name', 'email']) && oneOf(user.plan, ['free', 'business', 'pro']))) return false;
  if (record(user) && user.notificationPreferences !== undefined
    && (!record(user.notificationPreferences) || Object.entries(user.notificationPreferences).some(([key, enabled]) => !['payment', 'task', 'client', 'document', 'system'].includes(key) || typeof enabled !== 'boolean'))) return false;
  const business = value.business;
  if (business !== null && !(record(business) && fields(business, ['name', 'industry', 'city', 'employeesCount']) && Array.isArray(business.modules) && business.modules.every(item => typeof item === 'string'))) return false;
  if (value.onboardingComplete && (!record(user) || !record(business) || !Array.isArray(business.modules) || business.modules.length === 0 || !['name', 'industry', 'city', 'employeesCount'].every(key => typeof business[key] === 'string' && business[key].trim().length > 0))) return false;
  return rows(value.transactions, r => fields(r, ['id', 'category', 'description', 'date']) && numbers(r, ['amount']) && oneOf(r.type, ['income', 'expense', 'transfer']) && oneOf(r.status, ['completed', 'pending', 'failed']) && optionalStrings(r, ['account']))
    && rows(value.documents, r => fields(r, ['id', 'name', 'client', 'date', 'number']) && numbers(r, ['amount']) && oneOf(r.type, ['contract', 'invoice', 'act', 'proposal', 'template']) && oneOf(r.status, ['draft', 'signing', 'signed', 'paid']) && optionalStrings(r, ['content']))
    && rows(value.clients, r => fields(r, ['id', 'name', 'company', 'email', 'phone', 'lastActivity', 'avatarColor']) && numbers(r, ['dealValue']) && oneOf(r.status, ['active', 'potential', 'archived']) && rows(r.notes, n => fields(n, ['id', 'text', 'date'])) && rows(r.activities, a => fields(a, ['id', 'text', 'date']) && oneOf(a.type, ['call', 'meeting', 'email', 'deal', 'payment'])))
    && rows(value.tasks, r => fields(r, ['id', 'title', 'description', 'dueDate']) && typeof r.completed === 'boolean' && oneOf(r.status, ['new', 'in_progress', 'review', 'done']) && oneOf(r.priority, ['low', 'medium', 'high']) && optionalStrings(r, ['dueTime', 'assignee', 'category']))
    && rows(value.employees, r => fields(r, ['id', 'name', 'position', 'nextPayment', 'email', 'phone', 'joinDate', 'avatarColor', 'department']) && numbers(r, ['salary', 'tasksCount']) && oneOf(r.status, ['active', 'vacation', 'inactive']))
    && rows(value.notifications, r => fields(r, ['id', 'title', 'body', 'date']) && typeof r.read === 'boolean' && oneOf(r.type, ['payment', 'task', 'client', 'document', 'system']))
    && rows(value.events, r => fields(r, ['id', 'date', 'title', 'color']) && oneOf(r.type, ['task', 'payment', 'document', 'employee']))
    && rows(value.specialists, r => fields(r, ['id', 'name', 'profession', 'category', 'location', 'bio', 'avatarColor']) && numbers(r, ['rating', 'projects', 'price']))
    && rows(value.payments, r => fields(r, ['id', 'userId', 'createdAt', 'customerName', 'customerPhone']) && numbers(r, ['amount']) && oneOf(r.plan, ['business', 'pro']) && oneOf(r.status, ['awaiting_payment', 'navigated_to_kaspi', 'awaiting_confirmation', 'under_review', 'confirmed', 'rejected']));
}

export function isTransientStorageError(error: unknown): boolean {
  return error instanceof WorkspaceStorageError && (error.code === 'timeout' || error.code === 'unavailable');
}

function requestOnce<T>(start: (done: (error: string | null, value?: T) => void) => unknown): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      reject(new WorkspaceStorageError('timeout', 'Telegram долго отвечает. Проверьте соединение и повторите попытку; сохранённые данные остаются на месте.'));
    }, CLOUD_STORAGE_TIMEOUT_MS);
    const done = (error: string | null, value?: T) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (error) reject(new WorkspaceStorageError('unavailable', 'Telegram не смог сохранить или загрузить данные. Попробуйте ещё раз.'));
      else resolve(value);
    };
    try { start(done); } catch { done('storage_unavailable'); }
  });
}

/** Retry only reads and idempotent chunk writes. Never blindly replay a manifest commit. */
async function request<T>(start: (done: (error: string | null, value?: T) => void) => unknown, attempts = 2): Promise<T | undefined> {
  for (let attempt = 0; ; attempt++) {
    try { return await requestOnce(start); } catch (error) {
      if (attempt + 1 >= attempts || !isTransientStorageError(error)) throw error;
    }
  }
}

function validGeneration(value: unknown): value is Generation {
  return record(value) && typeof value.revision === 'string' && /^[a-f0-9-]{36}$/.test(value.revision)
    && Number.isInteger(value.chunks) && Number(value.chunks) >= 1 && Number(value.chunks) <= WORKSPACE_MAX_CHUNKS;
}

async function readManifest(storage: CloudStorage): Promise<{ raw: string; manifest: Manifest | null }> {
  const raw = await request<string>(done => storage.getItem(WORKSPACE_MANIFEST_KEY, done));
  // Telegram returns an empty string for a key which has never been written.
  if (raw === '') return { raw, manifest: null };
  if (typeof raw !== 'string' || raw.length > 4096) throw corrupt();
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw corrupt(); }
  if (!validGeneration(value) || !record(value) || value.version !== 2 || !Number.isInteger(value.length)
    || Number(value.length) < 1 || Number(value.length) > WORKSPACE_CHUNK_SIZE * WORKSPACE_MAX_CHUNKS
    || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)
    || (value.previous !== undefined && !validGeneration(value.previous))) throw corrupt();
  return { raw, manifest: value as unknown as Manifest };
}

/** A newer commit must wait until the older timed-out write has finished. */
export async function isWorkspaceCommitResolved(storage: CloudStorage, revision: string): Promise<boolean> {
  if (commitOutcomes.get(storage)?.has(revision)) return true;
  const { manifest } = await readManifest(storage);
  return manifest?.revision === revision || manifest?.previous?.revision === revision;
}

function chunkKeys(generation: Generation): string[] {
  return Array.from({ length: generation.chunks }, (_, i) => `bizbox_ws_${generation.revision}_${i}`);
}

async function sha256(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new WorkspaceStorageError('unavailable', 'Для безопасного сохранения нужен актуальный Telegram. Обновите приложение и попробуйте ещё раз.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function loadWorkspace(storage: CloudStorage): Promise<{ state: AppState | null; revision: string | null }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const before = await readManifest(storage);
    if (!before.manifest) return { state: null, revision: null };
    const manifest = before.manifest;
    let state: AppState | undefined;
    let failure: unknown;
    try {
      const keys = chunkKeys(manifest);
      const values = await request<Record<string, string>>(done => storage.getItems(keys, done));
      if (!record(values) || keys.some(key => typeof values[key] !== 'string' || values[key].length > WORKSPACE_CHUNK_SIZE || values[key].length === 0)) throw corrupt();
      const json = keys.map(key => values[key]).join('');
      if (json.length !== manifest.length || await sha256(json) !== manifest.sha256) throw corrupt();
      let parsed: unknown;
      try { parsed = JSON.parse(json); } catch { throw corrupt(); }
      if (!isWorkspaceState(parsed)) throw corrupt();
      state = parsed;
    } catch (error) { failure = error; }
    const after = await readManifest(storage);
    if (before.raw !== after.raw) continue;
    if (failure) throw failure;
    if (!state) throw corrupt();
    return { state, revision: manifest.revision };
  }
  throw conflict();
}

export async function saveWorkspace(storage: CloudStorage, state: AppState, expectedRevision: string | null, lifecycle?: {
  onCommitStarted?: (revision: string) => void;
  onCommitSettled?: (revision: string) => void;
}): Promise<string> {
  if (!isWorkspaceState(state)) throw new WorkspaceStorageError('invalid_state', 'Проверьте профиль бизнеса: название, сферу, город и число сотрудников. Некорректные данные не сохранены.');
  let json: string;
  try { json = JSON.stringify(state); } catch { throw new WorkspaceStorageError('invalid_state', 'Не удалось подготовить данные к сохранению.'); }
  if (json.length > WORKSPACE_CHUNK_SIZE * WORKSPACE_MAX_CHUNKS) throw new WorkspaceStorageError('too_large', 'Данных стало больше лимита этой версии BizBox (около 168 тысяч символов). Новые изменения не сохранены; прежние данные доступны.');
  const before = await readManifest(storage);
  const checksum = await sha256(json);
  // A commit can succeed even if Telegram loses its callback. Recognizing the
  // exact payload makes retrying that save safe and avoids redundant generations.
  if (before.manifest?.length === json.length && before.manifest.sha256 === checksum) {
    const existing = await loadWorkspace(storage);
    if (existing.state && JSON.stringify(existing.state) === json && existing.revision) return existing.revision;
    throw conflict();
  }
  if ((before.manifest?.revision ?? null) !== expectedRevision) throw conflict();
  if (!globalThis.crypto?.randomUUID) throw new WorkspaceStorageError('unavailable', 'Для сохранения нужен актуальный Telegram. Обновите приложение и попробуйте ещё раз.');
  const revision = globalThis.crypto.randomUUID();
  const chunks: string[] = [];
  // Keep surrogate pairs together so transports cannot replace a split emoji.
  for (let offset = 0; offset < json.length;) {
    let end = Math.min(offset + WORKSPACE_CHUNK_SIZE, json.length);
    if (end < json.length && /[\uD800-\uDBFF]/.test(json[end - 1])) end--;
    chunks.push(json.slice(offset, end));
    offset = end;
  }
  if (chunks.length > WORKSPACE_MAX_CHUNKS) throw new WorkspaceStorageError('too_large', 'Достигнут лимит данных этой версии BizBox. Новые изменения не сохранены; прежние данные доступны.');
  const manifest: Manifest = { version: 2, revision, chunks: chunks.length, length: json.length, sha256: checksum };
  if (before.manifest) manifest.previous = { revision: before.manifest.revision, chunks: before.manifest.chunks };
  const keys = chunkKeys(manifest);
  try {
    for (let i = 0; i < chunks.length; i++) {
      const stored = await request<boolean>(done => storage.setItem(keys[i], chunks[i], done));
      if (stored !== true) throw new WorkspaceStorageError('unavailable', 'Telegram не подтвердил сохранение. Повторите попытку.');
    }
    // CloudStorage has no compare-and-swap; these checks detect known conflicts,
    // but a simultaneous write between this read and set cannot be locked remotely.
    const current = await readManifest(storage);
    if (current.raw !== before.raw) throw conflict();
  } catch (error) {
    // No manifest write has started yet. Reclaim failed preparation when possible;
    // never remove a generation which a manifest currently references.
    try {
      const latest = await readManifest(storage);
      if (latest.manifest?.revision !== revision && latest.manifest?.previous?.revision !== revision) {
        await request<boolean>(done => storage.removeItems(keys, done));
      }
    } catch { /* Leave unreferenced chunks when the transport is unavailable. */ }
    throw error;
  }
  const manifestJson = JSON.stringify(manifest);
  // Persist uncertainty before dispatch: the WebView can close before either a
  // callback or our timeout runs, while the Telegram request is still in flight.
  lifecycle?.onCommitStarted?.(revision);
  try {
    const committed = await request<boolean>(done => {
      const settled = (error: string | null, stored?: boolean) => {
        // Record even a late callback. Once it arrives this particular write can
        // no longer land after a newer generation, regardless of its outcome.
        let outcomes = commitOutcomes.get(storage);
        if (!outcomes) { outcomes = new Map(); commitOutcomes.set(storage, outcomes); }
        outcomes.set(revision, !error && stored === true);
        lifecycle?.onCommitSettled?.(revision);
        done(error, stored);
      };
      try { return storage.setItem(WORKSPACE_MANIFEST_KEY, manifestJson, settled); }
      catch { settled('storage_unavailable'); }
    }, 1);
    if (committed !== true) throw new WorkspaceStorageError('unavailable', 'Telegram не подтвердил сохранение. Повторите попытку.');
  } catch (error) {
    // A timeout is an unknown outcome, not a rejected write. Read back before
    // retrying; never remove chunks that a delayed manifest may still reference.
    let observed: Awaited<ReturnType<typeof readManifest>>;
    try { observed = await readManifest(storage); } catch (readError) {
      if (error instanceof WorkspaceStorageError && error.code === 'timeout' && !commitOutcomes.get(storage)?.has(revision)) throw unresolved(revision);
      throw readError;
    }
    if (observed.raw === manifestJson) return revision;
    if (error instanceof WorkspaceStorageError && error.code === 'timeout' && !commitOutcomes.get(storage)?.has(revision)) throw unresolved(revision);
    if (observed.raw !== before.raw) throw conflict();
    throw error;
  }
  const confirmed = await readManifest(storage);
  if (confirmed.raw !== manifestJson) throw conflict();
  // Keep the previous generation for in-flight readers. Cleaning an older one is
  // best effort; a cleanup failure must not turn an acknowledged save into failure.
  const old = before.manifest?.previous;
  if (old && old.revision !== confirmed.manifest?.revision && old.revision !== confirmed.manifest?.previous?.revision) {
    // Cleanup must not leave an already committed workspace in the saving state
    // for another timeout when Telegram drops a nonessential remove callback.
    void request<boolean>(done => storage.removeItems(chunkKeys(old), done), 1).catch(() => {});
  }
  return revision;
}
