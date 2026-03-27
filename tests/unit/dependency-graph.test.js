const axios = require('axios');
const {
  fetchNpmDependencies,
  buildDependencyTree,
  flattenDependencyTree,
  formatDependencyTree
} = require('../../src/dependency-graph');

jest.mock('axios');

describe('dependency-graph', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchNpmDependencies', () => {
    it('should fetch dependencies from npm registry', async () => {
      const mockData = {
        'dist-tags': { latest: '1.0.0' },
        versions: {
          '1.0.0': {
            dependencies: {
              'dep1': '^1.0.0',
              'dep2': '^2.0.0'
            }
          }
        }
      };

      axios.get.mockResolvedValue({ data: mockData });

      const result = await fetchNpmDependencies('test-package');

      expect(result).toContain('dep1');
      expect(result).toContain('dep2');
    });

    it('should return empty array on error', async () => {
      axios.get.mockRejectedValue(new Error('Not found'));

      const result = await fetchNpmDependencies('unknown-package');

      expect(result).toEqual([]);
    });
  });

  describe('flattenDependencyTree', () => {
    it('should flatten nested dependency tree', () => {
      const tree = {
        name: 'root',
        dependencies: [
          {
            name: 'dep1',
            dependencies: [
              { name: 'dep1-1', dependencies: [] }
            ]
          },
          { name: 'dep2', dependencies: [] }
        ]
      };

      const result = flattenDependencyTree(tree);

      expect(result.has('root')).toBe(true);
      expect(result.has('dep1')).toBe(true);
      expect(result.has('dep1-1')).toBe(true);
      expect(result.has('dep2')).toBe(true);
      expect(result.size).toBe(4);
    });
  });

  describe('formatDependencyTree', () => {
    it('should format tree for display', () => {
      const tree = {
        name: 'root',
        count: 2,
        dependencies: [
          { name: 'dep1', count: 0, dependencies: [] },
          { name: 'dep2', count: 0, dependencies: [] }
        ]
      };

      const result = formatDependencyTree(tree);

      expect(result).toContain('root');
      expect(result).toContain('dep1');
      expect(result).toContain('dep2');
    });
  });
});
