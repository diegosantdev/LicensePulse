const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

const GITHUB_API_BASE = 'https://api.github.com';
const LICENSE_HASHES_DIR = '.licensepulse/license-hashes';

async function fetchLicenseFileContent(repoId, token) {
  const [owner, repo] = repoId.split('/');
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  
  try {
    const licenseApiUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/license`;
    const response = await axios.get(licenseApiUrl, { headers, timeout: 10000 });
    
    if (response.data?.content) {
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      return {
        filename: response.data.name || 'LICENSE',
        content,
        sha: response.data.sha,
        url: response.data.html_url,
        size: response.data.size,
        detectionMethod: 'github-license-api'
      };
    }
  } catch (error) {
  }
  
  const licenseFiles = [
    'LICENSE',
    'LICENSE.md',
    'LICENSE.txt',
    'LICENSE-MIT',
    'LICENSE-APACHE',
    'LICENCE',
    'LICENCE.md',
    'LICENCE.txt',
    'COPYING',
    'COPYING.md',
    'COPYING.txt',
    'LICENSE-Community.txt'
  ];
  
  for (const filename of licenseFiles) {
    try {
      const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${filename}`;
      const response = await axios.get(url, { headers, timeout: 10000 });
      
      if (response.data?.content) {
        const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
        return {
          filename,
          content,
          sha: response.data.sha,
          url: response.data.html_url,
          size: response.data.size,
          detectionMethod: 'direct-file-access'
        };
      }
    } catch (error) {
      continue;
    }
  }
  
  return null;
}

function calculateHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function getStoredHash(repoId) {
  try {
    await fs.mkdir(LICENSE_HASHES_DIR, { recursive: true });
    const hashFile = path.join(LICENSE_HASHES_DIR, `${repoId.replace('/', '-')}.json`);
    const data = await fs.readFile(hashFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

async function storeHash(repoId, hashData) {
  try {
    await fs.mkdir(LICENSE_HASHES_DIR, { recursive: true });
    const hashFile = path.join(LICENSE_HASHES_DIR, `${repoId.replace('/', '-')}.json`);
    await fs.writeFile(hashFile, JSON.stringify(hashData, null, 2), 'utf8');
  } catch (error) {
    throw new Error(`Failed to store hash for ${repoId}: ${error.message}`);
  }
}

async function checkLicenseFileChange(repoId, token) {
  const licenseFile = await fetchLicenseFileContent(repoId, token);
  
  if (!licenseFile) {
    return {
      changed: false,
      reason: 'No LICENSE file found'
    };
  }
  
  const currentHash = calculateHash(licenseFile.content);
  const stored = await getStoredHash(repoId);
  
  if (!stored) {
    await storeHash(repoId, {
      hash: currentHash,
      filename: licenseFile.filename,
      sha: licenseFile.sha,
      checkedAt: new Date().toISOString(),
      url: licenseFile.url,
      detectionMethod: licenseFile.detectionMethod
    });
    
    return {
      changed: false,
      reason: 'First check - baseline stored',
      detectionMethod: licenseFile.detectionMethod
    };
  }
  
  if (stored.hash !== currentHash) {
    const oldData = stored;
    
    await storeHash(repoId, {
      hash: currentHash,
      filename: licenseFile.filename,
      sha: licenseFile.sha,
      checkedAt: new Date().toISOString(),
      url: licenseFile.url,
      detectionMethod: licenseFile.detectionMethod,
      previousHash: oldData.hash,
      changedAt: new Date().toISOString()
    });
    
    return {
      changed: true,
      oldHash: oldData.hash,
      newHash: currentHash,
      filename: licenseFile.filename,
      url: licenseFile.url,
      content: licenseFile.content,
      previousCheckedAt: oldData.checkedAt
    };
  }
  
  return {
    changed: false,
    reason: 'No changes detected'
  };
}

async function getLicenseFileHistory(repoId, token) {
  const [owner, repo] = repoId.split('/');
  
  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json'
    };
    
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?path=LICENSE&per_page=10`;
    const response = await axios.get(url, { headers, timeout: 10000 });
    
    return response.data.map(commit => ({
      sha: commit.sha,
      date: commit.commit.author.date,
      message: commit.commit.message,
      author: commit.commit.author.name,
      url: commit.html_url
    }));
  } catch (error) {
    return [];
  }
}

async function monitorAllLicenseFiles(repos, token) {
  const results = [];
  
  for (const repo of repos) {
    try {
      const change = await checkLicenseFileChange(repo, token);
      results.push({
        repo,
        ...change
      });
    } catch (error) {
      results.push({
        repo,
        changed: false,
        error: error.message
      });
    }
  }
  
  return results;
}

module.exports = {
  fetchLicenseFileContent,
  calculateHash,
  checkLicenseFileChange,
  getLicenseFileHistory,
  monitorAllLicenseFiles,
  getStoredHash,
  storeHash
};
