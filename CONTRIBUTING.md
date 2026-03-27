# Contributing to LicensePulse

Thanks for your interest in contributing! LicensePulse is built to be a community-driven tool for monitoring open source license changes.

## How to Contribute

### Reporting Issues

- Check if the issue already exists
- Include steps to reproduce
- Include your Node.js version and OS
- Include relevant logs or screenshots

### Suggesting Features

- Open an issue with the `enhancement` label
- Describe the use case clearly
- Explain why it would benefit the community

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit with clear messages (`git commit -m 'Add amazing feature'`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Development Setup

```bash
git clone https://github.com/yourusername/licensepulse
cd licensepulse
npm install
cp .env.example .env
# Add your GITHUB_TOKEN to .env
npm test
```

## Code Style

- Use 2 spaces for indentation
- Follow existing code patterns
- Keep functions focused and small
- Write clear, self-documenting code

## Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Aim for high test coverage
- CI runs tests automatically on Node 18.x, 20.x, and 22.x

```bash
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # Run with coverage report
```

All pull requests are automatically tested via GitHub Actions CI before merge.

## Most Impactful Contributions

1. **Expanding `data/licenses.json`** — Add more license mappings with accurate permission attributes
2. **Improving detection** — Better patterns for identifying licenses in LICENSE files
3. **Adding notification channels** — Discord, Microsoft Teams, etc.
4. **Supporting more platforms** — GitLab, Bitbucket support
5. **Documentation** — Examples, guides, use cases

## License Database Contributions

When adding licenses to `data/licenses.json`:

- Use official SPDX identifiers
- Reference [spdx.org/licenses](https://spdx.org/licenses) for accuracy
- Include all 6 permission attributes
- Add `realWorldImpact` with concrete examples
- Test with real repositories using that license

## Questions?

Open an issue or reach out to [@diegosantdev](https://github.com/diegosantdev)

---

By contributing, you agree that your contributions will be licensed under the MIT License.
