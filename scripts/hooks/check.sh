#!/usr/bin/env bash
# Claude Code Stop hook: when TypeScript files have uncommitted changes,
# run typecheck + tests. Exit 2 sends the failure back to Claude to fix.
input=$(cat)
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0

# Already re-prompted once by this hook: let Claude stop to avoid a loop.
if printf '%s' "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

if [ -z "$(git status --porcelain -- '*.ts' '*.tsx' 2>/dev/null)" ]; then
  exit 0
fi

if ! out=$(npm run typecheck --silent 2>&1); then
  printf 'Typecheck en échec :\n%s\n' "$(printf '%s' "$out" | grep -E 'error TS' | head -20)" >&2
  exit 2
fi
if ! out=$(npx vitest run 2>&1); then
  printf 'Tests en échec :\n%s\n' "$(printf '%s' "$out" | tail -30)" >&2
  exit 2
fi
exit 0
