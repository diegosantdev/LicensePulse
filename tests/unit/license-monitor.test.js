const axios = require('axios');
const {
  fetchLicenseFileContent,
  calculateHash,
  checkLicenseFileChange
} = require('../../src/license-monitor');

jest.mock('axios');
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn()
  }
}));

const fs = require('fs').promises;

describe('license-monitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchLicenseFileContent', () => {
    it('should fetch LICENSE file from GitHub', async () => {
      const mockContent = Buffer.from('MIT License\n\nCopyright...').toString('base64');
      
      axios.get.mockResolvedValue({
        data: {
          content: mockContent,
          sha: 'abc123',
          html_url: 'https://github.com/owner/repo/blob/main/LICENSE',
          size: 1024
        }
      });

      const result = await fetchLicenseFileContent('owner/repo', 'token');

      expect(result).toBeDefined();
      expect(result.filename).toBe('LICENSE');
      expect(result.content).toContain('MIT License');
      expect(result.sha).toBe('abc123');
    });

    it('should return null if no LICENSE file found', async () => {
      axios.get.mockRejectedValue(new Error('Not found'));

      const result = await fetchLicenseFileContent('owner/repo', 'token');

      expect(result).toBeNull();
    });
  });

  describe('calculateHash', () => {
    it('should calculate SHA256 hash of content', () => {
      const content = 'MIT License';
      const hash = calculateHash(content);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // SHA256 produces 64 hex characters
    });

    it('should produce different hashes for different content', () => {
      const hash1 = calculateHash('MIT License');
      const hash2 = calculateHash('Apache License');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('checkLicenseFileChange', () => {
    it('should detect first check and store baseline', async () => {
      const mockContent = Buffer.from('MIT License').toString('base64');
      
      axios.get.mockResolvedValue({
        data: {
          content: mockContent,
          sha: 'abc123',
          html_url: 'https://github.com/owner/repo/blob/main/LICENSE',
          size: 1024
        }
      });

      fs.readFile.mockRejectedValue({ code: 'ENOENT' });
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      const result = await checkLicenseFileChange('owner/repo', 'token');

      expect(result.changed).toBe(false);
      expect(result.reason).toContain('First check');
    });
  });
});
