const { loadSnapshot } = require('./differ');
const { getLicensePermissions } = require('./explainer');

async function calculateRiskScore(repoId, currentLicense) {
  let score = 0;
  const factors = [];
  
  const snapshot = await loadSnapshot(repoId);
  
  if (snapshot && snapshot.previousSpdxId) {
    score += 40;
    factors.push({
      factor: 'License changed previously',
      points: 40,
      detail: `${snapshot.previousSpdxId} → ${snapshot.spdxId}`
    });
  }
  
  const restrictiveLicenses = ['SSPL-1.0', 'BSL-1.1', 'RSALv2', 'CSL', 'CCL-1.0', 'Elastic-2.0'];
  if (restrictiveLicenses.includes(currentLicense)) {
    score += 30;
    factors.push({
      factor: 'Currently uses restrictive license',
      points: 30,
      detail: currentLicense
    });
  }
  
  if (snapshot && snapshot.previousSpdxId) {
    const oldPerms = getLicensePermissions(snapshot.previousSpdxId);
    const newPerms = getLicensePermissions(currentLicense);
    
    if (oldPerms && newPerms) {
      const oldAllowed = Object.values(oldPerms.permissions).filter(v => v === 'ALLOWED').length;
      const newAllowed = Object.values(newPerms.permissions).filter(v => v === 'ALLOWED').length;
      
      if (newAllowed < oldAllowed) {
        score += 20;
        factors.push({
          factor: 'License became more restrictive',
          points: 20,
          detail: `${oldAllowed} → ${newAllowed} allowed permissions`
        });
      }
    }
  }
  
  const commercialPatterns = ['hashicorp', 'elastic', 'mongodb', 'redis', 'cockroach'];
  const repoLower = repoId.toLowerCase();
  if (commercialPatterns.some(pattern => repoLower.includes(pattern))) {
    score += 10;
    factors.push({
      factor: 'Commercial/VC-backed entity',
      points: 10,
      detail: 'Higher likelihood of future license changes'
    });
  }
  
  return {
    score: Math.min(score, 100),
    level: getRiskLevel(score),
    factors
  };
}

function getRiskLevel(score) {
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

function getRiskColor(level) {
  switch (level) {
    case 'HIGH': return '\x1b[31m';
    case 'MEDIUM': return '\x1b[33m';
    case 'LOW': return '\x1b[32m';
    default: return '\x1b[0m';
  }
}

function suggestAlternatives(repoId, currentLicense) {
  const alternatives = {
    'hashicorp/terraform': {
      name: 'OpenTofu',
      repo: 'opentofu/opentofu',
      url: 'https://github.com/opentofu/opentofu',
      license: 'MPL-2.0',
      reason: 'Community fork after Terraform switched to BSL-1.1'
    },
    'redis/redis': {
      name: 'Valkey',
      repo: 'valkey-io/valkey',
      url: 'https://github.com/valkey-io/valkey',
      license: 'BSD-3-Clause',
      reason: 'Linux Foundation fork after Redis license change'
    },
    'elastic/elasticsearch': {
      name: 'OpenSearch',
      repo: 'opensearch-project/OpenSearch',
      url: 'https://github.com/opensearch-project/OpenSearch',
      license: 'Apache-2.0',
      reason: 'AWS fork maintaining Apache 2.0 license'
    },
    'mongodb/mongo': {
      name: 'FerretDB',
      repo: 'FerretDB/FerretDB',
      url: 'https://github.com/FerretDB/FerretDB',
      license: 'Apache-2.0',
      reason: 'MongoDB-compatible database with Apache 2.0 license'
    }
  };
  
  return alternatives[repoId] || null;
}

module.exports = {
  calculateRiskScore,
  getRiskLevel,
  getRiskColor,
  suggestAlternatives
};
