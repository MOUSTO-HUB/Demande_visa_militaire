#!/bin/sh
# Copie hors site des sauvegardes (cahier des charges, 7.3) : sur le disque externe
# branché au serveur, puis rangé dans un autre bâtiment (deux disques en rotation).
#   sudo ./deploy/copier-sauvegardes.sh /media/disque-sauvegarde
# Les fichiers restent chiffrés (phrase SAUVEGARDE_PHRASE) : le disque seul ne suffit pas.
set -eu

CIBLE="${1:?Indiquez le dossier du disque externe, ex. /media/disque-sauvegarde}"
SOURCE="$(dirname "$0")/../sauvegardes"

[ -d "$CIBLE" ] || { echo "Disque introuvable : $CIBLE" >&2; exit 1; }
mkdir -p "$CIBLE/visa-dgrecm"
# Copie des sauvegardes absentes du disque (les anciennes y restent).
for f in "$SOURCE"/*.gpg; do
  [ -e "$f" ] || { echo "Aucune sauvegarde dans $SOURCE." >&2; exit 1; }
  nom=$(basename "$f")
  [ -e "$CIBLE/visa-dgrecm/$nom" ] || cp "$f" "$CIBLE/visa-dgrecm/$nom.partiel"
  [ -e "$CIBLE/visa-dgrecm/$nom.partiel" ] && mv "$CIBLE/visa-dgrecm/$nom.partiel" "$CIBLE/visa-dgrecm/$nom"
done
sync
derniere=$(ls -1 "$CIBLE/visa-dgrecm"/base-*.dump.gpg | tail -n 1)
echo "Copie terminée sur $CIBLE/visa-dgrecm (dernière sauvegarde : $(basename "$derniere"))."
echo "Démontez le disque, puis rangez-le dans l'autre bâtiment."
