# Skill: Sync Knowledge

## When to Trigger

Invoke this skill when you want to refresh, prune, or audit the `.ai/` knowledge base. Typical triggers:
- After a major feature implementation session
- Before starting a new development phase
- When you suspect docs are stale
- Periodically (e.g., every 2 weeks)

## Procedure

### Step 1: Prune `state/current-state.md`

1. Read `.ai/state/current-state.md`
2. Identify entries in "Latest Delta" that are older than 60 days
3. Move those entries to the appropriate `state/changelog/*.md` file (match by domain)
4. Keep `current-state.md` concise: only the last 30 days of deltas

### Step 2: Check changelog freshness

1. For each file in `.ai/state/changelog/`:
   - Check the latest date mentioned in the file
   - If the latest date is >90 days old, flag it as potentially stale
2. Report which changelogs may need a review

### Step 3: Verify symlink integrity (Antigravity adapter)

1. Run: `find .agents -type l ! -exec test -e {} \; -print`
2. If any broken symlinks are found, report them and offer to fix

### Step 4: Cross-check implementation status

1. Compare `.ai/state/implementation-status.md` with `.ai/knowledge/architecture.md` FR table
2. Flag any inconsistencies (e.g., new FRs not reflected, status mismatches)

### Step 5: Thesis chapter status (optional)

1. Read `thesis-template-master/Chapters/*.tex` file sizes
2. Compare with `.ai/thesis/chapter-status.md`
3. Update status if file sizes have changed significantly (suggesting new content was added)

## Output

Provide a summary report:
```
## Knowledge Sync Report — [DATE]

### Pruned
- Moved X entries from current-state.md to changelog/

### Staleness Warnings
- [file]: last updated [date], [days] days ago

### Symlink Health
- All OK / Found N broken symlinks

### Status Consistency
- All OK / Found N mismatches

### Thesis Progress
- [chapter]: size changed from X to Y KB
```
