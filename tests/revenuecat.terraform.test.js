const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..');
const terraformRoot = path.join(
  repositoryRoot,
  'infrastructure',
  'terraform',
  'revenuecat-google-play',
);
const moduleDirectory = path.join(
  terraformRoot,
  'modules',
  'revenuecat-google-play',
);
const environmentDirectories = {
  dev: path.join(terraformRoot, 'environments', 'dev'),
  prod: path.join(terraformRoot, 'environments', 'prod'),
};

function readTerraformFiles(directory) {
  if (!fs.existsSync(directory)) {
    return '';
  }

  return fs
    .readdirSync(directory)
    .filter((fileName) => fileName.endsWith('.tf'))
    .sort()
    .map((fileName) =>
      fs.readFileSync(path.join(directory, fileName), 'utf8'),
    )
    .join('\n');
}

function readAllTerraformFiles(directory) {
  if (!fs.existsSync(directory)) {
    return '';
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readAllTerraformFiles(entryPath);
      }
      return entry.name.endsWith('.tf')
        ? fs.readFileSync(entryPath, 'utf8')
        : '';
    })
    .join('\n');
}

describe('RevenueCat Google Play Terraform configuration', () => {
  test('defines the shared resource implementation in a reusable module', () => {
    const configuration = readTerraformFiles(moduleDirectory);

    expect(configuration).toContain(
      'resource "google_service_account" "revenuecat"',
    );
    expect(configuration).toContain('variable "project_id"');
    expect(configuration).toContain('androidpublisher.googleapis.com');
    expect(configuration).toContain('playdeveloperreporting.googleapis.com');

    const configuredServices = [
      ...new Set(configuration.match(/[a-z]+\.googleapis\.com/g) ?? []),
    ].sort();
    expect(configuredServices).toEqual([
      'androidpublisher.googleapis.com',
      'playdeveloperreporting.googleapis.com',
    ]);
  });

  test.each([
    ['dev', 'physilog-dev'],
    ['prod', 'physilog-cb6cd'],
  ])('%s has an independent root pinned to the expected project', (name, id) => {
    const directory = environmentDirectories[name];
    const configuration = readTerraformFiles(directory);

    expect(fs.existsSync(path.join(directory, '.terraform.lock.hcl'))).toBe(
      true,
    );
    expect(configuration).toContain(
      'source = "../../modules/revenuecat-google-play"',
    );
    expect(configuration).toContain(`project_id = "${id}"`);
    expect(configuration).not.toContain('variable "project_id"');
  });

  test('migrates existing dev resource addresses without recreating resources', () => {
    const configuration = readTerraformFiles(environmentDirectories.dev);

    expect(configuration).toContain('from = google_service_account.revenuecat');
    expect(configuration).toContain(
      'to   = module.revenuecat_google_play.google_service_account.revenuecat',
    );
    expect(configuration).toContain(
      'from = google_project_service.required',
    );
    expect(configuration).toContain(
      'to   = module.revenuecat_google_play.google_project_service.required',
    );
    expect(configuration).toContain(
      'to = module.revenuecat_google_play.google_service_account.revenuecat',
    );
    expect(configuration).toContain(
      'to = module.revenuecat_google_play.google_project_service.required["androidpublisher.googleapis.com"]',
    );
    expect(configuration).toContain(
      'to = module.revenuecat_google_play.google_project_service.required["playdeveloperreporting.googleapis.com"]',
    );
  });

  test('keeps prod additive by excluding imports and migration blocks', () => {
    const configuration = readTerraformFiles(environmentDirectories.prod);

    expect(configuration).not.toContain('import {');
    expect(configuration).not.toContain('moved {');
  });

  test('does not manage Pub/Sub, notification IAM, or service account keys', () => {
    const configuration = readAllTerraformFiles(terraformRoot);

    expect(configuration).not.toMatch(/resource\s+"google_pubsub_/);
    expect(configuration).not.toContain('roles/pubsub.');
    expect(configuration).not.toContain('roles/monitoring.viewer');
    expect(configuration).not.toContain('google_service_account_key');
    expect(configuration).not.toMatch(
      /resource\s+"google_(?:project|service_account)_iam_/,
    );
  });

  test('ignores Terraform state and local plan artifacts', () => {
    const gitignore = fs.readFileSync(
      path.join(repositoryRoot, '.gitignore'),
      'utf8',
    );

    expect(gitignore).toContain('*.tfstate');
    expect(gitignore).toContain('*.tfplan');
    expect(gitignore).toContain('.terraform/');
  });

  test('documents environment boundaries and manual secret operations', () => {
    const readmePath = path.join(terraformRoot, 'README.md');
    const readme = fs.existsSync(readmePath)
      ? fs.readFileSync(readmePath, 'utf8')
      : '';

    expect(readme).toContain('Pub/Sub');
    expect(readme).toContain('サービスアカウント鍵');
    expect(readme).toContain('Google Play Console');
    expect(readme).toContain('RevenueCat');
    expect(readme).toContain('アプリの権限');
    expect(readme).toContain('アカウントの権限');
    expect(readme).toContain(
      'GOOGLE_PLAY_REVENUECAT_DEV_SERVICE_ACCOUNT_KEY_JSON_BASE64',
    );
    expect(readme).toContain(
      'GOOGLE_PLAY_REVENUECAT_PROD_SERVICE_ACCOUNT_KEY_JSON_BASE64',
    );
    expect(readme).toContain(
      '売上データ、注文、解約アンケートの回答の閲覧',
    );
    expect(readme).toContain('注文と定期購入の管理');
  });

  test('validates both environment roots in CI without applying infrastructure', () => {
    const workflowPath = path.join(
      repositoryRoot,
      '.github',
      'workflows',
      'terraform-validate.yml',
    );
    const workflow = fs.existsSync(workflowPath)
      ? fs.readFileSync(workflowPath, 'utf8')
      : '';

    expect(workflow).toContain('terraform fmt -check -recursive');
    expect(workflow).toContain('environment: [dev, prod]');
    expect(workflow).toContain(
      'infrastructure/terraform/revenuecat-google-play/environments/${{ matrix.environment }}',
    );
    expect(workflow).not.toMatch(
      /defaults:\s*\n\s*run:\s*\n\s*working-directory:[^\n]*matrix\.environment/,
    );
    expect(workflow).toContain('terraform validate');
    expect(workflow).toContain(
      'npm test -- --runInBand tests/revenuecat.terraform.test.js',
    );
    expect(workflow).toContain('uses: actions/checkout@v6');
    expect(workflow).toContain('uses: actions/setup-node@v6');
    expect(workflow).toContain('uses: hashicorp/setup-terraform@v4.0.1');
    expect(workflow).not.toMatch(/terraform\s+(apply|destroy)/);
  });
});
