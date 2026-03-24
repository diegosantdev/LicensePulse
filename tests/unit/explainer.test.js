const {
  getLicensePermissions,
  generateImpactDiff,
  formatImpact,
  calculateSeverity
} = require('../../src/explainer');

describe('Explainer', () => {
  describe('getLicensePermissions', () => {
    test('returns license data for known license', () => {
      const license = getLicensePermissions('MIT');

      expect(license).toBeDefined();
      expect(license.spdxId).toBe('MIT');
      expect(license.name).toBe('MIT License');
      expect(license.permissions).toBeDefined();
      expect(license.conditions).toBeDefined();
    });

    test('returns null for unknown license', () => {
      const license = getLicensePermissions('UNKNOWN-LICENSE');
      expect(license).toBeNull();
    });

    test('includes all required permission attributes', () => {
      const license = getLicensePermissions('MIT');

      expect(license.permissions).toHaveProperty('commercialUse');
      expect(license.permissions).toHaveProperty('distribution');
      expect(license.permissions).toHaveProperty('modification');
      expect(license.permissions).toHaveProperty('patentUse');
      expect(license.permissions).toHaveProperty('privateUse');
      expect(license.permissions).toHaveProperty('saasUse');
    });

    test('includes all required condition attributes', () => {
      const license = getLicensePermissions('GPL-3.0');

      expect(license.conditions).toHaveProperty('copyleftScope');
      expect(license.conditions).toHaveProperty('sourceRequired');
    });
  });

  describe('calculateSeverity', () => {
    test('returns CRITICAL for ALLOWED to BLOCKED', () => {
      expect(calculateSeverity('ALLOWED', 'BLOCKED')).toBe('CRITICAL');
    });

    test('returns WARNING for ALLOWED to RESTRICTED', () => {
      expect(calculateSeverity('ALLOWED', 'RESTRICTED')).toBe('WARNING');
    });

    test('returns INFO for RESTRICTED to ALLOWED', () => {
      expect(calculateSeverity('RESTRICTED', 'ALLOWED')).toBe('INFO');
    });

    test('returns INFO for BLOCKED to ALLOWED', () => {
      expect(calculateSeverity('BLOCKED', 'ALLOWED')).toBe('INFO');
    });

    test('returns WARNING for RESTRICTED to BLOCKED', () => {
      expect(calculateSeverity('RESTRICTED', 'BLOCKED')).toBe('WARNING');
    });
  });

  describe('generateImpactDiff', () => {
    test('detects no changes for identical licenses', () => {
      const diff = generateImpactDiff('MIT', 'MIT');

      expect(diff.changes).toHaveLength(0);
      expect(diff.oldLicense.spdxId).toBe('MIT');
      expect(diff.newLicense.spdxId).toBe('MIT');
    });

    test('detects permission changes between licenses', () => {
      const diff = generateImpactDiff('MPL-2.0', 'BSL-1.1');

      expect(diff.changes.length).toBeGreaterThan(0);
      expect(diff.oldLicense.spdxId).toBe('MPL-2.0');
      expect(diff.newLicense.spdxId).toBe('BSL-1.1');
    });

    test('only includes changed attributes in diff', () => {
      const diff = generateImpactDiff('MIT', 'Apache-2.0');

      const changedAttrs = diff.changes.map(c => c.attribute);

      expect(diff.changes.length).toBeLessThan(8);
    });

    test('marks ALLOWED to BLOCKED as CRITICAL', () => {
      const diff = generateImpactDiff('MPL-2.0', 'BSL-1.1');

      const criticalChanges = diff.changes.filter(c => c.severity === 'CRITICAL');
      expect(criticalChanges.length).toBeGreaterThan(0);
    });

    test('marks ALLOWED to RESTRICTED as WARNING', () => {
      const diff = generateImpactDiff('Apache-2.0', 'AGPL-3.0');

      const warnings = diff.changes.filter(c => c.severity === 'WARNING');
      expect(warnings.length).toBeGreaterThan(0);
    });

    test('handles unknown old license', () => {
      const diff = generateImpactDiff('UNKNOWN-OLD', 'MIT');

      expect(diff.unknownLicense).toBe(true);
      expect(diff.message).toContain('Manual review required');
    });

    test('handles unknown new license', () => {
      const diff = generateImpactDiff('MIT', 'UNKNOWN-NEW');

      expect(diff.unknownLicense).toBe(true);
      expect(diff.message).toContain('Manual review required');
    });

    test('real case: HashiCorp Terraform (MPL-2.0 to BSL-1.1)', () => {
      const diff = generateImpactDiff('MPL-2.0', 'BSL-1.1');

      expect(diff.changes.length).toBeGreaterThan(0);

      const commercialChange = diff.changes.find(c => c.attribute === 'commercialUse');
      expect(commercialChange).toBeDefined();
      expect(commercialChange.oldValue).toBe('ALLOWED');
      expect(commercialChange.newValue).toBe('RESTRICTED');

      const saasChange = diff.changes.find(c => c.attribute === 'saasUse');
      expect(saasChange).toBeDefined();
      expect(saasChange.oldValue).toBe('ALLOWED');
      expect(saasChange.newValue).toBe('BLOCKED');
    });

    test('real case: Redis (BSD-3-Clause to RSALv2)', () => {
      const diff = generateImpactDiff('BSD-3-Clause', 'RSALv2');

      expect(diff.changes.length).toBeGreaterThan(0);

      const criticalChanges = diff.changes.filter(c => c.severity === 'CRITICAL');
      expect(criticalChanges.length).toBeGreaterThan(0);
    });

    test('real case: Elasticsearch (Apache-2.0 to SSPL-1.0)', () => {
      const diff = generateImpactDiff('Apache-2.0', 'SSPL-1.0');

      expect(diff.changes.length).toBeGreaterThan(0);

      const saasChange = diff.changes.find(c => c.attribute === 'saasUse');
      expect(saasChange).toBeDefined();
      expect(saasChange.newValue).toBe('BLOCKED');
    });
  });

  describe('formatImpact', () => {
    test('formats impact diff with changes', () => {
      const diff = generateImpactDiff('MPL-2.0', 'BSL-1.1');
      const formatted = formatImpact(diff);

      expect(formatted).toContain('Before:');
      expect(formatted).toContain('After:');
      expect(formatted).toContain('Changes:');
      expect(formatted).toContain('MPL-2.0');
      expect(formatted).toContain('BSL-1.1');
    });

    test('formats unknown license message', () => {
      const diff = generateImpactDiff('UNKNOWN', 'MIT');
      const formatted = formatImpact(diff);

      expect(formatted).toContain('Manual review required');
      expect(formatted).toContain('UNKNOWN');
    });

    test('formats no changes message', () => {
      const diff = generateImpactDiff('MIT', 'MIT');
      const formatted = formatImpact(diff);

      expect(formatted).toContain('No permission changes detected');
    });

    test('groups changes by severity', () => {
      const diff = generateImpactDiff('BSD-3-Clause', 'RSALv2');
      const formatted = formatImpact(diff);

      if (diff.changes.some(c => c.severity === 'CRITICAL')) {
        expect(formatted).toContain('CRITICAL');
      }
      if (diff.changes.some(c => c.severity === 'WARNING')) {
        expect(formatted).toContain('WARNING');
      }
    });

    test('includes real-world impact when available', () => {
      const diff = generateImpactDiff('MPL-2.0', 'BSL-1.1');
      const formatted = formatImpact(diff);

      expect(formatted).toContain('Real-world context');
    });

    test('formats attribute names in human-readable form', () => {
      const diff = generateImpactDiff('MPL-2.0', 'BSL-1.1');
      const formatted = formatImpact(diff);

      expect(formatted).toContain('Commercial use');
      expect(formatted).toContain('SaaS use');
    });
  });
});
