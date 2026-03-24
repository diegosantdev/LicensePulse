#!/usr/bin/env node
const { Command } = require('commander');
const Watchlist = require('./watchlist');
const { fetchLicense } = require('./watcher');
const { checkAndUpdate, loadSnapshot } = require('./differ');
const { generateImpactDiff, formatImpact } = require('./explainer');
const { loadConfig } = require('./config');
const ui = require('./ui');

const program = new Command();

const RESTRICTED_LICENSES = [
  'SSPL-1.0',
  'BSL-1.1',
  'CSL',
  'CCL-1.0',
  'RSALv2',
  'Elastic-2.0',
  'Commons-Clause',
  'FSL-1.1'
];

function isRestrictiveLicense(spdxId) {
  return RESTRICTED_LICENSES.includes(spdxId);
}

program
  .name('licensepulse')
  .description('Monitor GitHub repositories for license changes')
  .version('1.0.0');

program
  .command('check')
  .description('Check all repositories for license changes')
  .action(async () => {
    try {
      await handleCheck();
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('watch')
  .description('Check repositories on interval (configured via CHECK_INTERVAL_HOURS)')
  .action(async () => {
    try {
      await handleWatch();
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('report')
  .description('Generate JSON report of all license states')
  .option('-o, --output <file>', 'Output file path (default: stdout)')
  .action(async (options) => {
    try {
      await handleReport(options);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('add <repo>')
  .description('Add repository to watchlist (format: owner/repo)')
  .action(async (repo) => {
    try {
      await handleAdd(repo);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('remove <repo>')
  .description('Remove repository from watchlist')
  .action(async (repo) => {
    try {
      await handleRemove(repo);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all monitored repositories')
  .action(async () => {
    try {
      await handleList();
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('diff <repo>')
  .description('Show last known license change for a repository')
  .action(async (repo) => {
    try {
      await handleDiff(repo);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

async function handleCheck() {

  const config = loadConfig();

  const watchlist = new Watchlist();
  await watchlist.load();

  const repos = watchlist.getAll();

  ui.header('Checking repos...', `${repos.length} repositories`);

  if (repos.length === 0) {
    ui.info('No repositories in watchlist');
    ui.space();
    console.log(ui.colors.muted('  Add some with: ') + ui.colors.primary('licensepulse add owner/repo'));
    ui.space();
    return;
  }

  const results = [];
  let successCount = 0;
  let errorCount = 0;
  let warningCount = 0;
  let alertCount = 0;

  for (const repo of repos) {
    try {
      const currentLicense = await fetchLicense(repo);
      const change = await checkAndUpdate(repo, currentLicense);

      const isUnknown = currentLicense.spdxId === 'NOASSERTION' || currentLicense.spdxId === 'NONE';
      if (isUnknown) warningCount++;

      if (change.changed) {
        alertCount++;
        results.push({
          repo,
          status: 'CHANGED',
          currentLicense: currentLicense.spdxId,
          previousLicense: change.oldLicense,
          newLicense: change.newLicense,
          isUnknown
        });
      } else {
        results.push({
          repo,
          status: 'NO_CHANGE',
          currentLicense: currentLicense.spdxId,
          isUnknown
        });
      }

      successCount++;
    } catch (error) {
      results.push({
        repo,
        status: 'ERROR',
        error: error.message
      });

      errorCount++;
    }
  }

  const alerts = results.filter(r => r.status === 'CHANGED');

  if (alerts.length > 0) {
    ui.space();
    const alertWidth = 60;
    console.log(ui.colors.error('╔' + '═'.repeat(alertWidth) + '╗'));
    const alertText = '  🚨 LICENSE CHANGE DETECTED';
    const alertPadding = Math.max(0, alertWidth - alertText.length - 2);
    console.log(ui.colors.error('║') + ui.colors.bright(alertText) + ' '.repeat(alertPadding) + ui.colors.error('  ║'));
    console.log(ui.colors.error('╚' + '═'.repeat(alertWidth) + '╝'));
    ui.space();

    for (const alert of alerts) {
      const repoName = alert.repo.padEnd(28, ' ');
      console.log(`  ${ui.icons.alert}  ${ui.colors.bright(repoName)} ${ui.colors.warning(alert.previousLicense)} ${ui.icons.arrow} ${ui.colors.error(alert.newLicense)}`);
      ui.space();

      const diff = generateImpactDiff(alert.previousLicense, alert.newLicense);

      ui.space();
      console.log('  ' + ui.colors.bright('═══ IMPACT ANALYSIS ════════════════════════════════════'));
      ui.space();

      const criticalCount = diff.changes.filter(c => c.severity === 'CRITICAL').length;
      const warningCount = diff.changes.filter(c => c.severity === 'WARNING').length;

      if (criticalCount > 0) {
        console.log('    ' + ui.colors.error('⚠ ') + ui.colors.error(`${criticalCount} CRITICAL restriction${criticalCount > 1 ? 's' : ''} detected`));
      }
      if (warningCount > 0) {
        console.log('    ' + ui.colors.warning('⚠ ') + ui.colors.warning(`${warningCount} permission change${warningCount > 1 ? 's' : ''}`));
      }
      ui.space();

      console.log('                           ' + ui.colors.muted('BEFORE       →  AFTER'));

      for (const change of diff.changes) {
        if (change.severity === 'CRITICAL' || change.severity === 'WARNING') {
          const label = change.attribute.padEnd(22, ' ');
          const before = String(change.oldValue).padEnd(13, ' ');
          const after = String(change.newValue);

          let icon = '  ';
          let beforeColor = ui.colors.success;
          let afterColor = ui.colors.success;

          if (change.severity === 'CRITICAL') {
            icon = ui.colors.error('⚠ ');
            beforeColor = ui.colors.success;
            afterColor = ui.colors.error;
          } else if (change.severity === 'WARNING') {
            icon = ui.colors.warning('⚠ ');
            beforeColor = ui.colors.success;
            afterColor = ui.colors.warning;
          }

          console.log(`  ${icon}${ui.colors.muted(label)} ${beforeColor(before)} →  ${afterColor(after)}`);
        }
      }

      ui.space();
      console.log('  ' + ui.colors.muted('═══════════════════════════════════════════════════════════'));
      ui.space();

      const hasCriticalChanges = diff.changes.some(c => c.severity === 'CRITICAL');
      if (hasCriticalChanges) {
        const projectName = alert.repo.split('/')[1];
        console.log(`  ${ui.icons.warning}  ${ui.colors.warning('LEGAL RISK: If you offer ' + projectName + ' as a service or')}`);
        console.log(`     ${ui.colors.warning('distribute it commercially, you may now be in violation.')}`);
        ui.space();
      }

      ui.link('Full license text', `https://github.com/${alert.repo}/blob/main/LICENSE`);

      const forkLinks = {
        'hashicorp/terraform': { url: 'https://github.com/opentofu/opentofu', name: 'OpenTofu' },
        'redis/redis': { url: 'https://github.com/valkey-io/valkey', name: 'Valkey' },
        'elastic/elasticsearch': { url: 'https://github.com/opensearch-project/OpenSearch', name: 'OpenSearch' }
      };

      if (forkLinks[alert.repo]) {
        const fork = forkLinks[alert.repo];
        console.log(`     ${ui.icons.arrow} ${ui.colors.info('Open source alternative')}: ${ui.colors.bright(fork.name)} ${ui.colors.dim('(' + fork.url + ')')}`);
      }

      ui.space();
    }

    ui.divider();
    ui.space();
  }

  for (const result of results) {
    if (result.status === 'NO_CHANGE') {
      if (result.isUnknown) {
        ui.repoStatus(result.repo, result.currentLicense, 'unknown');
      } else {

        const isRestricted = isRestrictiveLicense(result.currentLicense);
        const licenseText = isRestricted
          ? `${result.currentLicense.padEnd(13, ' ')} ${ui.colors.warning('⚠ restricted')}`
          : result.currentLicense;
        ui.repoStatus(result.repo, licenseText, 'normal');
      }
    } else if (result.status === 'ERROR') {
      ui.repoStatus(result.repo, result.error, 'error');
    }
  }

  ui.space();
  ui.divider();
  ui.summary(successCount, alertCount, warningCount, errorCount);
  ui.divider();
  ui.space();

  if (alertCount > 0) {
    console.log(ui.colors.muted('  Run ') + ui.colors.primary('licensepulse diff <repo>') + ui.colors.muted(' for details.'));
    ui.space();
  }
}

async function handleWatch() {

  const config = loadConfig();

  const intervalHours = config.checkIntervalHours;
  const intervalMs = intervalHours * 60 * 60 * 1000;

  ui.space();
  console.log(ui.colors.primary('  Starting watch mode') + ui.colors.muted(` (checking every ${intervalHours} hours)`));
  console.log(ui.colors.muted('  Press Ctrl+C to stop'));
  ui.space();

  await handleCheck();

  const interval = setInterval(async () => {
    ui.space();
    ui.divider();
    console.log(ui.colors.muted(`  Check at ${new Date().toLocaleString()}`));
    ui.divider();
    ui.space();

    try {
      await handleCheck();
    } catch (error) {
      ui.error(`Check failed: ${error.message}`);
    }
  }, intervalMs);

  process.on('SIGINT', () => {
    ui.space();
    ui.info('Stopping watch mode...');
    ui.space();
    clearInterval(interval);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    clearInterval(interval);
    process.exit(0);
  });
}

async function handleReport(options) {
  const watchlist = new Watchlist();
  await watchlist.load();

  const repos = watchlist.getAll();
  const alerts = [];
  const repoDetails = [];
  let warningCount = 0;

  for (const repo of repos) {
    const snapshot = await loadSnapshot(repo);

    if (snapshot) {
      const isUnknown = snapshot.spdxId === 'NOASSERTION' || snapshot.spdxId === 'NONE';
      if (isUnknown) warningCount++;

      repoDetails.push({
        repo,
        license: isUnknown ? 'UNKNOWN' : snapshot.spdxId,
        lastChecked: snapshot.timestamp,
        isUnknown
      });

      if (snapshot.previousSpdxId) {
        alerts.push({
          repo,
          before: snapshot.previousSpdxId,
          after: snapshot.spdxId,
          changed_at: snapshot.changedAt,
          impact: generateSimplifiedImpact(snapshot.previousSpdxId, snapshot.spdxId)
        });
      }
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    repos_checked: repos.length,
    alerts
  };

  const json = JSON.stringify(report, null, 2);

  if (options.output) {
    const fs = require('fs').promises;
    await fs.writeFile(options.output, json, 'utf8');
    ui.success(`Report written to ${ui.colors.bright(options.output)}`);
  } else {

    ui.header('Report');

    const genDate = new Date(report.generated_at).toLocaleString();
    ui.keyValue('Generated', genDate, ui.colors.muted);
    ui.keyValue('Repos checked', report.repos_checked.toString(), ui.colors.bright);
    ui.keyValue('Alerts', alerts.length.toString(), alerts.length > 0 ? ui.colors.error : ui.colors.success);

    if (warningCount > 0) {
      ui.keyValue('Warnings', `${warningCount} (unknown licenses)`, ui.colors.warning);
    }

    ui.space();
    ui.section('Repos');

    repoDetails.forEach(detail => {
      const icon = detail.isUnknown ? ui.icons.warning : ui.icons.check;
      const repoName = detail.repo.padEnd(25, ' ');
      const license = detail.license.padEnd(15, ' ');
      const date = new Date(detail.lastChecked).toLocaleDateString();
      const licenseColor = detail.isUnknown ? ui.colors.warning : ui.colors.success;

      console.log(`  ${icon}  ${ui.colors.bright(repoName)} ${licenseColor(license)} ${ui.colors.muted('Last checked: ' + date)}`);
    });

    ui.space();
  }
}

function generateSimplifiedImpact(oldSpdxId, newSpdxId) {
  const diff = generateImpactDiff(oldSpdxId, newSpdxId);
  const impact = {};

  for (const change of diff.changes) {
    if (change.severity === 'CRITICAL' || change.severity === 'WARNING') {
      impact[change.attribute] = change.newValue;
    }
  }

  return impact;
}

async function handleAdd(repo) {
  const watchlist = new Watchlist();
  await watchlist.load();
  await watchlist.add(repo);

  ui.success(`Added ${ui.colors.bright(repo)} to watchlist`);
}

async function handleRemove(repo) {
  const watchlist = new Watchlist();
  await watchlist.load();
  await watchlist.remove(repo);

  ui.success(`Removed ${ui.colors.bright(repo)} from watchlist`);
}

async function handleList() {
  const watchlist = new Watchlist();
  await watchlist.load();

  const repos = watchlist.getAll();

  ui.header(`${repos.length} repos monitored`);

  if (repos.length === 0) {
    ui.info('No repositories in watchlist');
    ui.space();
    console.log(ui.colors.muted('  Add some with: ') + ui.colors.primary('licensepulse add owner/repo'));
    ui.space();
    return;
  }

  repos.forEach((repo, index) => {
    ui.listItem(index + 1, ui.colors.bright(repo));
  });

  ui.space();
}

async function handleDiff(repo) {
  const snapshot = await loadSnapshot(repo);

  ui.header(repo);

  if (!snapshot) {
    ui.keyValue('Status', 'No snapshot found', ui.colors.warning);
    ui.space();
    ui.info('Run \'licensepulse check\' first to create a snapshot');
    ui.space();
    return;
  }

  const isUnknown = snapshot.spdxId === 'NOASSERTION' || snapshot.spdxId === 'NONE';

  if (!snapshot.previousSpdxId) {
    ui.keyValue('Status', 'No changes detected', ui.colors.success);
    ui.keyValue('License', isUnknown ? 'Unknown (NOASSERTION)' : snapshot.spdxId, isUnknown ? ui.colors.warning : ui.colors.success);
    ui.keyValue('Last checked', new Date(snapshot.timestamp).toLocaleString(), ui.colors.muted);

    if (isUnknown) {
      ui.space();
      ui.infoBox('GitHub could not identify a standard SPDX license', 'warning');
      console.log(ui.colors.muted('     This repo may use a custom or restricted license.'));
      ui.link('Review manually', `https://github.com/${repo}/blob/main/LICENSE`);
    }

    ui.space();
    return;
  }

  ui.keyValue('Status', 'License changed!', ui.colors.error);
  ui.keyValue('Before', snapshot.previousSpdxId, ui.colors.warning);
  ui.keyValue('After', snapshot.spdxId, ui.colors.error);
  ui.keyValue('Changed at', new Date(snapshot.changedAt).toLocaleString(), ui.colors.muted);

  ui.space();

  const diff = generateImpactDiff(snapshot.previousSpdxId, snapshot.spdxId);
  const formatted = formatImpact(diff);

  console.log(formatted);
  ui.space();
}

const isMainModule = require.main === module ||
                     (require.main && require.main.filename && require.main.filename.includes('bin'));

if (isMainModule) {
  program.parse(process.argv);

  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
}

module.exports = {
  handleCheck,
  handleAdd,
  handleRemove,
  handleList,
  handleDiff,
  handleReport
};
