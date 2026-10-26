import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  loadWorkspace, saveWorkspace, isWorkspaceState, isWorkspaceCommitResolved, WorkspaceStorageError,
  WORKSPACE_MANIFEST_KEY, WORKSPACE_CHUNK_SIZE, CLOUD_STORAGE_TIMEOUT_MS,
} from '../src/lib/cloudWorkspace.ts';

const baseState = () => ({
  user: { name: 'Ержан', email: 'telegram@example.local', plan: 'free' },
  business: { name: 'BizBox', industry: 'Услуги', city: 'Астана', employeesCount: '1', modules: ['finance'] },
  onboardingComplete: true,
  transactions: [], documents: [], clients: [], tasks: [], employees: [], notifications: [], events: [], specialists: [], payments: [],
});

class MemoryStorage {
  values = new Map();
  onRead;
  onWrite;
  operations = [];
  getItem(key, callback) {
    this.operations.push(['getItem', key]);
    if (this.onRead?.(key, callback) === false) return;
    callback(null, this.values.get(key) ?? '');
  }
  getItems(keys, callback) {
    this.operations.push(['getItems', ...keys]);
    if (this.onRead?.(keys, callback) === false) return;
    callback(null, Object.fromEntries(keys.map(key => [key, this.values.get(key) ?? ''])));
  }
  setItem(key, value, callback) {
    this.operations.push(['setItem', key]);
    assert.ok(key.length <= 128);
    assert.ok(value.length <= 4096);
    if (this.onWrite?.(key, value, callback) === false) return;
    this.values.set(key, value);
    callback(null, true);
  }
  removeItems(keys, callback) {
    this.operations.push(['removeItems', ...keys]);
    for (const key of keys) this.values.delete(key);
    callback(null, true);
  }
}

const rejectsCode = (operation, code) => assert.rejects(operation, error => error instanceof WorkspaceStorageError && error.code === code);
const generationKeys = manifest => Array.from({ length: manifest.chunks }, (_, i) => `bizbox_ws_${manifest.revision}_${i}`);
const manifestOf = storage => JSON.parse(storage.values.get(WORKSPACE_MANIFEST_KEY));

test('only an explicitly absent manifest produces an empty workspace', async () => {
  assert.deepEqual(await loadWorkspace(new MemoryStorage()), { state: null, revision: null });
  const broken = new MemoryStorage();
  broken.onRead = (_, callback) => { callback(null); return false; };
  await rejectsCode(loadWorkspace(broken), 'corrupt');
});

test('completed onboarding reopens from a new adapter across multiple chunks and emoji', async () => {
  const storage = new MemoryStorage();
  const state = baseState();
  state.documents.push({ id: '1', name: 'Договор', type: 'contract', client: 'Клиент', date: '2026-10-26', status: 'draft', amount: 100, number: '1', content: '🚀'.repeat(5000) });
  const revision = await saveWorkspace(storage, state, null);
  const reopened = new MemoryStorage();
  reopened.values = new Map(storage.values);
  assert.deepEqual(await loadWorkspace(reopened), { state, revision });
  const manifest = manifestOf(storage);
  assert.ok(manifest.chunks > 1);
  for (const key of generationKeys(manifest)) {
    const chunk = storage.values.get(key);
    assert.ok(chunk.length <= WORKSPACE_CHUNK_SIZE);
    assert.doesNotMatch(chunk.at(-1), /[\uD800-\uDBFF]/);
  }
});

test('a read error remains an error and never returns a fresh account', async () => {
  const storage = new MemoryStorage();
  storage.onRead = (_, callback) => { callback('NETWORK_ERROR'); return false; };
  await rejectsCode(loadWorkspace(storage), 'unavailable');
});

test('a stalled callback times out without resetting data', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = new MemoryStorage();
  storage.onRead = () => false;
  const pending = rejectsCode(loadWorkspace(storage), 'timeout');
  t.mock.timers.tick(CLOUD_STORAGE_TIMEOUT_MS + 1);
  await new Promise(setImmediate);
  t.mock.timers.tick(CLOUD_STORAGE_TIMEOUT_MS + 1);
  await pending;
  assert.equal(storage.operations.length, 2);
});

test('corrupt manifests, missing chunks, modified chunks, and invalid state are rejected', async t => {
  await t.test('malformed manifest', async () => {
    const storage = new MemoryStorage();
    storage.values.set(WORKSPACE_MANIFEST_KEY, '{');
    await rejectsCode(loadWorkspace(storage), 'corrupt');
  });
  for (const mode of ['missing', 'modified', 'invalid_state']) {
    await t.test(mode, async () => {
      const storage = new MemoryStorage();
      await saveWorkspace(storage, baseState(), null);
      const manifest = manifestOf(storage);
      const key = generationKeys(manifest)[0];
      if (mode === 'missing') storage.values.delete(key);
      if (mode === 'modified') storage.values.set(key, storage.values.get(key).replace('BizBox', 'BadBox'));
      if (mode === 'invalid_state') {
        const state = baseState();
        state.transactions = [{ id: 'unsafe' }];
        const json = JSON.stringify(state);
        storage.values.set(key, json);
        manifest.length = json.length;
        manifest.sha256 = createHash('sha256').update(json).digest('hex');
        storage.values.set(WORKSPACE_MANIFEST_KEY, JSON.stringify(manifest));
      }
      await rejectsCode(loadWorkspace(storage), 'corrupt');
    });
  }
});

test('incomplete completed profiles and oversized workspaces fail before writing', async () => {
  const storage = new MemoryStorage();
  const incomplete = baseState();
  incomplete.business.city = '  ';
  assert.equal(isWorkspaceState(incomplete), false);
  await rejectsCode(saveWorkspace(storage, incomplete, null), 'invalid_state');
  const oversized = baseState();
  oversized.business.name = 'a'.repeat(168_001);
  await rejectsCode(saveWorkspace(storage, oversized, null), 'too_large');
  assert.equal(storage.values.size, 0);
});

test('draft steps are bounded and completed workspaces require a selected module', async () => {
  const storage = new MemoryStorage();
  for (const step of [-1, 3, 0.5, '1']) {
    const state = { ...baseState(), onboardingComplete: false, onboardingStep: step };
    await rejectsCode(saveWorkspace(storage, state, null), 'invalid_state');
  }
  const noModules = baseState();
  noModules.business.modules = [];
  await rejectsCode(saveWorkspace(storage, noModules, null), 'invalid_state');
  noModules.onboardingComplete = false;
  noModules.onboardingStep = 1;
  const revision = await saveWorkspace(storage, noModules, null);
  assert.deepEqual(await loadWorkspace(storage), { state: noModules, revision });
});

test('a known revision mismatch rejects before any write', async () => {
  const storage = new MemoryStorage();
  const revision = await saveWorkspace(storage, baseState(), null);
  storage.operations.length = 0;
  const changed = baseState();
  changed.business.name = 'Неактуальная версия';
  await rejectsCode(saveWorkspace(storage, changed, null), 'conflict');
  assert.equal(storage.operations.some(([op]) => op === 'setItem'), false);
  assert.equal((await loadWorkspace(storage)).revision, revision);
});

test('a conflicting writer discovered after chunks were prepared is not overwritten', async () => {
  const storage = new MemoryStorage();
  const revision = await saveWorkspace(storage, baseState(), null);
  const other = new MemoryStorage();
  other.values = new Map(storage.values);
  const otherState = baseState();
  otherState.business.name = 'Другое окно';
  const otherRevision = await saveWorkspace(other, otherState, revision);
  storage.onWrite = key => {
    if (key !== WORKSPACE_MANIFEST_KEY) {
      for (const [otherKey, value] of other.values) storage.values.set(otherKey, value);
      storage.onWrite = undefined;
    }
  };
  const changed = baseState();
  changed.business.name = 'Местное изменение';
  await rejectsCode(saveWorkspace(storage, changed, revision), 'conflict');
  assert.deepEqual(await loadWorkspace(storage), { state: otherState, revision: otherRevision });
});

test('interrupted chunks and rejected manifest commits preserve the previous workspace', async t => {
  for (const failureAt of ['chunk', 'manifest']) {
    await t.test(failureAt, async () => {
      const storage = new MemoryStorage();
      const previous = baseState();
      const revision = await saveWorkspace(storage, previous, null);
      const changed = baseState();
      changed.business.name = 'Новое имя';
      storage.onWrite = (key, _, callback) => {
        if ((failureAt === 'manifest') === (key === WORKSPACE_MANIFEST_KEY)) { callback('INTERRUPTED'); return false; }
      };
      await rejectsCode(saveWorkspace(storage, changed, revision), 'unavailable');
      assert.deepEqual(await loadWorkspace(storage), { state: previous, revision });
    });
  }
});

test('load retries against a new manifest when a concurrent save changes the generation', async () => {
  const storage = new MemoryStorage();
  const first = await saveWorkspace(storage, baseState(), null);
  const other = new MemoryStorage();
  other.values = new Map(storage.values);
  const updated = baseState();
  updated.business.name = 'Последнее название';
  const second = await saveWorkspace(other, updated, first);
  storage.onRead = key => {
    if (Array.isArray(key)) {
      storage.values = new Map(other.values);
      storage.onRead = undefined;
    }
  };
  assert.deepEqual(await loadWorkspace(storage), { state: updated, revision: second });
});

test('cleanup retains the current and previous generations and bounds successful saves', async () => {
  const storage = new MemoryStorage();
  let revision = null;
  for (let i = 0; i < 8; i++) {
    const state = baseState();
    state.business.name = `Бизнес ${i}`;
    revision = await saveWorkspace(storage, state, revision);
    assert.deepEqual(await loadWorkspace(storage), { state, revision });
  }
  const current = manifestOf(storage);
  for (const key of [...generationKeys(current), ...generationKeys(current.previous)]) assert.equal(storage.values.has(key), true);
  assert.equal(storage.values.size, 3);
});

test('identical snapshots do not write and reconcile a lost save acknowledgement', async () => {
  const storage = new MemoryStorage();
  const state = baseState();
  const revision = await saveWorkspace(storage, state, null);
  storage.operations.length = 0;
  assert.equal(await saveWorkspace(storage, state, revision), revision);
  assert.equal(await saveWorkspace(storage, state, null), revision);
  assert.equal(storage.operations.some(([operation]) => operation === 'setItem'), false);
});

test('one transient read or chunk error recovers automatically with a bounded retry', async () => {
  const storage = new MemoryStorage();
  let failures = 1;
  storage.onRead = (_, callback) => {
    if (failures-- > 0) { callback('NETWORK_ERROR'); return false; }
  };
  assert.deepEqual(await loadWorkspace(storage), { state: null, revision: null });
  assert.equal(storage.operations.length, 2);
  failures = 1;
  storage.onWrite = (key, _, callback) => {
    if (key !== WORKSPACE_MANIFEST_KEY && failures-- > 0) { callback('NETWORK_ERROR'); return false; }
  };
  const revision = await saveWorkspace(storage, baseState(), null);
  assert.equal((await loadWorkspace(storage)).revision, revision);
});

test('a manifest saved without its callback is reconciled after timeout without replaying it', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = new MemoryStorage();
  let commitStarted = false;
  storage.onWrite = (key, value) => {
    if (key === WORKSPACE_MANIFEST_KEY) {
      storage.values.set(key, value);
      commitStarted = true;
      return false;
    }
  };
  const pending = saveWorkspace(storage, baseState(), null);
  while (!commitStarted) await new Promise(setImmediate);
  t.mock.timers.tick(CLOUD_STORAGE_TIMEOUT_MS + 1);
  const revision = await pending;
  assert.equal(manifestOf(storage).revision, revision);
  assert.equal(storage.operations.filter(([operation, key]) => operation === 'setItem' && key === WORKSPACE_MANIFEST_KEY).length, 1);
  assert.deepEqual((await loadWorkspace(storage)).state, baseState());
});

test('a committed save whose confirmation cannot be read can safely be retried', async () => {
  const storage = new MemoryStorage();
  const state = baseState();
  storage.onWrite = key => {
    if (key === WORKSPACE_MANIFEST_KEY) storage.onRead = (_, callback) => { callback('NETWORK_ERROR'); return false; };
  };
  await rejectsCode(saveWorkspace(storage, state, null), 'unavailable');
  const committedRevision = manifestOf(storage).revision;
  storage.onRead = undefined;
  storage.onWrite = undefined;
  storage.operations.length = 0;
  assert.equal(await saveWorkspace(storage, state, null), committedRevision);
  assert.equal(storage.operations.some(([operation]) => operation === 'setItem'), false);
});

test('a timed-out manifest still in flight blocks newer edits until that exact commit lands', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = new MemoryStorage();
  const original = baseState();
  const base = await saveWorkspace(storage, original, null);
  const attempted = { ...original, business: { ...original.business, name: 'Первая правка' } };
  let finishCommit;
  storage.onWrite = (key, value, callback) => {
    if (key === WORKSPACE_MANIFEST_KEY) {
      finishCommit = () => { storage.values.set(key, value); callback(null, true); };
      return false;
    }
  };
  let failure;
  const pending = saveWorkspace(storage, attempted, base).catch(error => { failure = error; });
  while (!finishCommit) await new Promise(setImmediate);
  t.mock.timers.tick(CLOUD_STORAGE_TIMEOUT_MS + 1);
  await pending;
  assert.equal(failure.code, 'commit_unknown');
  assert.ok(failure.uncertainRevision);
  assert.equal(await isWorkspaceCommitResolved(storage, failure.uncertainRevision), false);
  assert.equal(manifestOf(storage).revision, base);
  // The context persists this marker and does not send the newer queued state.
  const { reconcileWorkspaceRecovery } = await import('../src/lib/workspaceRecovery.ts');
  const latest = { ...attempted, business: { ...attempted.business, name: 'Вторая правка' } };
  const recovery = { version: 1, userId: '123', baseRevision: base, state: latest, attempted, commitUncertain: failure.uncertainRevision };
  assert.equal(reconcileWorkspaceRecovery(recovery, await loadWorkspace(storage)), 'waiting');
  finishCommit();
  assert.equal(await isWorkspaceCommitResolved(storage, failure.uncertainRevision), true);
  const loaded = await loadWorkspace(storage);
  assert.equal(reconcileWorkspaceRecovery(recovery, loaded), 'resume');
  storage.onWrite = undefined;
  const final = await saveWorkspace(storage, latest, loaded.revision);
  assert.deepEqual(await loadWorkspace(storage), { state: latest, revision: final });
});

test('notification preferences accept only supported types and boolean values', () => {
  const state = baseState();
  state.user.notificationPreferences = { task: false, payment: true };
  assert.equal(isWorkspaceState(state), true);
  for (const invalid of [[], { task: 'false' }, { unknown: true }, null]) {
    state.user.notificationPreferences = invalid;
    assert.equal(isWorkspaceState(state), false);
  }
});

test('closing before the manifest timeout still leaves a persisted uncertain revision', async () => {
  const storage = new MemoryStorage();
  const state = baseState();
  const base = await saveWorkspace(storage, state, null);
  const next = { ...state, business: { ...state.business, name: 'Первая отправка' } };
  let recordedRevision;
  let finishCommit;
  storage.onWrite = (key, value, callback) => {
    if (key === WORKSPACE_MANIFEST_KEY) {
      assert.equal(JSON.parse(value).revision, recordedRevision, 'recovery marker exists before manifest leaves the app');
      finishCommit = () => { storage.values.set(key, value); callback(null, true); };
      return false;
    }
  };
  const pending = saveWorkspace(storage, next, base, { onCommitStarted: revision => { recordedRevision = revision; } });
  while (!finishCommit) await new Promise(setImmediate);
  const { reconcileWorkspaceRecovery } = await import('../src/lib/workspaceRecovery.ts');
  const latest = { ...next, business: { ...next.business, name: 'Ещё одна правка перед закрытием' } };
  const afterReopen = { version: 1, userId: '123', baseRevision: base, state: latest, attempted: next, commitUncertain: recordedRevision };
  assert.equal(reconcileWorkspaceRecovery(afterReopen, await loadWorkspace(storage)), 'waiting');
  finishCommit();
  await pending;
  assert.equal(reconcileWorkspaceRecovery(afterReopen, await loadWorkspace(storage)), 'resume');
});
