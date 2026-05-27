const {
  setupTestEnvironment,
  teardownTestEnvironment,
  expectSuccess,
  expectFailure
} = require('./helpers');

describe('PhysiLog Firestore Security Rules', () => {
  afterEach(async () => {
    await teardownTestEnvironment();
  });

  const now = new Date();

  const athlete = {
    name: '山田太郎',
    age: 12,
    note: '',
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  };

  const event = {
    name: '100m',
    unit: '秒',
    sortOrder: 1,
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  };

  const record = {
    athleteId: 'athlete1',
    eventId: 'event1',
    value: 12.34,
    unit: '秒',
    athleteNameSnapshot: '山田太郎',
    eventNameSnapshot: '100m',
    recordedAt: now,
    note: '',
    createdAt: now,
    updatedAt: now
  };

  const entitlement = {
    plan: 'monitor_lifetime',
    source: 'manual',
    status: 'active',
    grantedAt: now,
    updatedAt: now
  };

  test('認証済みユーザーは自分の選手を作成して読める', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();

    await expectSuccess(db.doc('users/user1/athletes/athlete1').set(athlete));
    await expectSuccess(db.doc('users/user1/athletes/athlete1').get());
  });

  test('認証済みユーザーは自分の種目を作成して読める', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();

    await expectSuccess(db.doc('users/user1/events/event1').set(event));
    await expectSuccess(db.doc('users/user1/events/event1').get());
  });

  test('認証済みユーザーは自分の記録を作成して読める', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();

    await expectSuccess(db.doc('users/user1/records/record1').set(record));
    await expectSuccess(db.doc('users/user1/records/record1').get());
  });

  test('認証済みユーザーは自分のentitlementを読めるが作成・更新できない', async () => {
    const context = await setupTestEnvironment(
      { uid: 'user1' },
      { 'users/user1/entitlements/current': entitlement }
    );
    const db = context.firestore();

    await expectSuccess(db.doc('users/user1/entitlements/current').get());
    await expectFailure(
      db.doc('users/user1/entitlements/current').set(entitlement)
    );
  });

  test('記録は単位なしの値を保存できる', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();
    const { unit, ...recordWithoutUnit } = record;

    await expectSuccess(db.doc('users/user1/records/record1').set({
      ...recordWithoutUnit,
      value: 15
    }));
  });

  test('記録はeventUnitSnapshotを保存しない', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();

    await expectFailure(db.doc('users/user1/records/record1').set({
      ...record,
      eventUnitSnapshot: '秒'
    }));
  });

  test('動画計測の記録は計測区間と動画参照を保存できる', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();

    await expectSuccess(db.doc('users/user1/records/videoRecord1').set({
      ...record,
      startMs: 1000,
      endMs: 2234,
      durationMs: 1234,
      videoRef: '/tmp/video.mp4',
      fps: 60
    }));
  });

  test('他人のデータは読めず書けない', async () => {
    const context = await setupTestEnvironment(
      { uid: 'user2' },
      {
        'users/user1/athletes/athlete1': athlete,
        'users/user1/entitlements/current': entitlement
      }
    );
    const db = context.firestore();

    await expectFailure(db.doc('users/user1/athletes/athlete1').get());
    await expectFailure(db.doc('users/user1/entitlements/current').get());
    await expectFailure(db.doc('users/user1/athletes/athlete2').set(athlete));
  });

  test('未認証ユーザーはデータを読めず書けない', async () => {
    const context = await setupTestEnvironment(
      null,
      { 'users/user1/events/event1': event }
    );
    const db = context.firestore();

    await expectFailure(db.doc('users/user1/events/event1').get());
    await expectFailure(db.doc('users/user1/events/event2').set(event));
  });

  test('必須フィールドが不足した選手は作成できない', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();

    await expectFailure(db.doc('users/user1/athletes/athlete1').set({
      note: '',
      createdAt: now,
      updatedAt: now
    }));
  });

  test('snapshotが不足した記録は作成できない', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();

    await expectFailure(db.doc('users/user1/records/record1').set({
      athleteId: 'athlete1',
      eventId: 'event1',
      value: 12.34,
      unit: '秒',
      recordedAt: now,
      note: '',
      createdAt: now,
      updatedAt: now
    }));
  });

  test('記録は既存の選手IDと種目IDを参照する', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();

    await expectFailure(db.doc('users/user1/records/record1').set({
      ...record,
      athleteId: '',
      eventId: ''
    }));
  });

  test('選手と種目はdeletedAtで論理削除できる', async () => {
    const context = await setupTestEnvironment(
      { uid: 'user1' },
      {
        'users/user1/athletes/athlete1': athlete,
        'users/user1/events/event1': event
      }
    );
    const db = context.firestore();

    await expectSuccess(db.doc('users/user1/athletes/athlete1').set({
      ...athlete,
      deletedAt: now
    }));
    await expectSuccess(db.doc('users/user1/events/event1').set({
      ...event,
      deletedAt: now
    }));
  });

  test('未対応のユーザー配下コレクションは使えない', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();

    await expectFailure(db.doc('users/user1/private/profile').set({
      name: 'Private Profile',
      createdAt: now,
      updatedAt: now
    }));
  });
});
