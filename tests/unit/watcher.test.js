const axios = require('axios');
const { fetchLicense, checkRateLimit } = require('../../src/watcher');

jest.mock('axios');

describe('Watcher', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv };
    process.env.GITHUB_TOKEN = 'test-token';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('fetchLicense', () => {
    test('fetches license successfully', async () => {
      const mockResponse = {
        data: {
          license: {
            spdx_id: 'MIT'
          }
        }
      };

      axios.get.mockResolvedValueOnce(mockResponse);

      const result = await fetchLicense('redis/redis');

      expect(result.spdxId).toBe('MIT');
      expect(result.fetchedAt).toBeDefined();
      expect(new Date(result.fetchedAt)).toBeInstanceOf(Date);
    });

    test('extracts SPDX ID from API response', async () => {
      const mockResponse = {
        data: {
          license: {
            spdx_id: 'Apache-2.0',
            name: 'Apache License 2.0'
          }
        }
      };

      axios.get.mockResolvedValueOnce(mockResponse);

      const result = await fetchLicense('hashicorp/terraform');

      expect(result.spdxId).toBe('Apache-2.0');
    });

    test('returns NONE for repository without license (404)', async () => {
      const error = new Error('Not Found');
      error.response = { status: 404 };

      axios.get.mockRejectedValueOnce(error);

      const result = await fetchLicense('owner/repo');

      expect(result.spdxId).toBe('NONE');
    });

    test('throws error when GITHUB_TOKEN is missing', async () => {
      delete process.env.GITHUB_TOKEN;

      await expect(fetchLicense('redis/redis')).rejects.toThrow(
        'GITHUB_TOKEN environment variable is required'
      );
    });

    test('throws error for invalid repository identifier', async () => {
      await expect(fetchLicense('invalid')).rejects.toThrow(
        'Invalid repository identifier'
      );
    });

    test('includes repository context in error messages', async () => {
      const error = new Error('Network error');
      axios.get.mockRejectedValue(error);

      await expect(fetchLicense('redis/redis')).rejects.toThrow('redis/redis');
    });

    test('handles rate limit exceeded (403)', async () => {
      const error = new Error('Rate limit exceeded');
      error.response = {
        status: 403,
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1711180800'
        }
      };

      axios.get.mockRejectedValueOnce(error);

      await expect(fetchLicense('redis/redis')).rejects.toThrow(
        'GitHub API rate limit exceeded'
      );
    });

    test('retries on network errors with exponential backoff', async () => {
      const networkError = new Error('Network error');

      axios.get
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          data: { license: { spdx_id: 'MIT' } }
        });

      const result = await fetchLicense('redis/redis');

      expect(result.spdxId).toBe('MIT');
      expect(axios.get).toHaveBeenCalledTimes(3);
    });

    test('retries on 5xx server errors', async () => {
      const serverError = new Error('Server error');
      serverError.response = { status: 500 };

      axios.get
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce({
          data: { license: { spdx_id: 'MIT' } }
        });

      const result = await fetchLicense('redis/redis');

      expect(result.spdxId).toBe('MIT');
      expect(axios.get).toHaveBeenCalledTimes(2);
    });

    test('does not retry on 4xx client errors (except 404 and 429)', async () => {
      const clientError = new Error('Unauthorized');
      clientError.response = { status: 401, statusText: 'Unauthorized' };

      axios.get.mockRejectedValueOnce(clientError);

      await expect(fetchLicense('redis/redis')).rejects.toThrow(
        'GitHub API error for "redis/redis": HTTP 401 Unauthorized'
      );

      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    test('fails after exhausting all retries', async () => {
      const networkError = new Error('Network error');

      axios.get.mockRejectedValue(networkError);

      await expect(fetchLicense('redis/redis')).rejects.toThrow(
        'Failed to fetch license for "redis/redis" after 3 attempts'
      );

      expect(axios.get).toHaveBeenCalledTimes(3);
    });

    test('uses correct GitHub API endpoint', async () => {
      axios.get.mockResolvedValueOnce({
        data: { license: { spdx_id: 'MIT' } }
      });

      await fetchLicense('redis/redis');

      expect(axios.get).toHaveBeenCalledWith(
        'https://api.github.com/repos/redis/redis/license',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'Accept': 'application/vnd.github+json'
          })
        })
      );
    });

    test('handles missing license.spdx_id in response', async () => {
      axios.get.mockResolvedValueOnce({
        data: { license: null }
      });

      const result = await fetchLicense('redis/redis');

      expect(result.spdxId).toBe('NONE');
    });
  });

  describe('checkRateLimit', () => {
    test('returns rate limit information', async () => {
      const mockResponse = {
        data: {
          resources: {
            core: {
              remaining: 4999,
              reset: 1711180800
            }
          }
        }
      };

      axios.get.mockResolvedValueOnce(mockResponse);

      const result = await checkRateLimit();

      expect(result.remaining).toBe(4999);
      expect(result.resetAt).toBeDefined();
      expect(new Date(result.resetAt)).toBeInstanceOf(Date);
    });

    test('throws error when GITHUB_TOKEN is missing', async () => {
      delete process.env.GITHUB_TOKEN;

      await expect(checkRateLimit()).rejects.toThrow(
        'GITHUB_TOKEN environment variable is required'
      );
    });

    test('throws error on API failure', async () => {
      axios.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(checkRateLimit()).rejects.toThrow(
        'Failed to check rate limit'
      );
    });
  });
});
