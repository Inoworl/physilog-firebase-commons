const fs = require('fs');

describe('PhysiLog Firestore indexes', () => {
  const indexes = JSON.parse(
    fs.readFileSync('security_rules/firestore/firestore.indexes.json', 'utf8')
  ).indexes;

  test('選手一覧はdeletedAtとnameの複合indexで取得できる', () => {
    expect(indexes).toContainEqual({
      collectionGroup: '選手',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'deletedAt', order: 'ASCENDING' },
        { fieldPath: 'name', order: 'ASCENDING' }
      ]
    });
  });

  test('種目一覧はdeletedAtとsortOrderとnameの複合indexで取得できる', () => {
    expect(indexes).toContainEqual({
      collectionGroup: '種目',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'deletedAt', order: 'ASCENDING' },
        { fieldPath: 'sortOrder', order: 'ASCENDING' },
        { fieldPath: 'name', order: 'ASCENDING' }
      ]
    });
  });
});
