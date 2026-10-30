#!/bin/sh
# Restaure une sauvegarde (REMPLACE les données actuelles) : la base, et les pièces
# si le fichier « fichiers-… » est donné. Arrêter d'abord l'API et le site :
#   docker compose -f docker-compose.prod.yml --env-file .env.production stop api web
#   docker compose -f docker-compose.prod.yml --env-file .env.production run --rm \
#     -v demande_visa_prod_stockage:/restauration --entrypoint restaurer.sh sauvegarde \
#     /sauvegardes/base-AAAAMMJJ-HHMM.dump.gpg /sauvegardes/fichiers-AAAAMMJJ-HHMM.tar.gz.gpg
# Le volume des pièces est monté sur /restauration : le service de sauvegarde, lui, ne
# le voit qu'en lecture seule. Les pièces restent illisibles sans la même CLE_PIECES,
# et les doubles authentifications sans le même JWT_SECRET : garder une copie de
# .env.production à part.
set -eu

: "${SAUVEGARDE_PHRASE:?SAUVEGARDE_PHRASE est obligatoire}"
BASE="${1:?Indiquez la sauvegarde de la base, ex. /sauvegardes/base-20261105-0200.dump.gpg}"
FICHIERS="${2:-}"
CIBLE=/restauration

PHRASE=$(mktemp)
chmod 600 "$PHRASE"
printf '%s' "$SAUVEGARDE_PHRASE" > "$PHRASE"
trap 'rm -f "$PHRASE"' EXIT

dechiffrer() {
  gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$PHRASE" -d "$1"
}

if [ -n "$FICHIERS" ] && ! touch "$CIBLE/.essai" 2>/dev/null; then
  echo "Montez le volume des pièces sur $CIBLE (option -v …_stockage:$CIBLE)." >&2
  exit 1
fi

dechiffrer "$BASE" | pg_restore --clean --if-exists --no-owner -d "$PGDATABASE"
echo "Base restaurée depuis $BASE."

if [ -n "$FICHIERS" ]; then
  find "$CIBLE" -mindepth 1 -delete
  # L'archive contient « stockage/… » : son contenu va à la racine du volume.
  dechiffrer "$FICHIERS" | tar -C "$CIBLE" --strip-components=1 -xzf -
  # Propriétaire : l'utilisateur « node » (1000) de l'image de l'API.
  chown -R 1000:1000 "$CIBLE"
  echo "Pièces restaurées depuis $FICHIERS ($(find "$CIBLE" -type f | wc -l) fichier(s))."
fi
