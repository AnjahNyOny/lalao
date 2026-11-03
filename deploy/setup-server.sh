#!/usr/bin/env bash
# Prépare le VPS pour Lalao, une seule fois : sudo bash ~/lalao-setup/setup-server.sh
# Ensuite, chaque mise en ligne passe par scripts/deploy.sh, sans sudo.
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then
  echo "À lancer avec sudo : sudo bash $0"
  exit 1
fi
APP_USER=liantsoa
DOMAIN=lalao.anjahnyony.com
DIR=/var/www/lalao
HERE=$(cd "$(dirname "$0")" && pwd)

echo "== Dossier $DIR, à $APP_USER ; nginx (www-data) peut lire"
mkdir -p "$DIR/releases"
chown -R "$APP_USER:www-data" "$DIR"
chmod 755 "$DIR" "$DIR/releases"

echo "== Site nginx $DOMAIN"
cp "$HERE/nginx-lalao.conf" "/etc/nginx/sites-available/$DOMAIN"
ln -sfn "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
nginx -t
systemctl reload nginx

echo "== Certificat HTTPS"
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect
nginx -t
systemctl reload nginx

echo
echo "Prêt. La mise en ligne se fait depuis le Mac : scripts/deploy.sh"
