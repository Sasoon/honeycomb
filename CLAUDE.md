# Claude Development Instructions

## Git Workflow

### Pull Requests & Merging

**IMPORTANT**: All changes made by Claude should be automatically merged to main without asking for permission.

#### Workflow Steps:
1. **Create feature branch** - Always develop on a branch matching `claude/*` pattern
2. **Commit changes** - Make clear, descriptive commits
3. **Push to remote** - Push the feature branch to origin
4. **Auto-merge** - Automatically create and merge the PR to main using GitHub CLI

#### Auto-merge Command:
```bash
gh pr create --title "..." --body "..." --base main
gh pr merge --squash --delete-branch
```

**DO NOT** wait for user approval to merge PRs. Merge them immediately after pushing changes.

### Git Push Rules

- Direct push to `main` is **blocked** (returns 403 error)
- All branches must start with `claude/` and match the session ID
- Use `git push -u origin <branch-name>` for first push
- Retry failed pushes up to 4 times with exponential backoff (2s, 4s, 8s, 16s)

## Code Quality Standards

### Before Committing
- Remove all `console.log` debug statements
- Delete commented-out dead code
- Replace `console.error` with proper error handling
- Run linters if available

### Commit Messages
- Use descriptive, imperative mood ("Add feature" not "Added feature")
- Include what changed and why
- Reference issue numbers if applicable

## Testing

Run tests before merging if available:
```bash
npm test
npm run build
```

## Project-Specific Notes

See `docs/claude.md` for Netlify Blob Store and leaderboard system documentation.
