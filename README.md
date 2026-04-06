# SIRH-Doc Editor

SIRH-Doc Editor est un éditeur de documents administratifs basé sur des templates HTML/Tiptap et alimenté par SQL Server.

Le projet permet de :
- définir des familles de documents
- créer des templates par établissement
- générer des documents à partir des données SQL Server
- prévisualiser et imprimer les documents
- appliquer des filtres métier avant aperçu et impression

## Vue d'ensemble

Le projet repose sur 3 interfaces principales :

- [superAdmin.html](/C:/Users/oumar/Documents/HTML/Editor/superAdmin.html) : configuration globale
- [admin.html](/C:/Users/oumar/Documents/HTML/Editor/admin.html) : édition des templates et aperçu
- [user.html](/C:/Users/oumar/Documents/HTML/Editor/user.html) : utilisation finale pour générer les documents

Le backend est dans [server.js](/C:/Users/oumar/Documents/HTML/Editor/server.js), la logique partagée dans [shared.js](/C:/Users/oumar/Documents/HTML/Editor/shared.js), et la structure SQL minimale dans [schema.sql](/C:/Users/oumar/Documents/HTML/Editor/schema.sql).

## Installation

Pré-requis :
- Node.js
- SQL Server
- une configuration de connexion SQL Server valide côté serveur

Installation :

```bash
npm install
npm start
```

Le serveur démarre ensuite sur :

```text
http://localhost:3000
```

Pages principales :
- `http://localhost:3000/superAdmin.html`
- `http://localhost:3000/admin.html`
- `http://localhost:3000/user.html`

## Structure du projet

- [server.js](/C:/Users/oumar/Documents/HTML/Editor/server.js) : serveur HTTP, bootstrap, lecture/écriture SQL Server, API
- [shared.js](/C:/Users/oumar/Documents/HTML/Editor/shared.js) : état applicatif, exécution des requêtes, rendu de documents, pagination, filtres
- [schema.sql](/C:/Users/oumar/Documents/HTML/Editor/schema.sql) : création/mise à jour des tables internes du projet
- [superAdmin.html](/C:/Users/oumar/Documents/HTML/Editor/superAdmin.html) : configuration familles, variables, filtres, requêtes
- [admin.html](/C:/Users/oumar/Documents/HTML/Editor/admin.html) : édition des templates et aperçu
- [user.html](/C:/Users/oumar/Documents/HTML/Editor/user.html) : sélection document, filtres, bénéficiaires, impression
- [PAGINATION.md](/C:/Users/oumar/Documents/HTML/Editor/PAGINATION.md) : détails sur la pagination
- [README-PAGINATION.md](/C:/Users/oumar/Documents/HTML/Editor/README-PAGINATION.md) : complément sur le moteur de pagination

## Modèle métier

### Établissement

Un établissement porte :
- son identité
- ses informations de contact
- ses chartes graphiques

### Famille de documents

Une famille représente un type de document ou une famille métier.

Exemples :
- attestation de travail
- liste des enseignants
- liste des vacataires

Une famille contient notamment :
- une cible de document : `table` ou `etablissement`
- une table bénéficiaire si la cible est `table`
- un `SELECT bénéficiaires`
- un `SELECT principal`
- des classes et variables
- un catalogue de filtres

### Template

Un template est la mise en page éditable d’un document pour un établissement donné.

Un template contient :
- le header
- le body
- le footer
- l’orientation
- les marges
- la charte graphique
- l’activation des filtres de la famille

## Rôles et responsabilités

### Super Admin

Le super admin :
- configure les familles
- choisit la table principale
- choisit la table bénéficiaire
- génère les variables depuis le schéma SQL
- configure les filtres de famille
- définit les correspondances manuelles entre tables si besoin
- choisit les colonnes affichées pour les bénéficiaires

### Admin

L’admin :
- crée et modifie les templates
- active ou désactive les filtres pour chaque template
- fixe des valeurs par défaut
- verrouille des filtres si nécessaire
- prévisualise et imprime les documents

### User

L’utilisateur final :
- choisit une famille
- choisit un template
- remplit les filtres autorisés
- choisit le bénéficiaire si nécessaire
- prévisualise et imprime le document

## Logique des données

### 1. Cible du document

Deux modes existent :

- `etablissement`
- `table`

En mode `etablissement` :
- aucun bénéficiaire individuel n’est demandé
- le document est généré à partir du contexte établissement

En mode `table` :
- une table bénéficiaire est utilisée
- une liste de bénéficiaires est affichée à l’admin et au user

### 2. Affichage des bénéficiaires

Quand la cible est `table`, le super admin peut choisir :
- `colonne affichage 1`
- `colonne affichage 2`

Exemple :
- `Nom`
- `Prenom`

Le système affiche alors :

```text
BEN AMOR Anouar
```

au lieu de :

```text
80
```

### 3. Variables

Les variables sont générées depuis le schéma SQL Server.

Types principaux :
- variable simple
- liste
- tableau objet

Exemples :
- `{{nom}}`
- `{{grade}}`
- `{{#anneeunivenseignant_table:table}}`

### 4. Table principale et tables secondaires

Dans l’assistant du super admin :
- une seule table est définie comme `table principale`
- les autres tables sont ajoutées manuellement comme `tables secondaires`

Cela permet :
- d’éviter une liste trop longue de toutes les tables
- de garder une base métier stable
- d’ajouter seulement les tables utiles

### 5. Jointures et correspondances manuelles

Deux cas sont possibles pour récupérer une donnée depuis une table secondaire.

Cas 1 : jointure détectée dans le schéma
- le système peut utiliser la jointure automatiquement

Cas 2 : pas de jointure détectée
- le super admin peut définir une correspondance manuelle

Exemple :
- table principale : `AnneeUnivEnseignant`
- table secondaire : `Grade`
- colonne table principale : `Grade`
- colonne table secondaire : `CodeUnivad`

Cela permet de récupérer le libellé du grade même sans clé étrangère déclarée dans SQL Server.

### 6. Libellés depuis une table de référence

Pour les variables de type `TABLE`, une colonne peut afficher :
- la valeur source
- ou un libellé depuis une table externe

Exemple :
- valeur stockée : `CTR`
- table de référence : `Status`
- colonne code : `CodeUnivad`
- colonne libellé : `LibelleFr`

Résultat affiché :

```text
Contractuel
```

au lieu de :

```text
CTR
```

## Système de filtres

Le système de filtres est organisé en 3 niveaux.

### Niveau 1 : catalogue de filtres au niveau famille

Défini par le super admin.

Chaque filtre peut contenir :
- une clé SQL
- un libellé
- un type : `text`, `number`, `date`, `select`
- une source de valeurs : statique ou SQL
- des rôles autorisés : `admin`, `user`
- une liaison optionnelle avec une colonne de la table principale

### Niveau 2 : activation/preset au niveau template

Défini par l’admin.

Par template, l’admin peut :
- activer ou désactiver un filtre
- l’autoriser côté admin
- l’autoriser côté user
- le rendre obligatoire
- le verrouiller
- fixer une valeur par défaut
- limiter les valeurs autorisées

### Niveau 3 : saisie au runtime

Utilisé par l’admin et le user au moment de :
- l’aperçu
- l’impression

Les valeurs saisies sont injectées comme paramètres SQL dans les requêtes.

## Requêtes SQL

Le projet utilise principalement 2 requêtes côté famille :

### SELECT bénéficiaires

Utilisé pour afficher la liste des bénéficiaires avant génération.

Il doit idéalement retourner :
- `id`
- `libelle`
- éventuellement `sous_libelle`

### SELECT principal

Utilisé pour récupérer toutes les données du document.

Il peut utiliser :
- `:beneficiaryId`
- `:etablissementId`
- les paramètres de filtres comme `:grade`, `:statut`, `:annee`

## Workflow recommandé

### Pour créer un nouveau document

1. Créer une famille dans le `superAdmin`
2. Choisir la cible du document
3. Choisir la table bénéficiaire si besoin
4. Choisir les colonnes affichées pour le bénéficiaire
5. Définir la table principale
6. Ajouter les tables secondaires utiles
7. Générer les variables
8. Définir les liaisons automatiques ou manuelles
9. Définir les filtres de la famille
10. Créer un template dans l’`admin`
11. Activer les filtres nécessaires dans le template
12. Tester l’aperçu puis l’impression

## Conseils pratiques

- Garde une seule vraie table principale par famille.
- Ajoute seulement les tables secondaires nécessaires.
- Utilise une correspondance manuelle quand SQL Server n’expose pas de relation.
- Pour les listes de bénéficiaires, configure toujours les colonnes d’affichage.
- Si le contenu change fortement, crée un nouveau template.
- Si seule la population de données change, utilise plutôt les filtres.

## Notes techniques

- le serveur applique [schema.sql](/C:/Users/oumar/Documents/HTML/Editor/schema.sql) au démarrage
- certaines évolutions récentes ajoutent des colonnes à la table `family`
- après une modification de schéma, redémarrer `npm start`
- après une grosse mise à jour front, faire un vrai refresh navigateur

## Documentation complémentaire

- [EDITOR-PAGES.md](/C:/Users/oumar/Documents/HTML/Editor/EDITOR-PAGES.md)
- [PAGINATION.md](/C:/Users/oumar/Documents/HTML/Editor/PAGINATION.md)
- [README-PAGINATION.md](/C:/Users/oumar/Documents/HTML/Editor/README-PAGINATION.md)

## État actuel

Le projet supporte déjà :
- génération de documents par établissement
- génération de documents par bénéficiaire
- variables simples, listes et tableaux objet
- correspondances manuelles entre tables
- libellés depuis tables de référence
- catalogue de filtres au niveau famille
- activation des filtres au niveau template
- utilisation des filtres côté admin et user

Si besoin, le README peut encore être enrichi avec :
- des captures d’écran
- des exemples SQL complets
- un guide pas à pas pour un cas métier précis
- une section dépannage
