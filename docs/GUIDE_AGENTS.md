# Guide des agents (support de formation)

Plateforme de préparation des demandes de visa d'études des militaires boursiers. Formation d'une journée : matin pour tous, après-midi par rôle, avec des données fictives.

## 1. Pour tous

- **Adresse** : `https://<adresse de la plateforme>`, depuis un poste du réseau interne ou le VPN.
- **Connexion** : email et mot de passe ; à la première connexion, changer le mot de passe provisoire. Gestion et administration : double authentification obligatoire (application Google Authenticator, Microsoft Authenticator ou FreeOTP sur le téléphone, et 10 codes de secours à garder à part).
- **Rôles** : ADMIN (DGSIC : comptes, journal, sauvegardes) ; GESTIONNAIRE (DGRECM : campagnes, import, validation, suivi) ; OPERATEUR (saisie sur les sites officiels) ; LECTEUR (hiérarchie : consultation, jamais les pièces).
- **Règle de sincérité** : la plateforme recopie fidèlement les réponses validées. Ne jamais modifier une réponse pour « faire passer » une demande.
- Toute consultation, modification ou export est inscrit au journal, avec votre nom.

## 2. Gestionnaire (DGRECM)

1. **Créer la campagne** (« Campagnes » → « Nouvelle campagne ») : pays, année, type de visa, pièces demandées, **date limite des fiches** (déclenche les rappels).
2. **Valeurs communes** : établissement, dates du séjour, adresse, financement, invitation… saisies une fois pour tous les dossiers.
3. **Importer la liste** (Excel ou CSV) : vérifier le rapport d'erreurs ligne par ligne avant de créer les fiches. Contrôler que chaque militaire a un **email ou un téléphone** (sinon pas de code de connexion possible).
4. **Envoyer les liens d'accès** : bouton « Envoyer les liens d'accès » sur la campagne (ou sur chaque fiche). Le militaire reçoit un lien personnel ; à l'ouverture, un code lui est envoyé.
5. **Suivre** : tableau de bord de la campagne et menu « Alertes » (fiches en retard, passeports, pièces manquantes, messages en échec). Relancer depuis la fiche si besoin (les rappels J-7, J-3, J-1 partent aussi tout seuls).
6. **Valider** les fiches « À valider » : vérifier les anomalies, compléter les questions sensibles (profession, employeur, déclarations), puis « Valider » ; ou **renvoyer** au militaire avec un motif précis (il le reçoit par message).
7. **Attribuer** les dossiers validés aux opérateurs.
8. Après soumission : enregistrer le **rendez-vous** (le militaire reçoit sa convocation, puis un rappel la veille), puis « Déposé », puis le résultat.
9. **Correspondances COVA / kdmid** : après un relevé des pages par un opérateur, vérifier les propositions (champ du dossier, valeurs des listes, format de date).
10. **Clôturer la campagne** à la fin : les pièces seront effacées automatiquement 6 mois plus tard.

## 3. Opérateur (saisie sur les sites officiels)

1. Installer l'extension « Visa DGRECM » (fait par la DGSIC), s'y connecter avec son compte.
2. Ouvrir COVA ou kdmid, ouvrir la page du formulaire, choisir le dossier dans l'extension, « Remplir cette page ».
3. Relire **chaque champ** ; compléter ceux encadrés en rouge ; sur kdmid, cliquer de nouveau « Remplir » après un rechargement de la page.
4. Captcha, téléversement des pièces (téléchargées depuis l'extension, déjà au bon format) et soumission : toujours à la main.
5. Saisir le **numéro de demande** dans l'extension, « Marquer soumis ».
6. Lire un passeport : fiche du dossier → « Photo ou scan du passeport » (lu sur le poste, rien n'est envoyé), comparer nom et prénoms au passeport, puis « Lire et remplir ». Un lecteur MRZ ou la saisie des deux lignes restent possibles.
7. Site officiel modifié (champs non trouvés) : « Relever les champs de cette page », puis prévenir le gestionnaire pour les correspondances.

## 4. Administrateur (DGSIC)

- Comptes : création (mot de passe provisoire affiché une seule fois), désactivation au départ d'un agent, « Nouveau mot de passe » en cas de perte (retire aussi la double authentification).
- Journal d'audit, sauvegardes, copie hors site, mises à jour, restauration : docs/DEPLOIEMENT.md.

## 5. Exercices de la formation (données fictives)

1. Créer une campagne d'essai avec une date limite dans 5 jours ; importer `docs/exemple-import.csv` (10 militaires fictifs, dont 2 lignes erronées à repérer dans le rapport : matricule en double, date impossible).
2. Envoyer le lien à un militaire fictif dont l'email est celui du formateur ; jouer le militaire sur un téléphone : code, information, fiche, photo, envoi.
3. Renvoyer la fiche avec un motif, la corriger côté militaire, la valider.
4. Remplir le formulaire d'essai de l'extension (`pnpm --filter @visa/extension essai`, page http://localhost:4100 ou /webforms).
5. Retrouver dans le journal toutes les étapes du dossier.
