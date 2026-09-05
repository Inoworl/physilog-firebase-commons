const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..');
const terraformDirectory = path.join(
  repositoryRoot,
  'infrastructure',
  'terraform',
  'revenuecat-google-play',
);

function readTerraformFiles() {
  if (!fs.existsSync(terraformDirectory)) {
    return '';
  }

  return fs
    .readdirSync(terraformDirectory)
    .filter((fileName) => fileName.endsWith('.tf'))
    .sort()
    .map((fileName) =>
      fs.readFileSync(path.join(terraformDirectory, fileName), 'utf8'),
    )
    .join('\n');
}

describe('RevenueCat Google Play Terraform configuration', () => {
  test('declares the existing RevenueCat service account and required APIs', () => {
    const configuration = readTerraformFiles();

    expect(configuration).toContain(
      'resource "google_service_account" "revenuecat"',
    );
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

  test('imports the existing service account and Android Publisher API', () => {
    const configuration = readTerraformFiles();

    expect(configuration).toContain('to = google_service_account.revenuecat');
    expect(configuration).toContain(
      'to = google_project_service.required["androidpublisher.googleapis.com"]',
    );
  });

  test('does not manage Pub/Sub, notification IAM, or service account keys', () => {
    const configuration = readTerraformFiles();

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

  test('documents the Terraform boundary and manual secret operations', () => {
    const readmePath = path.join(terraformDirectory, 'README.md');

    expect(fs.existsSync(readmePath)).toBe(true);

    const readme = fs.existsSync(readmePath)
      ? fs.readFileSync(readmePath, 'utf8')
      : '';
    expect(readme).toContain('Pub/Sub');
    expect(readme).toContain('サービスアカウント鍵');
    expect(readme).toContain('Google Play Console');
    expect(readme).toContain('RevenueCat');
  });

  test('validates Terraform in CI without applying infrastructure', () => {
    const workflowPath = path.join(
      repositoryRoot,
      '.github',
      'workflows',
      'terraform-validate.yml',
    );

    expect(fs.existsSync(workflowPath)).toBe(true);

    const workflow = fs.existsSync(workflowPath)
      ? fs.readFileSync(workflowPath, 'utf8')
      : '';
    expect(workflow).toContain('terraform fmt -check -recursive');
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
