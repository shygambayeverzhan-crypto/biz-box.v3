import test from 'node:test';
import assert from 'node:assert/strict';
import { readWorkspaceRecovery, writeWorkspaceRecovery, writeWorkspaceCheckpoint, clearWorkspaceRecovery, reconcileWorkspaceRecovery, sameWorkspaceState } from '../src/lib/workspaceRecovery.ts';

const baseState = () => ({
  user: { name: 'Ержан', email: '', plan: 'free' },
  business: { name: 'BizBox', industry: 'Услуги', city: 'Астана', employeesCount: '1', modules: ['finance'] },
  onboardingComplete: true,
  transactions: [], documents: [], clients: [], tasks: [], employees: [], notifications: [], events: [], specialists: [], payments: [],
});
const localStorage = () => {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};

test('account-scoped recovery restores the latest edits and the snapshot awaiting acknowledgement', () => {
  const storage = localStorage();
  const attempted = baseState();
  const latest = { ...attempted, business: { ...attempted.business, name: 'Последняя правка' } };
  const recovery = { version: 1, userId: '123', baseRevision: 'base', state: latest, attempted };
  assert.equal(writeWorkspaceRecovery(recovery, storage), true);
  assert.deepEqual(readWorkspaceRecovery('123', storage), recovery);
  assert.equal(readWorkspaceRecovery('456', storage), null);
  assert.equal(reconcileWorkspaceRecovery(recovery, { state: attempted, revision: 'acknowledged-after-timeout' }), 'resume');
  assert.equal(reconcileWorkspaceRecovery(recovery, { state: latest, revision: 'latest-revision' }), 'saved');
  clearWorkspaceRecovery('123', storage);
  assert.equal(readWorkspaceRecovery('123', storage), null);
});

test('unrelated cloud changes are never overwritten by a stale local draft', () => {
  const recovery = { version: 1, userId: '123', baseRevision: 'base', state: baseState() };
  const remote = { ...baseState(), business: { ...baseState().business, name: 'Другое окно' } };
  assert.equal(reconcileWorkspaceRecovery(recovery, { state: remote, revision: 'other' }), 'conflict');
  assert.equal(reconcileWorkspaceRecovery(recovery, { state: remote, revision: 'base' }), 'resume');
  assert.equal(reconcileWorkspaceRecovery({ ...recovery, baseRevision: null }, { state: null, revision: null }), 'resume');
});

test('old account-scoped caches are recovered conservatively, never silently replayed', () => {
  const storage = localStorage();
  const state = baseState();
  storage.setItem('bizbox_cache_v2_123', JSON.stringify(state));
  const recovered = readWorkspaceRecovery('123', storage);
  assert.deepEqual(recovered.state, state);
  assert.equal(recovered.baseRevision, undefined);
  assert.equal(reconcileWorkspaceRecovery(recovered, { state: baseState(), revision: 'remote' }), 'saved');
  assert.equal(reconcileWorkspaceRecovery(recovered, { state: null, revision: null }), 'conflict');
});

test('missing, blocked, full, corrupt, or mismatched local storage never grants durable recovery', () => {
  const recovery = { version: 1, userId: '123', baseRevision: null, state: baseState() };
  assert.equal(writeWorkspaceRecovery(recovery, null), false);
  assert.equal(readWorkspaceRecovery('123', null), null);
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(writeWorkspaceRecovery(recovery, blocked), false);
  assert.equal(readWorkspaceRecovery('123', blocked), null);
  assert.doesNotThrow(() => clearWorkspaceRecovery('123', blocked));
  const storage = localStorage();
  storage.setItem('bizbox_recovery_v3_123', '{');
  assert.equal(readWorkspaceRecovery('123', storage), null);
  storage.setItem('bizbox_recovery_v3_123', JSON.stringify({ ...recovery, userId: '456' }));
  assert.equal(readWorkspaceRecovery('123', storage), null);
  assert.equal(writeWorkspaceRecovery(recovery, { ...storage, setItem() {} }), false);
});

test('derived subscription plans do not cause writes, while payment plan changes still do', () => {
  const state = baseState();
  assert.equal(sameWorkspaceState(state, { ...state, user: { ...state.user, plan: 'pro' } }), true);
  assert.equal(sameWorkspaceState(state, JSON.parse(JSON.stringify(state))), true);
  const businessChanged = { ...state, business: { ...state.business, city: 'Алматы' } };
  assert.equal(sameWorkspaceState(state, businessChanged), false);
  const paid = { ...state, payments: [{ plan: 'pro' }] };
  assert.equal(sameWorkspaceState(paid, { ...paid, payments: [{ plan: 'business' }] }), false);
});

test('confirmed offline copies survive pending cleanup and never overwrite newer cloud data', () => {
  const storage = localStorage();
  const state = baseState();
  writeWorkspaceCheckpoint('123', state, 'confirmed-revision', storage);
  const draft = { ...state, business: { ...state.business, name: 'Черновик' } };
  writeWorkspaceRecovery({ version: 1, userId: '123', baseRevision: 'confirmed-revision', state: draft, commitUncertain: 'in-flight-revision' }, storage);
  assert.equal(readWorkspaceRecovery('123', storage).commitUncertain, 'in-flight-revision');
  clearWorkspaceRecovery('123', storage);
  const offline = readWorkspaceRecovery('123', storage);
  assert.deepEqual(offline.state, state);
  assert.equal(offline.synced, true);
  assert.equal(reconcileWorkspaceRecovery(offline, { state: draft, revision: 'newer-cloud' }), 'saved');
  assert.equal(readWorkspaceRecovery('456', storage), null);
});
