const chalk = require('chalk');

const colors = {
  primary: chalk.hex('#9b59b6'),
  secondary: chalk.hex('#8e44ad'),
  success: chalk.hex('#2ecc71'),
  warning: chalk.hex('#f39c12'),
  error: chalk.hex('#e74c3c'),
  info: chalk.hex('#3498db'),
  muted: chalk.hex('#95a5a6'),
  bright: chalk.hex('#ecf0f1'),
  dim: chalk.dim
};

const icons = {
  check: colors.success('✓'),
  cross: colors.error('✗'),
  warning: colors.warning('⚠'),
  alert: colors.error('🚨'),
  info: colors.info('ℹ'),
  pulse: colors.primary('●'),
  arrow: colors.muted('→'),
  bullet: colors.muted('•')
};

function header(title, subtitle = '') {
  const width = 60;
  const titleText = `  LicensePulse ${icons.bullet} ${title}`;
  const titleLen = titleText.replace(/\u001b\[[0-9;]*m/g, '').length;
  const padding = Math.max(0, width - titleLen - 2);

  console.log('');
  console.log(colors.primary('╔' + '═'.repeat(width) + '╗'));
  console.log(colors.primary('║') + colors.bright(titleText) + ' '.repeat(padding) + colors.primary('  ║'));

  if (subtitle) {
    const subText = `  ${subtitle}`;
    const subLen = subText.length;
    const subPadding = Math.max(0, width - subLen - 2);
    console.log(colors.primary('║') + colors.muted(subText) + ' '.repeat(subPadding) + colors.primary('  ║'));
  }

  console.log(colors.primary('╚' + '═'.repeat(width) + '╝'));
  console.log('');
}

function divider() {
  console.log(colors.muted('─'.repeat(64)));
}

function section(title) {
  console.log('');
  console.log(colors.secondary(`  ${title}`));
  console.log(colors.muted('  ' + '─'.repeat(title.length)));
}

function keyValue(key, value, color = colors.bright) {
  const dots = '.'.repeat(Math.max(2, 20 - key.length));
  console.log(`  ${colors.muted(key)} ${colors.dim(dots)} ${color(value)}`);
}

function listItem(number, text, status = 'normal') {
  const num = colors.muted(number.toString().padStart(2, ' '));
  let icon = icons.pulse;

  if (status === 'success') icon = icons.check;
  if (status === 'warning') icon = icons.warning;
  if (status === 'error') icon = icons.cross;
  if (status === 'alert') icon = icons.alert;

  console.log(`  ${num}  ${icon}  ${text}`);
}

function repoStatus(repo, license, status = 'normal') {
  const repoName = repo.padEnd(35, ' ');
  let icon = icons.check;
  let licenseColor = colors.success;
  let licenseText = license;

  if (status === 'unknown') {
    icon = icons.warning;
    licenseColor = colors.warning;
    licenseText = 'Unknown license (manual review required)';
  } else if (status === 'alert') {
    icon = icons.alert;
    licenseColor = colors.error;
  } else if (status === 'error') {
    icon = icons.cross;
    licenseColor = colors.error;
  }

  console.log(`  ${icon}  ${colors.bright(repoName)} ${licenseColor(licenseText)}`);
}

function summary(checked, alerts, warnings, errors) {
  let parts = [];

  parts.push(colors.bright(`${checked} checked`));
  if (alerts > 0) parts.push(colors.error(`${alerts} alerts`));
  if (warnings > 0) parts.push(colors.warning(`${warnings} warnings`));
  if (errors > 0) parts.push(colors.error(`${errors} errors`));

  console.log('  ' + parts.join(colors.muted('  •  ')));
}

function infoBox(message, type = 'info') {
  let icon = icons.info;
  let color = colors.info;

  if (type === 'warning') {
    icon = icons.warning;
    color = colors.warning;
  } else if (type === 'error') {
    icon = icons.cross;
    color = colors.error;
  } else if (type === 'success') {
    icon = icons.check;
    color = colors.success;
  }

  console.log('');
  console.log(`  ${icon}  ${color(message)}`);
}

function link(text, url) {
  console.log(`     ${icons.arrow} ${colors.info(text)}: ${colors.dim(url)}`);
}

function success(message) {
  console.log(`  ${icons.check}  ${colors.success(message)}`);
}

function error(message) {
  console.log(`  ${icons.cross}  ${colors.error(message)}`);
}

function warning(message) {
  console.log(`  ${icons.warning}  ${colors.warning(message)}`);
}

function info(message) {
  console.log(`  ${icons.info}  ${colors.info(message)}`);
}

function space() {
  console.log('');
}

module.exports = {
  colors,
  icons,
  header,
  divider,
  section,
  keyValue,
  listItem,
  repoStatus,
  summary,
  infoBox,
  link,
  success,
  error,
  warning,
  info,
  space
};
