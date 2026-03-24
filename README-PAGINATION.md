# 📋 SIRH-Doc v7.1 — Système de Pagination Complète

## ✅ Implémentation Terminée

Un système de pagination **professionnel et complet** pour Word (documents multi-pages A4) avec aperçu interactif et impression optimisée.

---

## 📦 Fichiers Modifiés/Créés

| Fichier                        | Type          | Description                                  |
| ------------------------------ | ------------- | -------------------------------------------- |
| [shared.js](shared.js)         | ✏️ Modifié    | Ajout des classes et fonctions de pagination |
| [admin.html](admin.html)       | ✏️ Modifié    | Ajout bouton "👁 Aperçu" + fonctions         |
| [user.html](user.html)         | ✏️ Modifié    | Ajout bouton "👁 Aperçu" pour la génération  |
| [PAGINATION.md](PAGINATION.md) | ✨ Créé       | Documentation technique complète             |
| [DEMO.html](DEMO.html)         | ✨ Créé       | Page de démo et tests interactifs            |
| README.md                      | 📄 Ce fichier | Vue d'ensemble du projet                     |

---

## 🎯 Fonctionnalités Principales

### 1. **Classe `PagePaginator`**

Moteur intelligent qui divise le contenu en pages A4.

```javascript
const paginator = new PagePaginator({
  marginTop: 20,
  marginBottom: 20,
  marginLeft: 25,
  marginRight: 25,
});

const pages = paginator.paginate(contentHtml, headerHtml, footerHtml);
// → Array[{ header, content, footer }, ...]
```

**Caractéristiques** :

- ✅ Conversion automatique mm→px (96 DPI)
- ✅ Mesure précise des hauteurs
- ✅ Intégrité des éléments (tables non-coupées)
- ✅ Répartition intelligente multi-pages

---

### 2. **Fonction `previewDocument(tpl, person)`**

Aperçu interactif multi-pages avec navigation.

```javascript
previewDocument(template, person);
```

**Interface** :

- 👁 **Aperçu** — Navigation page par page
- 🖨 **Imprimer** — Lance directement l'impression
- ✕ **Fermer** — Ferme la fenêtre

**Styles** :

- Modal fullscreen avec backdrop
- Pages à l'échelle 100% pour fidélité
- CSS A4 intégré (sans dépendances)
- Responsive et accessible

---

### 3. **Fonction `printDocPaginated(tpl, person, pages)`**

Impression multi-pages avec pagination automatique.

```javascript
// Paginé automatiquement
printDocPaginated(template, person);

// Ou avec pages pré-paginées
printDocPaginated(template, person, pagesArray);
```

**Caractéristiques** :

- ✅ Sauts de page automatiques (@page A4)
- ✅ Headers/footers répétés
- ✅ Préservation des couleurs
- ✅ CSS d'impression autonome

---

### 4. **Rétrocompatibilité**

```javascript
// Ancien code continue de fonctionner
printDoc(tpl, person); // → printDocPaginated()
```

---

## 🎨 Intégration Interface

### Admin.html

Deux nouveaux boutons dans la section **Aperçu/Impression** :

```html
<button onclick="doPreviewFromPreview()">👁 Aperçu</button>
<button onclick="doPrintFromPreview()">🖨 Imprimer</button>
```

### User.html

Intégration dans la génération de documents :

```javascript
mkBtn("👁 Aperçu", "primary", () => previewDocument(tpl, person));
mkBtn("🖨 Imprimer", "primary", () => printDocPaginated(tpl, person));
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│     Admin/User Interface                │
│   (Sélection template + personne)       │
└────────────┬────────────────────────────┘
             │
             ├──→ [Aperçu]
             │        │
             └────────┴──→ PagePaginator
                           (diviser en pages)
                                │
                        ┌───────┴──────────┐
                        ↓                  ↓
                  previewDocument()   printDocPaginated()
                        │                  │
                   Modal interactif    CSS @media print
                   Navigation pages    Sauts de page
                   [Page N sur M]       Impression auto
```

---

## 📐 Spécifications

### Dimensions A4

| Format                | Valeur                                |
| --------------------- | ------------------------------------- |
| **Page**              | 210 × 297 mm                          |
| **Marges par défaut** | 20mm (haut/bas), 25mm (gauche/droite) |
| **Résolution**        | 96 DPI (web standard)                 |

### Conversion

- **1 mm = 3.78 pixels** (96 DPI)
- Conversion automatique dans `PagePaginator.mmToPx()`

### Typographie

```css
font-family: "Times New Roman", Times, serif;
font-size: 12pt;
line-height: 1.6;
```

---

## 🚀 Utilisation Rapide

### Exemple 1 : Aperçu Simple

```javascript
const tpl = DB.getTemplate("tpl_1");
const person = DB.getPerson("pers_1");

previewDocument(tpl, person);
```

### Exemple 2 : Impression Directe

```javascript
printDocPaginated(tpl, person);
```

### Exemple 3 : Pagination Personnalisée

```javascript
const paginator = new PagePaginator({
  marginTop: 15,
  marginBottom: 15,
  marginLeft: 30,
  marginRight: 30,
});

const pages = paginator.paginate(html, hdr, ftr);
console.log(`${pages.length} page(s) générées`);
```

---

## 🧪 Tests et Démo

Fichier [DEMO.html](DEMO.html) inclut des utilitaires de test :

### Commandes Console

```javascript
demo(); // Démo complète
paginator(); // Tester PagePaginator
preview(); // Afficher aperçu
print(); // Imprimer
stats(); // Statistiques DB
```

### Exemple dans la Console

```javascript
// 1. Tester conversion mm→px
DEMO.testMMConversion();

// 2. Générer 5 pages de test
const pages = DEMO.testPaginator();
console.log(`${pages.length} pages créées`);

// 3. Afficher aperçu avec données réelles
DEMO.showPreview();
```

---

## 📖 Documentation

- **[PAGINATION.md](PAGINATION.md)** — Documentation technique détaillée
  - Classes et fonctions
  - Paramètres
  - Exemples de code
  - Dépannage

- **[DEMO.html](DEMO.html)** — Page d'expérimentation
  - Tests interactifs
  - Console JavaScript
  - Démo visuelle

---

## ✨ Points Clés

### ✅ Avant

```
Impression → Une seule page A4
Aperçu    → Format zoom sur le canvas
```

### ✅ Après (v7.1)

```
Impression → Multi-pages A4 avec pagination automatique
Aperçu    → Modal interactif avec navigation page/page
Contenu   → Div intelligente qui respecte les limites
```

---

## 🎯 Flux Utilisateur

### Aperçu Multi-Pages

```
1. Cliquer "👁 Aperçu"
2. Modal s'ouvre avec Page 1
3. Cliquer "Suivant" pour voir les autres pages
4. Numéro de page affiché (ex: "Page 2 sur 5")
5. Bouton "🖨 Imprimer" depuis l'aperçu
6. Ou fermer avec "✕"
```

### Impression

```
1. Depuis aperçu : Cliquer "🖨 Imprimer"
2. Ou directement : Cliquer "🖨 Imprimer"
3. Print dialog s'ouvre
4. Choisir imprimante/PDF
5. Pages multiples imprimées automatiquement
```

---

## 🔍 Vérification

Pour vérifier que tout fonctionne :

1. **Ouvrir admin.html ou user.html**
2. **Créer/Sélectionner un template avec texte long**
3. **Cliquer "👁 Aperçu"**
   - Modal s'ouvre
   - Navigation "Précédent/Suivant" fonctionne
   - Compteur de pages s'affiche
4. **Cliquer "🖨 Imprimer" depuis aperçu**
   - Print dialog s'ouvre
   - Aperçu PDF montre plusieurs pages
5. **Imprimer ou sauvegarder en PDF**

---

## 🐛 Dépannage Rapide

| Problème                   | Solution                                |
| -------------------------- | --------------------------------------- |
| Modal ne s'ouvre pas       | Vérifier console (F12) pour erreurs     |
| Navigation ne marche pas   | Recharger la page                       |
| Pages vides                | Vérifier que le contenu n'est pas vide  |
| Impressions se chevauchent | Vérifier marges et hauteurs             |
| CSS pas appliqué           | Vérifier que shared.js est chargé avant |

---

## 📋 Checklist Complète

- ✅ Classe `PagePaginator` implémentée
- ✅ Fonction `previewDocument()` implémentée
- ✅ Fonction `printDocPaginated()` implémentée
- ✅ Rétrocompatibilité `printDoc()` assurée
- ✅ Boutons ajoutés à admin.html
- ✅ Boutons ajoutés à user.html
- ✅ Styles CSS complets et testés
- ✅ Documentation PAGINATION.md créée
- ✅ DEMO.html pour tests créé
- ✅ README.md complet

---

## 🎓 Prochaines Améliorations

### Possibilités futures

- [ ] Numérotation automatique des pages
- [ ] En-têtes/pieds avec chiffres romains
- [ ] Export PDF côté client
- [ ] Aperçu vignettes (grid)
- [ ] Sauts de page manuels dans éditeur
- [ ] Orientation mixte (portrait/paysage)
- [ ] Watermark automatique
- [ ] Signature avant impression

---

## 📞 Support

Pour des questions ou ajustements :

1. **Consulter [PAGINATION.md](PAGINATION.md)** pour la doc technique
2. **Exécuter DEMO.html** pour tester les fonctionnalités
3. **Vérifier la console (F12)** pour les erreurs
4. **Lire les commentaires dans shared.js** pour les détails

---

**Statut** : ✅ **COMPLET ET TESTÉ**  
**Version** : 7.1  
**Date** : 2026-03-24  
**Auteur** : Système SIRH-Doc

---

## 📊 Résumé des Changements

### shared.js (+1000 lignes)

- Classe `PagePaginator` (moteur de pagination)
- Fonction `previewDocument()` (aperçu modal)
- Fonction `printDocPaginated()` (impression multi-pages)
- Rétrocompatibilité `printDoc()`

### admin.html (+15 lignes)

- Bouton "Aperçu"
- Fonction `doPreviewFromPreview()`
- Modification `doPrintFromPreview()`

### user.html (+2 lignes)

- Bouton "Aperçu" dans `generateDocument()`
- Utilisation de `printDocPaginated()`

### Nouveaux fichiers

- PAGINATION.md (documentation)
- DEMO.html (tests et démo)

---

**💡 Bon à savoir** : Tout le système est autonome (CSS intégré, pas de dépendances externes). Vous pouvez imprimer/prévisualiser sans connexion Internet.
