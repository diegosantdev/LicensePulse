const { calculateRiskScore, getRiskLevel, suggestAlternatives } = require('../../src/risk-scorer');
const { loadSnapshot } = require('../../src/differ');

jest.mock('../../src/differ');

describe('risk-scorer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateRiskScore', () => {
    it('should return low risk for repos with no history', async () => {
      loadSnapshot.mockResolvedValue(null);

      const result = await calculateRiskScore('facebook/react', 'MIT');

      expect(result.score).toBeLessThan(40);
      expect(result.level).toBe('LOW');
    });

    it('should add points for previous license change', async () => {
      loadSnapshot.mockResolvedValue({
        spdxId: 'BSL-1.1',
        previousSpdxId: 'MPL-2.0'
      });

      const result = await calculateRiskScore('hashicorp/terraform', 'BSL-1.1');

      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.factors.some(f => f.factor.includes('changed previously'))).toBe(true);
    });

    it('should add points for restrictive license', async () => {
      loadSnapshot.mockResolvedValue({
        spdxId: 'SSPL-1.0'
      });

      const result = await calculateRiskScore('mongodb/mongo', 'SSPL-1.0');

      expect(result.score).toBeGreaterThanOrEqual(30);
      expect(result.factors.some(f => f.factor.includes('restrictive license'))).toBe(true);
    });

    it('should return HIGH risk for repos with multiple factors', async () => {
      loadSnapshot.mockResolvedValue({
        spdxId: 'BSL-1.1',
        previousSpdxId: 'MPL-2.0'
      });

      const result = await calculateRiskScore('hashicorp/terraform', 'BSL-1.1');

      expect(result.level).toBe('HIGH');
      expect(result.score).toBeGreaterThanOrEqual(70);
    });
  });

  describe('getRiskLevel', () => {
    it('should return correct risk levels', () => {
      expect(getRiskLevel(80)).toBe('HIGH');
      expect(getRiskLevel(50)).toBe('MEDIUM');
      expect(getRiskLevel(20)).toBe('LOW');
    });
  });

  describe('suggestAlternatives', () => {
    it('should suggest OpenTofu for Terraform', () => {
      const result = suggestAlternatives('hashicorp/terraform', 'BSL-1.1');

      expect(result).toBeDefined();
      expect(result.name).toBe('OpenTofu');
      expect(result.license).toBe('MPL-2.0');
    });

    it('should suggest Valkey for Redis', () => {
      const result = suggestAlternatives('redis/redis', 'RSALv2');

      expect(result).toBeDefined();
      expect(result.name).toBe('Valkey');
    });

    it('should return null for repos without alternatives', () => {
      const result = suggestAlternatives('facebook/react', 'MIT');

      expect(result).toBeNull();
    });
  });
});
