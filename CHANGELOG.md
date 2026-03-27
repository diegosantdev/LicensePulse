# Changelog

All notable changes to LicensePulse will be documented in this file.

## [1.2.0] - 2026-03-26

### Added - Complete Community Requests

#### Direct LICENSE File Monitoring
- New `monitor-file` command to check LICENSE file changes directly in GitHub
- Monitors file content hash, not just SPDX ID
- Catches changes between commit and package publish
- Shows commit history for LICENSE file
- Uses GitHub's official license API for reliable detection
- Falls back to 12+ filename variations (LICENSE, LICENCE, COPYING, etc.)

**Example:**
```bash
licensepulse monitor-file redis/redis
```

#### Dependency Graph Analysis
- New `deps` command to analyze transitive dependencies
- Shows complete dependency tree with proper indentation
- Supports npm and PyPI ecosystems
- Configurable depth (default: 2 levels)
- Lists all unique dependencies
- Identifies packages with zero dependencies

**Example:**
```bash
licensepulse deps axios
licensepulse deps requests --ecosystem pypi
```

### Improved
- Enhanced LICENSE file detection with GitHub API
- Better error messages for missing LICENSE files
- Improved dependency tree visualization
- Added detection method tracking

### Technical Improvements
- New modules: `license-monitor.js`, `dependency-graph.js`
- SHA256 hashing for LICENSE file content
- Recursive dependency tree building
- 141 tests passing (+9 from v1.1)

## [1.1.0] - 2026-03-26

### Added - Community-Driven Features

#### Version Cutoff Detection
- Shows last safe version and first changed version
- Works across npm, PyPI, and GitHub tags
- Integrated into `check` and `diff` commands

**Example:**
```
hashicorp/terraform    MPL-2.0 → BSL-1.1
Safe up to: v1.5.7 │ Changed in: v1.6.0
```

#### Auto-Import Dependencies
- New `import` command
- Supports package.json (npm) and requirements.txt (Python)
- Dry-run mode for preview
- Resolves GitHub repos from package registries

#### License Risk Scoring
- New `risk` command
- Score 0-100 based on history and patterns
- Risk levels: LOW, MEDIUM, HIGH
- Automatic alternative suggestions

#### Enhanced Alternatives
- Terraform → OpenTofu (MPL-2.0)
- Redis → Valkey (BSD-3-Clause)
- Elasticsearch → OpenSearch (Apache-2.0)
- MongoDB → FerretDB (Apache-2.0)

### Technical Improvements
- New modules: `version-tracker.js`, `risk-scorer.js`, `package-importer.js`
- Added dependency: `semver@^7.5.4`
- 132 tests passing (+3 from v1.0)

## [1.0.0] - 2026-03-24

### Initial Release
- Monitor GitHub repositories for license changes
- SPDX license database with 42+ licenses
- Impact analysis showing permission changes
- Commands: check, watch, add, remove, list, diff, report
- Notification support: Slack, Email, Generic Webhook
- GitHub Actions integration example
- 129 tests passing
