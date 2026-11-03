#!/usr/bin/env bash
# Met Lalao en ligne : vérifie et compile sur ce Mac, envoie la version sur le
# VPS, bascule `current` dessus et redémarre le serveur de jeu.
# Les parties en cours sont coupées au redémarrage (les salons vivent en mémoire).
#
#   scripts/deploy.sh                 déploie le commit courant
#   DEPLOY_DIRTY=1 scripts/deploy.sh  même avec des changements non commités
#   scripts/deploy.sh --rollback      revient à la version précédente
set -euo pipefail
cd "$(dirname "$0")/.."

HOST=${DEPLOY_HOST:-liantsoa@anjahnyony.com}
DIR=${DEPLOY_DIR:-/var/www/lalao}
URL=${DEPLOY_URL:-https://lalao.anjahnyony.com}
# As in deploy/ecosystem.config.cjs.
PORT=5004
KEEP=3

restart() {
  ssh "$HOST" "cd $DIR && pm2 startOrReload ecosystem.config.cjs --update-env >/dev/null && pm2 save >/dev/null"
}

# The game server itself, from the VPS (must answer), then the public site
# through nginx and HTTPS (a warning only: DNS or the certificate may lag).
check() {
  local ok=
  for _ in 1 2 3 4 5 6; do
    if ssh "$HOST" "curl -fsS http://127.0.0.1:$PORT/healthz"; then ok=1; echo; break; fi
    sleep 2
  done
  if [ -z "$ok" ]; then
    echo "Le serveur de jeu ne répond pas : regarde « ssh $HOST pm2 logs lalao »." >&2
    return 1
  fi
  curl -fsS -o /dev/null "$URL/healthz" || echo "Attention : $URL ne répond pas encore (DNS ou HTTPS)." >&2
}

if [ "${1:-}" = "--rollback" ]; then
  ssh "$HOST" "set -e; cd $DIR; prev=\$(ls -1dt releases/* | sed -n 2p); [ -n \"\$prev\" ] || { echo 'Pas de version précédente'; exit 1; }; ln -sfn \"\$prev\" current.tmp && mv -Tf current.tmp current; echo \"Retour à \$prev\""
  restart
  check
  exit 0
fi

if [ -n "$(git status --porcelain)" ] && [ "${DEPLOY_DIRTY:-}" != 1 ]; then
  echo "Des changements ne sont pas commités : commite d'abord (ou DEPLOY_DIRTY=1)." >&2
  exit 1
fi
VERSION="$(date +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)"

echo "== Vérifications"
npm run typecheck >/dev/null
npx vitest run >/dev/null
echo "== Compilation"
npm run build >/dev/null
npm run build -w @game/server >/dev/null

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
mkdir "$STAGE/$VERSION"
cp apps/server/dist/server.mjs "$STAGE/$VERSION/"
cp -R apps/client/dist "$STAGE/$VERSION/client"
echo "$VERSION" > "$STAGE/$VERSION/VERSION"

echo "== Envoi de $VERSION"
rsync -az "$STAGE/$VERSION" "$HOST:$DIR/releases/"
rsync -az deploy/ecosystem.config.cjs "$HOST:$DIR/"
# Bascule d'un coup (mv est atomique), puis ne garde que les dernières versions.
ssh "$HOST" "set -e; cd $DIR; ln -sfn releases/$VERSION current.tmp && mv -Tf current.tmp current; ls -1dt releases/* | tail -n +$((KEEP + 1)) | xargs -r rm -rf"
restart
check
echo "Déployé : $VERSION"
