# RevenueCat Google Play Terraform

RevenueCatがGoogle Playの購入・定期購入情報を検証するために必要な、最小限のGoogle Cloudリソースを管理します。

## 管理対象

- 共有サービスアカウント
  - `physilog-revenuecat@physilog-dev.iam.gserviceaccount.com`
- Google Play Android Developer API
  - `androidpublisher.googleapis.com`
- Google Play Developer Reporting API
  - `playdeveloperreporting.googleapis.com`

サービスアカウントは`physilog-dev`プロジェクトに1個だけ置き、Google Play Console側で以下の両アプリに限定してアクセスを許可します。

- PhysiLog Dev: `com.inoworl.physilog.dev`
- PhysiLog: `com.inoworl.physilog`

Google Play Consoleの権限がアプリ単位のアクセス範囲を決めるため、prod用Google Cloudプロジェクト`physilog-cb6cd`に同じサービスアカウントを重複作成しません。

## 管理対象外

次の情報や操作はTerraform stateに含めません。

- サービスアカウント鍵の作成、内容、Base64値
- Google Play Consoleのアプリ別権限
- RevenueCatへのサービスアカウントJSON登録
- Pub/Sub、Real-time Developer Notifications（RTDN）

サービスアカウント鍵を`google_service_account_key`で作成すると秘密鍵がTerraform stateに保存されるため、鍵はTerraformの管理対象外です。鍵はリポジトリ外のSecret管理領域で管理し、Flutterアプリ、Git、CIログには含めません。

現在のSecret変数名は次のとおりです。値はこのリポジトリに置きません。

```text
GOOGLE_PLAY_REVENUECAT_INOWORL_SERVICE_ACCOUNT_KEY_JSON_BASE64
```

## Pub/Subを構成しない理由

RevenueCatのサービスアカウント認証とGoogle Play Developer APIがあれば、アプリから送信された購入情報の検証と大部分の定期購入更新を処理できます。

Pub/Subを使うRTDNは、アプリが起動していない間の更新、解約、返金などをより早く反映するための追加構成です。現段階ではGCPリソースを最小化するため導入せず、反映遅延が運用上の問題になった場合に別Issueで追加します。

## 初回移行

この構成には、手動作成済みのサービスアカウントと有効化済みAndroid Publisher APIを取り込む`import`ブロックがあります。

```bash
cd infrastructure/terraform/revenuecat-google-play
terraform init
terraform plan -out=terraform.tfplan
terraform apply terraform.tfplan
```

初回planでは次を確認してください。

- サービスアカウントを削除・再作成しない
- Android Publisher APIを再作成しない
- Play Developer Reporting APIだけを新しく有効化する
- Pub/SubやIAMロールを作成しない

サービスアカウントには`deletion_policy = "PREVENT"`を設定しています。APIもTerraform構成を削除しただけでは無効化されません。

## ローカル検証

Google Cloudへ接続しない構文検証:

```bash
terraform fmt -check -recursive
terraform init -backend=false
terraform validate
```

実環境との差分確認:

```bash
gcloud auth application-default login
terraform plan
```

Terraform stateとplanファイルはGit管理しません。ローカルstateを失った場合も、`import`ブロックによって既存リソースを再度取り込めます。

GCPリソースを増やさないため、現段階ではstate保存用GCS bucketを作成せず、local backendを使用します。この構成は単一管理者で運用し、複数端末や複数人から同時に`plan`や`apply`を実行しないでください。共同運用が必要になった場合は、state lockingを備えたremote backendへの移行を別Issueで扱います。

## Google Play Consoleの手動設定

サービスアカウントを`PhysiLog`と`PhysiLog Dev`へ追加し、両アプリに以下の権限を付与します。

- アプリ情報の閲覧（読み取り専用）
- 売上データの表示（Purchases APIへのアクセスを含む）
- 注文と定期購入の管理
- ストアでの表示の管理

権限変更がRevenueCatへ伝播するまで、最大36時間かかる場合があります。

## RevenueCatの手動設定

Secret管理領域からJSONを一時的に復元し、以下のAndroidアプリ設定へ登録します。

- RevenueCat dev: `com.inoworl.physilog.dev`
- RevenueCat prod: `com.inoworl.physilog`

アップロード後はRevenueCatのcredential validatorで次を確認します。

- Google Play subscription purchasesを検証できる
- In-app product catalogを読み取れる
- Subscription catalogとbase plansを読み取れる

使用した一時JSONは検証後に削除します。

## RTDNを後から追加する場合

RTDNが必要になった場合は、この構成へ無断で追加せず、別Issueで必要性と追加リソースを確認します。追加候補はPub/Sub topic、topic IAM、RevenueCatとGoogle Play Consoleの通知接続です。
