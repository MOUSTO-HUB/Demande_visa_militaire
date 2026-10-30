# Cahier de recette

Vérification de la plateforme avant sa mise en service, selon les critères du cahier des charges (section 11). La recette se fait sur le serveur de production installé (docs/DEPLOIEMENT.md), **avec des données fictives** pour tout ce qui n'exige pas un vrai passeport ; les essais sur les sites officiels utilisent de vrais dossiers de la campagne en préparation, avec l'accord de la DGRECM.

Participants : DGRECM (gestionnaire, deux opérateurs), DGSIC (administrateur), deux militaires volontaires (espace du militaire, téléphone).

Pour chaque essai, noter le résultat (✅ conforme / ❌ non conforme) et la remarque. Un essai non conforme est corrigé puis rejoué.

## Critères du cahier des charges

| N° | Critère | Préparation | Déroulement | Attendu |
|---|---|---|---|---|
| 1 | Import de 100 militaires depuis Excel en moins de 5 minutes, avec rapport d'erreurs | Fichier de 100 lignes fictives, dont 3 erronées (matricule en double, téléphone invalide, date impossible) | « Militaires » → « Importer » ; chronométrer de l'envoi du fichier à la création | 97 fiches créées, 3 erreurs signalées ligne par ligne, moins de 5 minutes |
| 2 | Lecture de la MRZ sur au moins 95 % des passeports guinéens | 20 passeports réels (avec accord des titulaires) ; photo au téléphone et scan | Fiche du dossier → « Photo ou scan du passeport » ; noter si les chiffres de contrôle sont justes et si nom/prénoms sont exacts | Au moins 19 lectures justes sur 20 (le lecteur MRZ ou la saisie restent possibles pour les autres) |
| 3 | Formulaire COVA et formulaire kdmid remplis, hors captcha et pièces, avec 0 champ erroné | Relevé et correspondances faits (phase 0) ; un dossier validé par pays | Opérateur : extension, « Remplir cette page » sur chaque page ; comparer chaque champ au dossier | Aucun champ erroné ; les obligatoires non remplis sont encadrés en rouge |
| 4 | Formulaire rempli et soumis par un opérateur en moins de 10 minutes | Dossier validé, pièces au format | Chronométrer de l'ouverture du site officiel au numéro de demande saisi dans l'extension | Moins de 10 minutes |
| 5 | Photo et scans acceptés du premier coup par les deux sites | Pièces déposées sur la plateforme (téléphone et scanner) | Téléverser sur COVA et kdmid les fichiers préparés par la plateforme | Aucun refus de format ; sinon corriger `api/src/referentiel/pieces.ts` |
| 6 | Un militaire ne peut accéder qu'à sa fiche | Deux dossiers A et B avec lien envoyé | Voir « Essais de sécurité » ci-dessous | Tous les accès hors de sa fiche refusés |
| 7 | Restauration d'une sauvegarde sur un serveur vierge | Sauvegarde de la veille, copie scellée de `.env.production`, machine vierge | docs/DEPLOIEMENT.md, section 7 | Connexion d'un agent avec sa double authentification, dossiers et pièces lisibles |
| 8 | Journal d'audit complet pour un dossier de bout en bout | Un dossier suivi de la création au visa | « Journal » → filtrer sur le dossier | Chaque étape présente, avec auteur (ou « militaire »), date et adresse IP : création, lien, connexion du militaire, saisies, envoi, validation, saisie sur le site, numéro de demande, rendez-vous, dépôt, résultat |

## Essais de sécurité (critère 6 et section 7)

| Essai | Attendu |
|---|---|
| Ouvrir l'adresse du lien de A en changeant un caractère | « Ce lien n'est pas valable » |
| Lien de A, code demandé, mauvais code 5 fois | Code bloqué ; il faut en demander un nouveau |
| Militaire A connecté : ouvrir une adresse d'agent (`/dossiers`, `/campagnes`) | Renvoyé vers la connexion des agents, aucune donnée |
| Militaire A connecté : appel direct de l'API d'un dossier (`/api/dossiers/<id de B>`) | Refusé (403) |
| Agent connecté : appel de `/api/espace/dossier` | Refusé (403) |
| Après envoi de sa fiche, le militaire tente de la modifier | Refusé, message « fiche envoyée à la DGRECM » |
| Plateforme des agents depuis une adresse hors du réseau interne | « Accès réservé au réseau interne » (403) |
| Compte ADMIN ou GESTIONNAIRE sans double authentification | Accès limité à « Mon compte » jusqu'à son activation |
| Lecteur (hiérarchie) : pièces, coordonnées et messages d'un militaire | Non accessibles |
| Copie du dossier des pièces ou d'une sauvegarde sans les secrets | Fichiers illisibles (chiffrés) |

## Essais fonctionnels complémentaires

| Essai | Attendu |
|---|---|
| Militaire volontaire, sur son téléphone : lien, code, information acceptée, fiche complète, pièces, envoi | Fiche reçue « À valider » ; réponses enregistrées au fil de la saisie (couper le réseau puis reprendre) |
| Gestionnaire : renvoi de la fiche avec un motif | Le militaire reçoit le motif et peut corriger |
| Campagne avec date limite dans 3 jours, fiche non envoyée | Alerte « à envoyer » ; rappel reçu par le militaire à J-3 |
| Rendez-vous pris pour le lendemain | Convocation reçue, rappel la veille, alerte « rendez-vous demain » |
| Clôture d'une campagne | Date d'effacement des pièces affichée ; effacement à la date prévue (essai avec `CONSERVATION_MOIS=0` sur une campagne fictive) |
| Fiche récapitulative PDF et export Excel | Documents complets et lisibles |

## Procès-verbal de recette

> **Plateforme de préparation des demandes de visa des militaires boursiers**
>
> Version recettée : commit `…………` du `…/…/……`
>
> Critères 1 à 8 : ✅ conformes / ❌ réserves (détail joint)
>
> Réserves : …………………………………………………………
>
> Décision : ☐ mise en service ☐ mise en service avec réserves ☐ ajournement
>
> Pour la DGRECM : ……………… Pour la DGSIC : ……………… Date : …/…/……
