const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..');
const runbookPath = path.join(
  repositoryRoot,
  'docs',
  'revenuecat-google-play-operations.md',
);
const terraformDirectory = path.join(
  repositoryRoot,
  'infrastructure',
  'terraform',
  'revenuecat-google-play',
);
const workflowPath = path.join(
  repositoryRoot,
  '.github',
  'workflows',
  'revenuecat-config-policy.yml',
);

function readFile(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

describe('RevenueCat Google Play operations policy', () => {
  test('keeps the one-time Google Cloud setup out of Terraform', () => {
    expect(fs.existsSync(terraformDirectory)).toBe(false);
  });

  test.each([
    [
      'dev',
      'physilog-dev',
      'com.inoworl.physilog.dev',
      'physilog-revenuecat@physilog-dev.iam.gserviceaccount.com',
    ],
    [
      'prod',
      'physilog-cb6cd',
      'com.inoworl.physilog',
      'physilog-revenuecat@physilog-cb6cd.iam.gserviceaccount.com',
    ],
  ])(
    'documents the %s environment boundary',
    (environment, projectId, packageName, serviceAccount) => {
      const runbook = readFile(runbookPath);

      expect(runbook).toContain(environment);
      expect(runbook).toContain(projectId);
      expect(runbook).toContain(packageName);
      expect(runbook).toContain(serviceAccount);
    },
  );

  test('documents only the required Google APIs and excludes Pub/Sub', () => {
    const runbook = readFile(runbookPath);
    const documentedApis = [
      ...new Set(runbook.match(/[a-z]+\.googleapis\.com/g) ?? []),
    ].sort();

    expect(documentedApis).toEqual([
      'androidpublisher.googleapis.com',
      'playdeveloperreporting.googleapis.com',
    ]);
    expect(runbook).toContain('Pub/Sub');
    expect(runbook).toContain('構成しない');
  });

  test('documents the manual Google Play and RevenueCat checks', () => {
    const runbook = readFile(runbookPath);
    const appPermissions = runbook.slice(
      runbook.indexOf('### アプリの権限'),
      runbook.indexOf('### アカウントの権限'),
    );
    const accountPermissions = runbook.slice(
      runbook.indexOf('### アカウントの権限'),
      runbook.indexOf('## 鍵の作成と保管'),
    );

    expect(runbook).toContain('Google Play Console');
    expect(runbook).toContain('アプリの権限');
    expect(runbook).toContain('アカウントの権限');
    expect(appPermissions).toContain('アプリ情報の閲覧（読み取り専用）');
    expect(appPermissions).toContain('ストアでの表示の管理');
    expect(accountPermissions).toContain(
      '売上データ、注文、解約アンケートの回答の閲覧',
    );
    expect(accountPermissions).toContain('注文と定期購入の管理');
    expect(accountPermissions).not.toContain('\n- ストアでの表示の管理');
    expect(runbook).toContain(
      'devサービスアカウントからprodアプリの権限を削除します',
    );
    expect(runbook).toContain('RevenueCat');
    expect(runbook).toContain('Google Play subscription purchases');
    expect(runbook).toContain('In-app product catalog');
    expect(runbook).toContain('Subscription catalog');
    expect(runbook).toContain('Credentials Validation Details');
    expect(runbook).toContain(
      'Project ID不一致を成功として扱いません',
    );
  });

  test('documents repeatable verification and recovery procedures', () => {
    const runbook = readFile(runbookPath);

    expect(runbook).toContain('gcloud services list');
    expect(runbook).toContain('gcloud iam service-accounts describe');
    expect(runbook).toContain('NOT_FOUND');
    expect(runbook).not.toContain('2>&1 ||');
    expect(runbook).toContain('再構築');
    expect(runbook).toContain('ローテーション');
    expect(runbook).toContain('失効');
  });

  test('protects temporary credentials from Git', () => {
    const gitignore = readFile(path.join(repositoryRoot, '.gitignore'));
    const runbook = readFile(runbookPath);

    expect(gitignore).toContain('.secrets/');
    expect(gitignore).toContain('*.p8');
    expect(runbook).toContain('.secrets/');
    expect(runbook).toContain(
      'GOOGLE_PLAY_REVENUECAT_DEV_SERVICE_ACCOUNT_KEY_JSON_BASE64',
    );
    expect(runbook).toContain(
      'GOOGLE_PLAY_REVENUECAT_PROD_SERVICE_ACCOUNT_KEY_JSON_BASE64',
    );
    expect(runbook).toContain('Gitにコミットしない');
  });

  test('runs the policy test in CI for dev and prod-bound branches', () => {
    const workflow = readFile(workflowPath);

    expect(workflow).toContain('branches:');
    expect(workflow).toContain('- dev');
    expect(workflow).toContain('- main');
    expect(workflow).toContain(
      'npm test -- --runInBand tests/revenuecat.google-play-operations.test.js',
    );
    expect(workflow).not.toMatch(/\bgcloud\b/);
  });
});
