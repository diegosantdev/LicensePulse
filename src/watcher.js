const axios = require('axios');

const GITHUB_API_BASE = 'https://api.github.com';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];
const REQUEST_TIMEOUT = 10000;

const LICENSE_PATTERNS = [

  { pattern: /Redis Source Available License|RSALv2|RSAL/i,                                          spdxId: 'RSALv2'        },
  { pattern: /Server Side Public License|SSPL/i,                                                      spdxId: 'SSPL-1.0'     },
  { pattern: /Business Source License|BSL/i,                                                          spdxId: 'BSL-1.1'      },
  { pattern: /Elastic License 2\.0|Elastic License\s+2/i,                                            spdxId: 'Elastic-2.0'  },
  { pattern: /CockroachDB Software License|CockroachDB Community License|Cockroach Community License/i, spdxId: 'CSL'        },
  { pattern: /Commons Clause/i,                                                                       spdxId: 'Commons-Clause'},
  { pattern: /Confluent Community License/i,                                                          spdxId: 'CCL-1.0'      },
  { pattern: /Functional Source License|FSL/i,                                                        spdxId: 'FSL-1.1'      },

  { pattern: /GNU AFFERO GENERAL PUBLIC LICENSE/i,                                                    spdxId: 'AGPL-3.0'     },
  { pattern: /GNU GENERAL PUBLIC LICENSE\s+Version 3/i,                                              spdxId: 'GPL-3.0'      },
  { pattern: /GNU GENERAL PUBLIC LICENSE\s+Version 2/i,                                              spdxId: 'GPL-2.0'      },
  { pattern: /GNU LESSER GENERAL PUBLIC LICENSE\s+Version 3/i,                                       spdxId: 'LGPL-3.0'     },
  { pattern: /GNU LESSER GENERAL PUBLIC LICENSE\s+Version 2\.1/i,                                    spdxId: 'LGPL-2.1'     },

  { pattern: /Mozilla Public License Version 2\.0/i,                                                  spdxId: 'MPL-2.0'      },
  { pattern: /Mozilla Public License,?\s+Version 1\.1/i,                                             spdxId: 'MPL-1.1'      },
  { pattern: /Eclipse Public License\s*[–-]?\s*v?\s*2\.0/i,                                         spdxId: 'EPL-2.0'      },
  { pattern: /Eclipse Public License\s*[–-]?\s*v?\s*1\.0/i,                                         spdxId: 'EPL-1.0'      },
  { pattern: /Common Development and Distribution License/i,                                          spdxId: 'CDDL-1.0'     },
  { pattern: /European Union Public Licen[cs]e.*?1\.2|EUPL.*?1\.2/i,                                spdxId: 'EUPL-1.2'     },
  { pattern: /European Union Public Licen[cs]e.*?1\.1|EUPL.*?1\.1/i,                                spdxId: 'EUPL-1.1'     },
  { pattern: /Common Public Attribution License/i,                                                    spdxId: 'CPAL-1.0'     },
  { pattern: /Open Software License\s+3\.0/i,                                                         spdxId: 'OSL-3.0'      },
  { pattern: /Open Software License\s+2\.1/i,                                                         spdxId: 'OSL-2.1'      },
  { pattern: /Artistic License\s+2\.0/i,                                                              spdxId: 'Artistic-2.0' },
  { pattern: /Microsoft Public License/i,                                                              spdxId: 'MS-PL'        },
  { pattern: /Microsoft Reciprocal License/i,                                                          spdxId: 'MS-RL'        },

  { pattern: /Apache License\s+Version 2\.0/i,                                                        spdxId: 'Apache-2.0'   },
  { pattern: /Apache License\s+Version 1\.1/i,                                                        spdxId: 'Apache-1.1'   },
  { pattern: /BSD 3-Clause/i,                                                                          spdxId: 'BSD-3-Clause' },
  { pattern: /BSD 2-Clause/i,                                                                          spdxId: 'BSD-2-Clause' },
  { pattern: /ISC License/i,                                                                           spdxId: 'ISC'          },
  { pattern: /MIT License/i,                                                                           spdxId: 'MIT'          },
  { pattern: /The Unlicense/i,                                                                         spdxId: 'Unlicense'    },
  { pattern: /Creative Commons Zero|CC0/i,                                                             spdxId: 'CC0-1.0'      },
  { pattern: /Boost Software License\s+1\.0/i,                                                        spdxId: 'BSL-1.0'      },
  { pattern: /PostgreSQL License/i,                                                                    spdxId: 'PostgreSQL'   },
  { pattern: /Python Software Foundation License/i,                                                    spdxId: 'PSF-2.0'      },
  { pattern: /zlib License|zlib\/libpng/i,                                                             spdxId: 'Zlib'         },
  { pattern: /Perl Artistic License/i,                                                                 spdxId: 'Artistic-1.0' },
  { pattern: /SIL Open Font License/i,                                                                 spdxId: 'OFL-1.1'      },
  { pattern: /Do What The Fuck You Want|WTFPL/i,                                                      spdxId: 'WTFPL'        },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function detectLicenseFromContent(content) {
  for (const { pattern, spdxId } of LICENSE_PATTERNS) {
    if (pattern.test(content)) {
      return spdxId;
    }
  }
  return null;
}

async function fetchLicenseFile(repoId, token) {
  const [owner, repo] = repoId.split('/');

  const licenseFiles = [
    'LICENSE',
    'LICENSE.md',
    'LICENSE.txt',
    'LICENSE-Community.txt',
    'LICENSE-APACHE',
    'LICENSE-MIT',
    'COPYING',
    'COPYING.txt',
    'COPYING.md',
    'LICENCE',
    'LICENCE.md',
    'LICENCE.txt',
  ];

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  for (const filename of licenseFiles) {
    try {
      const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${filename}`;
      const response = await axios.get(url, { headers, timeout: REQUEST_TIMEOUT });

      if (response.data?.content) {
        const decoded = Buffer.from(response.data.content, 'base64').toString('utf-8');
        return decoded;
      }

      if (typeof response.data === 'string') {
        return response.data;
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function fetchLicense(repoId) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }

  const [owner, repo] = repoId.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid repository identifier: "${repoId}". Expected format: owner/repo`);
  }

  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/license`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await axios.get(url, { headers, timeout: REQUEST_TIMEOUT });
      const spdxIdFromApi = response.data?.license?.spdx_id;

      if (spdxIdFromApi && spdxIdFromApi !== 'NOASSERTION' && spdxIdFromApi !== 'NONE') {
        return {
          spdxId: spdxIdFromApi,
          fetchedAt: new Date().toISOString(),
          detectionMethod: 'github-api'
        };
      }

      const licenseContent = await fetchLicenseFile(repoId, token);

      if (licenseContent) {
        const detectedSpdxId = detectLicenseFromContent(licenseContent);

        if (detectedSpdxId) {
          return {
            spdxId: detectedSpdxId,
            fetchedAt: new Date().toISOString(),
            detectionMethod: 'content-match'
          };
        }

        return {
          spdxId: 'UNKNOWN',
          fetchedAt: new Date().toISOString(),
          detectionMethod: 'content-unrecognized'
        };
      }

      return {
        spdxId: 'NONE',
        fetchedAt: new Date().toISOString(),
        detectionMethod: 'not-found'
      };

    } catch (error) {
      lastError = error;

      if (error.response) {
        const status = error.response.status;

        if (status === 404) {
          return {
            spdxId: 'NONE',
            fetchedAt: new Date().toISOString(),
            detectionMethod: 'not-found'
          };
        }

        if (status === 403) {
          const remaining = error.response.headers['x-ratelimit-remaining'];
          const reset = error.response.headers['x-ratelimit-reset'];

          if (remaining === '0') {
            const resetDate = new Date(parseInt(reset) * 1000);
            throw new Error(
              `GitHub API rate limit exceeded for "${repoId}". Resets at ${resetDate.toISOString()}`
            );
          }
        }

        if (status >= 400 && status < 500 && status !== 429) {
          throw new Error(
            `GitHub API error for "${repoId}": HTTP ${status} ${error.response.statusText}`
          );
        }
      }

      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
    }
  }

  const errorMessage = lastError?.response?.data?.message || lastError?.message || 'Unknown error';
  throw new Error(
    `Failed to fetch license for "${repoId}" after ${MAX_RETRIES} attempts: ${errorMessage}`
  );
}

async function checkRateLimit() {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }

  try {
    const response = await axios.get(`${GITHUB_API_BASE}/rate_limit`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json'
      },
      timeout: REQUEST_TIMEOUT
    });

    const core = response.data.resources.core;

    return {
      remaining: core.remaining,
      limit: core.limit,
      resetAt: new Date(core.reset * 1000).toISOString()
    };
  } catch (error) {
    throw new Error(`Failed to check rate limit: ${error.message}`);
  }
}

module.exports = {
  fetchLicense,
  checkRateLimit,
  detectLicenseFromContent
};
