const fs = require('fs');
const path = require('path');

const licensesPath = path.join(__dirname, '..', 'data', 'licenses.json');
const licensesDb = JSON.parse(fs.readFileSync(licensesPath, 'utf8'));

function getLicensePermissions(spdxId) {
  return licensesDb[spdxId] || null;
}

function calculateSeverity(oldValue, newValue) {

  if (oldValue === 'ALLOWED' && newValue === 'BLOCKED') {
    return 'CRITICAL';
  }

  if (oldValue === 'ALLOWED' && newValue === 'RESTRICTED') {
    return 'WARNING';
  }

  if ((oldValue === 'RESTRICTED' || oldValue === 'BLOCKED') && newValue === 'ALLOWED') {
    return 'INFO';
  }

  if (oldValue === 'RESTRICTED' && newValue === 'BLOCKED') {
    return 'WARNING';
  }

  return 'INFO';
}

function generateImpactDiff(oldSpdxId, newSpdxId) {
  const oldLicense = getLicensePermissions(oldSpdxId);
  const newLicense = getLicensePermissions(newSpdxId);

  const changes = [];

  if (!oldLicense || !newLicense) {
    return {
      oldLicense: oldLicense || { spdxId: oldSpdxId, name: 'Unknown License' },
      newLicense: newLicense || { spdxId: newSpdxId, name: 'Unknown License' },
      changes: [],
      unknownLicense: true,
      message: 'Manual review required: One or both licenses not found in database'
    };
  }

  const permissionKeys = [
    'commercialUse',
    'distribution',
    'modification',
    'patentUse',
    'privateUse',
    'saasUse'
  ];

  for (const key of permissionKeys) {
    const oldValue = oldLicense.permissions[key];
    const newValue = newLicense.permissions[key];

    if (oldValue !== newValue) {
      changes.push({
        attribute: key,
        oldValue,
        newValue,
        severity: calculateSeverity(oldValue, newValue)
      });
    }
  }

  if (oldLicense.conditions.copyleftScope !== newLicense.conditions.copyleftScope) {
    changes.push({
      attribute: 'copyleftScope',
      oldValue: oldLicense.conditions.copyleftScope,
      newValue: newLicense.conditions.copyleftScope,
      severity: 'INFO'
    });
  }

  if (oldLicense.conditions.sourceRequired !== newLicense.conditions.sourceRequired) {
    changes.push({
      attribute: 'sourceRequired',
      oldValue: oldLicense.conditions.sourceRequired,
      newValue: newLicense.conditions.sourceRequired,
      severity: 'INFO'
    });
  }

  return {
    oldLicense,
    newLicense,
    changes
  };
}

function formatAttributeName(attr) {
  const names = {
    commercialUse: 'Commercial use',
    distribution: 'Distribution',
    modification: 'Modification',
    patentUse: 'Patent use',
    privateUse: 'Private use',
    saasUse: 'SaaS use',
    copyleftScope: 'Copyleft scope',
    sourceRequired: 'Source required'
  };
  return names[attr] || attr;
}

function formatImpact(impactDiff) {
  if (impactDiff.unknownLicense) {
    return `\n⚠️  ${impactDiff.message}\n\nOld: ${impactDiff.oldLicense.spdxId}\nNew: ${impactDiff.newLicense.spdxId}\n`;
  }

  if (impactDiff.changes.length === 0) {
    return '\nNo permission changes detected.\n';
  }

  let output = '\n';
  output += `Before: ${impactDiff.oldLicense.name} (${impactDiff.oldLicense.spdxId})\n`;
  output += `After:  ${impactDiff.newLicense.name} (${impactDiff.newLicense.spdxId})\n\n`;
  output += 'Changes:\n';

  const critical = impactDiff.changes.filter(c => c.severity === 'CRITICAL');
  const warnings = impactDiff.changes.filter(c => c.severity === 'WARNING');
  const info = impactDiff.changes.filter(c => c.severity === 'INFO');

  if (critical.length > 0) {
    output += '\n🚨 CRITICAL:\n';
    for (const change of critical) {
      output += `  ${formatAttributeName(change.attribute)}: ${change.oldValue} → ${change.newValue}\n`;
    }
  }

  if (warnings.length > 0) {
    output += '\n⚠️  WARNING:\n';
    for (const change of warnings) {
      output += `  ${formatAttributeName(change.attribute)}: ${change.oldValue} → ${change.newValue}\n`;
    }
  }

  if (info.length > 0) {
    output += '\nℹ️  INFO:\n';
    for (const change of info) {
      const oldVal = typeof change.oldValue === 'boolean' ? (change.oldValue ? 'Yes' : 'No') : change.oldValue;
      const newVal = typeof change.newValue === 'boolean' ? (change.newValue ? 'Yes' : 'No') : change.newValue;
      output += `  ${formatAttributeName(change.attribute)}: ${oldVal} → ${newVal}\n`;
    }
  }

  if (impactDiff.newLicense.realWorldImpact) {
    output += `\n📌 Real-world context:\n${impactDiff.newLicense.realWorldImpact}\n`;
  }

  return output;
}

module.exports = {
  getLicensePermissions,
  generateImpactDiff,
  formatImpact,
  calculateSeverity
};
