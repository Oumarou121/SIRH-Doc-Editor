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
// columns = [{key, label}] (peut être null → auto-détection)
// preview = true → on colore les cellules
function _buildObjectTable(items, columns, tech, preview) {
  if (!items || !items.length) {
    return preview
      ? `<span style="color:#aaa;font-style:italic">(liste vide)</span>`
      : "";
  }

  // Si les colonnes ne sont pas définies dans le schéma, on les
  // déduit automatiquement depuis les clés du premier objet.
  const cols =
    columns && columns.length
      ? columns
      : Object.keys(items[0]).map((k) => ({ key: k, label: k }));

  const thStyle = preview
    ? `background:#eef2ff;color:#1d4ed8;font-weight:600;border:1px solid #c8cdd8;padding:6px 10px;text-align:left`
    : `background:#eef2ff;color:#1d4ed8;font-weight:600;border:1px solid #c8cdd8;padding:6px 10px;text-align:left`;
  const tdStyle = `border:1px solid #c8cdd8;padding:6px 10px`;
  const trEvenStyle = preview ? `background:#f8faff` : `background:#f8faff`;

  const thead = `<thead><tr>${cols.map((c) => `<th style="${thStyle}">${_esc(c.label)}</th>`).join("")}</tr></thead>`;

  const rows = items.map((obj, ri) => {
    const rowStyle = ri % 2 === 1 ? ` style="${trEvenStyle}"` : "";
    const cells = cols.map((c) => {
      const raw = obj[c.key] !== undefined ? String(obj[c.key]) : "";
      const cell = preview
        ? `<span class="var-resolved">${_esc(raw)}</span>`
        : _esc(raw);
      return `<td style="${tdStyle}">${cell}</td>`;
    });
    return `<tr${rowStyle}>${cells.join("")}</tr>`;
  });

  const tableStyle = `border-collapse:collapse;width:100%;margin:6px 0`;
  return `<table style="${tableStyle}">${thead}<tbody>${rows.join("")}</tbody></table>`;
}

// ── 0. list-object :table ─────────────────────────────────────
function _resolveObjectTables(html, person, preview) {
  if (!html) return html;
  return html.replace(/\{\{#([\w]+):table\}\}/g, (match, tech) => {
    // Aperçu sans personne
    if (!person) {
      if (!preview) return match;
      // Placeholder visuel pour l'éditeur
      return `<table style="border-collapse:collapse;width:100%;margin:6px 0;opacity:.5">
        <thead><tr>
          <th style="background:#eef2ff;color:#7c3aed;border:1px solid #c8cdd8;padding:6px 10px;font-style:italic">Colonne 1</th>
          <th style="background:#eef2ff;color:#7c3aed;border:1px solid #c8cdd8;padding:6px 10px;font-style:italic">Colonne 2</th>
          <th style="background:#eef2ff;color:#7c3aed;border:1px solid #c8cdd8;padding:6px 10px;font-style:italic">…</th>
        </tr></thead>
        <tbody><tr>
          <td style="border:1px solid #c8cdd8;padding:6px 10px;color:#7c3aed;font-style:italic">{{#${tech}:table}}</td>
          <td style="border:1px solid #c8cdd8;padding:6px 10px"></td>
          <td style="border:1px solid #c8cdd8;padding:6px 10px"></td>
        </tr></tbody></table>`;
    }

    const items = Array.isArray(person[tech]) ? person[tech] : [];
    // Récupérer la définition des colonnes depuis le schéma DB
    const columns = DB.getListObjectColumns(tech);
    return _buildObjectTable(items, columns, tech, preview);
  });
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

// ── Résolution principale (ordre : table → cell-expand → ul/inline → scalaires) ──
function _resolveAll(html, person, preview) {
  if (!html) return "";
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
td, th { border: 1px solid #c8cdd8; padding: 6px 10px; }
th { background: #eef2ff; color: #1d4ed8; font-weight: 600; text-align: left; }
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
