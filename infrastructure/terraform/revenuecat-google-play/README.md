# RevenueCat Google Play Terraform

RevenueCatがGoogle Playの購入・定期購入情報を検証するために必要な、最小限のGoogle Cloudリソースをdev/prod別に管理します。リソース定義は共通moduleへ集約し、環境ごとのGoogle Cloud project、サービスアカウント、Terraform state、鍵を分離します。

## ディレクトリ構成

```text
revenuecat-google-play/
├── modules/
│   └── revenuecat-google-play/  # 両環境で共通のリソース定義
└── environments/
    ├── dev/                     # physilog-dev専用root/state
    └── prod/                    # physilog-cb6cd専用root/state
```

moduleの`project_id`は変数ですが、各環境rootでは対象projectを固定しています。CLIの`-var`指定ミスでdevのstateをprodへ向けないため、環境rootには上書き可能な`project_id`変数を定義しません。

## 管理対象

各環境に次のリソースを作成します。

| 環境 | Google Cloud project | サービスアカウント |
| --- | --- | --- |
| dev | `physilog-dev` | `physilog-revenuecat@physilog-dev.iam.gserviceaccount.com` |
| prod | `physilog-cb6cd` | `physilog-revenuecat@physilog-cb6cd.iam.gserviceaccount.com` |

両環境で有効化するAPIは共通です。

- Google Play Android Developer API（`androidpublisher.googleapis.com`）
- Google Play Developer Reporting API（`playdeveloperreporting.googleapis.com`）

## 環境分離の境界

次のものはdev/prodで分離します。

- Google Cloud projectとサービスアカウント
- Terraform rootとlocal state
- サービスアカウント鍵
- Secret変数
- RevenueCatへ登録するcredential

Google Play Consoleの「売上データ、注文、解約アンケートの回答の閲覧」と「注文と定期購入の管理」は、同一Google Playデベロッパーアカウント内の全アプリへ適用されるアカウントの権限です。そのため、サービスアカウントを分ける目的は鍵ローテーション、監査、漏洩時の影響範囲をdev/prodで分けることであり、Play Console上の完全なアプリ単位分離ではありません。

## 管理対象外

次の情報や操作はTerraform stateに含めません。

- サービスアカウント鍵の作成、内容、Base64値
- Google Play Consoleのアプリ別権限とアカウント権限
- RevenueCatへのサービスアカウントJSON登録
- Pub/Sub、Real-time Developer Notifications（RTDN）

`google_service_account_key`で鍵を作成すると秘密鍵がTerraform stateに保存されるため、鍵はTerraformの管理対象外です。鍵はリポジトリ外のSecret管理領域で管理し、Flutterアプリ、Git、CIログには含めません。

Secret変数も環境ごとに分けます。値はこのリポジトリに置きません。

```text
GOOGLE_PLAY_REVENUECAT_DEV_SERVICE_ACCOUNT_KEY_JSON_BASE64
GOOGLE_PLAY_REVENUECAT_PROD_SERVICE_ACCOUNT_KEY_JSON_BASE64
```

従来の共有変数`GOOGLE_PLAY_REVENUECAT_INOWORL_SERVICE_ACCOUNT_KEY_JSON_BASE64`は移行元としてのみ扱います。既存値をdev用変数へ移した後、prod用サービスアカウントの鍵を別途作成してprod用変数へ保存します。移行完了前に既存鍵を無効化しません。

## 既存dev stateの移行

旧rootのlocal stateを利用している端末では、最初にバックアップを作り、dev rootへ移動します。

```bash
cd infrastructure/terraform/revenuecat-google-play
cp terraform.tfstate terraform.tfstate.pre-environment-split.backup
mv terraform.tfstate environments/dev/terraform.tfstate
cd environments/dev
terraform init
terraform plan -out=terraform.tfplan
terraform apply terraform.tfplan
```

dev rootの`moved`ブロックが旧resource addressをmodule内のaddressへ移します。このplanではサービスアカウントやAPIの削除・再作成がなく、address移行だけになることを確認してください。

dev rootには既存リソースを復旧できる`import`ブロックも残しています。local stateが存在しない環境では、同じ構成から既存devリソースをimportできます。

## prodの初回構築

prodは既存resourceの移行ではなく、新規追加です。

```bash
cd infrastructure/terraform/revenuecat-google-play/environments/prod
terraform init
terraform plan -out=terraform.tfplan
terraform apply terraform.tfplan
```

apply前のplanで、`physilog-cb6cd`にサービスアカウント1個とAPI 2個だけが追加され、devリソースの変更や削除が含まれないことを確認します。

## ローカル検証

Google Cloudへ接続しない構文検証:

```bash
terraform fmt -check -recursive infrastructure/terraform/revenuecat-google-play

cd infrastructure/terraform/revenuecat-google-play/environments/dev
terraform init -backend=false
terraform validate

cd ../prod
terraform init -backend=false
terraform validate
```

実環境との差分は、対象環境のdirectoryで確認します。

```bash
gcloud auth application-default login
terraform plan
```

Terraform stateとplanファイルはGit管理しません。GCPリソースを増やさないためstate保存用GCS bucketは作成せず、環境ごとのlocal backendを使用します。単一管理者で運用し、複数端末や複数人から同時に`plan`や`apply`を実行しないでください。共同運用が必要になった場合は、state lockingを備えたremote backendへの移行を別Issueで扱います。

## Google Play Consoleの手動設定

「ユーザーと権限」で環境ごとのサービスアカウントを開き、「アプリの権限」と「アカウントの権限」を分けて設定します。

### アプリの権限

- devサービスアカウント: PhysiLog Dev（`com.inoworl.physilog.dev`）
- prodサービスアカウント: PhysiLog（`com.inoworl.physilog`）

それぞれの対象アプリに以下を付与します。

- アプリ情報の閲覧（読み取り専用）
- 売上データの表示（Purchases APIへのアクセスを含む）
- 注文と定期購入の管理
- ストアでの表示の管理

### アカウントの権限

RevenueCatのGoogle Play subscription purchase validationに必要な次の2権限を付与します。

- 売上データ、注文、解約アンケートの回答の閲覧
- 注文と定期購入の管理

アカウント権限は同一Playデベロッパーアカウント内の全アプリへ適用されます。管理者権限やその他のアカウント権限は追加しません。

RevenueCatの[公式手順](https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials)は4権限すべてをアカウント権限へ付与する構成です。現構成では、カタログ読取に必要な権限を対象アプリへ限定し、credential validatorでカタログ読取が成功することを確認します。将来RevenueCatからGoogle Playの商品を作成・更新する必要が生じた場合は、追加のアカウント権限を別途レビューします。

権限変更がRevenueCatへ伝播するまで、通常24時間、最大36時間以上かかる場合があります。保存直後に`insufficient permissions`が残っていても権限を重複変更せず、伝播後に再度`Check credentials`を実行します。

## RevenueCatの手動設定

環境ごとのSecretからJSONを一時的に復元し、対応するAndroidアプリ設定へ登録します。

- dev鍵 → RevenueCat dev: `com.inoworl.physilog.dev`
- prod鍵 → RevenueCat prod: `com.inoworl.physilog`

アップロード後は両環境のcredential validatorで次を確認します。

- Google Play subscription purchasesを検証できる
- In-app product catalogを読み取れる
- Subscription catalogとbase plansを読み取れる

RevenueCat prodのcredentialをprod鍵へ置き換えた後、検証がすべて成功するまではGoogle Cloud側の既存dev鍵を無効化しません。使用した一時JSONは検証後に削除します。

## Pub/Subを構成しない理由

RevenueCatのサービスアカウント認証とGoogle Play Developer APIがあれば、アプリから送信された購入情報の検証と大部分の定期購入更新を処理できます。

Pub/Subを使うRTDNは、アプリが起動していない間の更新、解約、返金などをより早く反映するための追加構成です。現段階ではGCPリソースを最小化するため導入せず、反映遅延が運用上の問題になった場合に別Issueで追加します。
