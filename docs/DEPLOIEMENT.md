# Déploiement et exploitation (DGSIC)

> Installation sur Ubuntu, pas à pas et par un script : [DEPLOIEMENT_UBUNTU.md](DEPLOIEMENT_UBUNTU.md). Ce document-ci décrit la plateforme et son exploitation.

Mise en service de la plateforme sur un serveur de la DGSIC, puis tâches courantes : mises à jour, sauvegardes, restauration, comptes, supervision. Cahier des charges : sections 7 (sécurité) et 8 (architecture).

## 1. Le serveur

- **Machine** : 4 cœurs, 8 Go de mémoire, 200 Go de disque (base, pièces et 30 jours de sauvegardes), sur onduleur.
- **Système** : Linux récent (Debian 12 ou Ubuntu 24.04 LTS), avec Docker Engine et le module Docker Compose.
- **Réseau** : adresse fixe sur le réseau interne ; nom DNS interne (ex. `visa.dgsic.defense.gn`) pointant vers elle. Ports 80 et 443 ouverts depuis le réseau interne et le VPN seulement.
- **Accès d'administration** : SSH par clé uniquement, réservé aux administrateurs de la DGSIC.

Composants (fichier `docker-compose.prod.yml`) :

| Service | Rôle |
|---|---|
| `caddy` | Relais HTTPS, seul joignable (ports 80 et 443) ; plateforme des agents réservée aux adresses internes |
| `web` | Site (Next.js) : agents et espace du militaire |
| `api` | API (NestJS) : données, pièces chiffrées, messages, rappels, effacement automatique |
| `postgres` | Base de données |
| `sauvegarde` | Sauvegarde chiffrée quotidienne de la base et des pièces |

## 2. Première installation

1. Installer Docker, puis récupérer le code :

   ```bash
   git clone https://github.com/MOUSTO-HUB/Demande_visa_militaire.git /opt/visa
   ```

2. Créer la configuration :

   ```bash
   cd /opt/visa && cp deploy/env.production.exemple .env.production && chmod 600 .env.production
   ```

   Remplir chaque valeur (les commandes de génération des secrets sont dans le fichier). **Imprimer une copie** de `.env.production`, la mettre sous pli scellé dans le coffre : elle est indispensable pour restaurer une sauvegarde.

3. Certificat HTTPS, au choix :
   - `CADDY_TLS=internal` : Caddy crée sa propre autorité. Après le premier démarrage, récupérer son certificat racine et le déployer sur les postes par stratégie de groupe :

     ```bash
     docker compose -f docker-compose.prod.yml --env-file .env.production cp caddy:/data/caddy/pki/authorities/local/root.crt ./racine-visa.crt
     ```

   - certificat de la PKI de la DGSIC : déposer `visa.crt` et `visa.key` dans `deploy/certificats/`, puis `CADDY_TLS=/certificats/visa.crt /certificats/visa.key`.

4. Démarrer :

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
   ```

   L'API applique les migrations de la base à chaque démarrage. Vérifier que tout est « healthy » :

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production ps
   ```

5. Créer le premier compte ADMIN (mot de passe provisoire affiché une seule fois ; la double authentification sera demandée à la première connexion) :

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production exec api node dist/cli/initialiser.js prenom.nom@defense.gn Prénoms NOM
   ```

6. Ouvrir `https://<DOMAINE>` depuis un poste du réseau interne, se connecter, changer le mot de passe, activer la double authentification. Créer ensuite les comptes des agents (menu « Comptes »).

7. Extension « Remplisseur » : construire `extension/dist` (voir `extension/README.md`), la déployer sur les postes des opérateurs ; dans l'extension, régler l'adresse de l'API sur `https://<DOMAINE>/api`.

## 3. Messages aux militaires

- **Email** : renseigner `SMTP_*` (serveur de messagerie de la DGSIC) et `EMAIL_EXPEDITEUR`. Tant que `SMTP_HOST` est vide, aucun email ne part en production : les messages sont marqués « Échec » avec la raison, visibles sur la fiche du dossier et dans les alertes.
- **SMS** (optionnels, payants) : `SMS_URL`, `SMS_JETON`, `SMS_EXPEDITEUR`. La passerelle reçoit `{ to, from, message }` en JSON ; si le fournisseur retenu attend un autre format, adapter `api/src/messages/envoi.service.ts`.
- Essai : sur la fiche d'un dossier de test, « Envoyer le lien d'accès », puis vérifier la réception.

## 4. Espace du militaire sur Internet (facultatif)

Par défaut, tout est réservé au réseau interne. Si les militaires doivent remplir leur fiche depuis chez eux :

1. obtenir un nom public (ex. `espace-visa.defense.gn`) pointant vers une adresse publique redirigée sur le port 443 du serveur ;
2. copier `deploy/caddy/sites/espace-internet.caddy.exemple` en `espace-internet.caddy` ;
3. dans `.env.production` : `DOMAINE_ESPACE`, `ESPACE_URL=https://<DOMAINE_ESPACE>` et `CADDY_TLS_ESPACE` (une adresse email pour Let's Encrypt) ;
4. redémarrer : `docker compose -f docker-compose.prod.yml --env-file .env.production up -d`.

Seules les pages `/m/…` (lien personnel) et `/espace` passent par ce nom ; la plateforme des agents et l'API restent internes.

## 5. Mises à jour

```bash
cd /opt/visa && ./deploy/mettre-a-jour.sh
```

Le script fait une sauvegarde, récupère la dernière version, reconstruit les images et redémarre (migrations comprises). Après une mise à jour de l'extension, la redéployer sur les postes.

## 6. Sauvegardes

- **Quotidiennes** à `SAUVEGARDE_HEURE` (UTC, heure de Conakry), dans `/opt/visa/sauvegardes` : `base-….dump.gpg` et `fichiers-….tar.gz.gpg`, chiffrées (AES-256) par `SAUVEGARDE_PHRASE`, gardées `SAUVEGARDE_JOURS` jours. `derniere-sauvegarde.txt` donne la date de la dernière réussie.
- **Sauvegarde immédiate** :

  ```bash
  docker compose -f docker-compose.prod.yml --env-file .env.production run --rm sauvegarde maintenant
  ```

- **Copie hors site** (chaque semaine, deux disques en rotation, l'un toujours dans un autre bâtiment) :

  ```bash
  sudo ./deploy/copier-sauvegardes.sh /media/disque-sauvegarde
  ```

## 7. Restauration (aussi sur un serveur vierge)

1. Sur un serveur vierge : installation (section 2, étapes 1 à 3) avec la **copie scellée** de `.env.production`, puis démarrer seulement la base :

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d postgres
   ```

   Sur le serveur en service : arrêter le site et l'API.

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production stop api web
   ```

2. Copier les sauvegardes voulues dans `/opt/visa/sauvegardes`, puis :

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production run --rm -v demande_visa_prod_stockage:/restauration --entrypoint restaurer.sh sauvegarde /sauvegardes/base-AAAAMMJJ-HHMM.dump.gpg /sauvegardes/fichiers-AAAAMMJJ-HHMM.tar.gz.gpg
   ```

3. Redémarrer tout, puis vérifier : connexion d'un agent (avec son code de double authentification), ouverture d'un dossier et d'une de ses pièces.

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d
   ```

## 8. Conservation et protection des données

- **Pièces** : effacées automatiquement `CONSERVATION_MOIS` mois (6 par défaut) après la clôture de la campagne ; la date prévue s'affiche sur la campagne close. L'ADMIN peut les effacer plus tôt (bouton sur la campagne). La fiche d'identité et l'historique des dossiers restent (cahier des charges, 7.4).
- **Chiffrement** : pièces chiffrées sur le disque (`CLE_PIECES`), sauvegardes chiffrées, HTTPS partout.
- **Journal d'audit** (menu « Journal », ADMIN) : consultations, modifications, exports, statuts, messages, connexions des militaires, avec l'adresse IP.
- **Information des militaires** : à la première connexion à son espace, le militaire lit et accepte l'information sur l'utilisation de ses données (texte dans `api/src/espace/consentement.ts`, à faire valider par le service juridique ; changer sa version le fait accepter de nouveau).

## 9. Supervision et incidents

- État des services : `docker compose -f docker-compose.prod.yml --env-file .env.production ps` (l'API doit être « healthy »).
- Journaux : `docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail 200 api` (ou `web`, `caddy`, `sauvegarde`).
- Contrôle hebdomadaire : date de `sauvegardes/derniere-sauvegarde.txt`, espace disque (`df -h`), page « Alertes » (messages en échec).
- Agent bloqué (trop d'essais) : attendre la fin du blocage, ou « Nouveau mot de passe » dans « Comptes » (ADMIN), qui retire aussi sa double authentification.
- Site officiel modifié (champs non trouvés par l'extension) : relever de nouveau les pages concernées, puis vérifier les « Correspondances ».
