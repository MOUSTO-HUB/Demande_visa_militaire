#!/bin/sh
# Mise à jour sur le serveur : dernière version du dépôt, nouvelles images, redémarrage.
# Les migrations de la base sont appliquées au démarrage de l'API.
#   ./deploy/mettre-a-jour.sh
set -eu

cd "$(dirname "$0")/.."
[ -f .env.production ] || { echo "Fichier .env.production absent (modèle : deploy/env.production.exemple)." >&2; exit 1; }
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

# Sauvegarde avant toute mise à jour.
$COMPOSE run --rm sauvegarde maintenant || { echo "Sauvegarde impossible : mise à jour annulée." >&2; exit 1; }

git pull --ff-only
$COMPOSE build --pull
$COMPOSE up -d --remove-orphans
docker image prune -f >/dev/null
$COMPOSE ps
echo "Mise à jour terminée. Vérifier : https://\$DOMAINE (page de connexion) et l'état « healthy » de l'API."
