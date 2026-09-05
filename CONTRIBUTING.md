# Contributing to VaultMind AI

Thank you for your interest in contributing to VaultMind AI.

## Prerequisites

- Node.js 20+
- TypeScript knowledge
- Familiarity with payment risk and fraud detection concepts

## Setup

```bash
git clone https://github.com/Radhikaa-chauhan/VaultMind-AI.git
cd VaultMind-AI
npm install
npm run build
```

## Running Tests

```bash
npm test
```

## Package Structure

```
packages/
  core/       # Core types, events, and persistence
  control/    # Deterministic policy engine and rule sets
  observe/    # Fraud-spike detection model, spend tracker, and alerts
  protect/    # Dispute and provenance audit trail
  dashboard/  # Express API and React console UI
```

Each package is independently versioned and published under the `@vaultmind` scope.

## Development Workflow

1. Fork the repository and create a branch from `main`.
2. Make your changes with clear, descriptive commits.
3. Add or update tests to cover your changes.
4. Ensure `npm run build` and `npm test` pass.
5. Submit a pull request against `main`.

## PR Guidelines

- Keep PRs focused on a single change.
- Reference related issues in the PR description.
- Follow existing code style and conventions.
- Add tests for new functionality.
- Update documentation when changing public APIs.

## Code Style

- TypeScript strict mode enabled.
- Use meaningful variable and function names.
- Prefer explicit types over `any`.

## Questions?

Open an issue or reach out to the maintainers.
