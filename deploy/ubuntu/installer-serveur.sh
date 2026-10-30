#!/usr/bin/env bash
# Installation de la plateforme sur un serveur Ubuntu de la DGSIC (22.04 ou 24.04 LTS).
# Voir docs/DEPLOIEMENT_UBUNTU.md. À lancer avec sudo ; peut être relancé sans risque
# (ce qui est déjà fait est conservé, en particulier .env.production).
#
#   sudo bash installer-serveur.sh --domaine visa.dgsic.defense.gn
#
# Options :
#   --domaine NOM        nom DNS interne de la plateforme (obligatoire à la 1re installation)
#   --dossier CHEMIN     dossier d'installation (défaut : /opt/visa)
#   --depot URL          dépôt Git (défaut : https://github.com/MOUSTO-HUB/Demande_visa_militaire.git)
#   --branche NOM        branche (défaut : main)
#   --reseau-ssh CIDR    réseau autorisé en SSH (défaut : réseaux privés)
#   --sans-demarrage     prépare tout sans lancer la plateforme
#   --essai              aucune installation système (apt, Docker, pare-feu) : contrôle du script
set -euo pipefail

DOMAINE=""
DOSSIER="/opt/visa"
DEPOT="https://github.com/MOUSTO-HUB/Demande_visa_militaire.git"
BRANCHE="main"
RESEAU_SSH=""
DEMARRER=1
ESSAI=0

while [ $# -gt 0 ]; do
  case "$1" in
    --domaine) DOMAINE="$2"; shift 2 ;;
    --dossier) DOSSIER="$2"; shift 2 ;;
    --depot) DEPOT="$2"; shift 2 ;;
    --branche) BRANCHE="$2"; shift 2 ;;
    --reseau-ssh) RESEAU_SSH="$2"; shift 2 ;;
    --sans-demarrage) DEMARRER=0; shift ;;
    --essai) ESSAI=1; DEMARRER=0; shift ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    *) echo "Option inconnue : $1 (voir --help)" >&2; exit 1 ;;
  esac
done

etape() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }
ok() { printf '  \033[32m✔\033[0m %s\n' "$1"; }
attention() { printf '  \033[33m⚠\033[0m %s\n' "$1"; }
erreur() { printf '\033[31m✘ %s\033[0m\n' "$1" >&2; exit 1; }

# ─── 1. Contrôles ────────────────────────────────────────────────────────────
etape "Contrôles du serveur"
[ "$(id -u)" -eq 0 ] || erreur "Lancez ce script avec sudo."
. /etc/os-release
[ "${ID:-}" = "ubuntu" ] || erreur "Système non pris en charge : ${PRETTY_NAME:-inconnu} (Ubuntu 22.04 ou 24.04 attendu)."
case "${VERSION_ID:-}" in
  22.04|24.04) ok "$PRETTY_NAME" ;;
  *) attention "$PRETTY_NAME : version non testée (22.04 ou 24.04 conseillées)." ;;
esac
memoire=$(awk '/MemTotal/ {print int($2/1024/1024)}' /proc/meminfo)
[ "$memoire" -ge 4 ] || attention "Mémoire : ${memoire} Go (8 Go conseillés, 4 Go minimum)."
disque=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
[ "$disque" -ge 40 ] || attention "Espace libre : ${disque} Go (200 Go conseillés)."
ok "Mémoire ${memoire} Go, disque libre ${disque} Go"

# ─── 2. Paquets et mises à jour de sécurité ─────────────────────────────────
if [ "$ESSAI" -eq 0 ]; then
  etape "Paquets système et mises à jour de sécurité automatiques"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg git openssl ufw unattended-upgrades >/dev/null
  dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null
  ok "git, openssl, ufw, mises à jour de sécurité automatiques"

  # ─── 3. Docker Engine (dépôt officiel) ────────────────────────────────────
  etape "Docker Engine et Docker Compose"
  if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
  fi
  systemctl enable --now docker >/dev/null
  ok "$(docker --version), $(docker compose version --short)"

  # ─── 4. Pare-feu ──────────────────────────────────────────────────────────
  etape "Pare-feu (ufw)"
  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  if [ -n "$RESEAU_SSH" ]; then
    ufw allow from "$RESEAU_SSH" to any port 22 proto tcp >/dev/null
  else
    for r in 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16; do
      ufw allow from "$r" to any port 22 proto tcp >/dev/null
    done
  fi
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null
  ok "SSH depuis ${RESEAU_SSH:-les réseaux privés} ; HTTP et HTTPS ouverts"
  ok "Accès des agents filtré par Caddy (adresses internes et RESEAUX_AUTORISES)"
fi

# ─── 5. Code de la plateforme ────────────────────────────────────────────────
etape "Code de la plateforme dans $DOSSIER"
if [ -d "$DOSSIER/.git" ]; then
  git -C "$DOSSIER" fetch -q origin "$BRANCHE"
  git -C "$DOSSIER" checkout -q "$BRANCHE"
  git -C "$DOSSIER" pull -q --ff-only origin "$BRANCHE"
  ok "Mis à jour : $(git -C "$DOSSIER" log --oneline -1)"
else
  git clone -q --branch "$BRANCHE" "$DEPOT" "$DOSSIER"
  ok "Récupéré : $(git -C "$DOSSIER" log --oneline -1)"
fi
cd "$DOSSIER"
mkdir -p sauvegardes deploy/certificats

# ─── 6. Configuration et secrets ─────────────────────────────────────────────
etape "Configuration (.env.production)"
aleatoire() { openssl rand -base64 "$1" | tr '+/' '-_' | tr -d '=\n'; }
if [ -f .env.production ]; then
  ok "Déjà présente : conservée (secrets inchangés)"
else
  [ -n "$DOMAINE" ] || erreur "Première installation : indiquez --domaine (nom DNS interne de la plateforme)."
  cp deploy/env.production.exemple .env.production
  remplacer() { sed -i "s|^$1=.*|$1=$2|" .env.production; }
  remplacer DOMAINE "$DOMAINE"
  remplacer POSTGRES_PASSWORD "$(aleatoire 24)"
  remplacer JWT_SECRET "$(aleatoire 48)"
  remplacer CLE_PIECES "$(openssl rand -base64 32)"
  remplacer SAUVEGARDE_PHRASE "$(aleatoire 30)"
  chmod 600 .env.production
  ok "Créée avec des secrets aléatoires (domaine : $DOMAINE)"
  attention "IMPRIMEZ .env.production et mettez la copie sous pli scellé au coffre :"
  attention "sans elle, aucune sauvegarde ne pourra être restaurée."
fi
# Contrôle : aucune valeur obligatoire vide.
for cle in DOMAINE POSTGRES_PASSWORD JWT_SECRET CLE_PIECES SAUVEGARDE_PHRASE; do
  grep -Eq "^$cle=.+" .env.production || erreur "$cle est vide dans .env.production."
done
ok "Valeurs obligatoires présentes"
grep -Eq '^SMTP_HOST=.+' .env.production \
  || attention "SMTP_HOST vide : aucun email ne partira (à renseigner, voir le guide)."

if [ "$DEMARRER" -eq 0 ]; then
  etape "Préparation terminée (plateforme non démarrée)"
  echo "  Démarrage : cd $DOSSIER && docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build"
  exit 0
fi

# ─── 7. Démarrage ────────────────────────────────────────────────────────────
etape "Construction et démarrage (plusieurs minutes la première fois)"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"
$COMPOSE up -d --build --remove-orphans
for _ in $(seq 1 60); do
  etat=$($COMPOSE ps --format '{{.Service}} {{.Health}}' | awk '$1=="api"{print $2}')
  [ "$etat" = "healthy" ] && break
  sleep 5
done
[ "${etat:-}" = "healthy" ] || erreur "L'API ne démarre pas : $COMPOSE logs --tail 100 api"
ok "Plateforme démarrée"
$COMPOSE ps --format 'table {{.Service}}\t{{.Status}}'

# ─── 8. Suite ────────────────────────────────────────────────────────────────
etape "Étapes suivantes (docs/DEPLOIEMENT_UBUNTU.md)"
cat <<SUITE
  1. Premier compte ADMIN (mot de passe provisoire affiché une seule fois) :
       cd $DOSSIER && $COMPOSE exec api node dist/cli/initialiser.js prenom.nom@defense.gn Prénoms NOM
  2. Certificat racine à installer sur les postes (si CADDY_TLS=internal) :
       $COMPOSE cp caddy:/data/caddy/pki/authorities/local/root.crt ./racine-visa.crt
  3. Ouvrir https://$(grep '^DOMAINE=' .env.production | cut -d= -f2) depuis un poste du réseau interne.
  4. Contrôle complet à tout moment :
       sudo bash $DOSSIER/deploy/ubuntu/verifier-serveur.sh
SUITE
