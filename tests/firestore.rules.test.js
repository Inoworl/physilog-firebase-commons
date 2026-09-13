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

  const appVersionSettings = {
    title: 'アプリの更新',
    content: '最新バージョンへ更新してください。',
    forceUpdate: true,
    iOSLatestVersion: '1.1.0',
    androidLatestVersion: '1.1.0',
    iOSMinRequiredVersion: '1.0.0',
    androidMinRequiredVersion: '1.0.0',
    appStoreUrl: 'https://apps.apple.com/app/example',
    googlePlayUrl: 'https://play.google.com/store/apps/details?id=example'
  };

  const entitlement = {
    plan: 'free',
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

  test('種目は記録の型と計測方法を保存できる', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();

    await expectSuccess(db.doc('users/user1/events/event1').set({
      ...event,
      recordType: 'distance',
      measurementMethod: 'manual'
    }));
  });

  test('種目は記録の型と計測方法を省略しても保存できる', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();

    // 既存種目（新フィールドなし）も従来どおり保存できる
    await expectSuccess(db.doc('users/user1/events/event1').set(event));
  });

  test('不正な記録の型の種目は保存できない', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();

    await expectFailure(db.doc('users/user1/events/event1').set({
      ...event,
      recordType: 'banana'
    }));
  });

  test('不正な計測方法の種目は保存できない', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();

    await expectFailure(db.doc('users/user1/events/event1').set({
      ...event,
      measurementMethod: 'telepathy'
    }));
  });

  test('種目はベスト方向(scoreDirection)を保存できる', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();

    await expectSuccess(db.doc('users/user1/events/event1').set({
      ...event,
      scoreDirection: 'none'
    }));
  });

  test('不正なベスト方向の種目は保存できない', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();

    await expectFailure(db.doc('users/user1/events/event1').set({
      ...event,
      scoreDirection: 'sideways'
    }));
  });

  test('認証済みユーザーは自分の記録を作成して読める', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();

    await expectSuccess(db.doc('users/user1/records/record1').set(record));
    await expectSuccess(db.doc('users/user1/records/record1').get());
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

  test('ウェイト種目(recordType=weight)を保存できる', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();

    await expectSuccess(db.doc('users/user1/events/event1').set({
      ...event,
      unit: 'kg',
      recordType: 'weight'
    }));
  });

  test('記録はセット配列(sets)を保存できる', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();

    await expectSuccess(db.doc('users/user1/records/weightRecord1').set({
      ...record,
      unit: 'kg',
      value: 80,
      sets: [
        { weight: 60, reps: 10 },
        { weight: 70, reps: 8 },
        { weight: 80, reps: 5 }
      ]
    }));
  });

  test('setsがlistでない記録は保存できない', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();

    await expectFailure(db.doc('users/user1/records/record1').set({
      ...record,
      sets: 'notalist'
    }));
  });

  test('setsが上限(50)を超える記録は保存できない', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();

    await expectFailure(db.doc('users/user1/records/record1').set({
      ...record,
      sets: Array.from({ length: 51 }, () => ({ weight: 1, reps: 1 }))
    }));
  });

  test('他人のデータは読めず書けない', async () => {
    const context = await setupTestEnvironment(
      { uid: 'user2' },
      { 'users/user1/athletes/athlete1': athlete }
    );
    const db = context.firestore();

    await expectFailure(db.doc('users/user1/athletes/athlete1').get());
    await expectFailure(db.doc('users/user1/athletes/athlete2').set(athlete));
  });

  test('認証済みユーザーは自分の権限情報を読める', async () => {
    const context = await setupTestEnvironment(
      { uid: 'user1' },
      { 'users/user1/entitlements/current': entitlement }
    );
    const db = context.firestore();

    await expectSuccess(db.doc('users/user1/entitlements/current').get());
  });

  test('他人の権限情報は読めない', async () => {
    const context = await setupTestEnvironment(
      { uid: 'user2' },
      { 'users/user1/entitlements/current': entitlement }
    );
    const db = context.firestore();

    await expectFailure(db.doc('users/user1/entitlements/current').get());
  });

  test('クライアントは権限情報を書き込めない', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();

    await expectFailure(
      db.doc('users/user1/entitlements/current').set(entitlement)
    );
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

  test('認証済みユーザーはアプリバージョン設定を読める', async () => {
    const context = await setupTestEnvironment(
      { uid: 'user1' },
      { 'settings/appVersion': appVersionSettings }
    );
    const db = context.firestore();

    await expectSuccess(db.doc('settings/appVersion').get());
  });

  test('未認証ユーザーはアプリバージョン設定を読めない', async () => {
    const context = await setupTestEnvironment(
      null,
      { 'settings/appVersion': appVersionSettings }
    );
    const db = context.firestore();

    await expectFailure(db.doc('settings/appVersion').get());
  });

  test('クライアントはアプリバージョン設定を書き込めない', async () => {
    const context = await setupTestEnvironment({ uid: 'user1' });
    const db = context.firestore();

    await expectFailure(db.doc('settings/appVersion').set(appVersionSettings));
  });
});
