#!/usr/bin/env node
const { Command } = require('commander');
const Watchlist = require('./watchlist');
const { fetchLicense } = require('./watcher');
const { checkAndUpdate, loadSnapshot } = require('./differ');
const { generateImpactDiff, formatImpact } = require('./explainer');
const { loadConfig } = require('./config');
const { getVersionCutoff } = require('./version-tracker');
const { calculateRiskScore, suggestAlternatives } = require('./risk-scorer');
const { autoImport } = require('./package-importer');
const { checkLicenseFileChange, getLicenseFileHistory } = require('./license-monitor');
const { getTransitiveDependencies, formatDependencyTree } = require('./dependency-graph');
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
  .version('1.2.0');

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

program
  .command('import')
  .description('Auto-import dependencies from package.json or requirements.txt')
  .option('-d, --directory <path>', 'Directory to scan (default: current directory)', '.')
  .option('--dry-run', 'Show what would be imported without adding to watchlist')
  .action(async (options) => {
    try {
      await handleImport(options);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('risk <repo>')
  .description('Show risk score and analysis for a repository')
  .action(async (repo) => {
    try {
      await handleRisk(repo);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('monitor-file <repo>')
  .description('Check if LICENSE file changed directly in GitHub repo')
  .action(async (repo) => {
    try {
      await handleMonitorFile(repo);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('deps <package>')
  .description('Show dependency tree and transitive license risks')
  .option('-e, --ecosystem <type>', 'Package ecosystem (npm or pypi)', 'npm')
  .option('-d, --depth <number>', 'Tree depth (default: 2)', '2')
  .action(async (packageName, options) => {
    try {
      await handleDeps(packageName, options);
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
        
        // Load snapshot to get change date
        const snapshot = await loadSnapshot(repo);
        
        results.push({
          repo,
          status: 'CHANGED',
          currentLicense: currentLicense.spdxId,
          previousLicense: change.oldLicense,
          newLicense: change.newLicense,
          changedAt: snapshot?.changedAt,
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
      
      // Show version cutoff if available
      const config = loadConfig();
      const token = process.env.GITHUB_TOKEN;
      if (token && alert.changedAt) {
        try {
          const versionInfo = await getVersionCutoff(alert.repo, alert.changedAt, token);
          if (versionInfo && versionInfo.safeVersion) {
            console.log(`  ${ui.colors.muted('     Safe up to:')} ${ui.colors.success(versionInfo.safeVersion)} ${ui.colors.muted('│')} ${ui.colors.error('Changed in:')} ${ui.colors.error(versionInfo.changedVersion || 'latest')}`);
          }
        } catch {}
      }
      
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

      // Use new alternative suggestion system
      const alternative = suggestAlternatives(alert.repo, alert.newLicense);
      if (alternative) {
        console.log(`     ${ui.icons.arrow} ${ui.colors.info('Open source alternative')}: ${ui.colors.bright(alternative.name)} ${ui.colors.dim('(' + alternative.url + ')')}`);
        console.log(`        ${ui.colors.muted(alternative.reason)}`);
      } else if (forkLinks[alert.repo]) {
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
  
  // Show version cutoff
  const token = process.env.GITHUB_TOKEN;
  if (token && snapshot.changedAt) {
    try {
      const versionInfo = await getVersionCutoff(repo, snapshot.changedAt, token);
      if (versionInfo) {
        ui.space();
        ui.section('Version Information');
        if (versionInfo.safeVersion) {
          ui.keyValue('Safe up to', versionInfo.safeVersion, ui.colors.success);
          ui.keyValue('Changed in', versionInfo.changedVersion || 'latest', ui.colors.error);
        }
        if (versionInfo.ecosystem !== 'github') {
          ui.keyValue('Package', `${versionInfo.packageName} (${versionInfo.ecosystem})`, ui.colors.muted);
        }
      }
    } catch (error) {
      // Silently fail version lookup
    }
  }

  ui.space();

  const diff = generateImpactDiff(snapshot.previousSpdxId, snapshot.spdxId);
  const formatted = formatImpact(diff);

  console.log(formatted);
  ui.space();
}

async function handleImport(options) {
  ui.header('Auto-importing dependencies');
  
  const result = await autoImport(options.directory);
  
  if (result.sources.length === 0) {
    ui.info('No dependency files found (package.json or requirements.txt)');
    ui.space();
    return;
  }
  
  ui.keyValue('Sources found', result.sources.join(', '), ui.colors.success);
  ui.keyValue('Repos discovered', result.repos.length.toString(), ui.colors.bright);
  
  if (result.failed.length > 0) {
    ui.keyValue('Failed to resolve', result.failed.length.toString(), ui.colors.warning);
  }
  
  ui.space();
  
  if (result.repos.length === 0) {
    ui.info('No GitHub repositories found in dependencies');
    ui.space();
    return;
  }
  
  if (options.dryRun) {
    ui.section('Would add to watchlist:');
    result.repos.forEach((item, index) => {
      console.log(`  ${index + 1}. ${ui.colors.bright(item.repo)} ${ui.colors.muted(`(${item.package} via ${item.ecosystem})`)}`);
    });
    ui.space();
    return;
  }
  
  // Add to watchlist
  const watchlist = new Watchlist();
  await watchlist.load();
  
  let added = 0;
  let skipped = 0;
  
  for (const item of result.repos) {
    const existing = watchlist.getAll();
    if (existing.includes(item.repo)) {
      skipped++;
    } else {
      await watchlist.add(item.repo);
      added++;
    }
  }
  
  ui.space();
  ui.success(`Added ${added} repositories to watchlist`);
  if (skipped > 0) {
    ui.info(`Skipped ${skipped} already in watchlist`);
  }
  ui.space();
}

async function handleRisk(repo) {
  ui.header(`Risk Analysis: ${repo}`);
  
  // Load current license
  const snapshot = await loadSnapshot(repo);
  if (!snapshot) {
    ui.info('No snapshot found. Run \'licensepulse check\' first.');
    ui.space();
    return;
  }
  
  const riskAnalysis = await calculateRiskScore(repo, snapshot.spdxId);
  
  // Display risk score
  const scoreColor = riskAnalysis.level === 'HIGH' ? ui.colors.error : 
                     riskAnalysis.level === 'MEDIUM' ? ui.colors.warning : 
                     ui.colors.success;
  
  ui.keyValue('Risk Score', `${riskAnalysis.score}/100`, scoreColor);
  ui.keyValue('Risk Level', riskAnalysis.level, scoreColor);
  ui.keyValue('Current License', snapshot.spdxId, ui.colors.bright);
  
  ui.space();
  ui.section('Risk Factors');
  
  if (riskAnalysis.factors.length === 0) {
    console.log(ui.colors.success('  ✓ No significant risk factors detected'));
  } else {
    riskAnalysis.factors.forEach(factor => {
      console.log(`  ${ui.colors.warning('⚠')} ${ui.colors.bright(factor.factor)} ${ui.colors.muted(`(+${factor.points} points)`)}`);
      console.log(`     ${ui.colors.muted(factor.detail)}`);
    });
  }
  
  ui.space();
  
  // Show alternative if available
  const alternative = suggestAlternatives(repo, snapshot.spdxId);
  if (alternative) {
    ui.section('Recommended Alternative');
    console.log(`  ${ui.colors.bright(alternative.name)} ${ui.colors.muted(`(${alternative.license})`)}`);
    console.log(`  ${ui.colors.muted(alternative.reason)}`);
    ui.link('Repository', alternative.url);
    ui.space();
  }
  
  if (riskAnalysis.level === 'HIGH') {
    ui.space();
    console.log(ui.colors.error('  ⚠ HIGH RISK: Consider monitoring this repository closely or switching to an alternative.'));
  }
  
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
  handleReport,
  handleImport,
  handleRisk,
  handleMonitorFile,
  handleDeps
};

async function handleMonitorFile(repo) {
  const token = process.env.GITHUB_TOKEN;
  
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }
  
  ui.header(`LICENSE File Monitor: ${repo}`);
  
  const change = await checkLicenseFileChange(repo, token);
  
  if (change.changed) {
    ui.keyValue('Status', 'LICENSE file changed!', ui.colors.error);
    ui.keyValue('File', change.filename, ui.colors.bright);
    ui.keyValue('Old hash', change.oldHash.substring(0, 12) + '...', ui.colors.warning);
    ui.keyValue('New hash', change.newHash.substring(0, 12) + '...', ui.colors.error);
    
    ui.space();
    ui.section('Change Details');
    console.log(`  ${ui.colors.muted('This change happened between:')}`);
    console.log(`  ${ui.colors.muted('Last check:')} ${new Date(change.previousCheckedAt).toLocaleString()}`);
    console.log(`  ${ui.colors.muted('Current check:')} ${new Date().toLocaleString()}`);
    
    ui.space();
    ui.link('View LICENSE file', change.url);
    
    // Get commit history
    const history = await getLicenseFileHistory(repo, token);
    if (history.length > 0) {
      ui.space();
      ui.section('Recent LICENSE Commits');
      history.slice(0, 3).forEach((commit, i) => {
        console.log(`  ${i + 1}. ${new Date(commit.date).toLocaleDateString()} - ${commit.message.split('\n')[0]}`);
        console.log(`     ${ui.colors.muted('by ' + commit.author)}`);
      });
    }
    
    ui.space();
    console.log(ui.colors.error('  ⚠ WARNING: LICENSE file content changed!'));
    console.log(ui.colors.muted('     Run ') + ui.colors.primary('licensepulse check') + ui.colors.muted(' to update SPDX detection.'));
  } else {
    ui.keyValue('Status', 'No changes detected', ui.colors.success);
    
    if (change.reason === 'No LICENSE file found') {
      ui.keyValue('Reason', 'LICENSE file not found', ui.colors.warning);
      ui.space();
      console.log(ui.colors.muted('  ℹ  Possible reasons:'));
      console.log(ui.colors.muted('     • LICENSE file is in a subdirectory'));
      console.log(ui.colors.muted('     • Repo uses non-standard license structure'));
      console.log(ui.colors.muted('     • Repository is private or access restricted'));
      console.log(ui.colors.muted('     • License info only in package metadata'));
      ui.space();
      console.log(ui.colors.info('  💡 Tip: Use ') + ui.colors.primary('licensepulse check') + ui.colors.info(' to get SPDX license via GitHub API.'));
      console.log(ui.colors.muted('     The check command uses GitHub\'s license detection which is more reliable.'));
    } else {
      ui.keyValue('Reason', change.reason || 'LICENSE file unchanged', ui.colors.muted);
      
      const stored = await require('./license-monitor').getStoredHash(repo);
      if (stored) {
        ui.keyValue('Last checked', new Date(stored.checkedAt).toLocaleString(), ui.colors.muted);
        ui.keyValue('File hash', stored.hash.substring(0, 12) + '...', ui.colors.muted);
        if (stored.detectionMethod) {
          ui.keyValue('Detection method', stored.detectionMethod, ui.colors.muted);
        }
      }
    }
  }
  
  ui.space();
}

async function handleDeps(packageName, options) {
  ui.header(`Dependency Analysis: ${packageName}`);
  
  console.log(ui.colors.muted(`  Analyzing ${options.ecosystem} dependencies...`));
  ui.space();
  
  const { tree, allDependencies, count } = await getTransitiveDependencies(
    packageName,
    options.ecosystem,
    parseInt(options.depth)
  );
  
  ui.keyValue('Total dependencies', count.toString(), ui.colors.bright);
  ui.keyValue('Depth analyzed', options.depth, ui.colors.muted);
  
  if (count === 0) {
    ui.space();
    console.log(ui.colors.success('  ✓ This package has no dependencies!'));
    console.log(ui.colors.muted('     It\'s a standalone package with zero external dependencies.'));
  }
  
  ui.space();
  ui.section('Dependency Tree');
  
  const treeOutput = formatDependencyTree(tree, 0, parseInt(options.depth));
  console.log(treeOutput);
  
  if (count > 0) {
    ui.space();
    ui.section('All Dependencies');
    
    // Show first 20 dependencies
    const depsToShow = allDependencies.slice(0, 20);
    depsToShow.forEach((dep, i) => {
      console.log(`  ${(i + 1).toString().padStart(2, ' ')}. ${dep}`);
    });
    
    if (allDependencies.length > 20) {
      console.log(`  ${ui.colors.muted(`... and ${allDependencies.length - 20} more`)}`);
    }
    
    ui.space();
    console.log(ui.colors.info('  💡 Tip: Use ') + ui.colors.primary('licensepulse import') + ui.colors.info(' to monitor these dependencies.'));
  }
  
  ui.space();
}
