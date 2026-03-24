const fs = require('fs').promises;
const Watchlist = require('../../src/watchlist');

describe('Watchlist', () => {
  const testFilePath = 'test-watchlist.json';
  let watchlist;

  beforeEach(async () => {
    watchlist = new Watchlist(testFilePath);

    try {
      await fs.unlink(testFilePath);
    } catch (error) {

    }
  });

  afterEach(async () => {

    try {
      await fs.unlink(testFilePath);
    } catch (error) {

    }
  });

  describe('validateRepoIdentifier', () => {
    test('accepts valid repository identifiers', () => {
      expect(() => watchlist.validateRepoIdentifier('owner/repo')).not.toThrow();
      expect(() => watchlist.validateRepoIdentifier('redis/redis')).not.toThrow();
      expect(() => watchlist.validateRepoIdentifier('hashicorp/terraform')).not.toThrow();
      expect(() => watchlist.validateRepoIdentifier('user-name/repo.name')).not.toThrow();
    });

    test('rejects invalid repository identifiers', () => {
      expect(() => watchlist.validateRepoIdentifier('invalid')).toThrow('Invalid repository identifier');
      expect(() => watchlist.validateRepoIdentifier('owner/')).toThrow('Invalid repository identifier');
      expect(() => watchlist.validateRepoIdentifier('/repo')).toThrow('Invalid repository identifier');
      expect(() => watchlist.validateRepoIdentifier('owner/repo/extra')).toThrow('Invalid repository identifier');
      expect(() => watchlist.validateRepoIdentifier('')).toThrow('Invalid repository identifier');
    });
  });

  describe('add', () => {
    test('adds valid repository to watchlist', async () => {
      await watchlist.add('redis/redis');
      expect(watchlist.getAll()).toEqual(['redis/redis']);
    });

    test('prevents duplicate entries', async () => {
      await watchlist.add('redis/redis');
      await watchlist.add('redis/redis');
      expect(watchlist.getAll()).toEqual(['redis/redis']);
    });

    test('throws error for invalid repository identifier', async () => {
      await expect(watchlist.add('invalid')).rejects.toThrow('Invalid repository identifier');
    });

    test('persists changes to disk', async () => {
      await watchlist.add('redis/redis');

      const newWatchlist = new Watchlist(testFilePath);
      await newWatchlist.load();
      expect(newWatchlist.getAll()).toEqual(['redis/redis']);
    });
  });

  describe('remove', () => {
    test('removes repository from watchlist', async () => {
      await watchlist.add('redis/redis');
      await watchlist.add('hashicorp/terraform');
      await watchlist.remove('redis/redis');
      expect(watchlist.getAll()).toEqual(['hashicorp/terraform']);
    });

    test('handles removing non-existent repository', async () => {
      await watchlist.add('redis/redis');
      await watchlist.remove('nonexistent/repo');
      expect(watchlist.getAll()).toEqual(['redis/redis']);
    });

    test('persists changes to disk', async () => {
      await watchlist.add('redis/redis');
      await watchlist.add('hashicorp/terraform');
      await watchlist.remove('redis/redis');

      const newWatchlist = new Watchlist(testFilePath);
      await newWatchlist.load();
      expect(newWatchlist.getAll()).toEqual(['hashicorp/terraform']);
    });
  });

  describe('getAll', () => {
    test('returns all repositories in watchlist', async () => {
      await watchlist.add('redis/redis');
      await watchlist.add('hashicorp/terraform');
      expect(watchlist.getAll()).toEqual(['redis/redis', 'hashicorp/terraform']);
    });

    test('returns empty array for empty watchlist', () => {
      expect(watchlist.getAll()).toEqual([]);
    });

    test('returns a copy of the repos array', async () => {
      await watchlist.add('redis/redis');
      const repos = watchlist.getAll();
      repos.push('hacker/repo');
      expect(watchlist.getAll()).toEqual(['redis/redis']);
    });
  });

  describe('load', () => {
    test('loads watchlist from existing file', async () => {
      const data = { repos: ['redis/redis', 'hashicorp/terraform'] };
      await fs.writeFile(testFilePath, JSON.stringify(data), 'utf8');

      await watchlist.load();
      expect(watchlist.getAll()).toEqual(['redis/redis', 'hashicorp/terraform']);
    });

    test('handles missing file gracefully', async () => {
      await watchlist.load();
      expect(watchlist.getAll()).toEqual([]);
    });

    test('throws error for invalid JSON', async () => {
      await fs.writeFile(testFilePath, 'invalid json', 'utf8');
      await expect(watchlist.load()).rejects.toThrow('Failed to load watchlist');
    });
  });

  describe('save', () => {
    test('saves watchlist to disk', async () => {
      await watchlist.add('redis/redis');
      await watchlist.save();

      const data = await fs.readFile(testFilePath, 'utf8');
      const parsed = JSON.parse(data);
      expect(parsed.repos).toEqual(['redis/redis']);
    });
  });

  describe('add-remove round trip', () => {
    test('adding then removing results in original state', async () => {
      await watchlist.add('redis/redis');
      const beforeAdd = watchlist.getAll();

      await watchlist.add('hashicorp/terraform');
      await watchlist.remove('hashicorp/terraform');

      expect(watchlist.getAll()).toEqual(beforeAdd);
    });
  });
});
