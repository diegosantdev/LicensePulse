const axios = require('axios');

const NPM_REGISTRY = 'https://registry.npmjs.org';
const PYPI_API = 'https://pypi.org/pypi';

async function fetchNpmDependencies(packageName) {
  try {
    const response = await axios.get(`${NPM_REGISTRY}/${packageName}`);
    const latestVersion = response.data['dist-tags']?.latest;
    
    if (!latestVersion || !response.data.versions[latestVersion]) {
      return [];
    }
    
    const versionData = response.data.versions[latestVersion];
    const deps = {
      ...versionData.dependencies,
      ...versionData.peerDependencies
    };
    
    return Object.keys(deps);
  } catch (error) {
    return [];
  }
}

async function fetchPyPiDependencies(packageName) {
  try {
    const response = await axios.get(`${PYPI_API}/${packageName}/json`);
    return [];
  } catch (error) {
    return [];
  }
}

async function buildDependencyTree(packageName, ecosystem = 'npm', depth = 2, visited = new Set()) {
  if (visited.has(packageName) || depth === 0) {
    return null;
  }
  
  visited.add(packageName);
  
  let dependencies = [];
  if (ecosystem === 'npm') {
    dependencies = await fetchNpmDependencies(packageName);
  } else if (ecosystem === 'pypi') {
    dependencies = await fetchPyPiDependencies(packageName);
  }
  
  const children = [];
  
  for (const dep of dependencies.slice(0, 10)) {
    const child = await buildDependencyTree(dep, ecosystem, depth - 1, visited);
    if (child) {
      children.push(child);
    } else {
      children.push({ name: dep, dependencies: [] });
    }
  }
  
  return {
    name: packageName,
    dependencies: children,
    count: dependencies.length
  };
}

function flattenDependencyTree(tree, result = new Set()) {
  if (!tree) return result;
  
  result.add(tree.name);
  
  for (const child of tree.dependencies) {
    flattenDependencyTree(child, result);
  }
  
  return result;
}

async function getTransitiveDependencies(packageName, ecosystem = 'npm', maxDepth = 2) {
  const tree = await buildDependencyTree(packageName, ecosystem, maxDepth);
  const allDeps = flattenDependencyTree(tree);
  
  allDeps.delete(packageName);
  
  return {
    tree,
    allDependencies: Array.from(allDeps),
    count: allDeps.size
  };
}

async function analyzeDependencyRisks(packageName, ecosystem, getRepoForPackage, calculateRisk) {
  const { tree, allDependencies } = await getTransitiveDependencies(packageName, ecosystem, 2);
  
  const risks = [];
  
  for (const dep of allDependencies.slice(0, 20)) {
    const repo = await getRepoForPackage(dep, ecosystem);
    if (repo) {
      const risk = await calculateRisk(repo);
      if (risk.level !== 'LOW') {
        risks.push({
          package: dep,
          repo,
          riskLevel: risk.level,
          riskScore: risk.score
        });
      }
    }
  }
  
  return {
    totalDependencies: allDependencies.length,
    riskyDependencies: risks,
    tree
  };
}

function formatDependencyTree(tree, indent = 0, maxDepth = 3) {
  if (!tree || indent > maxDepth) return '';
  
  const prefix = '  '.repeat(indent);
  const connector = indent === 0 ? '' : '├── ';
  
  let output = `${prefix}${connector}${tree.name}`;
  if (tree.count > 0) {
    output += ` (${tree.count} deps)`;
  }
  output += '\n';
  
  const childrenToShow = tree.dependencies.slice(0, 5);
  for (let i = 0; i < childrenToShow.length; i++) {
    const child = childrenToShow[i];
    const isLast = i === childrenToShow.length - 1 && tree.dependencies.length <= 5;
    
    const childPrefix = '  '.repeat(indent + 1);
    const childConnector = isLast ? '└── ' : '├── ';
    
    output += `${childPrefix}${childConnector}${child.name}`;
    if (child.count > 0) {
      output += ` (${child.count} deps)`;
    }
    output += '\n';
    
    if (child.dependencies && child.dependencies.length > 0 && indent + 1 < maxDepth) {
      const nestedChildren = child.dependencies.slice(0, 3);
      for (let j = 0; j < nestedChildren.length; j++) {
        const nested = nestedChildren[j];
        const nestedIsLast = j === nestedChildren.length - 1 && child.dependencies.length <= 3;
        const nestedPrefix = '  '.repeat(indent + 2);
        const nestedConnector = nestedIsLast ? '└── ' : '├── ';
        
        output += `${nestedPrefix}${nestedConnector}${nested.name}`;
        if (nested.count > 0) {
          output += ` (${nested.count} deps)`;
        }
        output += '\n';
      }
      
      if (child.dependencies.length > 3) {
        output += `${'  '.repeat(indent + 2)}└── ... and ${child.dependencies.length - 3} more\n`;
      }
    }
  }
  
  if (tree.dependencies.length > 5) {
    output += `${'  '.repeat(indent + 1)}└── ... and ${tree.dependencies.length - 5} more\n`;
  }
  
  return output;
}

module.exports = {
  fetchNpmDependencies,
  fetchPyPiDependencies,
  buildDependencyTree,
  getTransitiveDependencies,
  analyzeDependencyRisks,
  flattenDependencyTree,
  formatDependencyTree
};
