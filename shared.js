// ═══════════════════════════════════════════════════════════════
//  SIRH-Doc  shared.js  v7
//  Nouveauté : type "list-object" + syntaxe {{#tech:table}}
//  → génère un <table> automatique dont les colonnes sont les
//    clés du premier objet et les lignes les valeurs.
//  Toutes les syntaxes antérieures restent inchangées.
// ═══════════════════════════════════════════════════════════════

const STORE_KEY = "sirhdoc_v7";
const API_BASE = (() => {
  if (typeof window === "undefined") return "http://localhost:3000";
  if (window.SIRHDOC_API_BASE)
    return window.SIRHDOC_API_BASE.replace(/\/$/, "");
  if (window.location?.protocol?.startsWith("http"))
    return window.location.origin;
  return "http://localhost:3000";
})();
const API_ROOT = `${API_BASE}/api`;

function cloneData(data) {
  if (data === undefined) return undefined;
  return JSON.parse(JSON.stringify(data));
}

const DEFAULT_FAMILY_BENEFICIARY_TABLE = "personnel";
const SUPERADMIN_FAMILY_HIDDEN_TABLES = Object.freeze([
  // "family",
  // "template",
  // "etablissement",
  // "admin_user",
  // "graphic_charter",
  // "admin_account",
  // "charte",
]);

function normalizeFilterParamName(value, fallback = "filtre") {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
  return normalized || fallback;
}

function normalizeFilterOption(option, fallbackValue = "") {
  if (option === undefined || option === null) return null;
  if (typeof option !== "object" || Array.isArray(option)) {
    const value = String(option).trim();
    if (!value) return null;
    return { value, label: value };
  }
  const value = String(
    option.value ?? option.id ?? option.code ?? fallbackValue ?? "",
  ).trim();
  if (!value) return null;
  const label = String(
    option.label ?? option.libelle ?? option.nom ?? option.name ?? value,
  ).trim();
  return { value, label: label || value };
}

function normalizeFilterOptions(options) {
  const seen = new Set();
  return (Array.isArray(options) ? options : [])
    .map((option, index) => normalizeFilterOption(option, index + 1))
    .filter((option) => {
      if (!option || seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });
}

function parseFilterStaticOptions(raw) {
  if (Array.isArray(raw)) return normalizeFilterOptions(raw);
  const text = String(raw || "").trim();
  if (!text) return [];
  return normalizeFilterOptions(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [valuePart, ...labelParts] = line.split("|");
        const value = String(valuePart || "").trim();
        const label = String(labelParts.join("|") || value).trim();
        return value ? { value, label: label || value } : null;
      })
      .filter(Boolean),
  );
}

function normalizeFilterRoleAccess(raw = {}) {
  return {
    admin: raw?.admin !== false,
    user: raw?.user !== false,
  };
}

function normalizeFilterSqlBuilder(builder = {}) {
  if (!builder || typeof builder !== "object") {
    return {
      tableName: "",
      valueColumn: "",
      labelColumn: "",
      distinct: true,
    };
  }
  return {
    tableName: String(builder.tableName || builder.table || "").trim(),
    valueColumn: String(builder.valueColumn || builder.value || "").trim(),
    labelColumn: String(builder.labelColumn || builder.label || "").trim(),
    distinct: builder.distinct !== false,
  };
}

function normalizeFilterColumnBinding(binding = {}) {
  if (!binding || typeof binding !== "object") {
    return {
      tableName: "",
      columnName: "",
      mode: "manual",
    };
  }
  const mode = binding.mode === "base-column" ? "base-column" : "manual";
  return {
    tableName: String(binding.tableName || binding.table || "").trim(),
    columnName: String(binding.columnName || binding.column || "").trim(),
    mode,
  };
}

function normalizeFilterDefinition(filter = {}, index = 0) {
  const label =
    String(filter.label || filter.name || "").trim() || `Filtre ${index + 1}`;
  const type = ["text", "number", "date", "select"].includes(filter.type)
    ? filter.type
    : "text";
  const sourceType =
    type === "select" && filter.sourceType === "sql" ? "sql" : "static";
  return {
    id: String(filter.id || genId("flt")),
    key: normalizeFilterParamName(
      filter.key || filter.param || filter.paramName || label,
      `filtre_${index + 1}`,
    ),
    label,
    type,
    sourceType,
    placeholder: String(filter.placeholder || "").trim(),
    helpText: String(filter.helpText || filter.help || "").trim(),
    roles: normalizeFilterRoleAccess(filter.roles),
    columnBinding: normalizeFilterColumnBinding(
      filter.columnBinding || filter.binding || {},
    ),
    staticOptions:
      type === "select"
        ? parseFilterStaticOptions(
            filter.staticOptionsText || filter.staticOptions || [],
          )
        : [],
    sqlBuilder:
      type === "select"
        ? normalizeFilterSqlBuilder(filter.sqlBuilder || filter.builder || {})
        : normalizeFilterSqlBuilder({}),
    sqlQuery:
      type === "select" && sourceType === "sql"
        ? String(filter.sqlQuery || filter.query || "").trim()
        : "",
  };
}

function normalizeTemplateFilterProfileEntry(entry = {}, index = 0) {
  const filterId = String(entry.filterId || entry.id || "").trim();
  if (!filterId) return null;
  return {
    filterId,
    enabled: entry.enabled !== false,
    adminEnabled: entry.adminEnabled !== false,
    userEnabled: entry.userEnabled !== false,
    required: !!entry.required,
    locked: !!entry.locked,
    order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : index,
    defaultValue:
      entry.defaultValue === undefined || entry.defaultValue === null
        ? null
        : entry.defaultValue,
    allowedValueMode: entry.allowedValueMode === "subset" ? "subset" : "all",
    allowedValues: normalizeFilterOptions(entry.allowedValues || []),
  };
}

function normalizeFilterCatalog(filters) {
  return (Array.isArray(filters) ? filters : [])
    .map((filter, index) => normalizeFilterDefinition(filter, index))
    .filter(Boolean);
}

function normalizeTemplateFilterProfile(profile) {
  return (Array.isArray(profile) ? profile : [])
    .map((entry, index) => normalizeTemplateFilterProfileEntry(entry, index))
    .filter(Boolean);
}

function normalizeFilterInputValue(filter, rawValue) {
  if (rawValue === undefined || rawValue === null) return null;
  const text = String(rawValue).trim();
  if (!text) return null;
  if (filter?.type === "number") {
    const numberValue = Number(text);
    return Number.isFinite(numberValue) ? numberValue : null;
  }
  return text;
}

function buildDocumentFilterParams(values = {}, filterDefs = []) {
  const params = {};
  (Array.isArray(filterDefs) ? filterDefs : []).forEach((filter) => {
    if (!filter?.key) return;
    const normalized = normalizeFilterInputValue(filter, values?.[filter.id]);
    params[filter.key] = normalized;
    params[`filter_${filter.key}`] = normalized;
  });
  return params;
}

function getFamilyFilterCatalog(family) {
  return normalizeFilterCatalog(family?.filterCatalog || []);
}

function getTemplateFilterProfile(template) {
  return normalizeTemplateFilterProfile(template?.filterProfile || []);
}

function getTemplateFilterProfileMap(template) {
  return new Map(
    getTemplateFilterProfile(template).map((entry) => [entry.filterId, entry]),
  );
}

function getTemplateFilterBinding(filterDef, template) {
  const rawProfile = getTemplateFilterProfileMap(template).get(filterDef.id);
  const isLegacyDisabledProfile =
    !!rawProfile &&
    rawProfile.enabled === false &&
    rawProfile.adminEnabled !== false &&
    rawProfile.userEnabled !== false &&
    !rawProfile.required &&
    !rawProfile.locked &&
    (rawProfile.defaultValue === null ||
      rawProfile.defaultValue === undefined) &&
    rawProfile.allowedValueMode !== "subset" &&
    !(rawProfile.allowedValues || []).length;
  const profile = (isLegacyDisabledProfile
    ? { ...rawProfile, enabled: true }
    : rawProfile) || {
    filterId: filterDef.id,
    enabled: true,
    adminEnabled: true,
    userEnabled: true,
    required: false,
    locked: false,
    order: 999,
    defaultValue: null,
    allowedValueMode: "all",
    allowedValues: [],
  };
  return {
    ...cloneData(filterDef),
    profile: cloneData(profile),
  };
}

function buildDistinctFilterSqlQuery(builder, schema = null) {
  const normalized = normalizeFilterSqlBuilder(builder);
  if (!normalized.tableName || !normalized.valueColumn) return "";
  const tableColumns = schema
    ? getSchemaColumnsForTable(schema, normalized.tableName)
    : [];
  const hasEtabColumn = tableColumns.some(
    (column) => column.name === "etablissement_id",
  );
  const labelExpr = normalized.labelColumn
    ? `COALESCE(CONVERT(NVARCHAR(255), ${quoteSqlIdentifier(normalized.labelColumn)}), CONVERT(NVARCHAR(255), ${quoteSqlIdentifier(normalized.valueColumn)}))`
    : `CONVERT(NVARCHAR(255), ${quoteSqlIdentifier(normalized.valueColumn)})`;
  return [
    "SELECT DISTINCT",
    `  CONVERT(NVARCHAR(255), ${quoteSqlIdentifier(normalized.valueColumn)}) AS value,`,
    `  ${labelExpr} AS label`,
    `FROM ${quoteSqlIdentifier(normalized.tableName)}`,
    `WHERE ${quoteSqlIdentifier(normalized.valueColumn)} IS NOT NULL${
      hasEtabColumn
        ? "\n  AND (:etablissementId IS NULL OR [etablissement_id] = :etablissementId)"
        : ""
    }`,
    "ORDER BY label ASC",
  ].join("\n");
}

function getEnabledTemplateFilters(family, template, role = "user") {
  return getFamilyFilterCatalog(family)
    .map((filterDef) => getTemplateFilterBinding(filterDef, template))
    .filter((entry) => {
      if (!entry.profile.enabled) return false;
      if (role === "admin" && entry.profile.adminEnabled === false)
        return false;
      if (role === "user" && entry.profile.userEnabled === false) return false;
      return entry.roles?.[role] !== false;
    })
    .sort((a, b) => {
      const orderGap = (a.profile.order || 0) - (b.profile.order || 0);
      if (orderGap !== 0) return orderGap;
      return a.label.localeCompare(b.label, "fr");
    });
}

function normalizeFamilyRecord(record = {}) {
  const next = cloneData(record || {}) || {};
  next.beneficiaryMode =
    next.beneficiaryMode === "etablissement" ? "etablissement" : "table";
  next.beneficiaryTable =
    next.beneficiaryMode === "table"
      ? String(
          next.beneficiaryTable ||
            next.beneficiaireTable ||
            DEFAULT_FAMILY_BENEFICIARY_TABLE,
        )
      : null;
  next.beneficiarySql = String(
    next.beneficiarySql || next.beneficiarySqlText || "",
  ).trim();
  next.filterCatalog = normalizeFilterCatalog(
    next.filterCatalog || next.filterCatalogJson || [],
  );
  delete next.beneficiaireTable;
  delete next.beneficiarySqlText;
  delete next.filterCatalogJson;
  return next;
}

function getSuperadminHiddenFamilyTables() {
  return [...SUPERADMIN_FAMILY_HIDDEN_TABLES];
}

function isSuperadminFamilyTableHidden(tableName) {
  return SUPERADMIN_FAMILY_HIDDEN_TABLES.includes(String(tableName || ""));
}

function getVisibleFamilySchemaTables(schema, extraTables = []) {
  const extras = new Set((extraTables || []).filter(Boolean));
  return (schema?.tables || []).filter(
    (table) =>
      !isSuperadminFamilyTableHidden(table.name) || extras.has(table.name),
  );
}

function normalizeState(state) {
  const next = state && typeof state === "object" ? state : {};
  return {
    etablissements: Array.isArray(next.etablissements)
      ? next.etablissements.map((etab) =>
          normalizeEtablissementRecord(cloneData(etab)),
        )
      : [],
    admins: Array.isArray(next.admins) ? cloneData(next.admins) : [],
    families: Array.isArray(next.families)
      ? next.families.map((fam) => normalizeFamilyRecord(cloneData(fam)))
      : [],
    templates: Array.isArray(next.templates)
      ? next.templates.map((tpl) => normalizeTemplateRecord(cloneData(tpl)))
      : [],
    personnel: Array.isArray(next.personnel) ? cloneData(next.personnel) : [],
  };
}

function notifySyncError(message, error) {
  console.error(message, error);
  if (typeof window !== "undefined" && typeof window.toast === "function") {
    window.toast(message, "error");
  }
}

function quoteSqlIdentifier(name) {
  return `[${String(name || "").replace(/]/g, "]]")}]`;
}

function getSchemaColumnsForTable(schema, tableName) {
  return (schema?.columns || []).filter((column) => column.table === tableName);
}

function getSchemaPrimaryColumn(schema, tableName) {
  return (
    getSchemaColumnsForTable(schema, tableName).find(
      (column) => column.key === "PRI",
    )?.name || "id"
  );
}

function getSchemaColumn(schema, tableName, columnName) {
  return getSchemaColumnsForTable(schema, tableName).find(
    (column) => column.name === columnName,
  );
}

function guessBeneficiaryLabel(row = {}) {
  const directKeys = [
    "nom_prenom",
    "nom_complet",
    "display_name",
    "full_name",
    "libelle",
    "intitule",
    "titre",
    "nom",
  ];
  for (const key of directKeys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  const fullName = [row.prenom, row.nom]
    .filter(
      (value) => value !== undefined && value !== null && String(value).trim(),
    )
    .join(" ")
    .trim();
  if (fullName) return fullName;

  const fallbackKey = Object.keys(row).find((key) => {
    const value = row[key];
    return (
      !key.startsWith("_") &&
      value !== undefined &&
      value !== null &&
      typeof value !== "object" &&
      String(value).trim()
    );
  });
  return fallbackKey ? String(row[fallbackKey]).trim() : "Bénéficiaire";
}

function guessBeneficiarySubtitle(row = {}, label = "") {
  const candidates = [
    row.sous_libelle,
    row.poste,
    row.fonction,
    row.grade,
    row.departement,
    row.service,
    row.email,
    row.code,
    row.matricule,
  ];
  const subtitle = candidates.find(
    (value) => value !== undefined && value !== null && String(value).trim(),
  );
  if (!subtitle) return "";
  const normalized = String(subtitle).trim();
  return normalized === label ? "" : normalized;
}

const DB = {
  _cache: normalizeState(),
  _readyPromise: null,
  _schemaPromise: null,

  async init(force = false) {
    if (this._readyPromise && !force) return this._readyPromise;
    this._readyPromise = (async () => {
      try {
        const res = await fetch(`${API_ROOT}/bootstrap`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          throw new Error(`Bootstrap failed with status ${res.status}`);
        }
        const payload = await res.json();
        this._cache = normalizeState(payload.state);
        return this.get();
      } catch (error) {
        this._cache = normalizeState();
        notifySyncError("Connexion SQL Server indisponible.", error);
        return this.get();
      }
    })();
    return this._readyPromise;
  },

  get() {
    return normalizeState(this._cache);
  },

  async getSchema(force = false) {
    if (this._schemaPromise && !force) return this._schemaPromise;
    this._schemaPromise = fetch(`${API_ROOT}/schema`)
      .then((res) => {
        if (!res.ok) throw new Error(`Schema failed with status ${res.status}`);
        return res.json();
      })
      .then((payload) => payload.schema);
    return this._schemaPromise;
  },

  async runSelect(sql, params = {}) {
    const res = await fetch(`${API_ROOT}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(
        payload.error || `Query failed with status ${res.status}`,
      );
    }
    const payload = await res.json();
    return payload.rows || [];
  },

  async getPersonDataForFamily(
    familyId,
    personId,
    filters = {},
    etablissementId = null,
  ) {
    const basePerson = this.getPerson(personId);
    return this.getDocumentDataForFamily(
      familyId,
      personId,
      etablissementId || basePerson?.etablissementId || null,
      filters,
    );
  },

  async getBeneficiariesForFamily(
    familyId,
    etablissementId = null,
    filters = {},
  ) {
    const family = this.getFamily(familyId);
    if (!family) return [];
    const filterDefs = getFamilyFilterCatalog(family);
    const filterParams = buildDocumentFilterParams(filters, filterDefs);

    if (family.beneficiaryMode === "etablissement") {
      const etab = etablissementId
        ? this.getEtablissement(etablissementId)
        : null;
      if (!etab) return [];
      return [
        {
          ...cloneData(etab),
          id: String(etab.id),
          _displayLabel: etab.nom || "Établissement",
          _displaySubtitle: etab.ville || "",
          _sourceTable: "etablissement",
        },
      ];
    }

    const tableName =
      family.beneficiaryTable || DEFAULT_FAMILY_BENEFICIARY_TABLE;
    if (family.beneficiarySql) {
      try {
        const rows = await this.runSelect(family.beneficiarySql, {
          etablissementId,
          etabId: etablissementId,
          ...filterParams,
        });
        return rows
          .filter(
            (row) =>
              row &&
              row.id !== undefined &&
              row.id !== null &&
              String(row.id).trim(),
          )
          .map((row) => {
            const label = guessBeneficiaryLabel(row);
            return {
              ...row,
              id: String(row.id),
              _displayLabel: label,
              _displaySubtitle: guessBeneficiarySubtitle(row, label),
              _sourceTable: tableName,
            };
          });
      } catch (error) {
        notifySyncError(
          `Impossible de charger les bénéficiaires via le SELECT de la famille ${family.nom || family.id || ""}.`,
          error,
        );
        return [];
      }
    }
    if (tableName === "personnel") {
      return this.getPersonnel(etablissementId).map((person) => ({
        ...cloneData(person),
        id: String(person.id),
        _displayLabel: person.nom_prenom || guessBeneficiaryLabel(person),
        _displaySubtitle:
          [person.poste, person.departement]
            .filter(
              (value) =>
                value !== undefined && value !== null && String(value).trim(),
            )
            .join(" · ") || "",
        _sourceTable: tableName,
      }));
    }

    try {
      const schema = await this.getSchema();
      const columns = getSchemaColumnsForTable(schema, tableName);
      if (!columns.length) return [];
      const pk = getSchemaPrimaryColumn(schema, tableName);
      const defaultOrderColumn =
        columns.find((column) =>
          [
            "nom_prenom",
            "nom_complet",
            "display_name",
            "full_name",
            "nom",
            "libelle",
            "intitule",
          ].includes(column.name),
        )?.name || pk;
      const etabColumn = getSchemaColumn(schema, tableName, "etablissement_id");
      const fallbackSql = family.beneficiarySql
        ? family.beneficiarySql
        : `SELECT TOP (500) * FROM ${quoteSqlIdentifier(tableName)}${
            etabColumn && etablissementId
              ? ` WHERE ${quoteSqlIdentifier(etabColumn.name)} = :etablissementId`
              : ""
          } ORDER BY ${quoteSqlIdentifier(defaultOrderColumn)} ASC`;
      const rows = await this.runSelect(fallbackSql, {
        etablissementId,
        etabId: etablissementId,
        ...filterParams,
      });
      return rows
        .filter(
          (row) =>
            row &&
            (row.id !== undefined && row.id !== null
              ? String(row.id).trim()
              : row[pk] !== undefined && row[pk] !== null
                ? String(row[pk]).trim()
                : ""),
        )
        .map((row) => {
          const label = guessBeneficiaryLabel(row);
          return {
            ...row,
            id: String(row.id ?? row[pk]),
            _displayLabel: label,
            _displaySubtitle: guessBeneficiarySubtitle(row, label),
            _sourceTable: tableName,
          };
        });
    } catch (error) {
      notifySyncError(
        `Impossible de charger les bénéficiaires depuis la table ${tableName}.`,
        error,
      );
      return [];
    }
  },

  async getDocumentDataForFamily(
    familyId,
    beneficiaryId = null,
    etablissementId = null,
    filters = {},
  ) {
    const family = this.getFamily(familyId);
    if (!family) return null;
    if (family.beneficiaryMode !== "etablissement" && !beneficiaryId) {
      return null;
    }

    let baseRecord = {};
    const tableName =
      family.beneficiaryTable || DEFAULT_FAMILY_BENEFICIARY_TABLE;

    if (family.beneficiaryMode === "etablissement") {
      const etab = etablissementId
        ? this.getEtablissement(etablissementId)
        : null;
      baseRecord = etab ? cloneData(etab) : {};
    } else if (beneficiaryId) {
      if (tableName === "personnel") {
        baseRecord = cloneData(this.getPerson(beneficiaryId) || {});
      } else {
        try {
          const schema = await this.getSchema();
          const columns = getSchemaColumnsForTable(schema, tableName);
          if (columns.length) {
            const pk = getSchemaPrimaryColumn(schema, tableName);
            const rows = await this.runSelect(
              `SELECT TOP (1) * FROM ${quoteSqlIdentifier(tableName)} WHERE ${quoteSqlIdentifier(pk)} = :beneficiaryId`,
              { beneficiaryId },
            );
            baseRecord = cloneData(rows?.[0] || {});
          }
        } catch (error) {
          notifySyncError(
            `Impossible de charger le bénéficiaire depuis la table ${tableName}.`,
            error,
          );
        }
      }
    }

    if (!family.sql) return baseRecord;

    try {
      const filterDefs = getFamilyFilterCatalog(family);
      const rows = await this.runSelect(family.sql, {
        id:
          family.beneficiaryMode === "etablissement"
            ? etablissementId
            : beneficiaryId,
        personId: beneficiaryId,
        beneficiaryId,
        etablissementId,
        etabId: etablissementId,
        ...buildDocumentFilterParams(filters, filterDefs),
      });
      const row = rows?.[0];
      return row ? { ...(baseRecord || {}), ...row } : baseRecord;
    } catch (error) {
      notifySyncError("La requete SELECT de la famille a echoue.", error);
      return baseRecord;
    }
  },

  save(d) {
    this._cache = normalizeState(d);
    fetch(`${API_ROOT}/state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: this._cache }),
    }).catch((error) => {
      notifySyncError(
        "Impossible de synchroniser les donnees avec SQL Server.",
        error,
      );
      this.init(true).catch(() => {});
    });
    return this.get();
  },

  seed() {
    this._cache = normalizeState();
    return this.get();
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
    const normalized = normalizeFamilyRecord(fam);
    const i = s.families.findIndex((f) => f.id === fam.id);
    i >= 0 ? (s.families[i] = normalized) : s.families.push(normalized);
    DB.save(s);
    return normalized;
  },
  deleteFamily(id) {
    const s = DB.get();
    s.families = s.families.filter((f) => f.id !== id);
    s.templates = s.templates.filter((t) => t.familyId !== id);
    DB.save(s);
  },
  saveTemplate(t) {
    const s = DB.get();
    const normalized = normalizeTemplateRecord(t);
    const i = s.templates.findIndex((x) => x.id === t.id);
    i >= 0 ? (s.templates[i] = normalized) : s.templates.push(normalized);
    DB.save(s);
    return normalized;
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

function makeFilterOptionLabel(row = {}, fallback = "") {
  const label =
    row.label ??
    row.libelle ??
    row.nom ??
    row.name ??
    row.intitule ??
    row.titre ??
    row.value ??
    row.id ??
    fallback;
  return String(label ?? fallback ?? "").trim();
}

function mapRowsToFilterOptions(rows = []) {
  return normalizeFilterOptions(
    (Array.isArray(rows) ? rows : []).map((row, index) => {
      if (row === null || row === undefined) return null;
      if (typeof row !== "object" || Array.isArray(row)) {
        return normalizeFilterOption(row, index + 1);
      }
      const value = String(
        row.value ?? row.id ?? row.code ?? row.key ?? index + 1,
      ).trim();
      if (!value) return null;
      return {
        value,
        label: makeFilterOptionLabel(row, value),
      };
    }),
  );
}

function getAllowedFilterOptions(filterEntry, options = []) {
  const normalizedOptions = normalizeFilterOptions(options);
  if (
    !filterEntry?.profile ||
    filterEntry.profile.allowedValueMode !== "subset" ||
    !filterEntry.profile.allowedValues?.length
  ) {
    return normalizedOptions;
  }

  const allowedMap = new Map(
    normalizeFilterOptions(filterEntry.profile.allowedValues).map((option) => [
      option.value,
      option,
    ]),
  );
  const subset = normalizedOptions.filter((option) =>
    allowedMap.has(option.value),
  );
  if (subset.length) return subset;
  return [...allowedMap.values()];
}

function getDefaultFilterValues(family, template, role = "user") {
  return Object.fromEntries(
    getEnabledTemplateFilters(family, template, role).map((entry) => [
      entry.id,
      normalizeFilterInputValue(entry, entry.profile.defaultValue),
    ]),
  );
}

function applyFilterValueDefaults(entries = [], values = {}) {
  const next = {};
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const rawValue =
      values?.[entry.id] !== undefined
        ? values[entry.id]
        : (entry.profile?.defaultValue ?? null);
    next[entry.id] = normalizeFilterInputValue(entry, rawValue);
  });
  return next;
}

function validateRuntimeFilterValues(entries = [], values = {}) {
  const next = applyFilterValueDefaults(entries, values);
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    if (entry.type !== "select") return;
    const allowed = getAllowedFilterOptions(entry, entry.options || []);
    if (!allowed.length) return;
    const currentValue = next[entry.id];
    if (
      currentValue === null ||
      currentValue === undefined ||
      currentValue === ""
    )
      return;
    if (!allowed.some((option) => option.value === String(currentValue))) {
      next[entry.id] = normalizeFilterInputValue(
        entry,
        entry.profile?.defaultValue ?? null,
      );
    }
  });
  return next;
}

async function resolveFilterOptionsForEntry(
  filterEntry,
  etablissementId = null,
  values = {},
  extraParams = {},
  filterDefs = [],
) {
  if (!filterEntry || filterEntry.type !== "select") return [];
  let options =
    filterEntry.sourceType === "sql" && filterEntry.sqlQuery
      ? []
      : normalizeFilterOptions(filterEntry.staticOptions);

  if (filterEntry.type === "select" && filterEntry.sourceType === "sql") {
    if (!String(filterEntry.sqlQuery || "").trim()) {
      return getAllowedFilterOptions(filterEntry, []);
    }
    try {
      const rows = await DB.runSelect(filterEntry.sqlQuery, {
        etablissementId,
        etabId: etablissementId,
        ...buildDocumentFilterParams(
          values,
          filterDefs.length ? filterDefs : [filterEntry],
        ),
        ...extraParams,
      });
      options = mapRowsToFilterOptions(rows);
    } catch (error) {
      notifySyncError(
        `Impossible de charger les valeurs possibles du filtre ${filterEntry.label}.`,
        error,
      );
      options = [];
    }
  }

  return getAllowedFilterOptions(filterEntry, options);
}

async function resolveTemplateFiltersForRole(
  familyId,
  templateId,
  role = "user",
  etablissementId = null,
  values = {},
  extraParams = {},
) {
  const family = DB.getFamily(familyId);
  const template = DB.getTemplate(templateId);
  if (!family || !template) return [];
  const entries = getEnabledTemplateFilters(family, template, role);
  const filterDefs = getFamilyFilterCatalog(family);
  const resolved = [];
  for (const entry of entries) {
    resolved.push({
      ...entry,
      options: await resolveFilterOptionsForEntry(
        entry,
        etablissementId,
        values,
        extraParams,
        filterDefs,
      ),
    });
  }
  return resolved;
}

const DEFAULT_GRAPHIC_CHARTER = Object.freeze({
  identity: {
    officialName: "",
    directorName: "",
    slogan: "",
    logoText: "",
  },
  colors: {
    primary: "#1d4ed8",
    secondary: "#475569",
    text: "#111111",
    heading: "#0f172a",
    border: "#c8cdd8",
    tableHeaderBg: "#f2f2f2",
    tableAltRowBg: "#f8fafc",
  },
  typography: {
    bodyFont: '"Times New Roman", Times, serif',
    headingFont: '"Times New Roman", Times, serif',
  },
  layout: {
    orientation: "portrait",
    pageMargins: { mt: 20, mb: 20, ml: 25, mr: 25 },
    pageBackground: {
      enabled: false,
      image: "",
      size: "cover",
      position: "center center",
      repeat: "no-repeat",
    },
  },
  header: {
    enabledByDefault: true,
    html: '<p style="text-align:center"><strong>{{nom_etab}}</strong></p><p style="text-align:center;font-size:10pt;color:var(--doc-color-secondary)">{{adresse_etab}} — Tél : {{tel_etab}}</p>',
  },
  footer: {
    enabledByDefault: true,
    html: '<p style="text-align:center;font-size:9pt;color:var(--doc-color-secondary)">Document officiel — {{nom_etab}} — Année {{annee_univ}}</p>',
  },
  watermark: {
    enabled: false,
    text: "",
    color: "#94a3b8",
    opacity: 0.08,
  },
});

function normalizeLegacyGraphicCharter(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.graphicCharters)) return raw.graphicCharters;
  if (Array.isArray(raw?.charters)) return raw.charters;
  if (
    isPlainObject(raw) &&
    ["identity", "colors", "typography", "layout", "header", "footer"].some(
      (key) => key in raw,
    )
  ) {
    return [
      {
        id: "charter_legacy",
        name: "Charte importee",
        description: "Charte reprise depuis l'ancien format",
        config: raw,
        isDefault: true,
      },
    ];
  }
  return [];
}

function normalizeGraphicCharterEntry(entry = {}, index = 0) {
  const configSource =
    entry && typeof entry === "object" && "config" in entry
      ? entry.config
      : entry;
  return {
    id: String(entry?.id || genId("charter")),
    name:
      String(entry?.name || entry?.nom || "").trim() || `Charte ${index + 1}`,
    description: String(entry?.description || "").trim(),
    isDefault: !!entry?.isDefault,
    createdAt: entry?.createdAt || null,
    updatedAt: entry?.updatedAt || null,
    config: normalizeGraphicCharterConfig(configSource || {}),
  };
}

function normalizeGraphicCharterCollection(raw) {
  const list = normalizeLegacyGraphicCharter(raw).map((entry, index) =>
    normalizeGraphicCharterEntry(entry, index),
  );
  if (!list.length) return [];
  const preferred =
    list.find((entry) => entry.isDefault)?.id || list[0]?.id || null;
  list.forEach((entry) => {
    entry.isDefault = entry.id === preferred;
  });
  return list;
}

function normalizeEtablissementRecord(record = {}) {
  const next = cloneData(record || {}) || {};
  next.graphicCharters = normalizeGraphicCharterCollection(
    next.graphicCharters ?? next.graphicCharter,
  );
  delete next.graphicCharter;
  return next;
}

function normalizeTemplateRecord(record = {}) {
  const next = cloneData(record || {}) || {};
  next.graphicCharterId = next.graphicCharterId
    ? String(next.graphicCharterId)
    : null;
  next.filterProfile = normalizeTemplateFilterProfile(
    next.filterProfile || next.filterProfileJson || [],
  );
  delete next.filterProfileJson;
  return next;
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(base, extra) {
  if (!isPlainObject(base)) return cloneData(extra);
  const out = cloneData(base);
  Object.entries(extra || {}).forEach(([key, value]) => {
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key], value);
      return;
    }
    out[key] = cloneData(value);
  });
  return out;
}

function normalizeMargins(src, fallback) {
  const base = fallback || DEFAULT_GRAPHIC_CHARTER.layout.pageMargins;
  const toNum = (value, def) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : def;
  };
  return {
    mt: toNum(src?.mt, base.mt),
    mb: toNum(src?.mb, base.mb),
    ml: toNum(src?.ml, base.ml),
    mr: toNum(src?.mr, base.mr),
  };
}

function normalizePageBackground(src) {
  const enabled = !!src?.enabled && !!String(src?.image || "").trim();
  const size = String(src?.size || "cover").toLowerCase();
  const position = String(src?.position || "center center").toLowerCase();
  const repeat = String(src?.repeat || "no-repeat").toLowerCase();
  return {
    enabled,
    image: enabled ? String(src?.image || "").trim() : "",
    size: ["cover", "contain", "100% 100%"].includes(size) ? size : "cover",
    position: [
      "center center",
      "top center",
      "bottom center",
      "center left",
      "center right",
    ].includes(position)
      ? position
      : "center center",
    repeat: ["no-repeat", "repeat", "repeat-x", "repeat-y"].includes(repeat)
      ? repeat
      : "no-repeat",
  };
}

function normalizeGraphicCharterConfig(config = {}) {
  const merged = deepMerge(DEFAULT_GRAPHIC_CHARTER, config || {});
  merged.identity = {
    officialName: String(merged.identity?.officialName || "").trim(),
    directorName: String(merged.identity?.directorName || "").trim(),
    slogan: String(merged.identity?.slogan || "").trim(),
    logoText: String(merged.identity?.logoText || "").trim(),
  };
  merged.colors = {
    primary: merged.colors?.primary || DEFAULT_GRAPHIC_CHARTER.colors.primary,
    secondary:
      merged.colors?.secondary || DEFAULT_GRAPHIC_CHARTER.colors.secondary,
    text: merged.colors?.text || DEFAULT_GRAPHIC_CHARTER.colors.text,
    heading: merged.colors?.heading || DEFAULT_GRAPHIC_CHARTER.colors.heading,
    border: merged.colors?.border || DEFAULT_GRAPHIC_CHARTER.colors.border,
    tableHeaderBg:
      merged.colors?.tableHeaderBg ||
      DEFAULT_GRAPHIC_CHARTER.colors.tableHeaderBg,
    tableAltRowBg:
      merged.colors?.tableAltRowBg ||
      DEFAULT_GRAPHIC_CHARTER.colors.tableAltRowBg,
  };
  merged.typography = {
    bodyFont:
      merged.typography?.bodyFont ||
      DEFAULT_GRAPHIC_CHARTER.typography.bodyFont,
    headingFont:
      merged.typography?.headingFont ||
      DEFAULT_GRAPHIC_CHARTER.typography.headingFont,
  };
  merged.layout = {
    orientation:
      String(merged.layout?.orientation || "portrait").toLowerCase() ===
      "landscape"
        ? "landscape"
        : "portrait",
    pageMargins: normalizeMargins(merged.layout?.pageMargins),
    pageBackground: normalizePageBackground(merged.layout?.pageBackground),
  };
  merged.header = {
    enabledByDefault:
      merged.header?.enabledByDefault !== false &&
      DEFAULT_GRAPHIC_CHARTER.header.enabledByDefault,
    html: String(merged.header?.html || DEFAULT_GRAPHIC_CHARTER.header.html),
  };
  merged.footer = {
    enabledByDefault:
      merged.footer?.enabledByDefault !== false &&
      DEFAULT_GRAPHIC_CHARTER.footer.enabledByDefault,
    html: String(merged.footer?.html || DEFAULT_GRAPHIC_CHARTER.footer.html),
  };
  merged.watermark = {
    enabled: !!merged.watermark?.enabled,
    text: String(merged.watermark?.text || ""),
    color: merged.watermark?.color || DEFAULT_GRAPHIC_CHARTER.watermark.color,
    opacity: Number.isFinite(Number(merged.watermark?.opacity))
      ? Number(merged.watermark.opacity)
      : DEFAULT_GRAPHIC_CHARTER.watermark.opacity,
  };
  return merged;
}

function getGraphicCharters(etablissementId) {
  const etab = etablissementId ? DB.getEtablissement(etablissementId) : null;
  return normalizeGraphicCharterCollection(etab?.graphicCharters || []);
}

function getGraphicCharter(etablissementId, charterId = null) {
  const charters = getGraphicCharters(etablissementId);
  if (!charters.length) return null;
  if (charterId) {
    const match = charters.find((item) => item.id === String(charterId));
    if (match) return match;
  }
  return charters.find((item) => item.isDefault) || charters[0] || null;
}

function getDefaultGraphicCharterId(etablissementId) {
  return getGraphicCharter(etablissementId)?.id || null;
}

function ensureEtablissementGraphicCharters(etablissementId) {
  const etab = etablissementId ? DB.getEtablissement(etablissementId) : null;
  if (!etab) return [];
  const current = getGraphicCharters(etablissementId);
  if (current.length) return current;
  const created = [
    normalizeGraphicCharterEntry(
      {
        id: genId("charter"),
        name: "Charte standard",
        description: "Charte par defaut de l'etablissement",
        isDefault: true,
        config: {},
      },
      0,
    ),
  ];
  DB.saveEtablissement({
    ...etab,
    graphicCharters: created,
    updatedAt: new Date().toISOString(),
  });
  return created;
}

function saveGraphicCharter(etablissementId, charter) {
  const etab = etablissementId ? DB.getEtablissement(etablissementId) : null;
  if (!etab) return null;
  const current = getGraphicCharters(etablissementId);
  const normalized = normalizeGraphicCharterEntry(
    {
      ...charter,
      id: charter?.id || genId("charter"),
      updatedAt: new Date().toISOString(),
      createdAt: charter?.createdAt || new Date().toISOString(),
    },
    current.length,
  );
  let next = current.filter((item) => item.id !== normalized.id);
  next.push(normalized);
  if (normalized.isDefault || !next.some((item) => item.isDefault)) {
    next = next.map((item) => ({
      ...item,
      isDefault: item.id === normalized.id,
    }));
  }
  DB.saveEtablissement({
    ...etab,
    graphicCharters: next,
    updatedAt: new Date().toISOString(),
  });
  return normalized;
}

function deleteGraphicCharter(etablissementId, charterId) {
  const etab = etablissementId ? DB.getEtablissement(etablissementId) : null;
  if (!etab) return null;
  const current = getGraphicCharters(etablissementId);
  const removed = current.find((item) => item.id === String(charterId));
  if (!removed) return null;
  let next = current.filter((item) => item.id !== String(charterId));
  if (next.length && !next.some((item) => item.isDefault)) {
    next = next.map((item, index) => ({
      ...item,
      isDefault: index === 0,
    }));
  }
  const fallbackId =
    next.find((item) => item.isDefault)?.id || next[0]?.id || null;
  const state = DB.get();
  state.etablissements = state.etablissements.map((item) =>
    item.id === etablissementId
      ? {
          ...item,
          graphicCharters: next,
          updatedAt: new Date().toISOString(),
        }
      : item,
  );
  state.templates = state.templates.map((tpl) =>
    tpl.etablissementId === etablissementId &&
    tpl.graphicCharterId === String(charterId)
      ? { ...tpl, graphicCharterId: fallbackId }
      : tpl,
  );
  DB.save(state);
  return removed;
}

function setDefaultGraphicCharter(etablissementId, charterId) {
  const etab = etablissementId ? DB.getEtablissement(etablissementId) : null;
  if (!etab) return null;
  const current = getGraphicCharters(etablissementId);
  if (!current.some((item) => item.id === String(charterId))) return null;
  const next = current.map((item) => ({
    ...item,
    isDefault: item.id === String(charterId),
    updatedAt:
      item.id === String(charterId) ? new Date().toISOString() : item.updatedAt,
  }));
  DB.saveEtablissement({
    ...etab,
    graphicCharters: next,
    updatedAt: new Date().toISOString(),
  });
  return getGraphicCharter(etablissementId, charterId);
}

function getEtablissementGraphicCharter(etablissementId, charterId = null) {
  return getGraphicCharter(etablissementId, charterId)?.config
    ? normalizeGraphicCharterConfig(
        getGraphicCharter(etablissementId, charterId).config,
      )
    : normalizeGraphicCharterConfig({});
}

function getTemplateGraphicCharterRecord(tpl) {
  if (!tpl?.etablissementId) return null;
  const resolvedId =
    tpl.graphicCharterId || getDefaultGraphicCharterId(tpl.etablissementId);
  return getGraphicCharter(tpl.etablissementId, resolvedId);
}

function getTemplateGraphicCharter(tpl) {
  const record = getTemplateGraphicCharterRecord(tpl);
  return record?.config
    ? normalizeGraphicCharterConfig(record.config)
    : normalizeGraphicCharterConfig({});
}

function getAcademicYearLabel(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function buildDocumentContext(tpl, person) {
  const base = person ? cloneData(person) : {};
  const etab = tpl?.etablissementId
    ? DB.getEtablissement(tpl.etablissementId)
    : null;
  const charter = getTemplateGraphicCharter(tpl);
  const officialName =
    charter.identity.officialName || etab?.nom || base.nom_etab || "";

  return {
    ...base,
    nom_etab: officialName,
    adresse_etab: etab?.adresse || base.adresse_etab || "",
    tel_etab: etab?.tel || base.tel_etab || "",
    ville_etab: etab?.ville || base.ville_etab || "",
    directeur: charter.identity.directorName || base.directeur || "",
    slogan_etab: charter.identity.slogan || base.slogan_etab || "",
    logo_etab: charter.identity.logoText || base.logo_etab || "",
    annee_univ: base.annee_univ || getAcademicYearLabel(),
  };
}

function getDocumentThemeVars(tpl) {
  const charter = getTemplateGraphicCharter(tpl);
  const pageBackground = getTemplatePageBackground(tpl);
  return {
    "--doc-font-body": charter.typography.bodyFont,
    "--doc-font-heading": charter.typography.headingFont,
    "--doc-color-primary": charter.colors.primary,
    "--doc-color-secondary": charter.colors.secondary,
    "--doc-color-text": charter.colors.text,
    "--doc-color-heading": charter.colors.heading,
    "--doc-color-border": charter.colors.border,
    "--doc-table-header-bg": charter.colors.tableHeaderBg,
    "--doc-table-row-alt-bg": charter.colors.tableAltRowBg,
    "--doc-watermark-color": charter.watermark.color,
    "--doc-watermark-opacity": String(charter.watermark.opacity),
    "--doc-page-bg-image":
      pageBackground.enabled && pageBackground.image
        ? toCssUrlValue(pageBackground.image)
        : "none",
    "--doc-page-bg-size": pageBackground.size,
    "--doc-page-bg-position": pageBackground.position,
    "--doc-page-bg-repeat": pageBackground.repeat,
  };
}

function applyDocumentThemeToRoot(tpl, target = document.documentElement) {
  const vars = getDocumentThemeVars(tpl);
  Object.entries(vars).forEach(([key, value]) => {
    target.style.setProperty(key, value);
  });
  return vars;
}

function getDocumentThemeStyleAttr(tpl) {
  return Object.entries(getDocumentThemeVars(tpl))
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
}

function createTemplateFromGraphicCharter(
  etablissementId,
  familyId,
  name,
  graphicCharterId = null,
) {
  const family = familyId ? DB.getFamily(familyId) : null;
  const charterRecord = getGraphicCharter(etablissementId, graphicCharterId);
  const charter = charterRecord?.config
    ? normalizeGraphicCharterConfig(charterRecord.config)
    : normalizeGraphicCharterConfig({});
  return {
    id: genId("tpl"),
    familyId,
    etablissementId,
    graphicCharterId: charterRecord?.id || null,
    filterProfile: getFamilyFilterCatalog(family).map((filter, index) =>
      normalizeTemplateFilterProfileEntry(
        {
          filterId: filter.id,
          enabled: true,
          adminEnabled: filter.roles?.admin !== false,
          userEnabled: filter.roles?.user !== false,
          required: false,
          locked: false,
          order: index,
          defaultValue: null,
          allowedValueMode: "all",
          allowedValues: [],
        },
        index,
      ),
    ),
    nom: name || "Nouveau template",
    updatedAt: new Date().toISOString(),
    hasHeader: !!charter.header.enabledByDefault,
    hasFooter: !!charter.footer.enabledByDefault,
    orientation: charter.layout.orientation,
    pageMargins: normalizeMargins(charter.layout.pageMargins),
    header: charter.header.html || "",
    body: "<p>Rédigez le contenu du document ici.</p>",
    footer: charter.footer.html || "",
  };
}

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
  const defaultThStyle = `font-weight:700;color:var(--doc-color-text, #111);background:var(--doc-table-header-bg, #f2f2f2);border:1px solid var(--doc-color-border, #c8cdd8);padding:6px 10px;text-align:left`;
  const defaultTdStyle = `color:var(--doc-color-text, #111);border:1px solid var(--doc-color-border, #c8cdd8);padding:6px 10px`;

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
    const rowBg =
      ri % 2 === 1
        ? `background:var(--doc-table-row-alt-bg, #f8fafc)`
        : `background:#fff`;
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
    probe
      .querySelectorAll("br.ProseMirror-trailingBreak")
      .forEach((br) => br.remove());

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

function getTemplatePageMargins(tpl) {
  const charter = getTemplateGraphicCharter(tpl);
  return normalizeMargins(tpl?.pageMargins, charter.layout.pageMargins);
}

function getTemplateOrientation(tpl) {
  const charter = getTemplateGraphicCharter(tpl);
  const o = (
    tpl?.orientation ||
    tpl?.pageOrientation ||
    charter.layout.orientation ||
    "portrait"
  )
    .toString()
    .toLowerCase();
  return o === "landscape" ? "landscape" : "portrait";
}

function getTemplatePageBackground(tpl) {
  const record = getTemplateGraphicCharterRecord(tpl);
  return normalizePageBackground(record?.config?.layout?.pageBackground);
}

function toCssUrlValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "none";
  return `url("${raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
}

function mmToPx(mm) {
  const n = Number(mm);
  return ((Number.isFinite(n) ? n : 0) * 96) / 25.4;
}

function getPageHeightPxForOrientation(orientation) {
  return mmToPx(orientation === "landscape" ? 210 : 297);
}

function computeEditorPageUsableHeightPx(opts = {}) {
  const orientation =
    opts.orientation === "landscape" ? "landscape" : "portrait";
  const toNum = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  return Math.max(
    1,
    getPageHeightPxForOrientation(orientation) -
      toNum(opts.paddingTopPx) -
      toNum(opts.paddingBottomPx) -
      toNum(opts.headerHeightPx) -
      toNum(opts.footerHeightPx),
  );
}

function applyPageOrientationToUI(orientation) {
  const o = orientation === "landscape" ? "landscape" : "portrait";
  const pageW = o === "landscape" ? "297mm" : "210mm";
  const pageH = o === "landscape" ? "210mm" : "297mm";

  document.documentElement.style.setProperty("--page-orientation", o);
  document.documentElement.style.setProperty("--page-w", pageW);
  document.documentElement.style.setProperty("--page-h", pageH);

  const badge = document.getElementById("sbOrientation");
  if (badge) {
    badge.textContent = o === "landscape" ? "Paysage" : "Portrait";
  }

  document.querySelectorAll(".preview-page").forEach((el) => {
    el.style.width = pageW;
    el.style.minHeight = pageH;
  });
  document.querySelectorAll(".sirh-print-page").forEach((el) => {
    el.style.width = pageW;
    el.style.height = pageH;
  });
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
  background-color: #fff;
  background-image: var(--doc-page-bg-image, none);
  background-size: var(--doc-page-bg-size, cover);
  background-position: var(--doc-page-bg-position, center center);
  background-repeat: var(--doc-page-bg-repeat, no-repeat);
  margin: 0 auto;
  display: flex; flex-direction: column;
  page-break-after: always; break-after: page;
}
.a4-page:last-child { page-break-after: auto; break-after: auto; }
.a4-header {
  flex-shrink: 0;
  padding: 5mm var(--page-mr, 25mm) 3mm var(--page-ml, 25mm);
}
.a4-footer {
  flex-shrink: 0; margin-top: auto;
  padding: 3mm var(--page-mr, 25mm) 5mm var(--page-ml, 25mm);
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
    this.theme = normalizeGraphicCharterConfig(opts.theme || {});

    // Orientation A4
    this.orientation =
      opts.orientation === "landscape" ? "landscape" : "portrait";
    this.pageWidthMm = this.orientation === "landscape" ? 297 : 210;
    this.pageHeightMm = this.orientation === "landscape" ? 210 : 297;
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
    this.headerHeight = 0;
    this.footerHeight = 0;
  }

  _applyMeasureStyles(el) {
    if (!el) return;
    el.style.fontFamily = this.theme.typography.bodyFont;
    el.style.fontSize = "12pt";
    el.style.lineHeight = "1.6";
    el.style.color = this.theme.colors.text;
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
      el.style.fontFamily = this.theme.typography.headingFont;
      el.style.color = this.theme.colors.heading;
      el.style.fontSize = "22pt";
      el.style.fontWeight = "700";
      el.style.margin = "0.8em 0 0.4em";
    });
    root.querySelectorAll("h2").forEach((el) => {
      el.style.fontFamily = this.theme.typography.headingFont;
      el.style.color = this.theme.colors.heading;
      el.style.fontSize = "18pt";
      el.style.fontWeight = "700";
      el.style.margin = "0.7em 0 0.3em";
    });
    root.querySelectorAll("h3").forEach((el) => {
      el.style.fontFamily = this.theme.typography.headingFont;
      el.style.color = this.theme.colors.heading;
      el.style.fontSize = "14pt";
      el.style.fontWeight = "700";
      el.style.margin = "0.6em 0 0.3em";
    });
    root.querySelectorAll("h4").forEach((el) => {
      el.style.fontFamily = this.theme.typography.headingFont;
      el.style.color = this.theme.colors.heading;
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
      el.style.border = `1px solid ${this.theme.colors.border}`;
      el.style.padding = "6px 10px";
    });
    root.querySelectorAll("th:not([style])").forEach((el) => {
      el.style.background = this.theme.colors.tableHeaderBg;
      el.style.color = this.theme.colors.text;
      el.style.fontWeight = "700";
      el.style.textAlign = "left";
    });

    root.querySelectorAll("hr").forEach((el) => {
      el.style.border = "none";
      el.style.borderTop = `1.5px solid ${this.theme.colors.border}`;
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
    document.body.appendChild(tempContainer);

    // Mesurer hauteur du header
    if (headerHtml) {
      const hdrEl = document.createElement("div");
      hdrEl.innerHTML = headerHtml;
      hdrEl.style.padding = "5mm 25mm 3mm 25mm";
      this._applyMeasureContentStyles(hdrEl);
      tempContainer.appendChild(hdrEl);
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
      this.footerHeight = ftrEl.offsetHeight;
      tempContainer.removeChild(ftrEl);
    }

    if (tempContainer.parentNode) {
      tempContainer.parentNode.removeChild(tempContainer);
    }

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
  const margins = getTemplatePageMargins(tpl);
  const charter = getTemplateGraphicCharter(tpl);
  const context = buildDocumentContext(tpl, person);

  // Résoudre les variables (avec classes .var-resolved pour le bleu)
  const hdrHtml = tpl.hasHeader ? resolveVars(tpl.header || "", context) : "";
  const bHtml = resolveVars(tpl.body || "", context);
  const ftrHtml = tpl.hasFooter ? resolveVars(tpl.footer || "", context) : "";

  // Paginer le contenu
  const orientation = getTemplateOrientation(tpl);
  const paginator = new PagePaginator({
    marginTop: margins.mt,
    marginBottom: margins.mb,
    marginLeft: margins.ml,
    marginRight: margins.mr,
    orientation,
    theme: charter,
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
  const margins = getTemplatePageMargins(tpl);
  const orientation = getTemplateOrientation(tpl);
  const charter = getTemplateGraphicCharter(tpl);
  const context = buildDocumentContext(tpl, person);
  const pageWidth = orientation === "landscape" ? "297mm" : "210mm";
  const pageHeight = orientation === "landscape" ? "210mm" : "297mm";

  const hdrRaw = tpl.hasHeader ? resolveVars(tpl.header || "", context) : "";
  const bRaw = resolveVars(tpl.body || "", context);
  const ftrRaw = tpl.hasFooter ? resolveVars(tpl.footer || "", context) : "";

  // Paginer le contenu
  const paginator = new PagePaginator({
    marginTop: margins.mt,
    marginBottom: margins.mb,
    marginLeft: margins.ml,
    marginRight: margins.mr,
    orientation,
    theme: charter,
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
  modal.style.cssText = getDocumentThemeStyleAttr(tpl);

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
      width: ${pageWidth};
      height: ${pageHeight};
      background-color: #fff;
      background-image: var(--doc-page-bg-image, none);
      background-size: var(--doc-page-bg-size, cover);
      background-position: var(--doc-page-bg-position, center center);
      background-repeat: var(--doc-page-bg-repeat, no-repeat);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      flex-shrink: 0;
    }

    .preview-page-header {
      flex-shrink: 0;
      padding: 5mm ${margins.mr}mm 3mm ${margins.ml}mm;
      font-family: var(--doc-font-body, "Times New Roman", Times, serif);
      font-size: 12pt;
      line-height: 1.6;
      color: var(--doc-color-text, #111);
      overflow: hidden;
    }

    .preview-page-body {
      flex: 1;
      padding: 5mm ${margins.mr}mm 5mm ${margins.ml}mm;
      font-family: var(--doc-font-body, "Times New Roman", Times, serif);
      font-size: 12pt;
      line-height: 1.6;
      color: var(--doc-color-text, #111);
      overflow: hidden;
    }

    .preview-page-body.no-header {
      padding-top: ${margins.mt}mm;
    }

    .preview-page-body.no-footer {
      padding-bottom: ${margins.mb}mm;
    }

    .preview-page-footer {
      flex-shrink: 0;
      padding: 3mm ${margins.mr}mm 5mm ${margins.ml}mm;
      font-family: var(--doc-font-body, "Times New Roman", Times, serif);
      font-size: 12pt;
      line-height: 1.6;
      color: var(--doc-color-text, #111);
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
      border: 1px solid var(--doc-color-border, #c8cdd8);
      padding: 6px 10px;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    .preview-page td p, .preview-page th p {
      color: inherit;
    }

    .preview-page th:not([style]) {
      background: var(--doc-table-header-bg, #f2f2f2);
      color: var(--doc-color-text, #111);
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
  const margins = getTemplatePageMargins(tpl);
  const orientation = getTemplateOrientation(tpl);
  const charter = getTemplateGraphicCharter(tpl);
  const context = buildDocumentContext(tpl, person);
  const pageWidth = orientation === "landscape" ? "297mm" : "210mm";
  const pageHeight = orientation === "landscape" ? "210mm" : "297mm";

  // Utiliser les pages déjà paginées ou les générer
  let pagesToPrint = pages;
  if (!pages) {
    const hdrRaw = tpl.hasHeader
      ? resolveVarsRaw(tpl.header || "", context)
      : "";
    const bRaw = resolveVarsRaw(tpl.body || "", context);
    const ftrRaw = tpl.hasFooter
      ? resolveVarsRaw(tpl.footer || "", context)
      : "";

    const paginator = new PagePaginator({
      marginTop: margins.mt,
      marginBottom: margins.mb,
      marginLeft: margins.ml,
      marginRight: margins.mr,
      orientation,
      theme: charter,
    });
    pagesToPrint = paginator.paginate(bRaw, hdrRaw, ftrRaw);
  }

  const printCSS = `
    @page { size: A4 ${orientation}; margin: 0; }
    html, body {
      width: auto !important;
      height: auto !important;
      min-height: auto !important;
      overflow: visible !important;
    }
    * { margin: 0; padding: 0; }
    body { margin: 0; padding: 0; background: #fff; }
    #sirh-print-area { display: block; }

    .sirh-print-page {
      width: ${pageWidth};
      height: ${pageHeight};
      background-color: #fff;
      background-image: var(--doc-page-bg-image, none);
      background-size: var(--doc-page-bg-size, cover);
      background-position: var(--doc-page-bg-position, center center);
      background-repeat: var(--doc-page-bg-repeat, no-repeat);
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
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
      padding: 5mm ${margins.mr}mm 3mm ${margins.ml}mm;
      font-family: var(--doc-font-body, "Times New Roman", Times, serif);
      font-size: 12pt;
      line-height: 1.6;
      color: var(--doc-color-text, #111);
    }

    .sirh-print-body {
      flex: 1;
      padding: 5mm ${margins.mr}mm 5mm ${margins.ml}mm;
      font-family: var(--doc-font-body, "Times New Roman", Times, serif);
      font-size: 12pt;
      line-height: 1.6;
      color: var(--doc-color-text, #111);
      overflow: visible;
    }

    .sirh-print-body.no-header {
      padding-top: ${margins.mt}mm;
    }

    .sirh-print-body.no-footer {
      padding-bottom: ${margins.mb}mm;
    }

    .sirh-print-footer {
      flex-shrink: 0;
      padding: 3mm ${margins.mr}mm 5mm ${margins.ml}mm;
      font-family: var(--doc-font-body, "Times New Roman", Times, serif);
      font-size: 12pt;
      line-height: 1.6;
      color: var(--doc-color-text, #111);
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
      border: 1px solid var(--doc-color-border, #c8cdd8);
      padding: 6px 10px;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    td p, th p { color: inherit; }

    th:not([style]) {
      background: var(--doc-table-header-bg, #f2f2f2);
      color: var(--doc-color-text, #111);
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
  wrap.style.cssText += ";" + getDocumentThemeStyleAttr(tpl);

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
    // Orientation A4
    this.orientation =
      opts.orientation === "landscape" ? "landscape" : "portrait";
    this.pageWidthMm = this.orientation === "landscape" ? 297 : 210;
    this.pageHeightMm = this.orientation === "landscape" ? 210 : 297;
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

// ═══════════════════════════════════════════════════════════════
//  EditorPageVisualizer
//  Affiche des lignes pointillées dans #sec-body pour matérialiser
//  les sauts de page A4 en temps réel pendant l'édition.
//  Compatible avec admin.html : new EditorPageVisualizer({...})
// ═══════════════════════════════════════════════════════════════

class EditorPageVisualizer {
  /**
   * @param {object} opts
   * @param {number} opts.marginTop    marges en mm (défaut 20)
   * @param {number} opts.marginBottom
   * @param {number} opts.marginLeft
   * @param {number} opts.marginRight
   */
  constructor(opts = {}) {
    const toNum = (v, d) => {
      const n = Number(v);
      return isFinite(n) ? n : d;
    };
    this._mt = toNum(opts.marginTop, 20);
    this._mb = toNum(opts.marginBottom, 20);
    this._ml = toNum(opts.marginLeft, 25);
    this._mr = toNum(opts.marginRight, 25);
    this._orientation =
      opts.orientation === "landscape" ? "landscape" : "portrait";

    // Conversion mm → px (96 DPI)
    this._mmPx = (mm) => (mm * 96) / 25.4;

    this._pageH = this._mmPx(this._orientation === "landscape" ? 210 : 297);
    this._secBody = null;
    this._guides = null;
    this._raf = 0;
    this._ro = null; // ResizeObserver
    this._bound = this._refresh.bind(this);
  }

  /**
   * Initialiser le visualizer sur un sélecteur CSS ou élément DOM.
   * @param {string|HTMLElement} selector  ex: "#sec-body"
   * @param {number} headerHeightPx        hauteur du header rendu (0 si absent)
   * @param {number} footerHeightPx        hauteur du footer rendu (0 si absent)
   */
  init(selector, headerHeightPx = 0, footerHeightPx = 0) {
    this._headerH = headerHeightPx || 0;
    this._footerH = footerHeightPx || 0;

    const el =
      typeof selector === "string"
        ? document.querySelector(selector)
        : selector;

    if (!el) return;
    this._secBody = el;

    // Créer (ou récupérer) le conteneur de guides
    let guides = el.querySelector(".epv-guides");
    if (!guides) {
      guides = document.createElement("div");
      guides.className = "epv-guides";
      guides.style.cssText = [
        "position:absolute",
        "inset:0",
        "pointer-events:none",
        "z-index:0",
      ].join(";");
      el.appendChild(guides);
    }
    this._guides = guides;

    // Injecter le CSS des lignes de page (une seule fois)
    this._injectCSS();

    // Observer les changements de taille du contenu
    if (typeof ResizeObserver !== "undefined") {
      this._ro = new ResizeObserver(() => this._scheduleRefresh());
      this._ro.observe(el);
      const pm = el.querySelector(".ProseMirror");
      if (pm) this._ro.observe(pm);
    }

    el.addEventListener("scroll", this._bound, { passive: true });
    window.addEventListener("resize", this._bound, { passive: true });

    this._scheduleRefresh();
  }

  /** Détruire proprement */
  destroy() {
    if (this._ro) {
      this._ro.disconnect();
      this._ro = null;
    }
    if (this._secBody) {
      this._secBody.removeEventListener("scroll", this._bound);
    }
    window.removeEventListener("resize", this._bound);
    if (this._guides) {
      this._guides.innerHTML = "";
    }
    cancelAnimationFrame(this._raf);
    this._secBody = null;
    this._guides = null;
  }

  // ── Privé ──────────────────────────────────────────────────

  _scheduleRefresh() {
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => this._refresh());
  }

  _refresh() {
    const secBody = this._secBody;
    const guides = this._guides;
    if (!secBody || !guides) return;

    const style = getComputedStyle(secBody);
    const padTop = parseFloat(style.paddingTop) || 0;
    const padBottom = parseFloat(style.paddingBottom) || 0;

    // Hauteur utile disponible par page (en px)
    const pageUsable = computeEditorPageUsableHeightPx({
      orientation: this._orientation,
      paddingTopPx: padTop,
      paddingBottomPx: padBottom,
      headerHeightPx: this._headerH,
      footerHeightPx: this._footerH,
    });

    // Hauteur réelle du contenu
    const pm = secBody.querySelector(".ProseMirror");
    const contentH = pm ? Math.max(pm.scrollHeight, pm.offsetHeight) : 0;
    const totalH = Math.max(contentH, pageUsable);

    const totalPages = Math.max(1, Math.ceil(totalH / pageUsable));

    // Reconstruire les lignes de saut de page
    guides.innerHTML = "";
    guides.style.height = totalH + padTop + padBottom + "px";

    for (let p = 2; p <= totalPages; p++) {
      const top = (p - 1) * pageUsable;

      const line = document.createElement("div");
      line.className = "epv-line";
      line.style.top = top + padTop + "px";
      line.dataset.label = `— Page ${p} —`;

      guides.appendChild(line);
    }

    // Mettre à jour le badge "Page X / Y" si présent
    this._updateBadge(secBody, pageUsable, padTop, totalPages);
  }

  _updateBadge(secBody, pageUsable, padTop, totalPages) {
    const badge = document.getElementById("pageLiveBadge");
    if (!badge) return;

    // Calcul de la page courante depuis la position du curseur
    let scrollY = secBody.scrollTop;
    const curPage = Math.max(
      1,
      Math.min(totalPages, Math.floor(scrollY / pageUsable) + 1),
    );
    badge.textContent = `Page ${curPage} / ${totalPages}`;
  }

  _injectCSS() {
    if (document.getElementById("epv-css")) return;
    const s = document.createElement("style");
    s.id = "epv-css";
    s.textContent = `
      .epv-guides {
        position: absolute; inset: 0;
        pointer-events: none; z-index: 0;
      }
      .epv-line {
        position: absolute;
        left: 6px; right: 6px; height: 0;
        border-top: 2px dashed rgba(148,153,176,.42);
        transition: border-color .15s;
      }
      .epv-line::after {
        content: attr(data-label);
        position: absolute;
        right: 0; top: -12px;
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 10px; font-weight: 700; letter-spacing: .03em;
        color: #667085;
        background: rgba(240,242,245,.96);
        border: 1px solid rgba(148,153,176,.25);
        font-family: 'IBM Plex Sans', sans-serif;
        white-space: nowrap;
        pointer-events: none;
      }
    `;
    document.head.appendChild(s);
  }
}

// Exposer globalement
window.EditorPageVisualizer = EditorPageVisualizer;
window.computeEditorPageUsableHeightPx = computeEditorPageUsableHeightPx;
