const dotenv = require('dotenv');

dotenv.config();

function loadConfig() {
  const config = {

    githubToken: process.env.GITHUB_TOKEN,

    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || null,
    webhookUrl: process.env.WEBHOOK_URL || null,

    smtpHost: process.env.SMTP_HOST || null,
    smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : null,
    smtpUser: process.env.SMTP_USER || null,
    smtpPass: process.env.SMTP_PASS || null,
    notifyEmail: process.env.NOTIFY_EMAIL || null,

    checkIntervalHours: process.env.CHECK_INTERVAL_HOURS
      ? parseInt(process.env.CHECK_INTERVAL_HOURS, 10)
      : 24
  };

  if (!config.githubToken) {
    throw new Error(
      'GITHUB_TOKEN environment variable is required. ' +
      'Get one at: https://github.com/settings/tokens'
    );
  }

  if (isNaN(config.checkIntervalHours) || config.checkIntervalHours <= 0) {
    throw new Error(
      'CHECK_INTERVAL_HOURS must be a positive number'
    );
  }

  const smtpFields = [config.smtpHost, config.smtpPort, config.smtpUser, config.smtpPass, config.notifyEmail];
  const smtpFieldsSet = smtpFields.filter(f => f !== null).length;

  if (smtpFieldsSet > 0 && smtpFieldsSet < 5) {
    throw new Error(
      'SMTP configuration incomplete. All of SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and NOTIFY_EMAIL are required for email notifications'
    );
  }

  return config;
}

function getConfiguredChannels(config) {
  const channels = [];

  if (config.slackWebhookUrl) {
    channels.push('slack');
  }

  if (config.webhookUrl) {
    channels.push('webhook');
  }

  if (config.smtpHost && config.smtpPort && config.smtpUser && config.smtpPass && config.notifyEmail) {
    channels.push('email');
  }

  return channels;
}

function isEmailConfigured(config) {
  return !!(config.smtpHost && config.smtpPort && config.smtpUser && config.smtpPass && config.notifyEmail);
}

function isSlackConfigured(config) {
  return !!config.slackWebhookUrl;
}

function isWebhookConfigured(config) {
  return !!config.webhookUrl;
}

module.exports = {
  loadConfig,
  getConfiguredChannels,
  isEmailConfigured,
  isSlackConfigured,
  isWebhookConfigured
};
