const axios = require('axios');
const semver = require('semver');

const GITHUB_API_BASE = 'https://api.github.com';
const NPM_REGISTRY = 'https://registry.npmjs.org';
const PYPI_API = 'https://pypi.org/pypi';

async function fetchGitHubReleases(repoId, token) {
  const [owner, repo] = repoId.split('/');
  
  try {
    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/tags`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json'
        },
        params: { per_page: 100 }
      }
    );
    
    return response.data.map(tag => ({
      version: tag.name,
      commit: tag.commit.sha
    }));
  } catch (error) {
    return [];
  }
}

async function fetchNpmVersions(packageName) {
  try {
    const response = await axios.get(`${NPM_REGISTRY}/${packageName}`);
    const versions = Object.keys(response.data.versions || {});
    return versions.filter(v => semver.valid(v)).sort(semver.rcompare);
  } catch (error) {
    return [];
  }
}

async function fetchPyPiVersions(packageName) {
  try {
    const response = await axios.get(`${PYPI_API}/${packageName}/json`);
    const versions = Object.keys(response.data.releases || {});
    return versions.filter(v => semver.valid(v)).sort(semver.rcompare);
  } catch (error) {
    return [];
  }
}

function findSafeVersion(versions, changeCommit, releases) {
  if (changeCommit && releases.length > 0) {
    const changeIndex = releases.findIndex(r => r.commit === changeCommit);
    if (changeIndex > 0) {
      return releases[changeIndex - 1].version;
    }
  }
  
  return versions.length > 0 ? versions[0] : null;
}

async function detectEcosystem(repoId, token) {
  const [owner, repo] = repoId.split('/');
  
  try {
    const npmCheck = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/package.json`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json'
        }
      }
    );
    
    if (npmCheck.status === 200) {
      const content = Buffer.from(npmCheck.data.content, 'base64').toString('utf-8');
      const pkg = JSON.parse(content);
      return { type: 'npm', packageName: pkg.name };
    }
  } catch {}
  
  try {
    const pyCheck = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/setup.py`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json'
        }
      }
    );
    
    if (pyCheck.status === 200) {
      const repoName = repo.toLowerCase().replace(/-/g, '_');
      return { type: 'pypi', packageName: repoName };
    }
  } catch {}
  
  return { type: 'github', packageName: null };
}

async function getVersionCutoff(repoId, licenseChangeDate, token) {
  const ecosystem = await detectEcosystem(repoId, token);
  const releases = await fetchGitHubReleases(repoId, token);
  
  let versions = [];
  
  if (ecosystem.type === 'npm' && ecosystem.packageName) {
    versions = await fetchNpmVersions(ecosystem.packageName);
  } else if (ecosystem.type === 'pypi' && ecosystem.packageName) {
    versions = await fetchPyPiVersions(ecosystem.packageName);
  } else {
    versions = releases.map(r => r.version).filter(v => semver.valid(v));
  }
  
  if (versions.length === 0) {
    return null;
  }
  
  let safeVersion = null;
  let changedVersion = null;
  
  if (versions.length > 1) {
    safeVersion = versions[1];
    changedVersion = versions[0];
  }
  
  return {
    ecosystem: ecosystem.type,
    packageName: ecosystem.packageName,
    safeVersion,
    changedVersion,
    allVersions: versions.slice(0, 10)
  };
}

module.exports = {
  fetchGitHubReleases,
  fetchNpmVersions,
  fetchPyPiVersions,
  findSafeVersion,
  detectEcosystem,
  getVersionCutoff
};
