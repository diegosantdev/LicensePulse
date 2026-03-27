const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const NPM_REGISTRY = 'https://registry.npmjs.org';
const PYPI_API = 'https://pypi.org/pypi';

async function getGitHubRepoFromNpm(packageName) {
  try {
    const response = await axios.get(`${NPM_REGISTRY}/${packageName}`);
    const repository = response.data.repository;
    
    if (!repository) return null;
    
    let repoUrl = typeof repository === 'string' ? repository : repository.url;
    
    const match = repoUrl.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

async function getGitHubRepoFromPyPI(packageName) {
  try {
    const response = await axios.get(`${PYPI_API}/${packageName}/json`);
    const info = response.data.info;
    
    if (info.project_urls) {
      for (const [key, url] of Object.entries(info.project_urls)) {
        if (key.toLowerCase().includes('source') || key.toLowerCase().includes('repository')) {
          const match = url.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/);
          if (match) {
            return `${match[1]}/${match[2]}`;
          }
        }
      }
    }
    
    if (info.home_page) {
      const match = info.home_page.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/);
      if (match) {
        return `${match[1]}/${match[2]}`;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

async function importFromPackageJson(packageJsonPath = './package.json') {
  try {
    const content = await fs.readFile(packageJsonPath, 'utf8');
    const pkg = JSON.parse(content);
    
    const dependencies = {
      ...pkg.dependencies,
      ...pkg.devDependencies
    };
    
    const repos = [];
    const failed = [];
    
    for (const [name, version] of Object.entries(dependencies)) {
      if (version.startsWith('file:') || version.startsWith('link:')) {
        continue;
      }
      
      const repo = await getGitHubRepoFromNpm(name);
      if (repo) {
        repos.push({ package: name, repo, ecosystem: 'npm' });
      } else {
        failed.push({ package: name, reason: 'No GitHub repo found' });
      }
    }
    
    return { repos, failed };
  } catch (error) {
    throw new Error(`Failed to import from package.json: ${error.message}`);
  }
}

async function importFromRequirementsTxt(requirementsPath = './requirements.txt') {
  try {
    const content = await fs.readFile(requirementsPath, 'utf8');
    const lines = content.split('\n').filter(line => {
      line = line.trim();
      return line && !line.startsWith('#') && !line.startsWith('-');
    });
    
    const repos = [];
    const failed = [];
    
    for (const line of lines) {
      const match = line.match(/^([a-zA-Z0-9_-]+)/);
      if (!match) continue;
      
      const packageName = match[1];
      const repo = await getGitHubRepoFromPyPI(packageName);
      
      if (repo) {
        repos.push({ package: packageName, repo, ecosystem: 'pypi' });
      } else {
        failed.push({ package: packageName, reason: 'No GitHub repo found' });
      }
    }
    
    return { repos, failed };
  } catch (error) {
    throw new Error(`Failed to import from requirements.txt: ${error.message}`);
  }
}

async function autoImport(directory = '.') {
  const results = {
    repos: [],
    failed: [],
    sources: []
  };
  
  const packageJsonPath = path.join(directory, 'package.json');
  try {
    await fs.access(packageJsonPath);
    const npmResult = await importFromPackageJson(packageJsonPath);
    results.repos.push(...npmResult.repos);
    results.failed.push(...npmResult.failed);
    results.sources.push('package.json');
  } catch {}
  
  const requirementsPath = path.join(directory, 'requirements.txt');
  try {
    await fs.access(requirementsPath);
    const pyResult = await importFromRequirementsTxt(requirementsPath);
    results.repos.push(...pyResult.repos);
    results.failed.push(...pyResult.failed);
    results.sources.push('requirements.txt');
  } catch {}
  
  const uniqueRepos = Array.from(
    new Map(results.repos.map(item => [item.repo, item])).values()
  );
  
  return {
    repos: uniqueRepos,
    failed: results.failed,
    sources: results.sources
  };
}

module.exports = {
  getGitHubRepoFromNpm,
  getGitHubRepoFromPyPI,
  importFromPackageJson,
  importFromRequirementsTxt,
  autoImport
};
