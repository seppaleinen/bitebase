# Contribution Guidelines

Thank you for your interest in contributing to BiteBase! This document outlines our contribution process and guidelines.

## How to Contribute

### 1. Setting Up Your Environment

- Fork the repository and clone it locally
- Install dependencies: `pnpm install`
- Set up your `.env.local` file with required environment variables

### 2. Branching Strategy

- Create a feature branch for each new feature or bug fix
- Use clear, descriptive branch names (e.g., `feature/add-auth-middleware`, `bugfix/fix-privilege-escalation`)
- Never push directly to `main`

### 3. Making Changes

#### Code Standards

- Follow the existing code style (ES6+, TypeScript)
- Adhere to the project's ESLint/Prettier configuration
- Write comprehensive unit and integration tests for new functionality
- Ensure all tests pass locally: `pnpm test`

#### Security Considerations

- Add ownership checks for all user-resource interactions
- Validate all user inputs with Zod schemas
- Use parameterized queries (Drizzle ORM) to prevent SQL injection
- Ensure proper error handling without information disclosure
- Run the security audit checklist to verify all OWASP Top 10 requirements are met

#### Testing Requirements

- Add unit tests for new functions and business logic
- Add integration tests for API endpoints
- Add E2E tests for user-facing flows (where applicable)
- Ensure all existing tests continue to pass

### 4. Submitting Changes

1. **Stage your changes**
   ```bash
   git add -A
   ```

2. **Create a meaningful commit message**
   ```bash
   git commit -m "feat: add new feature or fix"
   ```

3. **Push your changes**
   ```bash
   git push origin <feature-branch-name>
   ```

4. **Open a Pull Request (PR)**
   - Fill out the PR template
   - Include a clear description of the changes
   - Link to any related issues
   - Request a review from a team member

### 5. Review and Iteration

- Respond promptly to feedback
- Address any requested changes
- Run all tests again after making changes

## Testing

### Running Tests

```bash
# Run all tests (unit + integration + e2e)
pnpm test

# Run specific package tests
pnpm --filter @bitebase/api test
pnpm --filter @bitebase/ai test
pnpm --filter @bitebase/web test
pnpm --filter @bitebase/mobile test
```

### Test Coverage

Our tests achieve 84% coverage across the codebase:
- 40+ unit tests for complex logic and utility functions
- 17 integration tests covering all tRPC endpoints
- 17 E2E tests covering auth, onboarding, and learning flows

### Security Testing

Special emphasis is placed on security testing:
- Horizontal privilege escalation tests for all user-resource interactions
- OWASP Top 10 vulnerability coverage
- Input validation testing
- Session management verification

## Style Guidelines

### Code Style

- Use TypeScript with strict mode
- Follow Airbnb JavaScript style guide (via ESLint)
- Use single quotes for strings
- Add JSDoc comments for public APIs
- Keep functions small and focused

### Commit Messages

- Use the conventional commit format: `<type>: <description>`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- Keep commit messages clear and descriptive
- Include relevant issue references when applicable

## Development Workflow

### Feature Development

1. Create a feature branch from `main`
2. Implement your feature
3. Write tests for your implementation
4. Run all tests to ensure nothing is broken
5. Commit your changes
6. Push and create a PR
7. Request review from a team member

### Bug Fixes

1. Create a feature branch from `main`
2. Identify and fix the bug
3. Write a test that reproduces the bug (TDD approach)
4. Run all tests to ensure the fix works and doesn't break anything else
5. Commit your changes
6. Push and create a PR
7. Request review from a team member

### Documentation

- Update README.md if you add new features or make significant changes
- Update AGENTS.md if you modify the contribution process
- Update SECURITY.md if you add new security features or fix vulnerabilities

## Security Checklist

Before merging any PR, ensure:

- [ ] All tests pass
- [ ] OWASP Top 10 requirements are met
- [ ] No secrets in codebase (use environment variables)
- [ ] Input validation is in place for all user inputs
- [ ] Database queries use parameterized queries
- [ ] Authentication and authorization checks are in place
- [ ] Error messages don't leak sensitive information
- [ ] Dependencies are updated to latest versions
- [ ] All security audit findings have been addressed

## Code Review Process

1. **Initial Review**: Automated checks for linting, tests, and security
2. **Peer Review**: Technical review by another team member
3. **Approval**: Final approval from a senior developer

## Getting Help

- Ask questions in GitHub Discussions
- Join our Discord/Slack community (if available)
- Check the existing issues for similar questions

## Thank You!

We appreciate your contributions to making BiteBase more secure and feature-rich. Together, we can create an excellent learning platform that prioritizes user security and experience!