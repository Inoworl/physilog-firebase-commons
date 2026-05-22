# physilog-firestore-commons

PhysiLog の Firestore Security Rules と Firestore データ設計を管理する共通リポジトリです。

## Firestore 設計

Firestore の実コレクション名は、アプリの概念に合わせて日本語名を使います。

```text
users/{userId}
  ├─ 選手/{athleteId}
  ├─ 種目/{eventId}
  └─ 記録/{recordId}
```

`users/{userId}` 配下のデータは本人のみ読み書きできます。匿名認証ユーザー、メール認証にリンク済みのユーザーのどちらも `request.auth.uid` が一致すれば同じRulesで扱います。

### 選手

```js
{
  name: string,
  note?: string,
  deletedAt?: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 種目

```js
{
  name: string,
  unit: string,
  sortOrder: number,
  deletedAt?: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 記録

`記録` はユーザー直下に置き、選手・種目・日付で横断検索できる形にします。

```js
{
  athleteId: string,
  eventId: string,
  recordedAt: Timestamp,
  value: number,
  unit: string,
  athleteNameSnapshot: string,
  eventNameSnapshot: string,
  eventUnitSnapshot: string,
  note?: string,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

`athleteNameSnapshot` / `eventNameSnapshot` / `eventUnitSnapshot` は、選手や種目を後で編集・削除しても過去記録の表示を壊さないために持ちます。

## なぜ記録をユーザー直下に置くか

`users/{uid}/選手/{athleteId}/記録` のようにネストすると、種目別・日付別の横断検索が難しくなります。PhysiLog は選手・種目・日付で記録を見たいアプリなので、`users/{uid}/記録` に集約します。

想定クエリ:

```text
選手詳細:
users/{uid}/記録 where athleteId == athleteId orderBy recordedAt desc

種目別:
users/{uid}/記録 where eventId == eventId orderBy recordedAt desc

選手 x 種目:
users/{uid}/記録 where athleteId == athleteId
                 where eventId == eventId
                 orderBy recordedAt desc
```

## ローカルテスト

```bash
npm install
npm run emulator:test:ci
```

## Firebase project alias

`.firebaserc` は以下を前提にしています。

```json
{
  "dev": "physilog-dev",
  "prod": "physilog-prod"
}
```

prod の Firebase project ID が異なる場合は、`.firebaserc` の `prod` を実プロジェクトIDへ変更してください。

## デプロイ

ローカルでFirebase CLIにログイン済みの場合:

```bash
firebase deploy --only firestore --project dev
firebase deploy --only firestore --project prod
```

GitHub Actions では `Deploy Firestore Rules` workflow を手動実行し、`dev` または `prod` を選びます。

必要なGitHub Secrets:

- `FIREBASE_SERVICE_ACCOUNT_DEV`
- `FIREBASE_SERVICE_ACCOUNT_PROD`

どちらも対象Firebase projectへ `Firebase Rules Admin` 相当の権限を持つサービスアカウントJSONを登録します。
