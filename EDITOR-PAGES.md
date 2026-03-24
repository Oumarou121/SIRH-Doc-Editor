# 📄 Gestion des Pages Multiples dans l'Éditeur Admin — Mise à Jour v7.2

## ✅ Problème Résolu

**Avant** : Quand vous écriviez dans l'éditeur et que le texte dépassait une page A4, le contenu le plus haut disparaissait visuellement et aucune nouvelle page n'était créée.

**Après** :

- ✅ Le contenu déborde naturellement sur les pages suivantes
- ✅ Des délimiteurs visuels (lignes tiretées) montrent les limites des pages A4
- ✅ Chaque section est éditable comme avant
- ✅ L'impression et l'aperçu gèrent automatiquement la pagination

---

## 🔧 Implémentation

### 1. **EditorPageVisualizer** (shared.js)

Nouvelle classe qui :

- Affiche les délimiteurs visuels des pages A4 dans l'éditeur
- Calcule la hauteur disponible (page height - headers - footers)
- Génère des lignes tiretées qui montrent où les pages se divisent
- Peut diviser le contenu en pages si nécessaire

```javascript
const visualizer = new EditorPageVisualizer();
visualizer.init("#sec-body", headerHeight, footerHeight);
```

### 2. **CSS Modifié** (admin.html)

```css
#sec-body {
  overflow-y: auto; /* ← Permet le défilement vertical */
  overflow-x: hidden;
  position: relative; /* ← Pour les délimiteurs absolus */
}

.tiptap-wrapper .ProseMirror {
  height: auto; /* ← S'adapte au contenu */
  min-height: 40px;
}

.editor-page-break {
  /* Ligne tiretée délimitant les pages */
  background: repeating-linear-gradient(
    90deg,
    #e2e8f0 0,
    #e2e8f0 8px,
    transparent 8px,
    transparent 16px
  );
}
```

### 3. **Initialisation** (admin.html)

Dans `buildEditorUI()`, après la création des éditeurs :

```javascript
// Créer le visualizer de pages
window.pageVisualizer = new EditorPageVisualizer({
  marginTop: 20,
  marginBottom: 20,
  marginLeft: 25,
  marginRight: 25,
});

// L'initialiser avec les hauteurs réelles
visualizer.init("#sec-body", headerHeight, footerHeight);
```

---

## 📐 Dimensions Utilisées

| Élément             | Valeur                                |
| ------------------- | ------------------------------------- |
| **Page A4**         | 210 × 297 mm                          |
| **Marges**          | 20mm (haut/bas), 25mm (gauche/droite) |
| **Hauteur contenu** | 297 - 20 - 20 = 257 mm (~687 px)      |
| **Résolution**      | 96 DPI (standard web)                 |

Les délimiteurs sont positionnés tous les **~687px**.

---

## 🎯 Flux d'Utilisation

### Dans l'Éditeur

```
1. Ouvrir un template
2. Écrire du contenu dans le corps
3. Voir les lignes tiretées indiquant les limites des pages
4. Continuer à écrire → le contenu déborde naturellement sur la page 2, 3, etc.
5. Les délimiteurs se mettent à jour automatiquement
```

### Aperçu

```
1. Quand on clique "👁 Aperçu"
2. Le contenu du gros éditeur est récupéré
3. PagePaginator le divise automatiquement en pages
4. Modal affiche page par page
```

### Impression

```
1. Quand on clique "🖨 Imprimer"
2. Le contenu est divisé en pages
3. Impression multi-pages automatique
4. Chaque page A4 imprimée correctement
```

---

## 🔄 Cycle de Vie

### À l'ouverture d'un template

```
buildEditorUI()
  ├─ destroyEditors() [ancien visualizer]
  ├─ Créer nouveaux éditeurs Tiptap
  ├─ Créer nouveau EditorPageVisualizer
  └─ Initialiser visualizer.init()
     ├─ Calculer hauteurs (header + footer)
     ├─ Calculer hauteur disponible
     └─ Ajouter délimiteurs visuels
```

### Quand header/footer change

```
updateSectionVisibility()
  └─ visualizer.destroy()
  └─ visualizer.init() [avec nouvelles hauteurs]
```

### À la destruction

```
destroyEditors()
  ├─ Détruire éditeurs Tiptap
  └─ Détruire visualizer → nettoyer les délimiteurs
```

---

## 🎨 Visuellement

L'éditeur affiche maintenant ceci :

```
┌─────────────────────────────────────┐
│ PAGE 1 (contenu)                    │
│ - - - - - - - - - - - - - - - - - - │ ← Délimiteur Page 2
│ - - - - - - - - - - - - - - - - - - │ ← Délimiteur Page 3
│ - - - - - - - - - - - - - - - - - - │ ← Délimiteur Page 4
│ PAGE 2 (contenu continue)           │
│ PAGE 3 (contenu continue)           │
└─────────────────────────────────────┘
```

Les délimiteurs :

- Sont des lignes tiretées gris clair
- Montrent le numéro de la page (2, 3, 4...)
- Sont non-interactifs (`pointer-events: none`)
- Se mettent à jour automatiquement

---

## 🚀 Avantages

| Avant                          | Après                          |
| ------------------------------ | ------------------------------ |
| Contenu disparaît visuellement | Contenu déborde naturellement  |
| Pas de limite visible          | Limites A4 claires             |
| Surprise à l'impression        | Pages correspondent exactement |
| Édition confuse                | Édition intuitives comme Word  |
| Une seule page affichée        | Plusieurs pages visibles       |

---

## ⚡ Performance

- ✅ **Pas de re-render** pendant la frappe (délimiteurs en CSS)
- ✅ **Surveillan ce légère** (50ms après changements)
- ✅ **Pas d'impact** sur les performances de Tiptap
- ✅ **Cleanup automatique** lors de destruction

---

## 🔍 Détection des Pages

Le système détecte automatiquement :

```javascript
const pageCount = window.pageVisualizer.getPageCount();
// Retourne le nombre de pages du contenu actuel
```

Utile pour afficher : _"5 pages, 2500 mots"_ dans la barre de statut.

---

## 🛠️ Customisation

Pour modifier les marges :

```javascript
const viz = new EditorPageVisualizer({
  marginTop: 15, // Changei
  marginBottom: 15, // Changé
  marginLeft: 30,
  marginRight: 30,
});
```

Pour changer l'apparence des délimiteurs, modifier le CSS :

```css
.editor-page-break {
  background: repeating-linear-gradient(
    90deg,
    #YOUR_COLOR 0,
    #YOUR_COLOR 8px,
    transparent 8px,
    transparent 16px
  );
}
```

---

## 📝 Résumé des Changements

### shared.js (+150 lignes)

- Classe `EditorPageVisualizer`
- Méthode `splitIntoPages()` pour diviser le contenu
- Gestion des délimiteurs visuels

### admin.html (+50 lignes)

- CSS pour délimiteurs et pages multiples
- Initialisation du visualizer dans `buildEditorUI()`
- Mise à jour du visualizer dans `updateSectionVisibility()`
- Cleanup dans `destroyEditors()`
- Recalcul dans `switchSection()`

---

## ✅ Checklist

- ✅ Délimiteurs visuels A4 dans l'éditeur
- ✅ Contenu déborde naturellement
- ✅ Clik "Aperçu" divise en pages
- ✅ Impression multi-pages automatique
- ✅ Headers/footers respectés
- ✅ Éditable partout
- ✅ Performance optimale
- ✅ Cleanup automatique

---

**Status** : ✅ **COMPLET**  
**Version** : 7.2  
**Date** : 2026-03-24
