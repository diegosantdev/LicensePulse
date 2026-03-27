const axios = require('axios');
const {
  fetchGitHubReleases,
  fetchNpmVersions,
  fetchPyPiVersions,
  detectEcosystem,
  getVersionCutoff
} = require('../../src/version-tracker');

jest.mock('axios');

describe('version-tracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchGitHubReleases', () => {
    it('should fetch releases from GitHub', async () => {
      const mockReleases = [
        { name: 'v1.0.0', commit: { sha: 'abc123' } },
        { name: 'v0.9.0', commit: { sha: 'def456' } }
      ];

      axios.get.mockResolvedValue({ data: mockReleases });

      const result = await fetchGitHubReleases('owner/repo', 'token');

      expect(result).toEqual([
        { version: 'v1.0.0', commit: 'abc123' },
        { version: 'v0.9.0', commit: 'def456' }
      ]);
    });

    it('should return empty array on error', async () => {
      axios.get.mockRejectedValue(new Error('API error'));

      const result = await fetchGitHubReleases('owner/repo', 'token');

      expect(result).toEqual([]);
    });
  });

  describe('fetchNpmVersions', () => {
    it('should fetch versions from npm registry', async () => {
      const mockData = {
        versions: {
          '1.0.0': {},
          '0.9.0': {},
          '0.8.0': {}
        }
      };

      axios.get.mockResolvedValue({ data: mockData });

      const result = await fetchNpmVersions('test-package');

      expect(result).toContain('1.0.0');
      expect(result).toContain('0.9.0');
    });

    it('should return empty array on error', async () => {
      axios.get.mockRejectedValue(new Error('Registry error'));

      const result = await fetchNpmVersions('test-package');

      expect(result).toEqual([]);
    });
  });

  describe('detectEcosystem', () => {
    it('should detect npm ecosystem', async () => {
      const mockPackageJson = {
        content: Buffer.from(JSON.stringify({ name: 'test-package' })).toString('base64')
      };

      axios.get.mockResolvedValue({ status: 200, data: mockPackageJson });

      const result = await detectEcosystem('owner/repo', 'token');

      expect(result).toEqual({
        type: 'npm',
        packageName: 'test-package'
      });
    });

    it('should detect Python ecosystem', async () => {
      axios.get
        .mockRejectedValueOnce(new Error('No package.json'))
        .mockResolvedValueOnce({ status: 200 });

      const result = await detectEcosystem('owner/repo', 'token');

      expect(result.type).toBe('pypi');
    });

    it('should fallback to github', async () => {
      axios.get.mockRejectedValue(new Error('Not found'));

      const result = await detectEcosystem('owner/repo', 'token');

      expect(result).toEqual({
        type: 'github',
        packageName: null
      });
    });
  });
});
