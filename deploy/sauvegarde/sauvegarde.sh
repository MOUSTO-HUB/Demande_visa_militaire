#!/bin/sh
# Sauvegarde quotidienne chiffrée (AES-256, phrase secrète SAUVEGARDE_PHRASE) :
#   - base-AAAAMMJJ-HHMM.dump.gpg       : la base PostgreSQL (format pg_dump -Fc)
#   - fichiers-AAAAMMJJ-HHMM.tar.gz.gpg : les pièces (déjà chiffrées par l'API avec CLE_PIECES)
# Garde SAUVEGARDE_JOURS jours dans /sauvegardes. La copie hors site (disque externe
# conservé dans un autre bâtiment) se fait avec deploy/copier-sauvegardes.sh.
# « sauvegarde.sh maintenant » : une sauvegarde tout de suite.
set -eu

: "${SAUVEGARDE_PHRASE:?SAUVEGARDE_PHRASE est obligatoire}"
HEURE="${SAUVEGARDE_HEURE:-02}"
JOURS="${SAUVEGARDE_JOURS:-30}"
DOSSIER=/sauvegardes

# Phrase secrète dans un fichier lisible par ce seul processus (jamais sur la ligne de commande).
PHRASE=$(mktemp)
chmod 600 "$PHRASE"
printf '%s' "$SAUVEGARDE_PHRASE" > "$PHRASE"
trap 'rm -f "$PHRASE"' EXIT

chiffrer() {
  gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file "$PHRASE" \
    --symmetric --cipher-algo AES256 -o "$1"
}

sauvegarder() {
  date_s=$(date -u +%Y%m%d-%H%M)
  pg_dump -Fc | chiffrer "$DOSSIER/base-$date_s.dump.gpg.partiel"
  mv "$DOSSIER/base-$date_s.dump.gpg.partiel" "$DOSSIER/base-$date_s.dump.gpg"
  if [ -d /donnees/stockage ]; then
    tar -C /donnees -czf - stockage | chiffrer "$DOSSIER/fichiers-$date_s.tar.gz.gpg.partiel"
    mv "$DOSSIER/fichiers-$date_s.tar.gz.gpg.partiel" "$DOSSIER/fichiers-$date_s.tar.gz.gpg"
  fi
  find "$DOSSIER" -name '*.gpg' -mtime "+$JOURS" -delete
  find "$DOSSIER" -name '*.partiel' -delete
  # Témoin lu par la supervision : date de la dernière sauvegarde réussie.
  date -u '+%F %T' > "$DOSSIER/derniere-sauvegarde.txt"
  echo "$(date -u '+%F %T') sauvegarde terminée : $date_s"
}

if [ "${1:-}" = "maintenant" ]; then
  sauvegarder
  exit 0
fi

echo "Sauvegarde chaque jour à ${HEURE}h00 (heure de Conakry, UTC), conservation ${JOURS} jours."
while true; do
  maintenant=$(date -u +%s)
  cible=$(date -u -d "$(date -u +%Y-%m-%d) ${HEURE}:00:00" +%s)
  [ "$cible" -le "$maintenant" ] && cible=$((cible + 86400))
  sleep $((cible - maintenant))
  sauvegarder || echo "$(date -u '+%F %T') ÉCHEC de la sauvegarde" >&2
done
