# 📄 Système de Pagination Professionnel — SIRH-Doc v7.1

## Vue d'ensemble

Un système de pagination **Word-like** complet pour générer, prévisualiser et imprimer des documents multi-pages avec gestion intelligente des pages A4.

---

## ✨ Nouvelles Fonctionnalités

### 1. **Classe `PagePaginator`**

Moteur intelligent de pagination qui divise le contenu HTML en pages A4.

#### Configuration

```javascript
const paginator = new PagePaginator({
  marginTop: 20, // mm
  marginBottom: 20, // mm
  marginLeft: 25, // mm
  marginRight: 25, // mm
});
```

#### Utilisation

```javascript
const pages = paginator.paginate(contentHtml, headerHtml, footerHtml);

// pages = [
//   { header: "...", content: "...", footer: "..." },
//   { header: "...", content: "...", footer: "..." },
//   ...
// ]
```

#### Caractéristiques

- ✅ **Mesure précise** des hauteurs (headers, footers, contenu)
- ✅ **Conversion mm→px** automatique (96 DPI standard)
- ✅ **Intégrité des éléments** - ne coupe pas les tables/blocs
- ✅ **Répartition intelligente** du contenu entre les pages
- ✅ **Support tables, listes, paragraphes**

---

### 2. **Fonction `previewDocument(tpl, person)`**

Affiche un aperçu interactif multi-pages avec navigation.

#### Utilisation

```javascript
previewDocument(template, person);
```

#### Interface

- **Navigation** : Boutons Précédent/Suivant
- **Indicateur** : Numéro de page (ex: "Page 2 sur 5")
- **Contrôles** :
  - 👁 **Aperçu** - Affiche l'aperçu
  - 🖨 **Imprimer** - Lance l'impression directement
  - ✕ **Fermer** - Ferme le modal

#### Styles

- Design moderne avec backdrop semi-transparent
- Pages affichées à l'échelle 100% pour fidélité
- CSS A4 intégré
- Scrollable si besoin

---

### 3. **Fonction `printDocPaginated(tpl, person, pages)`**

Impression multi-pages avec pagination automatique.

#### Utilisation

```javascript
// Impression automatique (avec paginage)
printDocPaginated(template, person);

// Impression de pages pré-paginées
printDocPaginated(template, person, pagesArray);
```

#### Paramètres

| Param    | Type   | Description                        |
| -------- | ------ | ---------------------------------- |
| `tpl`    | Object | Template avec header, body, footer |
| `person` | Object | Données personnelles à résoudre    |
| `pages`  | Array  | (Optionnel) Pages pré-paginées     |

#### CSS d'impression

- `@page` orienté A4 portrait
- Sauts de page automatiques (`page-break-after`)
- Préservation des couleurs (`print-color-adjust: exact`)
- Headers/footers répétés automatiquement

---

### 4. **Fonction `printDoc(tpl, person)` (Rétrocompatible)**

Alias qui appelle `printDocPaginated()` pour compatibilité ascendante.

---

## 🎯 Intégrations

### Admin.html

#### Boutons

```html
<button onclick="doPreviewFromPreview()">👁 Aperçu</button>
<button onclick="doPrintFromPreview()">🖨 Imprimer</button>
```

#### Fonctions JavaScript

```javascript
window.doPreviewFromPreview = function () {
  const person = DB.getPerson(selectedPersonId);
  const liveTpl = {
    /* template actuel */
  };
  previewDocument(liveTpl, person);
};

window.doPrintFromPreview = function () {
  const person = DB.getPerson(selectedPersonId);
  const liveTpl = {
    /* template actuel */
  };
  printDocPaginated(liveTpl, person);
};
```

### User.html

#### Boutons

```javascript
mkBtn("👁 Aperçu", "primary", () => previewDocument(tpl, person));
mkBtn("🖨 Imprimer", "primary", () => printDocPaginated(tpl, person));
```

---

## 📐 Spécifications Techniques

### Dimensions A4

| Propriété    | Valeur             |
| ------------ | ------------------ |
| Largeur      | 210 mm             |
| Hauteur      | 297 mm             |
| Marge haut   | 20 mm (par défaut) |
| Marge bas    | 20 mm (par défaut) |
| Marge gauche | 25 mm (par défaut) |
| Marge droite | 25 mm (par défaut) |

### Résolution

- **Base** : 96 DPI (standard web)
- **Conversion** : 1 mm = 96/25.4 ≈ 3.78 px

### Polices

```css
font-family: "Times New Roman", Times, serif;
font-size: 12pt;
line-height: 1.6;
```

---

## 🔄 Flux de Génération

```
Contenu HTML brut
        ↓
   [PagePaginator]
        ↓
Pages divisées (array)
        ↓
    ┌───┴───┐
    ↓       ↓
[Aperçu] [Impression]
```

### Aperçu

1. Paginer le contenu
2. Créer modal avec CSS intégré
3. Afficher page 1
4. Écouter navigation
5. Afficher les pages successives

### Impression

1. Paginer le contenu
2. Générer HTML pour chaque page
3. Injecter CSS @media print
4. Masquer les éléments non-impression
5. Lancer `window.print()`
6. Nettoyer le DOM

---

## 🎨 Customisation

### Marges personnalisées

```javascript
const paginator = new PagePaginator({
  marginTop: 15,
  marginBottom: 15,
  marginLeft: 30,
  marginRight: 30,
});
```

### Styles personnalisés

Si vous modifiez le CSS dans `previewDocument()` ou `printDocPaginated()`, les nouvelles règles s'appliqueront automatiquement à tous les documents.

### Hauteurs de headers/footers

Le `PagePaginator` mesure automatiquement :

- Hauteur du header HTML
- Hauteur du footer HTML
- Calcule l'espace disponible = hauteur page - headers - footers

---

## 🐛 Dépannage

### Problèmes courants

#### ❌ "Contenu coupé à travers les pages"

**Solution** : Les tables et blocs larges ne sont pas coupés. Le paginator vérifie :

- Si élément > 75% hauteur page → création nouvelle page
- Tables restent intègres

#### ❌ "Aperçu ne s'affiche pas"

**Vérifier** :

- Template valide avec body non-vide
- Personne sélectionnée
- Console pour erreurs JavaScript

#### ❌ "Impression ne respecte pas A4"

**Solution** :

- Vérifier marges configurées
- Les dimensions A4 sont en mm (conversion auto en px)
- CSS @page forcé à A4 portrait

#### ❌ "Headers/footers répétés incorrectement"

**Solution** :

- Ajuster `tpl.hasHeader` et `tpl.hasFooter`
- Si vides, les sections sont omises automatiquement
- Vérifier hauteur des headers (ne doit pas dépasser ~40mm)

---

## 📊 Exemple Complet

```javascript
// 1. Créer template
const template = {
  header: "<h2>Entreprise ACME</h2>",
  body: "<p>Contenu du document...</p>",
  footer: "<p>Page {num}</p>",
  hasHeader: true,
  hasFooter: true,
};

// 2. Créer personne
const person = {
  nom_prenom: "John Doe",
  poste: "Développeur",
  // ... autres propriétés
};

// 3. Afficher aperçu
previewDocument(template, person);

// Ou imprimer directement
printDocPaginated(template, person);
```

---

## 🔐 Notes de sécurité

- Le contenu HTML est échappé avant résolution des variables
- Variables non-résolues sont marquées en rouge (`.var-missing`)
- Pas d'injection de code externe
- Tout le CSS est encapsulé dans le modal/impression

---

## 📋 Checklist d'implémentation

- ✅ Classe `PagePaginator` créée
- ✅ Fonction `previewDocument()` implémentée
- ✅ Fonction `printDocPaginated()` implémentée
- ✅ Rétrocompatibilité `printDoc()` assurée
- ✅ Boutons ajoutés à admin.html
- ✅ Boutons ajoutés à user.html
- ✅ Styles CSS complets
- ✅ Documentation complète

---

## 🚀 Prochaines Améliorations Possibles

- [ ] Numérotation automatique des pages
- [ ] En-têtes/pieds de page avec numéros
- [ ] Export PDF côté client
- [ ] Aperçu en grille (vignettes)
- [ ] Sauts de page manuels dans l'éditeur
- [ ] Styles de pied de page par page
- [ ] Signature/validation avant impression

---

**Version** : 7.1  
**Dernière mise à jour** : 2026-03-24  
**Auteur** : Système SIRH-Doc
