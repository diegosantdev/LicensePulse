const axios = require('axios');
const {
  getGitHubRepoFromNpm,
  getGitHubRepoFromPyPI,
  importFromPackageJson,
  autoImport
} = require('../../src/package-importer');

jest.mock('axios');
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    access: jest.fn()
  }
}));

const fs = require('fs').promises;

describe('package-importer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getGitHubRepoFromNpm', () => {
    it('should extract GitHub repo from npm package', async () => {
      const mockData = {
        repository: {
          url: 'git+https://github.com/facebook/react.git'
        }
      };

      axios.get.mockResolvedValue({ data: mockData });

      const result = await getGitHubRepoFromNpm('react');

      expect(result).toBe('facebook/react');
    });

    it('should handle string repository field', async () => {
      const mockData = {
        repository: 'https://github.com/lodash/lodash'
      };

      axios.get.mockResolvedValue({ data: mockData });

      const result = await getGitHubRepoFromNpm('lodash');

      expect(result).toBe('lodash/lodash');
    });

    it('should return null if no repository found', async () => {
      axios.get.mockResolvedValue({ data: {} });

      const result = await getGitHubRepoFromNpm('unknown-package');

      expect(result).toBeNull();
    });
  });

  describe('getGitHubRepoFromPyPI', () => {
    it('should extract GitHub repo from PyPI package', async () => {
      const mockData = {
        info: {
          project_urls: {
            'Source': 'https://github.com/psf/requests'
          }
        }
      };

      axios.get.mockResolvedValue({ data: mockData });

      const result = await getGitHubRepoFromPyPI('requests');

      expect(result).toBe('psf/requests');
    });

    it('should fallback to home_page', async () => {
      const mockData = {
        info: {
          home_page: 'https://github.com/django/django'
        }
      };

      axios.get.mockResolvedValue({ data: mockData });

      const result = await getGitHubRepoFromPyPI('django');

      expect(result).toBe('django/django');
    });
  });

  describe('importFromPackageJson', () => {
    it('should import dependencies from package.json', async () => {
      const mockPackageJson = JSON.stringify({
        dependencies: {
          'react': '^18.0.0',
          'lodash': '^4.17.21'
        }
      });

      fs.readFile.mockResolvedValue(mockPackageJson);
      axios.get
        .mockResolvedValueOnce({ data: { repository: 'https://github.com/facebook/react' } })
        .mockResolvedValueOnce({ data: { repository: 'https://github.com/lodash/lodash' } });

      const result = await importFromPackageJson('./package.json');

      expect(result.repos).toHaveLength(2);
      expect(result.repos[0].repo).toBe('facebook/react');
      expect(result.repos[1].repo).toBe('lodash/lodash');
    });

    it('should skip file: dependencies', async () => {
      const mockPackageJson = JSON.stringify({
        dependencies: {
          'local-package': 'file:../local-package'
        }
      });

      fs.readFile.mockResolvedValue(mockPackageJson);

      const result = await importFromPackageJson('./package.json');

      expect(result.repos).toHaveLength(0);
    });
  });

  describe('autoImport', () => {
    it('should detect and import from available files', async () => {
      const mockPackageJson = JSON.stringify({
        dependencies: { 'react': '^18.0.0' }
      });

      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(mockPackageJson);
      axios.get.mockResolvedValue({
        data: { repository: 'https://github.com/facebook/react' }
      });

      const result = await autoImport('.');

      expect(result.sources).toContain('package.json');
      expect(result.repos.length).toBeGreaterThan(0);
    });
  });
});
