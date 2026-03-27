# LicensePulse - Updates & Improvements

## Latest Version: 1.2.0

### What's New

This document tracks all updates, improvements, and bug fixes made to LicensePulse.

---

## v1.2.0 - Complete Feature Set (March 26, 2026)

### New Features

#### 1. Direct LICENSE File Monitoring
Monitor LICENSE file content changes directly in GitHub repositories, catching modifications before package publication.

**Command:**
```bash
licensepulse monitor-file <repo>
```

**Features:**
- Uses GitHub's official license API for reliable detection
- Falls back to direct file access with 12+ filename variations
- Supports: LICENSE, LICENSE.md, LICENCE, COPYING, and more
- Shows commit history for LICENSE changes
- Detects changes between commit and package publish

**Detection Methods:**
1. GitHub License API (most reliable)
2. Direct file access with common variations
3. Supports British spelling (LICENCE) and GNU conventions (COPYING)

#### 2. Dependency Graph Analysis
Analyze complete dependency trees and discover transitive dependencies.

**Command:**
```bash
licensepulse deps <package>
licensepulse deps <package> --ecosystem pypi
licensepulse deps <package> --depth 3
```

**Features:**
- Shows visual dependency tree
- Lists all unique dependencies
- Configurable depth (default: 2 levels)
- Supports npm and PyPI ecosystems
- Identifies packages with zero dependencies

### Improvements

#### Enhanced LICENSE Detection
- **Primary method:** GitHub's official license API
- **Fallback methods:** 12+ filename variations including:
  - LICENSE, LICENSE.md, LICENSE.txt
  - LICENSE-MIT, LICENSE-APACHE
  - LICENCE, LICENCE.md (British spelling)
  - COPYING, COPYING.md (GNU convention)
  - LICENSE-Community.txt

#### Better User Messages
- Clear indication when packages have no dependencies
- Detailed explanations when LICENSE files aren't found
- Shows detection method used (github-license-api or direct-file-access)
- Helpful tips for troubleshooting

#### Improved Dependency Tree Display
- Proper indentation for nested dependencies
- Visual connectors (├── and └──)
- Truncation for large trees (shows first 5 children)
- Count indicators for each node

### Technical Changes
- New module: `src/license-monitor.js`
- New module: `src/dependency-graph.js`
- SHA256 hashing for LICENSE file content
- Recursive dependency tree building
- 141 tests passing (+9 from v1.1)

---

## v1.1.0 - Community-Driven Update (March 26, 2026)

### New Features

#### 1. Version Cutoff Detection
Shows exactly which version is safe to use and which version introduced the license change.

**Display:**
```
hashicorp/terraform    MPL-2.0 → BSL-1.1
Safe up to: v1.5.7 │ Changed in: v1.6.0
```

**Integration:**
- Shown in `check` command alerts
- Shown in `diff` command details
- Works with npm, PyPI, and GitHub tags

#### 2. Auto-Import Dependencies
Automatically discover and import dependencies from your project.

**Command:**
```bash
licensepulse import
licensepulse import --dry-run
licensepulse import --directory ./path
```

**Features:**
- Detects package.json (npm)
- Detects requirements.txt (Python)
- Resolves GitHub repos from package registries
- Dry-run mode for preview
- Skips already-monitored repos

#### 3. License Risk Scoring
Calculate risk scores based on license history and patterns.

**Command:**
```bash
licensepulse risk <repo>
```

**Scoring Factors:**
- Previous license change: +40 points
- Restrictive license: +30 points
- More restrictive change: +20 points
- Commercial/VC-backed: +10 points

**Risk Levels:**
- 0-39: LOW (safe)
- 40-69: MEDIUM (monitor)
- 70-100: HIGH (consider alternatives)

#### 4. Enhanced Alternative Suggestions
Automatic suggestions for open source alternatives with detailed information.

**Alternatives Database:**
- Terraform → OpenTofu (MPL-2.0)
- Redis → Valkey (BSD-3-Clause)
- Elasticsearch → OpenSearch (Apache-2.0)
- MongoDB → FerretDB (Apache-2.0)

### Technical Changes
- New module: `src/version-tracker.js`
- New module: `src/risk-scorer.js`
- New module: `src/package-importer.js`
- Added dependency: `semver@^7.5.4`
- 132 tests passing (+3 from v1.0)

---

## v1.0.0 - Initial Release (March 20, 2026)

### Core Features

#### License Change Detection
- Monitor GitHub repositories for license changes
- SPDX license database with 42+ licenses
- Snapshot-based change detection

#### Impact Analysis
- Permission-level diff (commercialUse, distribution, etc.)
- Severity classification (CRITICAL, WARNING, INFO)
- Real-world impact explanations

#### Commands
- `check` - Check all repositories once
- `watch` - Continuous monitoring
- `add` - Add repository to watchlist
- `remove` - Remove from watchlist
- `list` - List monitored repositories
- `diff` - Show license change details
- `report` - Generate JSON report

#### Notifications
- Slack webhook integration
- Email via SMTP
- Generic webhook support

#### CI/CD Integration
- GitHub Actions examples
- Environment variable configuration
- Automated scheduling

---

## Bug Fixes & Improvements

### v1.2.0
- Fixed dependency tree indentation
- Improved LICENSE file detection reliability
- Added support for 12+ LICENSE filename variations
- Better error messages for missing LICENSE files
- Added detection method tracking

### v1.1.0
- Fixed version cutoff integration in check command
- Improved alternative suggestion system
- Enhanced risk scoring accuracy
- Better handling of unknown licenses

### v1.0.0
- Initial stable release
- Comprehensive test coverage
- Production-ready codebase

---

## Migration Guide

### From v1.1 to v1.2
No breaking changes. All v1.1 commands work identically.

**New commands available:**
- `monitor-file <repo>` - Monitor LICENSE file directly
- `deps <package>` - Analyze dependency tree

### From v1.0 to v1.1
No breaking changes. All v1.0 commands work identically.

**New commands available:**
- `import` - Auto-import dependencies
- `risk <repo>` - Risk analysis

**Enhanced commands:**
- `check` - Now shows version cutoff in alerts
- `diff` - Now shows version information

---

## Performance Metrics

### Test Coverage
- **v1.2.0:** 141 tests, 12 test suites
- **v1.1.0:** 132 tests, 10 test suites
- **v1.0.0:** 129 tests, 9 test suites

### Execution Time
- Average test suite: ~11 seconds
- Single check command: <2 seconds per repo
- Import command: ~5 seconds for 20 dependencies

### API Usage
- GitHub API calls per check: 1 per repo
- Rate limit: 5000/hour with token
- Retry logic: 3 attempts with exponential backoff

---

## Known Limitations

### Current Limitations
1. **PyPI dependencies:** Limited metadata in API
2. **Private repos:** Requires appropriate token permissions
3. **Subdirectory licenses:** May not detect in all cases
4. **Version cutoff:** Heuristic-based, may not be 100% accurate

### Planned Improvements
See the Roadmap section in [README.md](./README.md) for future enhancements.

---

## Support & Feedback

### Getting Help
- Documentation: [README.md](./README.md)
- Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md)

### Reporting Issues
- GitHub Issues: https://github.com/diegosantdev/licensepulse/issues
- Feature Requests: Use GitHub Discussions

### Contributing
- See [CONTRIBUTING.md](./CONTRIBUTING.md)
- All contributions welcome
- Community-driven development

---

**Last Updated:** March 26, 2026  
**Current Version:** 1.2.0  
**License:** MIT
