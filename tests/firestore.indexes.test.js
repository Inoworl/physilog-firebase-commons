const fs = require('fs');

describe('PhysiLog Firestore indexes', () => {
  const indexes = JSON.parse(
    fs.readFileSync('security_rules/firestore/firestore.indexes.json', 'utf8')
  ).indexes;

  test('athletes一覧はdeletedAtとnameの複合indexで取得できる', () => {
    expect(indexes).toContainEqual({
      collectionGroup: 'athletes',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'deletedAt', order: 'ASCENDING' },
        { fieldPath: 'name', order: 'ASCENDING' }
      ]
    });
  });

  test('events一覧はdeletedAtとsortOrderとnameの複合indexで取得できる', () => {
    expect(indexes).toContainEqual({
      collectionGroup: 'events',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'deletedAt', order: 'ASCENDING' },
        { fieldPath: 'sortOrder', order: 'ASCENDING' },
        { fieldPath: 'name', order: 'ASCENDING' }
      ]
    });
  });
});
