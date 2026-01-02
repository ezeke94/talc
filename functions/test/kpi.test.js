const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

// Helper to create a minimal Firestore-like stub
function makeFirestoreStub(initialData = {}) {
  // initialData: { collectionName: [{ id, data }] }
  const store = JSON.parse(JSON.stringify(initialData));

  function getCollection(name) {
    return {
      get: async () => {
        const docs = (store[name] || []).map(d => ({ id: d.id, data: () => d.data }));
        return { docs, forEach: (cb) => docs.forEach(d => cb({ id: d.id, data: () => d.data })) };
      },
      doc: (id) => getDocRef(name, id),
      where: () => ({ get: async () => { const docs = (store[name] || []).map(d => ({ id: d.id, data: () => d.data })); return { docs, forEach: (cb) => docs.forEach(d => cb({ id: d.id, data: () => d.data })) }; } })
    };
  }

  function getDocRef(collectionName, id) {
    return {
      get: async () => {
        const col = store[collectionName] || [];
        const found = col.find(d => d.id === id);
        return { exists: !!found, data: () => (found ? found.data : undefined) };
      },
      set: async (obj, opts) => {
        store[collectionName] = store[collectionName] || [];
        const existingIndex = store[collectionName].findIndex(d => d.id === id);
        const docData = opts && opts.merge && existingIndex >= 0 ? Object.assign({}, store[collectionName][existingIndex].data, obj) : obj;
        if (existingIndex >= 0) store[collectionName][existingIndex].data = docData;
        else store[collectionName].push({ id, data: docData });
        return;
      },
      collection: (sub) => {
        // support users/{uid}/devices subcollection stored as `users/${id}/devices`
        const full = `${collectionName}/${id}/${sub}`;
        return {
          get: async () => {
            const docs = (store[full] || []).map(d => ({ id: d.id, data: () => d.data }));
            return { docs, forEach: (cb) => docs.forEach(d => cb({ id: d.id, data: () => d.data })) };
          }
        };
      }
    };
  }

  return {
    collection: (n) => getCollection(n),
    _store: store
  };
}

describe('KPI Notifications runner', () => {
  let messagingStub;
  let fbStubs;
  let kpiModule;

  beforeEach(() => {
    messagingStub = { sendEach: sinon.stub().resolves({ responses: [], successCount: 1 }) };
  });

  it('should dedupe when recent log exists and skip send when not forced', async () => {
    // Setup data: one mentor missing submission, assignedEvaluator eval1 with a token
    const initialData = {
      mentors: [ { id: 'mentor1', data: { name: 'M1', assignedFormIds: ['formA'], assignedEvaluator: { id: 'eval1' }, assignedCenters: ['C1'] } } ],
      kpiForms: [ { id: 'formA', data: { name: 'formA' } } ],
      kpiSubmissions: [],
      users: [ { id: 'eval1', data: { name: 'Eval One', assignedCenters: ['C1'], role: 'Quality' } } ],
      // devices subcollection for user eval1
      'users/eval1/devices': [ { id: 'token1', data: { enabled: true } } ],
      // Notification log has a recent entry for today's dedup key
      '_notificationLog': [ { id: 'eval1-kpi_reminder_2026-01-02', data: { userId: 'eval1', dedupKey: 'kpi_reminder_2026-01-02', sentAt: new Date() } } ]
    };

    fbStubs = makeFirestoreStub(initialData);

    kpiModule = proxyquire('../kpiNotifications', {
      'firebase-admin/firestore': { getFirestore: () => fbStubs },
      'firebase-admin/messaging': { getMessaging: () => messagingStub },
      'firebase-admin/app': { getApps: () => [], initializeApp: () => {} }
    });

    // Run non-dry, not-forced
    const result = await kpiModule.runWeeklyKPIReminders(false, { force: false });

    expect(result.notificationCount).to.equal(0);
    expect(result.evaluatorsSummary.length).to.equal(1);
    expect(result.evaluatorsSummary[0].skipReason).to.equal('deduped');
  });

  it('should send when forced despite recent dedupe entry and record the send', async () => {
    // Similar setup but we will check that recordNotificationSent is called (set on _notificationLog)
    const initialData = {
      mentors: [ { id: 'mentor1', data: { name: 'M1', assignedFormIds: ['formA'], assignedEvaluator: { id: 'eval1' }, assignedCenters: ['C1'] } } ],
      kpiForms: [ { id: 'formA', data: { name: 'formA' } } ],
      kpiSubmissions: [],
      users: [ { id: 'eval1', data: { name: 'Eval One', assignedCenters: ['C1'], role: 'Quality' } } ],
      'users/eval1/devices': [ { id: 'token1', data: { enabled: true } } ],
      '_notificationLog': [ { id: 'eval1-kpi_reminder_2026-01-02', data: { userId: 'eval1', dedupKey: 'kpi_reminder_2026-01-02', sentAt: new Date() } } ]
    };

    fbStubs = makeFirestoreStub(initialData);

    // Spy on set to observe recordNotificationSent calls
    const setSpy = sinon.spy(fbStubs.collection('_notificationLog').doc('placeholder'), 'set');

    kpiModule = proxyquire('../kpiNotifications', {
      'firebase-admin/firestore': { getFirestore: () => fbStubs },
      'firebase-admin/messaging': { getMessaging: () => messagingStub },
      'firebase-admin/app': { getApps: () => [], initializeApp: () => {} }
    });

    // Run non-dry with force true
    const result = await kpiModule.runWeeklyKPIReminders(false, { force: true });

    // Debug output (helpful during test development)
    // debug log removed

    expect(result.evaluatorsSummary.length).to.equal(1);
    // Token count should be >0 for the evaluator
    expect(result.evaluatorsSummary[0].tokenCount).to.be.greaterThan(0);
    expect(result.evaluatorsSummary[0].skipReason).to.be.null;

    expect(result.notificationCount).to.be.greaterThan(0);

    // Confirm that a dedupe record was written for the evaluator (existence in store)
    const dedupKey = `eval1-kpi_reminder_${new Date().toISOString().slice(0,10)}`;
    const written = fbStubs._store['_notificationLog'].some(d => d.id === dedupKey);
    expect(written).to.be.true;
  });
});