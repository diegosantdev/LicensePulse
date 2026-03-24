const {
  loadConfig,
  getConfiguredChannels,
  isEmailConfigured,
  isSlackConfigured,
  isWebhookConfigured
} = require('../../src/config');

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();

    process.env = { };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    test('loads configuration with required GITHUB_TOKEN', () => {
      process.env.GITHUB_TOKEN = 'test-token';

      const config = loadConfig();

      expect(config.githubToken).toBe('test-token');
    });

    test('throws error when GITHUB_TOKEN is missing', () => {
      delete process.env.GITHUB_TOKEN;

      expect(() => loadConfig()).toThrow('GITHUB_TOKEN environment variable is required');
    });

    test('uses default CHECK_INTERVAL_HOURS of 24', () => {
      process.env.GITHUB_TOKEN = 'test-token';

      const config = loadConfig();

      expect(config.checkIntervalHours).toBe(24);
    });

    test('uses custom CHECK_INTERVAL_HOURS when provided', () => {
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.CHECK_INTERVAL_HOURS = '12';

      const config = loadConfig();

      expect(config.checkIntervalHours).toBe(12);
    });

    test('throws error for invalid CHECK_INTERVAL_HOURS', () => {
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.CHECK_INTERVAL_HOURS = 'invalid';

      expect(() => loadConfig()).toThrow('CHECK_INTERVAL_HOURS must be a positive number');
    });

    test('throws error for negative CHECK_INTERVAL_HOURS', () => {
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.CHECK_INTERVAL_HOURS = '-5';

      expect(() => loadConfig()).toThrow('CHECK_INTERVAL_HOURS must be a positive number');
    });

    test('loads optional Slack configuration', () => {
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

      const config = loadConfig();

      expect(config.slackWebhookUrl).toBe('https://hooks.slack.com/test');
    });

    test('loads optional webhook configuration', () => {
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.WEBHOOK_URL = 'https://example.com/webhook';

      const config = loadConfig();

      expect(config.webhookUrl).toBe('https://example.com/webhook');
    });

    test('loads complete SMTP configuration', () => {
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password';
      process.env.NOTIFY_EMAIL = 'team@example.com';

      const config = loadConfig();

      expect(config.smtpHost).toBe('smtp.example.com');
      expect(config.smtpPort).toBe(587);
      expect(config.smtpUser).toBe('user@example.com');
      expect(config.smtpPass).toBe('password');
      expect(config.notifyEmail).toBe('team@example.com');
    });

    test('throws error for incomplete SMTP configuration', () => {
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';

      expect(() => loadConfig()).toThrow('SMTP configuration incomplete');
    });

    test('allows no SMTP configuration', () => {
      process.env.GITHUB_TOKEN = 'test-token';

      const config = loadConfig();

      expect(config.smtpHost).toBeNull();
      expect(config.smtpPort).toBeNull();
      expect(config.smtpUser).toBeNull();
      expect(config.smtpPass).toBeNull();
      expect(config.notifyEmail).toBeNull();
    });
  });

  describe('getConfiguredChannels', () => {
    test('returns empty array when no channels configured', () => {
      const config = {
        githubToken: 'test-token',
        slackWebhookUrl: null,
        webhookUrl: null,
        smtpHost: null,
        smtpPort: null,
        smtpUser: null,
        smtpPass: null,
        notifyEmail: null
      };

      const channels = getConfiguredChannels(config);

      expect(channels).toEqual([]);
    });

    test('returns slack when Slack is configured', () => {
      const config = {
        githubToken: 'test-token',
        slackWebhookUrl: 'https://hooks.slack.com/test',
        webhookUrl: null,
        smtpHost: null,
        smtpPort: null,
        smtpUser: null,
        smtpPass: null,
        notifyEmail: null
      };

      const channels = getConfiguredChannels(config);

      expect(channels).toContain('slack');
    });

    test('returns webhook when webhook is configured', () => {
      const config = {
        githubToken: 'test-token',
        slackWebhookUrl: null,
        webhookUrl: 'https://example.com/webhook',
        smtpHost: null,
        smtpPort: null,
        smtpUser: null,
        smtpPass: null,
        notifyEmail: null
      };

      const channels = getConfiguredChannels(config);

      expect(channels).toContain('webhook');
    });

    test('returns email when SMTP is fully configured', () => {
      const config = {
        githubToken: 'test-token',
        slackWebhookUrl: null,
        webhookUrl: null,
        smtpHost: 'smtp.example.com',
        smtpPort: 587,
        smtpUser: 'user@example.com',
        smtpPass: 'password',
        notifyEmail: 'team@example.com'
      };

      const channels = getConfiguredChannels(config);

      expect(channels).toContain('email');
    });

    test('returns all channels when all are configured', () => {
      const config = {
        githubToken: 'test-token',
        slackWebhookUrl: 'https://hooks.slack.com/test',
        webhookUrl: 'https://example.com/webhook',
        smtpHost: 'smtp.example.com',
        smtpPort: 587,
        smtpUser: 'user@example.com',
        smtpPass: 'password',
        notifyEmail: 'team@example.com'
      };

      const channels = getConfiguredChannels(config);

      expect(channels).toContain('slack');
      expect(channels).toContain('webhook');
      expect(channels).toContain('email');
      expect(channels).toHaveLength(3);
    });
  });

  describe('isEmailConfigured', () => {
    test('returns true when all SMTP fields are set', () => {
      const config = {
        smtpHost: 'smtp.example.com',
        smtpPort: 587,
        smtpUser: 'user@example.com',
        smtpPass: 'password',
        notifyEmail: 'team@example.com'
      };

      expect(isEmailConfigured(config)).toBe(true);
    });

    test('returns false when SMTP fields are missing', () => {
      const config = {
        smtpHost: null,
        smtpPort: null,
        smtpUser: null,
        smtpPass: null,
        notifyEmail: null
      };

      expect(isEmailConfigured(config)).toBe(false);
    });
  });

  describe('isSlackConfigured', () => {
    test('returns true when Slack webhook URL is set', () => {
      const config = {
        slackWebhookUrl: 'https://hooks.slack.com/test'
      };

      expect(isSlackConfigured(config)).toBe(true);
    });

    test('returns false when Slack webhook URL is not set', () => {
      const config = {
        slackWebhookUrl: null
      };

      expect(isSlackConfigured(config)).toBe(false);
    });
  });

  describe('isWebhookConfigured', () => {
    test('returns true when webhook URL is set', () => {
      const config = {
        webhookUrl: 'https://example.com/webhook'
      };

      expect(isWebhookConfigured(config)).toBe(true);
    });

    test('returns false when webhook URL is not set', () => {
      const config = {
        webhookUrl: null
      };

      expect(isWebhookConfigured(config)).toBe(false);
    });
  });
});
