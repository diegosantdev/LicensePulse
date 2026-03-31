process.env.LICENSEPULSE_SNAPSHOTS_DIR = '.licensepulse/snapshots-unit';
const fs = require('fs').promises;
const path = require('path');
const {
  loadSnapshot,
  saveSnapshot,
  getAllSnapshots,
  detectChange,
  getSnapshotFilename,
  getSnapshotPath
} = require('../../src/differ');

const SNAPSHOTS_DIR = process.env.LICENSEPULSE_SNAPSHOTS_DIR;

describe('Differ', () => {
  beforeEach(async () => {

    try {
      await fs.rm(SNAPSHOTS_DIR, { recursive: true, force: true });
    } catch (error) {

    }
  });

  afterEach(async () => {

    try {
      await fs.rm(SNAPSHOTS_DIR, { recursive: true, force: true });
    } catch (error) {

    }
  });

  describe('getSnapshotFilename', () => {
    test('converts repository identifier to filename', () => {
      expect(getSnapshotFilename('redis/redis')).toBe('redis-redis.json');
      expect(getSnapshotFilename('hashicorp/terraform')).toBe('hashicorp-terraform.json');
      expect(getSnapshotFilename('owner/repo')).toBe('owner-repo.json');
    });
  });

  describe('saveSnapshot', () => {
    test('creates snapshot directory if not exists', async () => {
      const licenseData = {
        spdxId: 'MIT',
        timestamp: '2026-03-23T09:00:00Z'
      };

      await saveSnapshot('redis/redis', licenseData);

      const dirExists = await fs.access(SNAPSHOTS_DIR)
        .then(() => true)
        .catch(() => false);
      expect(dirExists).toBe(true);
    });

    test('saves snapshot with required fields', async () => {
      const licenseData = {
        spdxId: 'MIT',
        timestamp: '2026-03-23T09:00:00Z'
      };

      await saveSnapshot('redis/redis', licenseData);

      const snapshot = await loadSnapshot('redis/redis');
      expect(snapshot).toMatchObject({
        repo: 'redis/redis',
        spdxId: 'MIT',
        timestamp: '2026-03-23T09:00:00Z'
      });
    });

    test('saves snapshot with optional fields when provided', async () => {
      const licenseData = {
        spdxId: 'BSL-1.1',
        timestamp: '2026-03-23T09:00:00Z',
        previousSpdxId: 'MPL-2.0',
        changedAt: '2026-03-22T14:30:00Z'
      };

      await saveSnapshot('hashicorp/terraform', licenseData);

      const snapshot = await loadSnapshot('hashicorp/terraform');
      expect(snapshot).toMatchObject({
        repo: 'hashicorp/terraform',
        spdxId: 'BSL-1.1',
        timestamp: '2026-03-23T09:00:00Z',
        previousSpdxId: 'MPL-2.0',
        changedAt: '2026-03-22T14:30:00Z'
      });
    });

    test('generates timestamp if not provided', async () => {
      const licenseData = {
        spdxId: 'MIT'
      };

      await saveSnapshot('redis/redis', licenseData);

      const snapshot = await loadSnapshot('redis/redis');
      expect(snapshot.timestamp).toBeDefined();
      expect(new Date(snapshot.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('loadSnapshot', () => {
    test('loads existing snapshot', async () => {
      const licenseData = {
        spdxId: 'MIT',
        timestamp: '2026-03-23T09:00:00Z'
      };

      await saveSnapshot('redis/redis', licenseData);
      const snapshot = await loadSnapshot('redis/redis');

      expect(snapshot).toMatchObject({
        repo: 'redis/redis',
        spdxId: 'MIT',
        timestamp: '2026-03-23T09:00:00Z'
      });
    });

    test('returns null for non-existent snapshot', async () => {
      const snapshot = await loadSnapshot('nonexistent/repo');
      expect(snapshot).toBeNull();
    });

    test('throws error for invalid JSON', async () => {
      await fs.mkdir(SNAPSHOTS_DIR, { recursive: true });
      const snapshotPath = path.join(SNAPSHOTS_DIR, 'invalid-repo.json');
      await fs.writeFile(snapshotPath, 'invalid json', 'utf8');

      await expect(loadSnapshot('invalid/repo')).rejects.toThrow('Failed to load snapshot');
    });
  });

  describe('getAllSnapshots', () => {
    test('returns all snapshots', async () => {
      await saveSnapshot('redis/redis', { spdxId: 'MIT', timestamp: '2026-03-23T09:00:00Z' });
      await saveSnapshot('hashicorp/terraform', { spdxId: 'BSL-1.1', timestamp: '2026-03-23T09:00:00Z' });

      const snapshots = await getAllSnapshots();

      expect(snapshots).toHaveLength(2);
      expect(snapshots.map(s => s.repo)).toContain('redis/redis');
      expect(snapshots.map(s => s.repo)).toContain('hashicorp/terraform');
    });

    test('returns empty array when no snapshots exist', async () => {
      const snapshots = await getAllSnapshots();
      expect(snapshots).toEqual([]);
    });
  });

  describe('detectChange', () => {
    test('returns null when no snapshot exists (first check)', () => {
      const currentLicense = { spdxId: 'MIT' };
      const change = detectChange(null, currentLicense);
      expect(change).toBeNull();
    });

    test('returns null when license has not changed', () => {
      const snapshot = { spdxId: 'MIT', timestamp: '2026-03-23T09:00:00Z' };
      const currentLicense = { spdxId: 'MIT' };
      const change = detectChange(snapshot, currentLicense);
      expect(change).toBeNull();
    });

    test('detects license change', () => {
      const snapshot = { spdxId: 'MPL-2.0', timestamp: '2026-03-22T09:00:00Z' };
      const currentLicense = { spdxId: 'BSL-1.1' };
      const change = detectChange(snapshot, currentLicense);

      expect(change).toEqual({
        changed: true,
        oldLicense: 'MPL-2.0',
        newLicense: 'BSL-1.1'
      });
    });

    test('detects change from permissive to restrictive license', () => {
      const snapshot = { spdxId: 'BSD-3-Clause', timestamp: '2024-01-01T00:00:00Z' };
      const currentLicense = { spdxId: 'RSALv2' };
      const change = detectChange(snapshot, currentLicense);

      expect(change).toEqual({
        changed: true,
        oldLicense: 'BSD-3-Clause',
        newLicense: 'RSALv2'
      });
    });
  });

  describe('snapshot serialization round trip', () => {
    test('saving and loading produces equivalent snapshot', async () => {
      const originalData = {
        spdxId: 'MIT',
        timestamp: '2026-03-23T09:00:00Z',
        previousSpdxId: 'Apache-2.0',
        changedAt: '2026-03-22T14:30:00Z'
      };

      await saveSnapshot('redis/redis', originalData);
      const loaded = await loadSnapshot('redis/redis');

      expect(loaded).toMatchObject({
        repo: 'redis/redis',
        spdxId: originalData.spdxId,
        timestamp: originalData.timestamp,
        previousSpdxId: originalData.previousSpdxId,
        changedAt: originalData.changedAt
      });
    });
  });

  describe('snapshot filename pattern', () => {
    test('follows owner-repo.json pattern', async () => {
      await saveSnapshot('redis/redis', { spdxId: 'MIT' });

      const files = await fs.readdir(SNAPSHOTS_DIR);
      expect(files).toContain('redis-redis.json');
    });
  });

  describe('checkAndUpdate', () => {
    const { checkAndUpdate } = require('../../src/differ');

    test('creates initial snapshot on first check', async () => {
      const currentLicense = {
        spdxId: 'MIT',
        fetchedAt: '2026-03-23T09:00:00Z'
      };

      const result = await checkAndUpdate('redis/redis', currentLicense);

      expect(result.changed).toBe(false);

      const snapshot = await loadSnapshot('redis/redis');
      expect(snapshot).toMatchObject({
        repo: 'redis/redis',
        spdxId: 'MIT',
        timestamp: '2026-03-23T09:00:00Z'
      });
    });

    test('returns no change when license is unchanged', async () => {

      await saveSnapshot('redis/redis', {
        spdxId: 'MIT',
        timestamp: '2026-03-22T09:00:00Z'
      });

      const currentLicense = {
        spdxId: 'MIT',
        fetchedAt: '2026-03-23T09:00:00Z'
      };

      const result = await checkAndUpdate('redis/redis', currentLicense);

      expect(result.changed).toBe(false);
    });

    test('detects and records license change', async () => {

      await saveSnapshot('hashicorp/terraform', {
        spdxId: 'MPL-2.0',
        timestamp: '2026-03-22T09:00:00Z'
      });

      const currentLicense = {
        spdxId: 'BSL-1.1',
        fetchedAt: '2026-03-23T09:00:00Z'
      };

      const result = await checkAndUpdate('hashicorp/terraform', currentLicense);

      expect(result).toEqual({
        changed: true,
        oldLicense: 'MPL-2.0',
        newLicense: 'BSL-1.1'
      });
    });

    test('updates snapshot with change history', async () => {

      await saveSnapshot('hashicorp/terraform', {
        spdxId: 'MPL-2.0',
        timestamp: '2026-03-22T09:00:00Z'
      });

      const currentLicense = {
        spdxId: 'BSL-1.1',
        fetchedAt: '2026-03-23T09:00:00Z'
      };

      await checkAndUpdate('hashicorp/terraform', currentLicense);

      const snapshot = await loadSnapshot('hashicorp/terraform');
      expect(snapshot).toMatchObject({
        repo: 'hashicorp/terraform',
        spdxId: 'BSL-1.1',
        timestamp: '2026-03-23T09:00:00Z',
        previousSpdxId: 'MPL-2.0',
        changedAt: '2026-03-23T09:00:00Z'
      });
    });

    test('preserves previous license in snapshot after change', async () => {

      await saveSnapshot('redis/redis', {
        spdxId: 'BSD-3-Clause',
        timestamp: '2024-01-01T00:00:00Z'
      });

      const currentLicense = {
        spdxId: 'RSALv2',
        fetchedAt: '2024-03-20T00:00:00Z'
      };

      await checkAndUpdate('redis/redis', currentLicense);

      const snapshot = await loadSnapshot('redis/redis');
      expect(snapshot.previousSpdxId).toBe('BSD-3-Clause');
      expect(snapshot.spdxId).toBe('RSALv2');
    });
  });
});
