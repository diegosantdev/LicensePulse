process.env.LICENSEPULSE_SNAPSHOTS_DIR = '.licensepulse/snapshots-integration';
const Watchlist = require('../../src/watchlist');
const { fetchLicense } = require('../../src/watcher');
const { checkAndUpdate, loadSnapshot } = require('../../src/differ');
const { generateImpactDiff } = require('../../src/explainer');
const fs = require('fs').promises;

jest.mock('axios');
const axios = require('axios');

describe('Integration: Complete Workflow', () => {
  const testWatchlistPath = 'test-integration-watchlist.json';
  const snapshotsDir = process.env.LICENSEPULSE_SNAPSHOTS_DIR;

  beforeAll(() => {
    process.env.GITHUB_TOKEN = 'test-token';
  });

  beforeEach(async () => {

    try {
      await fs.unlink(testWatchlistPath);
    } catch (error) {

    }

    try {
      await fs.rm(snapshotsDir, { recursive: true, force: true });
    } catch (error) {

    }
  });

  afterEach(async () => {

    try {
      await fs.unlink(testWatchlistPath);
    } catch (error) {

    }

    try {
      await fs.rm(snapshotsDir, { recursive: true, force: true });
    } catch (error) {

    }
  });

  test('complete workflow: add repo, check license, detect change', async () => {

    const watchlist = new Watchlist(testWatchlistPath);
    await watchlist.add('redis/redis');

    expect(watchlist.getAll()).toContain('redis/redis');

    axios.get.mockResolvedValueOnce({
      data: {
        license: {
          spdx_id: 'BSD-3-Clause'
        }
      }
    });

    const firstLicense = await fetchLicense('redis/redis');
    expect(firstLicense.spdxId).toBe('BSD-3-Clause');

    const firstCheck = await checkAndUpdate('redis/redis', firstLicense);
    expect(firstCheck.changed).toBe(false);

    // Wait for file system to sync (longer wait for coverage runs)
    await new Promise(resolve => setTimeout(resolve, 1000));

    const snapshot1 = await loadSnapshot('redis/redis');
    expect(snapshot1).toBeDefined();
    expect(snapshot1).not.toBeNull();
    expect(snapshot1.spdxId).toBe('BSD-3-Clause');

    axios.get.mockResolvedValueOnce({
      data: {
        license: {
          spdx_id: 'RSALv2'
        }
      }
    });

    const secondLicense = await fetchLicense('redis/redis');
    expect(secondLicense.spdxId).toBe('RSALv2');

    const secondCheck = await checkAndUpdate('redis/redis', secondLicense);
    expect(secondCheck.changed).toBe(true);
    expect(secondCheck.oldLicense).toBe('BSD-3-Clause');
    expect(secondCheck.newLicense).toBe('RSALv2');

    const snapshot2 = await loadSnapshot('redis/redis');
    expect(snapshot2.spdxId).toBe('RSALv2');
    expect(snapshot2.previousSpdxId).toBe('BSD-3-Clause');

    const impact = generateImpactDiff('BSD-3-Clause', 'RSALv2');
    expect(impact.changes.length).toBeGreaterThan(0);

    const criticalChanges = impact.changes.filter(c => c.severity === 'CRITICAL');
    expect(criticalChanges.length).toBeGreaterThan(0);
  });

  test('workflow handles multiple repositories', async () => {
    const watchlist = new Watchlist(testWatchlistPath);
    await watchlist.add('redis/redis');
    await watchlist.add('hashicorp/terraform');

    expect(watchlist.getAll()).toHaveLength(2);

    axios.get
      .mockResolvedValueOnce({
        data: { license: { spdx_id: 'MIT' } }
      })
      .mockResolvedValueOnce({
        data: { license: { spdx_id: 'MPL-2.0' } }
      });

    const license1 = await fetchLicense('redis/redis');
    await checkAndUpdate('redis/redis', license1);

    const license2 = await fetchLicense('hashicorp/terraform');
    await checkAndUpdate('hashicorp/terraform', license2);

    // Wait for file system sync
    await new Promise(resolve => setTimeout(resolve, 100));

    const snapshot1 = await loadSnapshot('redis/redis');
    const snapshot2 = await loadSnapshot('hashicorp/terraform');

    expect(snapshot1.spdxId).toBe('MIT');
    expect(snapshot2.spdxId).toBe('MPL-2.0');
  });

  test('workflow continues on individual repository errors', async () => {
    const watchlist = new Watchlist(testWatchlistPath);
    await watchlist.add('valid/repo');
    await watchlist.add('invalid/repo');

    axios.get.mockResolvedValueOnce({
      data: { license: { spdx_id: 'MIT' } }
    });

    const license1 = await fetchLicense('valid/repo');
    await checkAndUpdate('valid/repo', license1);

    // Wait for file system sync
    await new Promise(resolve => setTimeout(resolve, 100));

    axios.get.mockRejectedValueOnce(new Error('Repository not found'));

    await expect(fetchLicense('invalid/repo')).rejects.toThrow();

    const snapshot = await loadSnapshot('valid/repo');
    expect(snapshot).toBeDefined();
    expect(snapshot.spdxId).toBe('MIT');
  });
});
