const {
  handleAdd,
  handleRemove,
  handleList
} = require('../../src/cli');
const Watchlist = require('../../src/watchlist');
const fs = require('fs').promises;

let consoleOutput = [];
const originalLog = console.log;

beforeEach(() => {
  consoleOutput = [];
  console.log = (...args) => {
    consoleOutput.push(args.join(' '));
  };
});

afterEach(() => {
  console.log = originalLog;
});

describe('CLI Commands', () => {
  const testWatchlistPath = 'test-cli-watchlist.json';

  beforeEach(async () => {

    try {
      await fs.unlink(testWatchlistPath);
    } catch (error) {

    }

    try {
      await fs.unlink('watchlist.json');
    } catch (error) {

    }
  });

  afterEach(async () => {

    try {
      await fs.unlink(testWatchlistPath);
    } catch (error) {

    }

    try {
      await fs.unlink('watchlist.json');
    } catch (error) {

    }
  });

  describe('handleAdd', () => {
    test('adds repository to watchlist', async () => {
      await handleAdd('redis/redis');

      const output = consoleOutput.join(' ');
      expect(output).toContain('redis/redis');
      expect(output).toContain('Added');

      const watchlist = new Watchlist();
      await watchlist.load();
      expect(watchlist.getAll()).toContain('redis/redis');
    });

    test('throws error for invalid repository format', async () => {
      await expect(handleAdd('invalid')).rejects.toThrow();
    });
  });

  describe('handleRemove', () => {
    test('removes repository from watchlist', async () => {

      await handleAdd('redis/redis');
      consoleOutput = [];

      await handleRemove('redis/redis');

      const output = consoleOutput.join(' ');
      expect(output).toContain('redis/redis');
      expect(output).toContain('Removed');

      const watchlist = new Watchlist();
      await watchlist.load();
      expect(watchlist.getAll()).not.toContain('redis/redis');
    });
  });

  describe('handleList', () => {
    test('lists repositories in watchlist', async () => {

      await handleAdd('redis/redis');
      await handleAdd('hashicorp/terraform');
      consoleOutput = [];

      await handleList();

      const output = consoleOutput.join('\n');
      expect(output).toContain('redis/redis');
      expect(output).toContain('hashicorp/terraform');
    });

    test('shows message when watchlist is empty', async () => {
      await handleList();

      expect(consoleOutput.some(line => line.includes('No repositories'))).toBe(true);
    });
  });
});
