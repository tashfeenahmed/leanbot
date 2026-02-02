---
name: git
description: Git version control operations - commits, branches, merges, and more
user-invocable: true
metadata:
  openclaw:
    emoji: "\U0001F500"
    requires:
      bins: [git]
---

# Git Skill

Help the user with Git version control operations.

## Capabilities

- **Status**: Check repository status, staged/unstaged changes
- **Commits**: Create commits with meaningful messages
- **Branches**: Create, switch, list, and delete branches
- **Merging**: Merge branches, resolve conflicts
- **History**: View commit history, diffs, blame
- **Remotes**: Push, pull, fetch from remotes
- **Stashing**: Stash and apply changes

## Guidelines

1. Always check `git status` before making changes
2. Use descriptive commit messages that explain WHY, not just WHAT
3. When merging, explain any conflicts to the user
4. Before destructive operations (reset, force push), warn the user
5. Use `git diff` to show what will be committed

## Common Commands

```bash
git status                    # Check current state
git diff                      # Show unstaged changes
git add -A                    # Stage all changes
git commit -m "message"       # Commit with message
git push origin branch        # Push to remote
git pull origin branch        # Pull from remote
git checkout -b new-branch    # Create and switch to new branch
git merge branch-name         # Merge branch into current
git log --oneline -10         # Show recent commits
```
