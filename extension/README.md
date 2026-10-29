# Extension « Visa DGRECM – Remplisseur » (Chrome et Edge)

Remplit les formulaires officiels de demande de visa à partir des dossiers **validés** de la plateforme :

- **Chine** : COVA, `consular.mfa.gov.cn` (formulaire Vue 2 + Element UI) ;
- **Russie** : kdmid, `visa.kdmid.ru` (formulaire ASP.NET WebForms).

L'agent garde la main : il vérifie chaque page, résout le captcha, téléverse les pièces et soumet lui-même. L'extension ne clique jamais sur « Suivant », « Enregistrer » ni « Soumettre ».

## Installer (poste d'un agent)

1. Construire l'extension (une fois par version) :

   ```bash
   pnpm --filter @visa/extension build
   ```

2. Dans Chrome ou Edge, ouvrir `chrome://extensions` (ou `edge://extensions`), activer le **mode développeur**, cliquer **Charger l'extension non empaquetée** et choisir le dossier `extension/dist`. Après une nouvelle version : bouton ↻ de l'extension, puis recharger les onglets des sites officiels.
3. Cliquer sur l'icône de l'extension, puis ⚙ : saisir l'adresse de l'API de la plateforme (par défaut `http://localhost:3200/api`) et accepter l'autorisation demandée.
4. Se connecter avec son compte de la plateforme (même mot de passe, même code de double authentification).

Pour un déploiement sur tous les postes, la DGSIC peut imposer l'extension par stratégie de groupe Windows (pas besoin du Chrome Web Store).

## 1. Relever les champs du site (une fois, puis à chaque changement du site)

Les formulaires officiels changent sans prévenir : l'extension ne contient aucune liste de champs figée. Un agent, sur le site officiel :

1. ouvre chaque page du formulaire de demande ;
2. clique **Relever les champs de cette page** ;
3. pour les sections qui n'apparaissent qu'après un choix (conjoint si « marié », visas antérieurs si « oui »…), fait ce choix puis relève de nouveau la page.

Chaque champ est enregistré avec son libellé, son type (texte, liste, date, choix, case…), son caractère **obligatoire ou facultatif** et, pour les listes, tous les choix proposés par le site. Aucune donnée de dossier n'est envoyée pendant un relevé.

**kdmid** : choisir la langue **Français** au début du formulaire (les propositions automatiques fonctionnent aussi en anglais et en russe, mais il faut garder la même langue pour le relevé et le remplissage). Pour une liste qui dépend d'une autre (ville après pays), choisir d'abord la première puis relever de nouveau la page : les choix de la seconde sont alors enregistrés.

## 2. Relier les champs (plateforme → « Correspondances COVA » ou « Correspondances kdmid »)

Pour chaque champ relevé, la gestion choisit :

- **Réponse du dossier** : la question du dossier à recopier (proposée automatiquement d'après le libellé, en français, anglais, chinois ou russe : à vérifier) ;
- **Valeur fixe** : la même pour tous (ex. objet du voyage) ;
- **Ignorer** : jamais rempli ;
- **Conversions** pour les listes : `MASCULIN = 1` (sinon le choix est cherché par son libellé ; un pays ou une nationalité est retrouvé en français, en anglais ou en russe : `GUINEE`, `GUINEAN` → `GUINEA`, `ГВИНЕЯ`) ;
- **Format de date** : pour une date saisie en texte (`dd.MM.yyyy`, détecté quand le site affiche « jj.mm.aaaa ») ou pour une date en trois listes séparées (`dd` ou `d` pour le jour, `MM` ou `M` pour le mois, `yyyy` pour l'année) ;
- **Remplir** : coché d'office pour les champs obligatoires, à cocher pour un champ facultatif que l'on veut aussi remplir.

## 3. Remplir une demande

1. Sur le site officiel, ouvrir la page du formulaire.
2. Dans l'extension, choisir le dossier (ses dossiers « en saisie », puis les dossiers validés), puis le mode :
   - **Obligatoires + champs cochés** (réglages de la gestion) ;
   - **Obligatoires seulement**.
3. Cliquer **Remplir cette page**. Le dossier passe « En saisie » et vous est attribué.
   - encadré **vert** : rempli par l'extension ;
   - encadré **rouge pointillé** : obligatoire à saisir vous-même (réponse absente du dossier, choix introuvable, champ pas encore relié) ;
   - un champ facultatif non coché, ou déjà rempli sur la page, n'est jamais touché.
4. **kdmid : listes qui rechargent la page.** Certaines listes du site (pays, type de visa…) rechargent la page dès qu'on les change. L'extension remplit d'abord tous les autres champs, puis pose **une seule** de ces listes en dernier. La page se recharge, les valeurs déjà saisies restent : cliquez de nouveau **Remplir cette page** pour la suite (listes dépendantes, autres listes de ce genre). Répétez jusqu'à ce que l'extension n'annonce plus de rechargement.
5. Vérifier, compléter, passer à la page suivante, recommencer.
6. Les pièces (photo, passeport…) sont téléchargeables dans l'extension, déjà au format du site.
7. Après la soumission sur le site officiel, saisir le **numéro de demande** et cliquer **Marquer soumis**.

Chaque relevé et chaque page remplie sont inscrits au journal d'audit.

## Fonctionnement technique

- `src/moteur/element.ts` : formulaires Vue 2 / Element UI (COVA), par les composants de la page (monde « MAIN »).
- `src/moteur/natif.ts` : formulaires HTML ordinaires (kdmid) : libellé lu dans l'élément voisin (`<span class="Label">`, cellule précédente), obligation lue sur la marque « * » (`RequiredFieldMark`), les validateurs ASP.NET (`Page_Validators`) ou `required`, dates en texte reconnues par leur indication de format ou leur masque `__.__.____`, listes `postback-dropdown` / `__doPostBack` posées en dernier, une par clic.
- `src/pont.ts` : relais entre la fenêtre de l'extension et la page.
- `src/popup/` : fenêtre de l'extension ; `src/commun/valeurs.ts` : conversion des réponses (listes, dates, pays et nationalités), testée sans navigateur.
- Jetons en mémoire de session du navigateur (effacés à sa fermeture) ; aucune donnée de dossier n'est conservée par l'extension.

## Essais

```bash
pnpm --filter @visa/extension test
```

Les tests utilisent deux formulaires **fictifs**, qui ne reproduisent pas les sites officiels : `essai/formulaire.js` (vrais Vue 2 + Element UI, construit comme COVA) et `essai/webforms.html` (construit comme un formulaire ASP.NET WebForms, avec une liste qui recharge la page et une liste en cascade). Pour les voir dans un navigateur :

```bash
pnpm --filter @visa/extension build
```

```bash
pnpm --filter @visa/extension essai
```

puis ouvrir http://localhost:4100 (Element UI) ou http://localhost:4100/webforms (WebForms). Autre port : variable `PORT`.
