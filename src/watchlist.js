const fs = require('fs').promises;
const path = require('path');

class Watchlist {
  constructor(filePath = 'watchlist.json') {
    this.filePath = filePath;
    this.repos = [];
  }

  validateRepoIdentifier(repo) {
    const pattern = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
    if (!pattern.test(repo)) {
      throw new Error(
        `Invalid repository identifier: "${repo}". Expected format: owner/repo`
      );
    }
  }

  async add(repo) {
    this.validateRepoIdentifier(repo);

    if (!this.repos.includes(repo)) {
      this.repos.push(repo);
      await this.save();
    }
  }

  async remove(repo) {
    const index = this.repos.indexOf(repo);
    if (index > -1) {
      this.repos.splice(index, 1);
      await this.save();
    }
  }

  getAll() {
    return [...this.repos];
  }

  async load() {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(data);
      this.repos = parsed.repos || [];
    } catch (error) {
      if (error.code === 'ENOENT') {

        this.repos = [];
      } else {
        throw new Error(`Failed to load watchlist: ${error.message}`);
      }
    }
  }

  async save() {
    try {
      const data = JSON.stringify({ repos: this.repos }, null, 2);
      await fs.writeFile(this.filePath, data, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save watchlist: ${error.message}`);
    }
  }
}

module.exports = Watchlist;
