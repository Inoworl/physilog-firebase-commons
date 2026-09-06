# RevenueCat Google Play連携 Runbook

更新日: 2026-09-07

## 対象読者と目的

このRunbookは、PhysiLogのリリース運用担当者を対象とします。RevenueCatがGoogle Playの購入・定期購入情報を検証できるように、dev/prodそれぞれのGoogle Cloud、Google Play Console、RevenueCatを設定・確認・復旧する手順を定義します。

## 管理方針

今回必要なGoogle Cloudリソースは、環境ごとのサービスアカウント1個とAPI 2個だけです。一度だけ作成する小規模な構成であり、Google Play ConsoleとRevenueCatには手動設定が残るため、Terraformでは管理しません。

次の情報をこのリポジトリへ保存しません。

- サービスアカウントJSON鍵
- Base64へ変換した鍵
- RevenueCatのSecret API key
- App Store Connectの`.p8`鍵
- `.env`ファイル

一時ファイルはリポジトリ直下の`.secrets/`へ置きます。`.secrets/`はGitの除外対象ですが、作業完了後に一時ファイル自体も削除します。秘密情報はGitにコミットしないでください。Base64は暗号化ではありません。

## 環境の対応関係

| 環境 | Google Cloud project | Android package | サービスアカウント | Secret変数 |
| --- | --- | --- | --- | --- |
| dev | `physilog-dev` | `com.inoworl.physilog.dev` | `physilog-revenuecat@physilog-dev.iam.gserviceaccount.com` | `GOOGLE_PLAY_REVENUECAT_DEV_SERVICE_ACCOUNT_KEY_JSON_BASE64` |
| prod | `physilog-cb6cd` | `com.inoworl.physilog` | `physilog-revenuecat@physilog-cb6cd.iam.gserviceaccount.com` | `GOOGLE_PLAY_REVENUECAT_PROD_SERVICE_ACCOUNT_KEY_JSON_BASE64` |

サービスアカウントを分離する目的は、鍵のローテーション、監査、漏洩時の影響範囲をdev/prodで分けることです。Google Play Consoleの一部のアカウント権限は、同じPlayデベロッパーアカウント内の全アプリへ作用します。

## Google Cloudの期待状態

両方のprojectで有効にするAPIは次の2つだけです。

- Google Play Android Developer API: `androidpublisher.googleapis.com`
- Google Play Developer Reporting API: `playdeveloperreporting.googleapis.com`

Pub/SubとReal-time Developer Notifications（RTDN）は構成しない方針です。アプリが起動していない間の解約・返金などを、より早く反映する必要が生じた場合は別Issueで検討します。

## 初回設定

以下は環境ごとに実行します。すべての`gcloud`コマンドでprojectを明示し、現在のデフォルトprojectには依存しません。

### dev

```bash
PROJECT_ID=physilog-dev
SERVICE_ACCOUNT_ID=physilog-revenuecat
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud services enable \
  androidpublisher.googleapis.com \
  playdeveloperreporting.googleapis.com \
  --project="$PROJECT_ID"

gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" \
  --project="$PROJECT_ID"
```

`describe`が`NOT_FOUND`を返した場合だけ、次を実行します。権限不足や通信障害の場合は作成へ進まず、先にエラーを解消します。

```bash
gcloud iam service-accounts create "$SERVICE_ACCOUNT_ID" \
  --display-name="RevenueCat Google Play" \
  --project="$PROJECT_ID"
```

### prod

```bash
PROJECT_ID=physilog-cb6cd
SERVICE_ACCOUNT_ID=physilog-revenuecat
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud services enable \
  androidpublisher.googleapis.com \
  playdeveloperreporting.googleapis.com \
  --project="$PROJECT_ID"

gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" \
  --project="$PROJECT_ID"
```

`describe`が`NOT_FOUND`を返した場合だけ、次を実行します。権限不足や通信障害の場合は作成へ進まず、先にエラーを解消します。

```bash
gcloud iam service-accounts create "$SERVICE_ACCOUNT_ID" \
  --display-name="RevenueCat Google Play" \
  --project="$PROJECT_ID"
```

サービスアカウントへproject IAM roleは追加しません。Google Play購入情報へのアクセスは、次のGoogle Play Console側で付与します。

## Google Play Consoleの手動設定

Google Play Consoleの「ユーザーと権限」で対象サービスアカウントを追加し、「アプリの権限」と「アカウントの権限」を分けて設定します。

### アプリの権限

- devサービスアカウント: PhysiLog Dev（`com.inoworl.physilog.dev`）だけを対象にする
- prodサービスアカウント: PhysiLog（`com.inoworl.physilog`）だけを対象にする

対象アプリを追加し、各アプリの「権限を管理」で次の2権限を付与します。

- アプリ情報の閲覧（読み取り専用）
- ストアでの表示の管理

devサービスアカウントへprodアプリを、prodサービスアカウントへdevアプリを追加しません。既存設定でdevサービスアカウントにprodアプリが追加されている場合は、prod credentialをRevenueCatで検証した後、devサービスアカウントからprodアプリの権限を削除します。切り替え前に削除して購入検証を停止させないでください。

### アカウントの権限

RevenueCatの公式手順に従い、次の2権限を付与します。この2権限はPlay Consoleの仕様上、デベロッパーアカウント内の全アプリへ作用します。

- 売上データ、注文、解約アンケートの回答の閲覧
- 注文と定期購入の管理

「ストアでの表示の管理」は、RevenueCatからGoogle Playの商品を作成・更新するときにも必要ですが、対象アプリ側で付与します。管理者権限や無関係なアカウント権限は追加しません。権限変更がRevenueCatへ伝播するまで、通常24時間、最大36時間以上かかる場合があります。保存直後に`insufficient permissions`が表示されても権限を重複変更せず、伝播後に再確認します。

## 鍵の作成と保管

Google Play Consoleの設定後、環境ごとのサービスアカウント鍵を作成します。鍵はローカルの一時領域へ出力します。

```bash
ENVIRONMENT=dev
PROJECT_ID=physilog-dev
SERVICE_ACCOUNT_EMAIL="physilog-revenuecat@${PROJECT_ID}.iam.gserviceaccount.com"
KEY_FILE=".secrets/revenuecat/${ENVIRONMENT}-google-play.json"

mkdir -p "$(dirname "$KEY_FILE")"
gcloud iam service-accounts keys create "$KEY_FILE" \
  --iam-account="$SERVICE_ACCOUNT_EMAIL" \
  --project="$PROJECT_ID"
```

prodでは`ENVIRONMENT=prod`、`PROJECT_ID=physilog-cb6cd`に置き換えます。同じ鍵をdev/prodで共有しません。

Secret保管先でBase64形式が必要な場合は、標準出力へ秘密値を表示せずクリップボードへコピーします。

```bash
base64 -i "$KEY_FILE" | tr -d '\n' | pbcopy
```

対応するSecret変数へ保存した後、RevenueCatへは元のJSONファイルをアップロードします。アップロードと検証が完了したら、一時JSONとクリップボードを消去します。

```bash
rm "$KEY_FILE"
printf '' | pbcopy
```

## RevenueCatの手動設定

環境とAndroid appを取り違えないよう、次の対応でサービスアカウントJSONを登録します。

- dev鍵 → RevenueCat devの`com.inoworl.physilog.dev`
- prod鍵 → RevenueCat prodの`com.inoworl.physilog`

RevenueCatのcredential validatorで、次の3項目が成功することを確認します。

- `Google Play subscription purchases`を検証できる
- `In-app product catalog`を読み取れる
- `Subscription catalog`とbase plansを読み取れる

`Valid credentials`と3項目の成功だけでは環境分離を確認できません。
`Credentials Validation Details`を開き、表示されるProject IDが次の値と一致することも確認します。

| RevenueCat environment | Expected service account Project ID |
| --- | --- |
| dev | `physilog-dev` |
| prod | `physilog-cb6cd` |

Play Consoleのアカウント権限は複数アプリへ作用するため、別環境のService Accountでも3項目だけは成功する場合があります。Project ID不一致を成功として扱いません。

1項目でも失敗する場合、またはProject IDが一致しない場合は、新しい鍵を作り直す前に、project、Android package、サービスアカウントメール、Google Play Consoleの権限、権限伝播時間を確認します。

## 設定確認

環境ごとに変数を設定し、APIとサービスアカウントの存在を確認します。この操作は読み取り専用です。

```bash
PROJECT_ID=physilog-dev
SERVICE_ACCOUNT_EMAIL="physilog-revenuecat@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud services list --enabled \
  --project="$PROJECT_ID" \
  --filter='name:(androidpublisher.googleapis.com OR playdeveloperreporting.googleapis.com)' \
  --format='value(config.name)'

gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" \
  --project="$PROJECT_ID" \
  --format='value(email,disabled)'
```

prodは`PROJECT_ID=physilog-cb6cd`へ置き換えます。APIが2件表示され、サービスアカウントが取得できることを確認します。有効なアカウントの`disabled`は、gcloudのバージョンや出力形式によって空欄または`False`になります。`True`の場合はその鍵を再利用せず、新しいcredentialを作成します。

Google Play ConsoleとRevenueCatはCLIだけでは確認できないため、リリース前チェックリストに沿って両方の画面を確認します。

## 再構築と復旧

Terraform stateは存在しないため、端末交換時にstateを移行する必要はありません。Runbookの「設定確認」を実行し、不足している項目だけ「初回設定」から再実行します。API有効化は再実行しても期待状態が変わりません。サービスアカウントが存在する場合、記載したコマンドは新規作成をスキップします。

サービスアカウントを誤って削除した場合は、同じIDで再構築し、新しい鍵を作成してGoogle Play ConsoleとRevenueCatを再設定します。削除前の鍵は復元できません。

## 鍵のローテーションと失効

鍵は次の順序でローテーションします。

1. 同じ環境のサービスアカウントに新しい鍵を作成する。
2. 対応するSecret変数を新しい値へ更新する。
3. RevenueCatへ新しいJSON鍵を登録する。
4. credential validatorの3項目がすべて成功するまで待つ。
5. 古い鍵のkey IDを確認し、Google Cloudで古い鍵だけを失効・削除する。
6. `.secrets/`の一時JSONとクリップボードを消去する。

新しい鍵の検証が完了する前に古い鍵を失効しません。devの鍵をprodへ、prodの鍵をdevへ登録しません。

鍵一覧は次の読み取り専用コマンドで確認します。

```bash
gcloud iam service-accounts keys list \
  --iam-account="$SERVICE_ACCOUNT_EMAIL" \
  --project="$PROJECT_ID"
```

## リリース前チェックリスト

- [ ] 対象環境のproject IDとAndroid packageが一致している
- [ ] 必要なAPI 2件が有効である
- [ ] 環境専用サービスアカウントが有効である
- [ ] Google Play Consoleの対象アプリだけにアプリ権限が設定され、別環境のアプリ権限がない
- [ ] 売上閲覧と注文管理のアカウント権限が設定されている
- [ ] RevenueCatのcredential validatorが3項目とも成功している
- [ ] Credentials Validation DetailsのProject IDが対象環境と一致している
- [ ] dev/prodで別の鍵とSecret変数を使用している
- [ ] 一時JSON、クリップボード、作業ログに秘密値が残っていない
- [ ] 鍵、`.env`、`.p8`がGit差分に含まれていない

## 保守メモ

Google Play ConsoleまたはRevenueCatの必須権限・検証項目が変わった場合は、このRunbookと`tests/revenuecat.google-play-operations.test.js`を同時に更新します。Pub/SubやRTDNを追加する場合は、目的、費用、運用責任、障害時の復旧方法を別Issueで合意してから構成します。

参照する一次資料:

- [RevenueCat: Creating Play Service Credentials](https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials)
- [Google Play Developer API: Getting Started](https://developers.google.com/android-publisher/getting_started)
