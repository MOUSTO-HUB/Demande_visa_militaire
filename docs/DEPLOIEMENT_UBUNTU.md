# Installation sur le serveur Ubuntu de la DGSIC

Procédure pas à pas, de la machine nue à la plateforme en service. Elle complète [DEPLOIEMENT.md](DEPLOIEMENT.md) (exploitation : sauvegardes, restauration, mises à jour, supervision).

Durée : environ 1 heure, dont 15 à 30 minutes de construction des images.

## 0. À préparer avant le jour J

| Élément | Qui | Exemple |
|---|---|---|
| Serveur : 4 cœurs, 8 Go de mémoire, 200 Go de disque, sur onduleur | DGSIC | machine physique ou virtuelle |
| Adresse IP fixe sur le réseau interne | DGSIC réseau | `10.20.0.15` |
| Nom DNS interne pointant vers cette adresse | DGSIC réseau | `visa.dgsic.defense.gn` |
| Accès Internet sortant du serveur (installation et mises à jour) : `github.com`, `download.docker.com`, `registry.npmjs.org`, `registry-1.docker.io`, dépôts Ubuntu | DGSIC réseau | ouverture temporaire possible |
| Serveur de messagerie (SMTP) : adresse, port, compte d'envoi | DGSIC messagerie | `smtp.defense.gn`, 587 |
| Réseau des administrateurs autorisé en SSH | DGSIC sécurité | `10.20.1.0/24` |
| Coffre et enveloppe pour la copie des secrets | DGSIC | — |
| Deux disques externes de sauvegarde (rotation hors site) | DGSIC | 2 × 2 To |

## 1. Installer Ubuntu Server

1. Ubuntu Server **24.04 LTS** (ou 22.04 LTS), installation minimale, disque entier avec LVM.
2. Cocher **« Install OpenSSH server »**. Ne cocher aucun autre logiciel (Docker sera installé par le script, depuis son dépôt officiel).
3. Créer le compte d'administration (ex. `admin-dgsic`), puis, depuis le poste de l'administrateur, copier sa clé SSH et désactiver la connexion par mot de passe :

   ```bash
   ssh-copy-id admin-dgsic@10.20.0.15
   ```

   Sur le serveur, dans `/etc/ssh/sshd_config` : `PasswordAuthentication no`, puis `sudo systemctl restart ssh`.

4. Régler l'heure : `sudo timedatectl set-timezone Africa/Conakry`.

## 2. Lancer l'installation

Sur le serveur :

```bash
curl -fsSLO https://raw.githubusercontent.com/MOUSTO-HUB/Demande_visa_militaire/main/deploy/ubuntu/installer-serveur.sh
```

```bash
sudo bash installer-serveur.sh --domaine visa.dgsic.defense.gn --reseau-ssh 10.20.1.0/24
```

Le script, qu'on peut relancer sans risque :

1. vérifie le système (version d'Ubuntu, mémoire, disque) ;
2. installe les mises à jour de sécurité automatiques, Git, OpenSSL, le pare-feu ;
3. installe Docker Engine et Docker Compose depuis le dépôt officiel de Docker ;
4. configure le pare-feu : SSH depuis le réseau des administrateurs seulement, HTTP et HTTPS ouverts (Caddy réserve ensuite la plateforme des agents aux adresses internes) ;
5. récupère le code dans `/opt/visa` ;
6. crée `/opt/visa/.env.production` avec des **secrets aléatoires** (droits `600`) — s'il existe déjà, il est conservé ;
7. construit les images et démarre la plateforme, puis attend que l'API soit prête.

**Aussitôt après** : imprimer `/opt/visa/.env.production` (`sudo cat /opt/visa/.env.production`), mettre la feuille sous pli scellé au coffre. Sans ces secrets, aucune sauvegarde ne peut être restaurée.

Option `--sans-demarrage` : tout préparer sans démarrer (pour compléter `.env.production` d'abord, par exemple l'email).

## 3. Compléter la configuration

Dans `/opt/visa/.env.production` (`sudo nano /opt/visa/.env.production`) :

- **Email** : `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_UTILISATEUR`, `SMTP_MOT_DE_PASSE`, `EMAIL_EXPEDITEUR`.
- **Certificat** : laisser `CADDY_TLS=internal`, ou utiliser un certificat de la PKI de la DGSIC (fichiers dans `/opt/visa/deploy/certificats/`, puis `CADDY_TLS=/certificats/visa.crt /certificats/visa.key`).
- **VPN** à adresses publiques : les ajouter dans `RESEAUX_AUTORISES`.
- SMS : `SMS_URL`, `SMS_JETON` (facultatif).

Puis appliquer :

```bash
cd /opt/visa && sudo docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

## 4. Mettre en service

1. **Premier compte ADMIN** (mot de passe provisoire affiché une seule fois) :

   ```bash
   cd /opt/visa && sudo docker compose -f docker-compose.prod.yml --env-file .env.production exec api node dist/cli/initialiser.js prenom.nom@defense.gn Prénoms NOM
   ```

2. **Certificat racine sur les postes** (si `CADDY_TLS=internal`) : récupérer le fichier, puis le diffuser par stratégie de groupe (« Autorités de certification racines de confiance ») :

   ```bash
   cd /opt/visa && sudo docker compose -f docker-compose.prod.yml --env-file .env.production cp caddy:/data/caddy/pki/authorities/local/root.crt ./racine-visa.crt
   ```

3. Depuis un poste du réseau interne : ouvrir `https://visa.dgsic.defense.gn`, se connecter avec le compte ADMIN, changer le mot de passe, activer la double authentification, puis :
   - « Comptes » : créer les comptes des agents ;
   - « Paramètres » : vérifier les exigences des photos et scans ;
   - sur un dossier de test : « Envoyer le lien d'accès » et vérifier la réception de l'email.
4. **Extension** sur les postes des opérateurs : voir `extension/README.md`, adresse de l'API : `https://visa.dgsic.defense.gn/api`.
5. **Sauvegarde immédiate** et premier contrôle :

   ```bash
   cd /opt/visa && sudo docker compose -f docker-compose.prod.yml --env-file .env.production run --rm sauvegarde maintenant
   ```

   ```bash
   sudo bash /opt/visa/deploy/ubuntu/verifier-serveur.sh
   ```

   Tout doit être « ✔ ».

## 5. Contrôle automatique chaque matin (facultatif)

```bash
echo '30 7 * * * root bash /opt/visa/deploy/ubuntu/verifier-serveur.sh > /var/log/visa-controle.log 2>&1' | sudo tee /etc/cron.d/visa-controle
```

Le résultat du jour est dans `/var/log/visa-controle.log` (« Tout est en ordre. » ou la liste des problèmes).

## 6. Avant la recette

| Contrôle | Fait |
|---|---|
| `verifier-serveur.sh` : tout « ✔ » | ☐ |
| Copie scellée de `.env.production` au coffre | ☐ |
| Copie des sauvegardes sur le disque externe (`deploy/copier-sauvegardes.sh`), disque rangé dans l'autre bâtiment | ☐ |
| Restauration essayée sur une machine vierge (DEPLOIEMENT.md, section 7) | ☐ |
| Accès des agents refusé depuis une adresse hors du réseau interne | ☐ |
| Certificat racine diffusé : aucun avertissement de sécurité dans Chrome ou Edge | ☐ |
| Email reçu par un militaire de test (lien, puis code) | ☐ |
| Extension installée et connectée sur les postes des opérateurs | ☐ |

Ensuite : [RECETTE.md](RECETTE.md).
