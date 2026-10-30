#!/usr/bin/env bash
# Contrôle de l'état de la plateforme (à lancer après l'installation, puis chaque
# semaine ou par cron) : services, API, sauvegarde du jour, disque, configuration.
#   sudo bash /opt/visa/deploy/ubuntu/verifier-serveur.sh
# Code de sortie 0 : tout va bien ; 1 : au moins un problème (lignes ✘).
set -uo pipefail

DOSSIER="${1:-/opt/visa}"
cd "$DOSSIER" 2>/dev/null || { echo "Dossier introuvable : $DOSSIER" >&2; exit 1; }
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"
problemes=0
ok() { printf '\033[32m✔\033[0m %s\n' "$1"; }
ko() { printf '\033[31m✘\033[0m %s\n' "$1"; problemes=$((problemes + 1)); }

# Services
for service in caddy web api postgres sauvegarde; do
  etat=$($COMPOSE ps --format '{{.Service}} {{.State}} {{.Health}}' 2>/dev/null | awk -v s="$service" '$1==s {print $2, $3}')
  case "$etat" in
    "running healthy"|"running ") ok "Service $service : en marche" ;;
    running*) ok "Service $service : en marche ($etat)" ;;
    *) ko "Service $service : ${etat:-arrêté}" ;;
  esac
done

# API par le relais HTTPS (certificat interne accepté pour ce contrôle local).
domaine=$(grep '^DOMAINE=' .env.production | cut -d= -f2)
if curl -sk --max-time 10 --resolve "$domaine:443:127.0.0.1" "https://$domaine/api/sante" | grep -q '"ok"'; then
  ok "API joignable en HTTPS (https://$domaine/api/sante)"
else
  ko "API injoignable par https://$domaine (voir : $COMPOSE logs --tail 100 caddy api)"
fi

# Sauvegarde de moins de 26 heures.
if [ -f sauvegardes/derniere-sauvegarde.txt ]; then
  age=$(( ($(date -u +%s) - $(date -u -d "$(cat sauvegardes/derniere-sauvegarde.txt)" +%s)) / 3600 ))
  if [ "$age" -le 26 ]; then ok "Dernière sauvegarde : il y a ${age} h"
  else ko "Dernière sauvegarde : il y a ${age} h (plus d'un jour)"; fi
else
  ko "Aucune sauvegarde encore (sauvegarde immédiate : $COMPOSE run --rm sauvegarde maintenant)"
fi

# Disque
utilise=$(df --output=pcent / | tail -1 | tr -dc '0-9')
if [ "$utilise" -lt 85 ]; then ok "Disque utilisé : ${utilise} %"
else ko "Disque utilisé : ${utilise} % (libérer de la place)"; fi

# Configuration
[ "$(stat -c %a .env.production)" = "600" ] && ok ".env.production protégé (600)" || ko ".env.production lisible par d'autres comptes : chmod 600 .env.production"
grep -Eq '^SMTP_HOST=.+' .env.production && ok "Serveur d'email configuré" || ko "SMTP_HOST vide : les emails aux militaires ne partent pas"

echo
[ "$problemes" -eq 0 ] && echo "Tout est en ordre." || echo "$problemes problème(s) à traiter."
exit $((problemes > 0))
