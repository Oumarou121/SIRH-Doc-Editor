// ═══════════════════════════════════════════════════════════════
//  SIRH-Doc  shared.js  v7
//  Nouveauté : type "list-object" + syntaxe {{#tech:table}}
//  → génère un <table> automatique dont les colonnes sont les
//    clés du premier objet et les lignes les valeurs.
//  Toutes les syntaxes antérieures restent inchangées.
// ═══════════════════════════════════════════════════════════════

const STORE_KEY = "sirhdoc_v7";

// ── Migration automatique des anciennes clés ──────────────────
(function migrate() {
  try {
    if (!localStorage.getItem(STORE_KEY)) {
      const old =
        localStorage.getItem("sirhdoc_v6") ||
        localStorage.getItem("sirhdoc_v5") ||
        localStorage.getItem("sirhdoc_v4");
      if (old) {
        // Migrer les données et ajouter le nouveau type
        localStorage.setItem(STORE_KEY, old);
      }
    }
  } catch (_) {}
})();

// ═══════════════════════════════════════════════════════════════
//  DB
// ═══════════════════════════════════════════════════════════════
const DB = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || DB.seed();
    } catch (_) {
      return DB.seed();
    }
  },
  save(d) {
    localStorage.setItem(STORE_KEY, JSON.stringify(d));
    return d;
  },

  seed() {
    const now = new Date().toISOString();
    const today = new Date().toLocaleDateString("fr-FR");
    const data = {
      etablissements: [
        {
          id: "etab_1",
          nom: "ISET Tunis",
          ville: "Tunis",
          adresse: "Mont-Fleury, 1008 Tunis",
          tel: "+216 71 800 100",
        },
        {
          id: "etab_2",
          nom: "ISET Sousse",
          ville: "Sousse",
          adresse: "Route de Ceinture, 4000 Sousse",
          tel: "+216 73 200 200",
        },
      ],
      admins: [
        {
          id: "admin_1",
          nom: "Hedi Mejri",
          email: "h.mejri@iset-tunis.tn",
          etablissementId: "etab_1",
        },
        {
          id: "admin_2",
          nom: "Amira Khelil",
          email: "a.khelil@iset-sousse.tn",
          etablissementId: "etab_2",
        },
      ],
      families: [
        {
          id: "fam_1",
          nom: "Attestation de travail",
          icon: "📋",
          description: "Certifie qu'un membre du personnel est bien employé",
          sql: "SELECT * FROM personnel WHERE id = :id",
          createdAt: now,
          classes: [
            {
              nom: "Personnel",
              couleur: "#2d5be3",
              vars: [
                { tech: "nom_prenom", label: "Nom et prénom", type: "scalar" },
                {
                  tech: "date_naissance",
                  label: "Date de naissance",
                  type: "scalar",
                },
                { tech: "poste", label: "Poste occupé", type: "scalar" },
                { tech: "departement", label: "Département", type: "scalar" },
                {
                  tech: "date_embauche",
                  label: "Date d'embauche",
                  type: "scalar",
                },
                { tech: "num_cin", label: "N° CIN", type: "scalar" },
                { tech: "matricule", label: "Matricule", type: "scalar" },
              ],
            },
            {
              nom: "Enseignant",
              couleur: "#1e8a4a",
              vars: [
                { tech: "grade", label: "Grade académique", type: "scalar" },
                { tech: "specialite", label: "Spécialité", type: "scalar" },
                {
                  tech: "liste_matieres",
                  label: "Liste des matières",
                  type: "list",
                },
                // ── NOUVEAU : list-object ───────────────────────────
                {
                  tech: "liste_notes",
                  label: "Relevé de notes",
                  type: "list-object",
                  // Les colonnes à afficher (ordre + libellé affiché)
                  columns: [
                    { key: "matiere", label: "Matière" },
                    { key: "note", label: "Note /20" },
                    { key: "coef", label: "Coeff." },
                  ],
                },
              ],
            },
            {
              nom: "Établissement",
              couleur: "#7c3aed",
              vars: [
                { tech: "nom_etab", label: "Établissement", type: "scalar" },
                { tech: "ville", label: "Ville", type: "scalar" },
                { tech: "directeur", label: "Directeur", type: "scalar" },
                {
                  tech: "secretaire_general",
                  label: "Secrétaire général",
                  type: "scalar",
                },
                { tech: "adresse_etab", label: "Adresse", type: "scalar" },
                { tech: "tel_etab", label: "Téléphone", type: "scalar" },
              ],
            },
            {
              nom: "Paramètres",
              couleur: "#b45309",
              vars: [
                { tech: "date_jour", label: "Date du jour", type: "scalar" },
                {
                  tech: "annee_univ",
                  label: "Année universitaire",
                  type: "scalar",
                },
                { tech: "num_doc", label: "N° de document", type: "scalar" },
              ],
            },
          ],
        },
        {
          id: "fam_2",
          nom: "Contrat vacataire",
          icon: "📝",
          description: "Contrat de prestation pour enseignants vacataires",
          sql: "SELECT * FROM personnel WHERE id = :id",
          createdAt: now,
          classes: [
            {
              nom: "Personnel",
              couleur: "#2d5be3",
              vars: [
                { tech: "nom_prenom", label: "Nom et prénom", type: "scalar" },
                {
                  tech: "date_naissance",
                  label: "Date de naissance",
                  type: "scalar",
                },
                { tech: "num_cin", label: "N° CIN", type: "scalar" },
                { tech: "adresse", label: "Adresse", type: "scalar" },
              ],
            },
            {
              nom: "Contrat",
              couleur: "#d63b3b",
              vars: [
                { tech: "date_debut", label: "Date de début", type: "scalar" },
                { tech: "date_fin", label: "Date de fin", type: "scalar" },
                {
                  tech: "montant_total",
                  label: "Montant total",
                  type: "scalar",
                },
                {
                  tech: "liste_clauses",
                  label: "Clauses du contrat",
                  type: "list",
                },
              ],
            },
            {
              nom: "Établissement",
              couleur: "#7c3aed",
              vars: [
                { tech: "nom_etab", label: "Établissement", type: "scalar" },
                { tech: "directeur", label: "Directeur", type: "scalar" },
                { tech: "ville", label: "Ville", type: "scalar" },
              ],
            },
            {
              nom: "Paramètres",
              couleur: "#b45309",
              vars: [
                { tech: "date_jour", label: "Date du jour", type: "scalar" },
                { tech: "num_contrat", label: "N° Contrat", type: "scalar" },
              ],
            },
          ],
        },
      ],
      templates: [
        {
          id: "tpl_1",
          familyId: "fam_1",
          etablissementId: "etab_1",
          nom: "Attestation de travail (Français)",
          updatedAt: now,
          hasHeader: true,
          hasFooter: true,
          pageMargins: { mt: 20, mb: 20, ml: 25, mr: 25 },
          header: `<p style="text-align:center"><strong>{{nom_etab}}</strong></p><p style="text-align:center;font-size:10pt;color:#888">{{adresse_etab}} — Tél : {{tel_etab}}</p><p style="text-align:center;font-size:10pt;color:#aaa">Réf : {{num_doc}} — {{annee_univ}}</p>`,
          body: `<p>Nous soussignés, <strong>{{directeur}}</strong>, Directeur de <strong>{{nom_etab}}</strong>, certifions que :</p><p><br></p><p style="text-align:center"><strong>M./Mme {{nom_prenom}}</strong></p><p style="text-align:center">Né(e) le {{date_naissance}} — CIN : {{num_cin}} — Matricule : {{matricule}}</p><p><br></p><p>est employé(e) en qualité de <strong>{{poste}}</strong>, au département <strong>{{departement}}</strong>, depuis le <strong>{{date_embauche}}</strong>.</p><p><br></p><p>Matières enseignées :</p>{{#liste_matieres:ul}}<p><br></p><p>Relevé de notes :</p>{{#liste_notes:table}}<p><br></p><p>Délivrée pour servir et valoir ce que de droit.</p><p>Fait à {{ville}}, le {{date_jour}}</p><p style="text-align:right"><strong>Le Directeur</strong><br>{{directeur}}</p>`,
          footer: `<p style="text-align:center;font-size:10pt;color:#aaa">Document officiel — {{nom_etab}} — {{annee_univ}}</p>`,
        },
      ],
      personnel: [
        {
          id: "pers_1",
          etablissementId: "etab_1",
          nom_prenom: "Anis Kricha",
          date_naissance: "15/03/1985",
          poste: "Enseignant vacataire",
          departement: "Informatique",
          date_embauche: "01/09/2020",
          num_cin: "08456321",
          matricule: "ENS-2020-047",
          grade: "Assistant",
          specialite: "Génie logiciel",
          adresse: "12 Rue Alain Savary, Tunis",
          date_debut: "01/09/2025",
          date_fin: "31/08/2026",
          montant_total: "4 800,000 TND",
          num_contrat: "VAC-2025-012",
          nom_etab: "ISET Tunis",
          ville: "Tunis",
          directeur: "Prof. Mohamed Ben Ali",
          secretaire_general: "Mme. Fatma Trabelsi",
          adresse_etab: "Mont-Fleury, 1008 Tunis",
          tel_etab: "+216 71 800 100",
          date_jour: today,
          annee_univ: "2025/2026",
          num_doc: "ATT-2025-0047",
          liste_matieres: [
            "Programmation Web",
            "Base de données",
            "Réseaux informatiques",
          ],
          liste_clauses: [
            "Article 1 : Durée du contrat fixée à 1 an",
            "Article 2 : Rémunération horaire selon grille",
            "Article 3 : Respect du règlement intérieur",
          ],
          // ── NOUVEAU : list-object ──────────────────────────────
          liste_notes: [
            { matiere: "Programmation Web", note: 16, coef: 2 },
            { matiere: "Base de données", note: 14, coef: 2 },
            { matiere: "Réseaux", note: 15, coef: 1.5 },
            { matiere: "Algorithmique", note: 12, coef: 2 },
          ],
        },
        {
          id: "pers_2",
          etablissementId: "etab_1",
          nom_prenom: "Sonia Hamdi",
          date_naissance: "22/07/1979",
          poste: "Secrétaire générale",
          departement: "Administration",
          date_embauche: "15/04/2005",
          num_cin: "03829416",
          matricule: "ADM-2005-008",
          grade: "Administrateur principal",
          specialite: "Gestion",
          adresse: "45 Av. Bourguiba, Tunis",
          date_debut: "01/01/2025",
          date_fin: "31/12/2025",
          montant_total: "N/A",
          num_contrat: "N/A",
          nom_etab: "ISET Tunis",
          ville: "Tunis",
          directeur: "Prof. Mohamed Ben Ali",
          secretaire_general: "Mme. Sonia Hamdi",
          adresse_etab: "Mont-Fleury, 1008 Tunis",
          tel_etab: "+216 71 800 100",
          date_jour: today,
          annee_univ: "2025/2026",
          num_doc: "ATT-2025-0048",
          liste_matieres: [
            "Gestion administrative",
            "Communication institutionnelle",
          ],
          liste_clauses: [
            "Article 1 : Poste permanent",
            "Article 2 : Régime de retraite CNRPS",
          ],
          liste_notes: [
            { matiere: "Gestion RH", note: 17, coef: 2 },
            { matiere: "Comptabilité", note: 15, coef: 1.5 },
          ],
        },
        {
          id: "pers_3",
          etablissementId: "etab_1",
          nom_prenom: "Maher Bouaziz",
          date_naissance: "08/11/1975",
          poste: "Maître de conférences",
          departement: "Électronique",
          date_embauche: "01/09/2003",
          num_cin: "02156789",
          matricule: "ENS-2003-003",
          grade: "Maître de conférences",
          specialite: "Électronique embarquée",
          adresse: "22 Rue Ibn Khaldoun, Tunis",
          date_debut: "01/09/2025",
          date_fin: "31/08/2026",
          montant_total: "8 640,000 TND",
          num_contrat: "N/A",
          nom_etab: "ISET Tunis",
          ville: "Tunis",
          directeur: "Prof. Mohamed Ben Ali",
          secretaire_general: "Mme. Fatma Trabelsi",
          adresse_etab: "Mont-Fleury, 1008 Tunis",
          tel_etab: "+216 71 800 100",
          date_jour: today,
          annee_univ: "2025/2026",
          num_doc: "ATT-2025-0049",
          liste_matieres: [
            "Microcontrôleurs",
            "Électronique de puissance",
            "Automatique industrielle",
          ],
          liste_clauses: [
            "Article 1 : Enseignement 192h/an",
            "Article 2 : Recherche et publications",
            "Article 3 : Encadrement des PFE",
          ],
          liste_notes: [
            { matiere: "Microcontrôleurs", note: 15, coef: 3 },
            { matiere: "Électronique de puissance", note: 13, coef: 2 },
            { matiere: "Automatique", note: 14, coef: 2 },
            { matiere: "Traitement du signal", note: 12, coef: 1.5 },
          ],
        },
      ],
    };
    DB.save(data);
    return data;
  },

  // ── Accesseurs ──────────────────────────────────────────────
  getFamilies: () => DB.get().families,
  getFamily: (id) => DB.get().families.find((f) => f.id === id),
  getTemplates: (fId, eId) => {
    let t = DB.get().templates;
    if (fId) t = t.filter((x) => x.familyId === fId);
    if (eId) t = t.filter((x) => x.etablissementId === eId);
    return t;
  },
  getTemplate: (id) => DB.get().templates.find((t) => t.id === id),
  getPersonnel: (eId) => {
    let l = DB.get().personnel;
    return eId ? l.filter((p) => p.etablissementId === eId) : l;
  },
  getPerson: (id) => DB.get().personnel.find((p) => p.id === id),
  getEtablissements: () => DB.get().etablissements,
  getEtablissement: (id) => DB.get().etablissements.find((e) => e.id === id),
  getAdmins: () => DB.get().admins,
  getAdmin: (id) => DB.get().admins.find((a) => a.id === id),

  // ── Mutateurs ───────────────────────────────────────────────
  saveFamily(fam) {
    const s = DB.get();
    const i = s.families.findIndex((f) => f.id === fam.id);
    i >= 0 ? (s.families[i] = fam) : s.families.push(fam);
    DB.save(s);
    return fam;
  },
  deleteFamily(id) {
    const s = DB.get();
    s.families = s.families.filter((f) => f.id !== id);
    s.templates = s.templates.filter((t) => t.familyId !== id);
    DB.save(s);
  },
  saveTemplate(t) {
    const s = DB.get();
    const i = s.templates.findIndex((x) => x.id === t.id);
    i >= 0 ? (s.templates[i] = t) : s.templates.push(t);
    DB.save(s);
    return t;
  },
  deleteTemplate(id) {
    const s = DB.get();
    s.templates = s.templates.filter((t) => t.id !== id);
    DB.save(s);
  },
  saveEtablissement(e) {
    const s = DB.get();
    const i = s.etablissements.findIndex((x) => x.id === e.id);
    i >= 0 ? (s.etablissements[i] = e) : s.etablissements.push(e);
    DB.save(s);
    return e;
  },
  deleteEtablissement(id) {
    const s = DB.get();
    s.etablissements = s.etablissements.filter((e) => e.id !== id);
    s.admins = s.admins.filter((a) => a.etablissementId !== id);
    DB.save(s);
  },
  saveAdmin(a) {
    const s = DB.get();
    const i = s.admins.findIndex((x) => x.id === a.id);
    i >= 0 ? (s.admins[i] = a) : s.admins.push(a);
    DB.save(s);
    return a;
  },
  deleteAdmin(id) {
    const s = DB.get();
    s.admins = s.admins.filter((a) => a.id !== id);
    DB.save(s);
  },
  savePerson(p) {
    const s = DB.get();
    const i = s.personnel.findIndex((x) => x.id === p.id);
    i >= 0 ? (s.personnel[i] = p) : s.personnel.push(p);
    DB.save(s);
    return p;
  },
  deletePerson(id) {
    const s = DB.get();
    s.personnel = s.personnel.filter((p) => p.id !== id);
    DB.save(s);
  },

  // ── Résolution des colonnes d'une variable list-object ───────
  // Cherche dans toutes les familles les colonnes définies pour tech
  getListObjectColumns(tech) {
    const fams = DB.getFamilies();
    for (const fam of fams) {
      for (const cls of fam.classes || []) {
        for (const v of cls.vars || []) {
          if (v.tech === tech && v.type === "list-object" && v.columns) {
            return v.columns;
          }
        }
      }
    }
    return null;
  },
};

// ═══════════════════════════════════════════════════════════════
//  MOTEUR DE RÉSOLUTION DES VARIABLES
//
//  Syntaxes supportées :
//    {{tech}}              → scalaire
//    {{#tech:ul}}          → list (string[]) → <ul><li>…</li></ul>
//    {{#tech:inline}}      → list (string[]) → "el1, el2, el3"
//    {{#tech:table}}       → list-object     → <table> automatique
//    {{#tech:cell-expand}} → list (string[]) dans tableau :
//                            une <tr> par élément
// ═══════════════════════════════════════════════════════════════

// ── Helper : construire un <table> HTML depuis un list-object ──
// columns  = [{key, label, align?, width?, bold?}] ou null → auto
// thStyle  = styles inline appliqués aux <th> (peut venir du template Tiptap)
// preview  = true → on colore les valeurs résolues
function _buildObjectTable(
  items,
  columns,
  tech,
  preview,
  customThStyle,
  customTdStyle,
) {
  if (!items || !items.length) {
    return preview
      ? `<span style="color:#aaa;font-style:italic">(liste vide)</span>`
      : "";
  }

  // Colonnes : schéma DB > auto-détection depuis le premier objet
  const cols =
    columns && columns.length
      ? columns
      : Object.keys(items[0]).map((k) => ({ key: k, label: k }));

  // ── Styles par défaut : texte NOIR GRAS pour les en-têtes ────
  const defaultThStyle = `font-weight:700;color:#111;background:#f2f2f2;border:1px solid #c8cdd8;padding:6px 10px;text-align:left`;
  const defaultTdStyle = `color:#111;border:1px solid #c8cdd8;padding:6px 10px`;

  const thBase = customThStyle || defaultThStyle;
  const tdBase = customTdStyle || defaultTdStyle;

  const thead = `<thead><tr>${cols
    .map((c) => {
      // Alignement optionnel par colonne
      const alignExtra = c.align ? `;text-align:${c.align}` : "";
      const widthExtra = c.width ? `;width:${c.width}` : "";
      const boldExtra = c.bold === false ? `;font-weight:400` : "";
      return `<th style="${thBase}${alignExtra}${widthExtra}${boldExtra}">${_esc(c.label)}</th>`;
    })
    .join("")}</tr></thead>`;

  const rows = items.map((obj, ri) => {
    // Légère alternance de fond pour la lisibilité
    const rowBg = ri % 2 === 1 ? `background:#f9f9f9` : `background:#fff`;
    const cells = cols.map((c) => {
      const raw = obj[c.key] !== undefined ? String(obj[c.key]) : "";
      const alignExtra = c.align ? `;text-align:${c.align}` : "";
      const cell = preview
        ? `<span class="var-resolved">${_esc(raw)}</span>`
        : _esc(raw);
      return `<td style="${tdBase}${alignExtra}">${cell}</td>`;
    });
    return `<tr style="${rowBg}">${cells.join("")}</tr>`;
  });

  const tableStyle = `border-collapse:collapse;width:100%;margin:6px 0`;
  return `<table style="${tableStyle}">${thead}<tbody>${rows.join("")}</tbody></table>`;
}

// ── 0. list-object :table ─────────────────────────────────────
//
//  Deux cas :
//  A) Marqueur texte brut  {{#tech:table}}
//     → on génère le tableau complet avec les styles par défaut
//
//  B) Marqueur dans un vrai tableau Tiptap  <table>…<td>{{#tech:table}}</td>…</table>
//     → on REMPLACE la ligne modèle par autant de <tr> que d'objets,
//       en héritant des styles de la ligne modèle (couleur, gras, alignement…)
//       Les autres cellules de la ligne deviennent les libellés de colonnes
//       (en-têtes) ou restent vides.
//
//  Marqueur spécial :  {{#tech:table:header}}  dans une cellule <th>/<td>
//  signale que cette ligne EST la ligne d'en-tête Tiptap à conserver telle quelle.
//  Le marqueur  {{#tech:table:data}}  dans une <td> signale la cellule à répéter.
//
//  Syntaxe simplifiée maintenue :
//    {{#tech:table}}  hors tableau → tableau autonome (comportement précédent)
//    {{#tech:table}}  dans une cellule Tiptap → cell-expand objet (1 ligne / objet)
// ─────────────────────────────────────────────────────────────

function _resolveObjectTables(html, person, preview) {
  if (!html) return html;

  // ── Cas B : marqueur dans un <td> d'un vrai tableau Tiptap ───
  // Cherche les <tr> qui contiennent {{#tech:table}} dans une cellule.
  // On les remplace par une ligne par objet, en distribuant les valeurs
  // de l'objet dans chaque cellule selon l'ordre des colonnes définies.
  let guard = 0;
  while (guard++ < 20) {
    const m =
      /<tr([^>]*)>((?:(?!<\/tr>)[\s\S])*?\{\{#([\w]+):table\}\}(?:(?!<\/tr>)[\s\S])*?)<\/tr>/i.exec(
        html,
      );
    if (!m) break;

    const [fullTr, trAttrs, trInner, tech] = m;

    // Aperçu sans personne → placeholder coloré dans la cellule
    if (!person) {
      if (preview) {
        const ph = `<span style="color:#7c3aed;font-style:italic;background:#f3e8ff;padding:1px 5px;border-radius:3px;font-size:11px">▣ TABLE ${tech}</span>`;
        html = html.replace(fullTr, fullTr.replace(`{{#${tech}:table}}`, ph));
      }
      break;
    }

    // Extraire les cellules de la ligne modèle
    const cellRe = /<(td|th)((?:\s[^>]*)?|)>([\s\S]*?)<\/\1>/gi;
    const cells = [];
    let cm;
    while ((cm = cellRe.exec(trInner)) !== null)
      cells.push({ tag: cm[1], attrs: cm[2], content: cm[3] });

    if (!cells.length) {
      html = html.replace(fullTr, "");
      break;
    }

    const markerIdx = cells.findIndex((c) =>
      /\{\{#[\w]+:table\}\}/.test(c.content),
    );
    if (markerIdx === -1) {
      html = html.replace(fullTr, "");
      break;
    }

    const items = Array.isArray(person[tech]) ? person[tech] : [];
    const columns =
      DB.getListObjectColumns(tech) ||
      (items[0]
        ? Object.keys(items[0]).map((k) => ({ key: k, label: k }))
        : []);

    if (!items.length) {
      // Ligne vide
      let row = `<tr${trAttrs}>`;
      cells.forEach((c, i) => {
        const content =
          i === markerIdx
            ? `<em style="color:#aaa">—</em>`
            : _resolveScalars(c.content, person, preview);
        row += `<${c.tag}${c.attrs}>${content}</${c.tag}>`;
      });
      row += "</tr>";
      html = html.replace(fullTr, row);
      continue;
    }

    // Une ligne par objet — les valeurs sont réparties selon
    // l'ordre des colonnes dans la définition du schéma.
    // Si le nombre de cellules ≠ nombre de colonnes, on utilise
    // markerIdx comme cellule principale et on ignore le reste.
    let rows = "";
    items.forEach((obj) => {
      rows += `<tr${trAttrs}>`;
      cells.forEach((c, i) => {
        let content;
        if (columns.length === cells.length) {
          // Correspondance 1-1 cellule ↔ colonne
          const col = columns[i];
          const raw =
            col && obj[col.key] !== undefined ? String(obj[col.key]) : "";
          content = preview
            ? `<span class="var-resolved">${_esc(raw)}</span>`
            : _esc(raw);
        } else if (i === markerIdx) {
          // Fallback : on met toutes les valeurs dans la cellule marquée
          const raw = Object.values(obj).join(" | ");
          content = preview
            ? `<span class="var-resolved">${_esc(raw)}</span>`
            : _esc(raw);
        } else {
          content = _resolveScalars(c.content, person, preview);
        }
        rows += `<${c.tag}${c.attrs}>${content}</${c.tag}>`;
      });
      rows += "</tr>";
    });

    html = html.replace(fullTr, rows);
  }

  // ── Cas A : marqueur texte brut (hors tableau Tiptap) ────────
  html = html.replace(/\{\{#([\w]+):table\}\}/g, (match, tech) => {
    if (!person) {
      if (!preview) return match;
      // Placeholder éditeur : tableau avec th NOIR GRAS
      const cols = DB.getListObjectColumns(tech) || [];
      const headers = cols.length
        ? cols
            .map(
              (c) =>
                `<th style="font-weight:700;color:#111;background:#f2f2f2;border:1px solid #c8cdd8;padding:6px 10px">${_esc(c.label)}</th>`,
            )
            .join("")
        : `<th style="font-weight:700;color:#111;background:#f2f2f2;border:1px solid #c8cdd8;padding:6px 10px">Colonne 1</th>
           <th style="font-weight:700;color:#111;background:#f2f2f2;border:1px solid #c8cdd8;padding:6px 10px">Colonne 2</th>
           <th style="font-weight:700;color:#111;background:#f2f2f2;border:1px solid #c8cdd8;padding:6px 10px">…</th>`;
      const dataCells = cols.length
        ? cols
            .map(
              (c, i) =>
                `<td style="border:1px solid #c8cdd8;padding:6px 10px;color:#7c3aed;font-style:italic">${i === 0 ? `{{#${tech}:table}}` : ""}</td>`,
            )
            .join("")
        : `<td style="border:1px solid #c8cdd8;padding:6px 10px;color:#7c3aed;font-style:italic">{{#${tech}:table}}</td>
           <td style="border:1px solid #c8cdd8;padding:6px 10px"></td>
           <td style="border:1px solid #c8cdd8;padding:6px 10px"></td>`;
      return `<table style="border-collapse:collapse;width:100%;margin:6px 0;opacity:.6">
        <thead><tr>${headers}</tr></thead>
        <tbody><tr>${dataCells}</tr></tbody></table>`;
    }

    const items = Array.isArray(person[tech]) ? person[tech] : [];
    const columns = DB.getListObjectColumns(tech);
    return _buildObjectTable(items, columns, tech, preview);
  });

  return html;
}

// ── 1. cell-expand ────────────────────────────────────────────
function _resolveCellExpand(html, person, preview) {
  if (!html) return html;
  let guard = 0;
  while (guard++ < 20) {
    const m =
      /<tr([^>]*)>((?:(?!<\/tr>)[\s\S])*?\{\{#([\w]+):cell-expand\}\}(?:(?!<\/tr>)[\s\S])*?)<\/tr>/i.exec(
        html,
      );
    if (!m) break;
    const [fullTr, trAttrs, trInner, tech] = m;
    if (!person) {
      if (preview) {
        const ph = `<span style="color:#7c3aed;font-style:italic;background:#f3e8ff;padding:1px 5px;border-radius:3px;font-size:11px">▣ ${tech}</span>`;
        html = html.replace(
          fullTr,
          fullTr.replace(/\{\{#[\w]+:cell-expand\}\}/, ph),
        );
      }
      break;
    }
    const cellRe = /<(td|th)((?:\s[^>]*)?|)>([\s\S]*?)<\/\1>/gi;
    const cells = [];
    let cm;
    while ((cm = cellRe.exec(trInner)) !== null)
      cells.push({ tag: cm[1], attrs: cm[2], content: cm[3] });
    if (!cells.length) {
      html = html.replace(fullTr, "");
      break;
    }
    const markerIdx = cells.findIndex((c) =>
      /\{\{#[\w]+:cell-expand\}\}/.test(c.content),
    );
    if (markerIdx === -1) {
      html = html.replace(fullTr, "");
      break;
    }
    const raw = person[tech];
    // Gère string[] et object[] (prend la première valeur de l'objet)
    const items = Array.isArray(raw)
      ? raw.map((item) => {
          if (typeof item === "object" && item !== null)
            return Object.values(item).join(" | ");
          return String(item);
        })
      : [];
    if (!items.length) {
      let row = `<tr${trAttrs}>`;
      cells.forEach((c, i) => {
        const content =
          i === markerIdx
            ? `<em style="color:#aaa">—</em>`
            : _resolveScalars(c.content, person, preview);
        row += `<${c.tag}${c.attrs}>${content}</${c.tag}>`;
      });
      row += "</tr>";
      html = html.replace(fullTr, row);
      continue;
    }
    let rows = "";
    items.forEach((item) => {
      rows += `<tr${trAttrs}>`;
      cells.forEach((c, i) => {
        if (i === markerIdx) {
          const val = preview
            ? `<span class="var-resolved">${_esc(item)}</span>`
            : _esc(item);
          rows += `<${c.tag}${c.attrs}>${val}</${c.tag}>`;
        } else {
          rows += `<${c.tag}${c.attrs}>${_resolveScalars(c.content, person, preview)}</${c.tag}>`;
        }
      });
      rows += "</tr>";
    });
    html = html.replace(fullTr, rows);
  }
  return html;
}

// ── 2. ul / inline (string[]) ────────────────────────────────
function _resolveListTags(html, person, preview) {
  if (!html) return html;
  return html.replace(/\{\{#([\w]+):(ul|inline)\}\}/g, (match, tech, mode) => {
    if (!person) {
      if (!preview) return match;
      if (mode === "inline")
        return `<span style="color:#7c3aed;font-style:italic;background:#f3e8ff;padding:0 3px;border-radius:3px">[${tech}]</span>`;
      return `<ul style="opacity:.5;color:#7c3aed;margin:4px 0;padding-left:1.4em"><li style="font-style:italic">${tech} — élément 1</li><li style="font-style:italic">${tech} — élément 2</li></ul>`;
    }
    const raw = person[tech];
    const items = Array.isArray(raw)
      ? raw.map((item) => {
          if (typeof item === "object" && item !== null)
            return Object.values(item).join(" | ");
          return String(item);
        })
      : [];
    if (!items.length)
      return preview
        ? `<span style="color:#aaa;font-style:italic">(liste vide)</span>`
        : "";
    if (mode === "inline") {
      const joined = items.map(_esc).join(", ");
      return preview ? `<span class="var-resolved">${joined}</span>` : joined;
    }
    const lis = items
      .map((item) => {
        const val = _esc(item);
        return `<li>${preview ? `<span class="var-resolved">${val}</span>` : val}</li>`;
      })
      .join("");
    return `<ul style="margin:4px 0;padding-left:1.4em">${lis}</ul>`;
  });
}

// ── 3. Scalaires ──────────────────────────────────────────────
function _resolveScalars(html, person, preview) {
  if (!html) return html;
  return html.replace(/\{\{(\w+)\}\}/g, (match, k) => {
    if (!person)
      return preview
        ? `<span style="color:#2563eb;background:#eff6ff;padding:0 3px;border-radius:3px;font-style:italic">{{${k}}}</span>`
        : match;
    const val = person[k];
    if (val !== undefined && !Array.isArray(val))
      return preview
        ? `<span class="var-resolved">${_esc(String(val))}</span>`
        : _esc(String(val));
    return preview ? `<span class="var-missing">{{${k}}}</span>` : match;
  });
}

function _normalizeEditorSpacingHtml(html) {
  if (!html) return "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return html;

  root.querySelectorAll("p").forEach((p) => {
    const probe = p.cloneNode(true);
    probe.querySelectorAll("br.ProseMirror-trailingBreak").forEach((br) =>
      br.remove(),
    );

    const hasVisualContent =
      !!probe.textContent.replace(/\u00a0/g, " ").trim() ||
      !!probe.querySelector("img, table, hr, ul, ol, iframe, svg");

    if (!hasVisualContent) {
      p.innerHTML = "&nbsp;";
    }
  });

  return root.innerHTML;
}

// ── Résolution principale (ordre : table → cell-expand → ul/inline → scalaires) ──
function _resolveAll(html, person, preview) {
  if (!html) return "";
  html = _normalizeEditorSpacingHtml(html);
  html = _resolveObjectTables(html, person, preview); // 0 - NOUVEAU
  html = _resolveCellExpand(html, person, preview); // 1
  html = _resolveListTags(html, person, preview); // 2
  html = _resolveScalars(html, person, preview); // 3
  return html;
}

/** Aperçu (variables colorées) */
function resolveVars(html, person) {
  return _resolveAll(html, person, true);
}
/** Export / impression (texte pur) */
function resolveVarsRaw(html, person) {
  return _resolveAll(html, person, false);
}

// ═══════════════════════════════════════════════════════════════
//  INSERTION INTELLIGENTE dans Tiptap (admin.html)
//  Gère scalar, list, list-object
// ═══════════════════════════════════════════════════════════════
async function insertListVar(editor, varDef) {
  if (!editor || !varDef) return;

  // ── list-object → toujours :table (ou :cell-expand si dans tableau) ──
  if (varDef.type === "list-object") {
    const inCell =
      editor.isActive("tableCell") || editor.isActive("tableHeader");
    if (inCell) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: `{{#${varDef.tech}:cell-expand}}`,
          marks: [{ type: "textStyle", attrs: { color: "#7c3aed" } }],
        })
        .run();
      toast("Tableau objet inséré — cell-expand dans le tableau", "success");
    } else {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: `{{#${varDef.tech}:table}}`,
          marks: [{ type: "textStyle", attrs: { color: "#7c3aed" } }],
        })
        .run();
      toast(
        `Tableau généré automatiquement pour « ${varDef.label} »`,
        "success",
      );
    }
    return;
  }

  // ── list (string[]) → comportement d'origine ──────────────────
  const inCell = editor.isActive("tableCell") || editor.isActive("tableHeader");
  if (inCell) {
    editor
      .chain()
      .focus()
      .insertContent({
        type: "text",
        text: `{{#${varDef.tech}:cell-expand}}`,
        marks: [{ type: "textStyle", attrs: { color: "#7c3aed" } }],
      })
      .run();
    toast("Liste insérée — 1 ligne par élément dans le tableau", "success");
  } else {
    const mode = await _promptListMode(varDef.tech, varDef.label);
    if (!mode) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "text",
        text: `{{#${varDef.tech}:${mode}}}`,
        marks: [{ type: "textStyle", attrs: { color: "#7c3aed" } }],
      })
      .run();
    toast(`Liste insérée en mode « ${mode} »`, "success");
  }
}

function _promptListMode(tech, label) {
  return new Promise((resolve) => {
    const old = document.getElementById("_sirh_listModal");
    if (old) old.remove();
    const ov = document.createElement("div");
    ov.id = "_sirh_listModal";
    ov.style.cssText =
      "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);font-family:'IBM Plex Sans','Inter',sans-serif";
    ov.innerHTML = `
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:26px;width:90%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.22)">
        <div style="font-size:15px;font-weight:700;color:#1a1a1a;margin-bottom:4px">Rendu de la liste</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:20px;line-height:1.55">
          <strong style="color:#7c3aed;font-family:monospace">{{#${tech}}}</strong> est hors tableau.<br>
          Comment afficher les éléments de <em>${label}</em> ?
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
          <button data-mode="ul" style="border:2px solid #bbf7d0;border-radius:10px;padding:16px 12px;cursor:pointer;background:#f0fdf4;display:flex;flex-direction:column;align-items:center;gap:8px;color:#15803d;font-family:inherit;font-size:12px;transition:all .14s">
            <span style="font-size:22px">≡</span><strong>Liste à puces</strong>
            <span style="font-size:10px;color:#64748b;text-align:center;line-height:1.4">• élément 1<br>• élément 2</span>
          </button>
          <button data-mode="inline" style="border:2px solid #fde68a;border-radius:10px;padding:16px 12px;cursor:pointer;background:#fffbeb;display:flex;flex-direction:column;align-items:center;gap:8px;color:#92400e;font-family:inherit;font-size:12px;transition:all .14s">
            <span style="font-size:22px">…</span><strong>Inline (virgules)</strong>
            <span style="font-size:10px;color:#64748b;text-align:center;line-height:1.4">él1, él2, él3</span>
          </button>
        </div>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 13px;font-size:11px;color:#1d4ed8;margin-bottom:16px;line-height:1.5">
          💡 Pour <strong>une ligne par élément dans un tableau</strong>, placez d'abord le curseur dans une cellule, puis insérez la variable.
        </div>
        <button id="_sirh_cancel" style="width:100%;padding:9px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;cursor:pointer;font-size:12px;color:#64748b;font-family:inherit">Annuler</button>
      </div>`;
    ov.querySelectorAll("button[data-mode]").forEach((btn) => {
      btn.addEventListener("mouseenter", () => {
        btn.style.transform = "translateY(-2px)";
        btn.style.boxShadow = "0 4px 14px rgba(0,0,0,.12)";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.transform = "";
        btn.style.boxShadow = "";
      });
      btn.onclick = () => {
        ov.remove();
        resolve(btn.dataset.mode);
      };
    });
    ov.querySelector("#_sirh_cancel").onclick = () => {
      ov.remove();
      resolve(null);
    };
    document.body.appendChild(ov);
  });
}

// ═══════════════════════════════════════════════════════════════
//  CSS IMPRESSION A4
// ═══════════════════════════════════════════════════════════════
const PRINT_PAGE_CSS = `
@page { size: A4 portrait; margin: 0; }
body  { margin: 0; background: #fff; }
.a4-page {
  width: 210mm; min-height: 297mm;
  background: #fff; margin: 0 auto;
  display: flex; flex-direction: column;
  page-break-after: always; break-after: page;
}
.a4-page:last-child { page-break-after: auto; break-after: auto; }
.a4-header {
  flex-shrink: 0;
  padding: 5mm var(--page-mr, 25mm) 3mm var(--page-ml, 25mm);
  border-bottom: 1px solid #e2e8f0;
}
.a4-footer {
  flex-shrink: 0; margin-top: auto;
  padding: 3mm var(--page-mr, 25mm) 5mm var(--page-ml, 25mm);
  border-top: 1px solid #e2e8f0;
}
.a4-body {
  flex: 1;
  padding: 5mm var(--page-mr, 25mm) 5mm var(--page-ml, 25mm);
  font-family: 'Times New Roman', Times, serif;
  font-size: 12pt; line-height: 1.6; color: #111;
}
.a4-body.no-header { padding-top: var(--page-mt, 20mm); }
.a4-body.no-footer  { padding-bottom: var(--page-mb, 20mm); }
table { border-collapse: collapse; width: 100%; }
td, th {
  border: 1px solid #c8cdd8; padding: 6px 10px;
  print-color-adjust: exact; -webkit-print-color-adjust: exact;
}
td p, th p { color: inherit; }
th:not([style]) { background: #f2f2f2; color: #111; font-weight: 700; text-align: left; }
th { font-weight: 700; }
ul, ol { padding-left: 2em !important; list-style: revert !important; }
li { display: list-item !important; }
.var-resolved { color: #111 !important; font-weight: inherit !important; background: none !important; padding: 0 !important; }
.var-missing  { color: #dc2626 !important; }
.a4-hf-label, .a4-page-num, .a4-watermark { display: none !important; }
`;

// ═══════════════════════════════════════════════════════════════
//  UTILITAIRES COMMUNS
// ═══════════════════════════════════════════════════════════════
function _esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function genId(prefix) {
  return (
    prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6)
  );
}

function toast(msg, type = "") {
  let stack = document.getElementById("toastStack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toastStack";
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  const el = document.createElement("div");
  el.className = "toast" + (type ? " " + type : "");
  el.innerHTML = `<span>${{ success: "✓", error: "✕", info: "ℹ" }[type] || "●"}</span> ${msg}`;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .3s";
    setTimeout(() => el.remove(), 300);
  }, 2800);
}

function openModal(id) {
  document.getElementById(id)?.classList.add("open");
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove("open");
}

// ═══════════════════════════════════════════════════════════════
//  PAGINATION PROFESSIONNEL — Moteur complet Word-like
//  Gestion des pages A4, aperçu avec navigation, impression
// ═══════════════════════════════════════════════════════════════

/**
 * Classe PagePaginator
 * Divise le contenu HTML intelligemment en pages A4
 * Tient compte de la hauteur des headers/footers et du contenu
 */
class PagePaginator {
  constructor(opts = {}) {
    // Configuration A4 (en mm → pixels à 96 DPI)
    this.pageWidthMm = 210;
    this.pageHeightMm = 297;
    this.marginTopMm = opts.marginTop || 20;
    this.marginBottomMm = opts.marginBottom || 20;
    this.marginLeftMm = opts.marginLeft || 25;
    this.marginRightMm = opts.marginRight || 25;

    // Conversion mm → px (96 DPI standard)
    this.mmToPx = (mm) => (mm * 96) / 25.4;

    this.pageWidthPx = this.mmToPx(this.pageWidthMm);
    this.pageHeightPx = this.mmToPx(this.pageHeightMm);
    this.marginTopPx = this.mmToPx(this.marginTopMm);
    this.marginBottomPx = this.mmToPx(this.marginBottomMm);
    this.marginLeftPx = this.mmToPx(this.marginLeftMm);
    this.marginRightPx = this.mmToPx(this.marginRightMm);

    // Hauteur disponible pour le contenu (sans headers/footers)
    this.contentHeightPx =
      this.pageHeightPx - this.marginTopPx - this.marginBottomPx;

    this.pages = [];
    this.headerHeight = 0;
    this.footerHeight = 0;
  }

  _applyMeasureStyles(el) {
    if (!el) return;
    el.style.fontFamily = '"Times New Roman", Times, serif';
    el.style.fontSize = "12pt";
    el.style.lineHeight = "1.6";
    el.style.color = "#111";
  }

  _applyMeasureContentStyles(root) {
    if (!root) return;

    root.querySelectorAll("p").forEach((p) => {
      p.style.margin = "0 0 0.4em";
      if (
        !p.textContent.trim() &&
        !p.querySelector("img, table, hr, ul, ol, iframe, svg")
      ) {
        p.style.minHeight = "1.6em";
      }
    });

    const lastParagraph = root.querySelector("p:last-child");
    if (lastParagraph) lastParagraph.style.marginBottom = "0";

    root.querySelectorAll("h1").forEach((el) => {
      el.style.fontSize = "22pt";
      el.style.fontWeight = "700";
      el.style.margin = "0.8em 0 0.4em";
    });
    root.querySelectorAll("h2").forEach((el) => {
      el.style.fontSize = "18pt";
      el.style.fontWeight = "700";
      el.style.margin = "0.7em 0 0.3em";
    });
    root.querySelectorAll("h3").forEach((el) => {
      el.style.fontSize = "14pt";
      el.style.fontWeight = "700";
      el.style.margin = "0.6em 0 0.3em";
    });
    root.querySelectorAll("h4").forEach((el) => {
      el.style.fontSize = "12pt";
      el.style.fontWeight = "700";
      el.style.margin = "0.5em 0 0.2em";
    });

    root.querySelectorAll("ul").forEach((el) => {
      el.style.paddingLeft = "2em";
      el.style.margin = "0.4em 0";
      el.style.listStyleType = "disc";
    });
    root.querySelectorAll("ol").forEach((el) => {
      el.style.paddingLeft = "2em";
      el.style.margin = "0.4em 0";
      el.style.listStyleType = "decimal";
    });
    root.querySelectorAll("li").forEach((el) => {
      el.style.display = "list-item";
    });

    root.querySelectorAll("table").forEach((el) => {
      el.style.borderCollapse = "collapse";
      el.style.width = "100%";
      el.style.margin = "6px 0";
    });
    root.querySelectorAll("td, th").forEach((el) => {
      el.style.border = "1px solid #c8cdd8";
      el.style.padding = "6px 10px";
    });
    root.querySelectorAll("th:not([style])").forEach((el) => {
      el.style.background = "#f2f2f2";
      el.style.color = "#111";
      el.style.fontWeight = "700";
      el.style.textAlign = "left";
    });

    root.querySelectorAll("hr").forEach((el) => {
      el.style.border = "none";
      el.style.borderTop = "1.5px solid #c8cdd8";
      el.style.margin = "10px 0";
    });
  }

  /**
   * Pagine le contenu HTML en divisant intelligemment
   * @param {string} contentHtml - HTML du contenu principal
   * @param {string} headerHtml - HTML du header (optionnel)
   * @param {string} footerHtml - HTML du footer (optionnel)
   * @returns {Array} Array d'objects {header, content, footer}
   */
  paginate(contentHtml, headerHtml = "", footerHtml = "") {
    this.pages = [];

    // Créer un conteneur invisible pour mesurer les hauteurs
    const tempContainer = document.createElement("div");
    tempContainer.style.position = "absolute";
    tempContainer.style.visibility = "hidden";
    tempContainer.style.width = this.pageWidthPx + "px";
    tempContainer.style.left = "-99999px";
    tempContainer.style.top = "0";
    this._applyMeasureStyles(tempContainer);

    // Mesurer hauteur du header
    if (headerHtml) {
      const hdrEl = document.createElement("div");
      hdrEl.innerHTML = headerHtml;
      hdrEl.style.padding = "5mm 25mm 3mm 25mm";
      this._applyMeasureContentStyles(hdrEl);
      tempContainer.appendChild(hdrEl);
      document.body.appendChild(tempContainer);
      this.headerHeight = hdrEl.offsetHeight;
      tempContainer.removeChild(hdrEl);
    }

    // Mesurer hauteur du footer
    if (footerHtml) {
      const ftrEl = document.createElement("div");
      ftrEl.innerHTML = footerHtml;
      ftrEl.style.padding = "3mm 25mm 5mm 25mm";
      this._applyMeasureContentStyles(ftrEl);
      tempContainer.appendChild(ftrEl);
      document.body.appendChild(tempContainer);
      this.footerHeight = ftrEl.offsetHeight;
      tempContainer.removeChild(ftrEl);
    }

    document.body.removeChild(tempContainer);

    // Hauteur disponible pour le contenu = hauteur page - headers/footers
    const availableHeightPx =
      this.contentHeightPx - this.headerHeight - this.footerHeight;

    // Parser le contenu en éléments
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      `<div>${contentHtml}</div>`,
      "text/html",
    );
    const content = doc.body.firstChild;

    // Diviser les éléments enfants entre les pages
    this._distributeContent(content.children, availableHeightPx);

    // Construire les pages finales
    this.pages = this.pages.map((pageContent) => ({
      header: headerHtml,
      content: pageContent,
      footer: footerHtml,
    }));

    return this.pages;
  }

  /**
   * Distribue les éléments enfants entre les pages
   * @private
   */
  _distributeContent(elements, availableHeight) {
    let currentPageHTML = "";
    let currentPageHeight = 0;

    const tempMeasure = document.createElement("div");
    tempMeasure.style.position = "absolute";
    tempMeasure.style.visibility = "hidden";
    tempMeasure.style.left = "-99999px";
    tempMeasure.style.top = "0";
    tempMeasure.style.width =
      this.pageWidthPx - this.marginLeftPx - this.marginRightPx + "px";
    this._applyMeasureStyles(tempMeasure);
    document.body.appendChild(tempMeasure);

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (!el) continue;

      // Cloner l'élément pour mesurer
      const clone = el.cloneNode(true);
      tempMeasure.innerHTML = "";
      const wrapper = document.createElement("div");
      wrapper.style.display = "flow-root";
      wrapper.appendChild(clone);
      this._applyMeasureContentStyles(wrapper);
      tempMeasure.appendChild(wrapper);

      const elHeight = Math.max(
        wrapper.offsetHeight,
        wrapper.scrollHeight,
        clone.offsetHeight,
        clone.scrollHeight,
      );

      // Si l'élément est une table ou très grand, garder son intégrité
      const isLargeElement =
        el.tagName === "TABLE" || elHeight > availableHeight * 0.75;

      // Si ça déborde ET la page n'est pas vide, créer une nouvelle page
      if (
        currentPageHeight + elHeight > availableHeight &&
        currentPageHTML.trim() !== ""
      ) {
        this.pages.push(currentPageHTML);
        currentPageHTML = "";
        currentPageHeight = 0;
      }

      // Ajouter l'élément à la page actuelle
      currentPageHTML += el.outerHTML;
      currentPageHeight += elHeight;
    }

    // Ajouter la dernière page s'il y a du contenu
    if (currentPageHTML.trim() !== "") {
      this.pages.push(currentPageHTML);
    }

    document.body.removeChild(tempMeasure);
  }
}

// ═══════════════════════════════════════════════════════════════
//  paginateWithVariablesBlue(tpl, person)
//  Pagine le contenu avec variables en bleu (pas résolues)
//  Retourne: { pages: [...], hasHeader, hasFooter }
// ═══════════════════════════════════════════════════════════════
function paginateWithVariablesBlue(tpl, person) {
  if (!tpl || !person) return { pages: [], hasHeader: false, hasFooter: false };

  // Résoudre les variables (avec classes .var-resolved pour le bleu)
  const hdrHtml = tpl.hasHeader ? resolveVars(tpl.header || "", person) : "";
  const bHtml = resolveVars(tpl.body || "", person);
  const ftrHtml = tpl.hasFooter ? resolveVars(tpl.footer || "", person) : "";

  // Paginer le contenu
  const paginator = new PagePaginator({
    marginTop: 20,
    marginBottom: 20,
    marginLeft: 25,
    marginRight: 25,
  });

  const pages = paginator.paginate(bHtml, hdrHtml, ftrHtml);

  return {
    pages: pages,
    hasHeader: tpl.hasHeader,
    hasFooter: tpl.hasFooter,
  };
}

// ═══════════════════════════════════════════════════════════════
//  previewDocument(tpl, person)
//  Affiche un aperçu multi-pages complet avec navigation
// ═══════════════════════════════════════════════════════════════
function previewDocument(tpl, person) {
  if (!tpl || !person) {
    toast("Template ou personne manquant", "error");
    return;
  }

  const hdrRaw = tpl.hasHeader ? resolveVars(tpl.header || "", person) : "";
  const bRaw = resolveVars(tpl.body || "", person);
  const ftrRaw = tpl.hasFooter ? resolveVars(tpl.footer || "", person) : "";

  // Paginer le contenu
  const paginator = new PagePaginator({
    marginTop: 20,
    marginBottom: 20,
    marginLeft: 25,
    marginRight: 25,
  });

  const pages = paginator.paginate(bRaw, hdrRaw, ftrRaw);

  if (!pages.length) {
    toast("Aucun contenu à afficher", "error");
    return;
  }

  // Créer le modal d'aperçu
  const modal = document.createElement("div");
  modal.className = "preview-modal";
  modal.id = "pagePreviewModal";

  // CSS du modal
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    .preview-modal {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow: hidden;
    }

    .preview-modal.hidden {
      display: none;
    }

    .preview-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #fff;
      padding: 12px 20px;
      border-radius: 8px 8px 0 0;
      border-bottom: 1px solid #e0e0e0;
    }

    .preview-title {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a1a;
    }

    .preview-pageinfo {
      font-size: 12px;
      color: #666;
    }

    .preview-controls {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .preview-btn {
      padding: 6px 12px;
      border: 1px solid #ddd;
      background: #f5f5f5;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
      text-decoration: none;
      color: #333;
    }

    .preview-btn:hover {
      background: #e8e8e8;
      border-color: #bbb;
    }

    .preview-btn.primary {
      background: #2563eb;
      color: #fff;
      border-color: #2563eb;
    }

    .preview-btn.primary:hover {
      background: #1d4ed8;
    }

    .preview-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .preview-container {
      flex: 1;
      background: #e8e8e8;
      border-radius: 0 0 8px 8px;
      overflow: auto;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 20px;
    }

    .preview-page {
      width: 210mm;
      height: 297mm;
      background: white;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      flex-shrink: 0;
    }

    .preview-page-header {
      flex-shrink: 0;
      padding: 5mm 25mm 3mm 25mm;
      border-bottom: 1px solid #e2e8f0;
      font-family: "Times New Roman", Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #111;
      overflow: hidden;
    }

    .preview-page-body {
      flex: 1;
      padding: 5mm 25mm;
      font-family: "Times New Roman", Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #111;
      overflow: hidden;
    }

    .preview-page-body.no-header {
      padding-top: 20mm;
    }

    .preview-page-body.no-footer {
      padding-bottom: 20mm;
    }

    .preview-page-footer {
      flex-shrink: 0;
      padding: 3mm 25mm 5mm 25mm;
      border-top: 1px solid #e2e8f0;
      font-family: "Times New Roman", Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #111;
      overflow: hidden;
    }

    .preview-page p {
      margin: 0 0 0.4em 0;
    }

    .preview-page ul, .preview-page ol {
      padding-left: 2em;
      list-style: revert;
    }

    .preview-page table {
      border-collapse: collapse;
      width: 100%;
      margin: 6px 0;
    }

    .preview-page td, .preview-page th {
      border: 1px solid #c8cdd8;
      padding: 6px 10px;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    .preview-page td p, .preview-page th p {
      color: inherit;
    }

    .preview-page th:not([style]) {
      background: #f2f2f2;
      color: #111;
      font-weight: 700;
      text-align: left;
    }

    .preview-page th {
      font-weight: 700;
    }

    .var-resolved {
      color: #111 !important;
      font-weight: inherit !important;
      background: none !important;
      padding: 0 !important;
    }

    .var-missing {
      color: #dc2626 !important;
    }

    .preview-close {
      font-size: 20px;
      background: none;
      border: none;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .preview-close:hover {
      background: #f0f0f0;
      color: #333;
    }
  `;
  document.head.appendChild(styleEl);

  let currentPage = 0;

  const render = () => {
    const page = pages[currentPage];
    const noHdr = !tpl.hasHeader ? " no-header" : "";
    const noFtr = !tpl.hasFooter ? " no-footer" : "";

    modal.innerHTML = `
      <div class="preview-header">
        <div class="preview-title">Aperçu du document</div>
        <div class="preview-pageinfo">
          Page <strong>${currentPage + 1}</strong> sur <strong>${pages.length}</strong>
        </div>
        <div class="preview-controls">
          <button class="preview-btn" id="prevPageBtn" ${currentPage === 0 ? "disabled" : ""}>← Précédent</button>
          <button class="preview-btn" id="nextPageBtn" ${currentPage === pages.length - 1 ? "disabled" : ""}>Suivant →</button>
          <button class="preview-btn primary" id="printAllBtn">🖨 Imprimer</button>
          <button class="preview-close" id="closePreviewBtn">✕</button>
        </div>
      </div>
      <div class="preview-container">
        <div class="preview-page">
          ${page.header ? `<div class="preview-page-header">${page.header}</div>` : ""}
          <div class="preview-page-body${noHdr}${noFtr}">${page.content}</div>
          ${page.footer ? `<div class="preview-page-footer">${page.footer}</div>` : ""}
        </div>
      </div>
    `;

    // Attacher les événements
    document.getElementById("prevPageBtn")?.addEventListener("click", () => {
      if (currentPage > 0) {
        currentPage--;
        render();
      }
    });

    document.getElementById("nextPageBtn")?.addEventListener("click", () => {
      if (currentPage < pages.length - 1) {
        currentPage++;
        render();
      }
    });

    document.getElementById("printAllBtn")?.addEventListener("click", () => {
      printDocPaginated(tpl, person, pages);
    });

    document
      .getElementById("closePreviewBtn")
      ?.addEventListener("click", () => {
        modal.remove();
        styleEl.remove();
      });
  };

  document.body.appendChild(modal);
  render();
}

// ═══════════════════════════════════════════════════════════════
//  printDocPaginated(tpl, person, pages)
//  Impression avec pagination complète
// ═══════════════════════════════════════════════════════════════
function printDocPaginated(tpl, person, pages = null) {
  if (!tpl || !person) {
    toast("Template ou personne manquant", "error");
    return;
  }

  // Utiliser les pages déjà paginées ou les générer
  let pagesToPrint = pages;
  if (!pages) {
    const hdrRaw = tpl.hasHeader
      ? resolveVarsRaw(tpl.header || "", person)
      : "";
    const bRaw = resolveVarsRaw(tpl.body || "", person);
    const ftrRaw = tpl.hasFooter
      ? resolveVarsRaw(tpl.footer || "", person)
      : "";

    const paginator = new PagePaginator();
    pagesToPrint = paginator.paginate(bRaw, hdrRaw, ftrRaw);
  }

  const printCSS = `
    @page { size: A4 portrait; margin: 0; }
    * { margin: 0; padding: 0; }
    body { margin: 0; padding: 0; background: #fff; }
    #sirh-print-area { display: block; }

    .sirh-print-page {
      width: 210mm;
      height: 297mm;
      background: white;
      display: flex;
      flex-direction: column;
      page-break-after: always;
      break-after: page;
    }

    .sirh-print-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    .sirh-print-header {
      flex-shrink: 0;
      padding: 5mm 25mm 3mm 25mm;
      border-bottom: 1px solid #e2e8f0;
      font-family: "Times New Roman", Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #111;
    }

    .sirh-print-body {
      flex: 1;
      padding: 5mm 25mm;
      font-family: "Times New Roman", Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #111;
      overflow: visible;
    }

    .sirh-print-body.no-header {
      padding-top: 20mm;
    }

    .sirh-print-body.no-footer {
      padding-bottom: 20mm;
    }

    .sirh-print-footer {
      flex-shrink: 0;
      padding: 3mm 25mm 5mm 25mm;
      border-top: 1px solid #e2e8f0;
      font-family: "Times New Roman", Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #111;
    }

    .sirh-print-header p,
    .sirh-print-body p,
    .sirh-print-footer p {
      margin: 0 0 0.4em;
    }

    .sirh-print-header ul,
    .sirh-print-body ul,
    .sirh-print-footer ul,
    .sirh-print-header ol,
    .sirh-print-body ol,
    .sirh-print-footer ol {
      padding-left: 2em;
      list-style: revert;
    }

    li { display: list-item; }

    table { border-collapse: collapse; width: 100%; margin: 6px 0; }

    td, th {
      border: 1px solid #c8cdd8;
      padding: 6px 10px;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    td p, th p { color: inherit; }

    th:not([style]) {
      background: #f2f2f2;
      color: #111;
      font-weight: 700;
      text-align: left;
    }

    th { font-weight: 700; }

    .var-resolved {
      color: #111 !important;
      font-weight: inherit !important;
      background: none !important;
      padding: 0 !important;
    }

    .var-missing { color: #dc2626 !important; }
  `;

  document.getElementById("sirh-print-area")?.remove();

  const wrap = document.createElement("div");
  wrap.id = "sirh-print-area";
  wrap.style.display = "none";

  const pagesHtml = pagesToPrint
    .map((page) => {
      const noHdr = !tpl.hasHeader ? " no-header" : "";
      const noFtr = !tpl.hasFooter ? " no-footer" : "";

      return `
        <div class="sirh-print-page">
          ${page.header ? `<div class="sirh-print-header">${page.header}</div>` : ""}
          <div class="sirh-print-body${noHdr}${noFtr}">${page.content}</div>
          ${page.footer ? `<div class="sirh-print-footer">${page.footer}</div>` : ""}
        </div>
      `;
    })
    .join("");

  wrap.innerHTML = pagesHtml;

  const style = document.createElement("style");
  style.id = "sirh-print-css";
  style.media = "print";
  style.textContent = printCSS;

  const hideStyle = document.createElement("style");
  hideStyle.id = "sirh-hide-css";
  hideStyle.media = "print";
  hideStyle.textContent = `
    body > *:not(#sirh-print-area):not(#sirh-print-css):not(#sirh-hide-css) { display: none !important; }
    #sirh-print-area { display: block !important; }
  `;

  document.body.appendChild(style);
  document.body.appendChild(hideStyle);
  document.body.appendChild(wrap);

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.getElementById("sirh-print-area")?.remove();
      document.getElementById("sirh-print-css")?.remove();
      document.getElementById("sirh-hide-css")?.remove();
    }, 500);
  }, 80);
}

// ═══════════════════════════════════════════════════════════════
//  printDoc(tpl, person) — Compatibilité rétroactive
//  Utilise la nouvelle logique de pagination
// ═══════════════════════════════════════════════════════════════
function printDoc(tpl, person) {
  printDocPaginated(tpl, person);
}

// ═══════════════════════════════════════════════════════════════
//  GESTIONNAIRE DE PAGES MULTIPLES POUR L'ÉDITEUR (admin.html)
//  Gère la création automatique de pages quand le contenu dépasse A4
// ═══════════════════════════════════════════════════════════════

class EditorPageManager {
  constructor(opts = {}) {
    // Dimensions A4 (en mm)
    this.pageHeightMm = 297;
    this.pageWidthMm = 210;
    this.marginTopMm = opts.marginTop || 20;
    this.marginBottomMm = opts.marginBottom || 20;
    this.marginLeftMm = opts.marginLeft || 25;
    this.marginRightMm = opts.marginRight || 25;

    // Conversion mm → px (96 DPI)
    this.mmToPx = (mm) => (mm * 96) / 25.4;

    this.pageHeightPx = this.mmToPx(this.pageHeightMm);
    this.pageWidthPx = this.mmToPx(this.pageWidthMm);
    this.marginTopPx = this.mmToPx(this.marginTopMm);
    this.marginBottomPx = this.mmToPx(this.marginBottomMm);
    this.marginLeftPx = this.mmToPx(this.marginLeftMm);
    this.marginRightPx = this.mmToPx(this.marginRightMm);

    this.pages = [];
    this.containerWidth = 0;
    this.headerHeightPx = 0;
    this.footerHeightPx = 0;
  }

  /**
   * Initialiser les pages multiples dans le conteneur
   * @param {string} containerId - ID du div contenant le canvas
   * @param {boolean} hasHeader - Si header affiché
   * @param {boolean} hasFooter - Si footer affiché
   */
  init(containerId, hasHeader = false, hasFooter = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    this.containerId = containerId;
    const scaler = container.querySelector("#zoomScaler");
    const mainPage = container.querySelector("#mainPage");
    const secHeader = container.querySelector("#sec-header");
    const secBody = container.querySelector("#sec-body");
    const secFooter = container.querySelector("#sec-footer");

    if (!scaler || !mainPage) return;

    // Mesurer les hauteurs
    if (hasHeader && secHeader) {
      secHeader.style.display = "block";
      this.headerHeightPx = secHeader.offsetHeight;
    }

    if (hasFooter && secFooter) {
      secFooter.style.display = "block";
      this.footerHeightPx = secFooter.offsetHeight;
    }

    // Hauteur disponible pour le contenu sur une page
    this.contentHeightPx =
      this.pageHeightPx -
      this.marginTopPx -
      this.marginBottomPx -
      this.headerHeightPx -
      this.footerHeightPx;

    // Initialiser avec la première page
    this.pages = [{ id: "page_1", element: mainPage, editors: {} }];

    // Surveiller les changements de contenu
    this._watchPageOverflow();
  }

  /**
   * Surveiller le débordement de contenu et créer des pages
   * @private
   */
  _watchPageOverflow() {
    if (!this.containerId) return;

    // Surveillance tous les 500ms
    this.watchInterval = setInterval(() => {
      const scaler = document
        .getElementById(this.containerId)
        ?.querySelector("#zoomScaler");
      if (!scaler) return;

      const currentPages = scaler.querySelectorAll(".a4-page");
      let needsNewPage = false;

      // Vérifier chaque page existante
      currentPages.forEach((page, idx) => {
        const secBody = page.querySelector("#sec-body");
        if (!secBody) return;

        const contentHeight = secBody.scrollHeight;

        // Si contenu dépasse la hauteur disponible, créer nouvelle page
        if (
          contentHeight > this.contentHeightPx * 1.1 &&
          idx === currentPages.length - 1
        ) {
          needsNewPage = true;
        }
      });

      if (needsNewPage) {
        this._createNewPage();
      }
    }, 500);
  }

  /**
   * Créer une nouvelle page éditable
   * @private
   */
  _createNewPage() {
    const scaler = document
      .getElementById(this.containerId)
      ?.querySelector("#zoomScaler");
    const firstPage = scaler?.querySelector("#mainPage");
    if (!scaler || !firstPage) return;

    const pageNum = scaler.querySelectorAll(".a4-page").length + 1;
    const newPageId = `page_${pageNum}`;

    // Cloner la structure de la première page
    const newPage = firstPage.cloneNode(true);
    newPage.id = newPageId;

    // Réinitialiser les éditeurs Tiptap
    const editorElements = newPage.querySelectorAll(".tiptap-wrapper");
    editorElements.forEach((el, idx) => {
      el.innerHTML = "";
      el.id = el.id
        ? el.id.replace("ck-", `ck-page${pageNum}-`)
        : `ed-page${pageNum}-${idx}`;
    });

    // Ajouter une bordure visuelle pour délimiter les pages
    newPage.style.borderTop = "2px dashed #d0d0ca";
    newPage.style.marginTop = "10px";
    newPage.style.opacity = "0.95";

    // Ajouter au conteneur
    scaler.appendChild(newPage);

    // Stocker la page
    this.pages.push({ id: newPageId, element: newPage, editors: {} });

    // Afficher un toast
    toast(`Nouvelle page ${pageNum} créée`, "success");

    return newPageId;
  }

  /**
   * Obtenir le nombre de pages visibles
   */
  getPageCount() {
    if (!this.containerId) return 0;
    const scaler = document
      .getElementById(this.containerId)
      ?.querySelector("#zoomScaler");
    return scaler?.querySelectorAll(".a4-page").length || 0;
  }

  /**
   * Détruire l'intervalle de surveillance
   */
  destroy() {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
    }
  }
}

// Exporter globalement
window.EditorPageManager = EditorPageManager;
