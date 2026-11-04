#!/usr/bin/env bash
# One worktree per piece of work, so that several Claude chats can work at once
# without touching each other's files (see "Plusieurs chats en même temps" in CLAUDE.md).
#
#   scripts/worktree.sh <nom> [branche]   # ../game-<nom> on branch jeu/<nom>, from the main folder's branch
set -euo pipefail

name=${1:-}
if [[ ! $name =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "Usage : scripts/worktree.sh <nom> [branche de départ]   (minuscules, chiffres et tirets, ex. awale)" >&2
  exit 1
fi

# The main folder, even when run from inside another worktree.
main=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
base=${2:-$(git -C "$main" rev-parse --abbrev-ref HEAD)}
dir="$(dirname "$main")/$(basename "$main")-$name"

git -C "$main" worktree add -b "jeu/$name" "$dir" "$base"
(cd "$dir" && npm ci --no-audit --no-fund)

echo
echo "Chantier prêt : $dir"
echo "Branche jeu/$name, partie du dernier commit de $base."
if command -v code >/dev/null; then
  code -n "$dir"
  echo "Ouvre un nouveau chat Claude dans la fenêtre VS Code qui vient de s'ouvrir."
else
  echo "Ouvre ce dossier dans une nouvelle fenêtre VS Code, puis un nouveau chat Claude dedans."
fi
