const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} = require('@firebase/rules-unit-testing');
const fs = require('fs');

let testEnv;

async function setupTestEnvironment(auth = null, data = {}) {
  testEnv = await initializeTestEnvironment({
    projectId: `physilog-test-${Date.now()}`,
    firestore: {
      rules: fs.readFileSync('security_rules/firestore/firestore.rules', 'utf8'),
      host: process.env.FIRESTORE_EMULATOR_HOST?.split(':')[0] || '127.0.0.1',
      port: Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1] || 8080)
    }
  });

  if (Object.keys(data).length > 0) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      for (const [path, docData] of Object.entries(data)) {
        await db.doc(path).set(docData);
      }
    });
  }

  if (auth) {
    return testEnv.authenticatedContext(auth.uid, {
      sub: auth.uid,
      email: auth.email,
      email_verified: auth.emailVerified ?? false
    });
  }

  return testEnv.unauthenticatedContext();
}

async function teardownTestEnvironment() {
  if (!testEnv) {
    return;
  }

  await testEnv.clearFirestore();
  await testEnv.cleanup();
  testEnv = null;
}

module.exports = {
  setupTestEnvironment,
  teardownTestEnvironment,
  expectSuccess: assertSucceeds,
  expectFailure: assertFails
};
