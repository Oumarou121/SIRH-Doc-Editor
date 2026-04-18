const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const sql = require("mssql");

const PORT = Number(3000);
const ROOT_DIR = __dirname;
const DEFAULT_FAMILY_BENEFICIARY_TABLE = "personnel";
const INTERNAL_DB_NAME = "UnivAdENIMDB";
const AUTH_DB_NAME = "DSSGAEIAM";
const SESSION_COOKIE = "sirhdoc_session";

const sessions = new Map();

const config = {
  user: "sa",
  password: "N7vR2pXk9Lm4Qz8T",
  server: "92.222.230.31",
  database: INTERNAL_DB_NAME,
  requestTimeout: 60000,
  connectionTimeout: 30000,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  port: 1433,
};

let poolPromise = null;

async function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config);
  }
  return poolPromise;
}

let schemaReadyPromise = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

function normalizeOrganizationId(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function getScopedOrganizationId(record = {}, fallback = null) {
  return normalizeOrganizationId(
    record?.organizationId ?? record?.etablissementId,
    fallback,
  );
}

function isOrganizationBeneficiaryMode(mode) {
  return String(mode || "").toLowerCase() === "organization";
}

function isScopedOrganizationFamily(family = {}) {
  return (
    family?.beneficiaryMode === "etablissement" ||
    isOrganizationBeneficiaryMode(family?.beneficiaryMode)
  );
}

function withOrganizationQueryParams(params = {}) {
  const scopedId = normalizeOrganizationId(
    params.organizationId ?? params.etablissementId ?? params.etabId,
    null,
  );
  return {
    ...params,
    organizationId: scopedId,
    etablissementId: scopedId,
    etabId: scopedId,
  };
}

function normalizeFilterOption(option) {
  if (option === undefined || option === null) return null;
  if (typeof option !== "object" || Array.isArray(option)) {
    const value = String(option).trim();
    return value ? { value, label: value } : null;
  }
  const value = String(option.value ?? option.id ?? option.code ?? "").trim();
  if (!value) return null;
  const label = String(
    option.label ?? option.libelle ?? option.nom ?? option.name ?? value,
  ).trim();
  return { value, label: label || value };
}

function normalizeFilterOptions(options) {
  const seen = new Set();
  return (Array.isArray(options) ? options : [])
    .map((option) => normalizeFilterOption(option))
    .filter((option) => {
      if (!option || seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });
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
  return {
    id: String(filter.id || `flt_${index + 1}`),
    key: String(
      filter.key || filter.param || filter.paramName || `filtre_${index + 1}`,
    ).trim(),
    label,
    type,
    sourceType:
      type === "select" && filter.sourceType === "sql" ? "sql" : "static",
    placeholder: String(filter.placeholder || "").trim(),
    helpText: String(filter.helpText || filter.help || "").trim(),
    roles: {
      admin: filter?.roles?.admin !== false,
      user: filter?.roles?.user !== false,
    },
    columnBinding: normalizeFilterColumnBinding(
      filter.columnBinding || filter.binding || {},
    ),
    staticOptions:
      type === "select"
        ? normalizeFilterOptions(filter.staticOptions || [])
        : [],
    sqlBuilder:
      type === "select"
        ? normalizeFilterSqlBuilder(filter.sqlBuilder || filter.builder || {})
        : normalizeFilterSqlBuilder({}),
    sqlQuery:
      type === "select" && filter.sourceType === "sql"
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

function normalizeFamilyRecord(record = {}) {
  const next = clone(record || {});
  next.beneficiaryMode = isScopedOrganizationFamily(next)
    ? "organization"
    : "table";
  next.beneficiaryTable =
    next.beneficiaryMode === "table"
      ? String(next.beneficiaryTable || DEFAULT_FAMILY_BENEFICIARY_TABLE)
      : null;
  next.beneficiarySql = String(next.beneficiarySql || "").trim();
  next.filterCatalog = (
    Array.isArray(next.filterCatalog) ? next.filterCatalog : []
  )
    .map((filter, index) => normalizeFilterDefinition(filter, index))
    .filter(Boolean);
  return next;
}

function normalizeTemplateRecord(record = {}) {
  const next = clone(record || {});
  next.organizationId = getScopedOrganizationId(next);
  next.etablissementId = next.organizationId;
  next.filterProfile = (
    Array.isArray(next.filterProfile) ? next.filterProfile : []
  )
    .map((entry, index) => normalizeTemplateFilterProfileEntry(entry, index))
    .filter(Boolean);
  next.graphicCharterId = next.graphicCharterId
    ? String(next.graphicCharterId)
    : null;
  next.sectionDirections =
    next.sectionDirections && typeof next.sectionDirections === "object"
      ? {
          header:
            String(next.sectionDirections.header || "ltr")
              .toLowerCase()
              .trim() === "rtl"
              ? "rtl"
              : "ltr",
          body:
            String(next.sectionDirections.body || "ltr")
              .toLowerCase()
              .trim() === "rtl"
              ? "rtl"
              : "ltr",
          footer:
            String(next.sectionDirections.footer || "ltr")
              .toLowerCase()
              .trim() === "rtl"
              ? "rtl"
              : "ltr",
        }
      : { header: "ltr", body: "ltr", footer: "ltr" };
  return next;
}

function normalizeState(state) {
  const next = state && typeof state === "object" ? state : {};
  const normalizedOrganizations = Array.isArray(next.organizations)
    ? clone(next.organizations)
    : Array.isArray(next.etablissements)
      ? clone(next.etablissements)
      : [];
  return {
    etablissements: normalizedOrganizations,
    organizations: clone(normalizedOrganizations),
    admins: Array.isArray(next.admins) ? clone(next.admins) : [],
    families: Array.isArray(next.families)
      ? next.families.map((family) => normalizeFamilyRecord(family))
      : [],
    templates: Array.isArray(next.templates)
      ? next.templates.map((template) => normalizeTemplateRecord(template))
      : [],
    personnel: Array.isArray(next.personnel) ? clone(next.personnel) : [],
    settings:
      next.settings && typeof next.settings === "object"
        ? clone(next.settings)
        : {},
  };
}

/**
 * Convert named placeholders (:param) to @param for mssql,
 * and return { sql, params } where params is a flat map.
 */
function parseNamedSql(querySql, params = {}) {
  const usedParams = {};
  const compiled = querySql.replace(/:([a-zA-Z_]\w*)/g, (_, key) => {
    usedParams[key] = params[key] ?? null;
    return `@${key}`;
  });
  return { sql: compiled, params: usedParams };
}

function parseMaybeJsonValue(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (
    !trimmed.startsWith("[") &&
    !trimmed.startsWith("{") &&
    trimmed !== "null" &&
    trimmed !== "true" &&
    trimmed !== "false"
  ) {
    return value;
  }
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    return value;
  }
}

function cleanQueryRow(row) {
  const next = {};
  for (const [key, rawValue] of Object.entries(row)) {
    let value = parseMaybeJsonValue(rawValue);
    if (Array.isArray(value)) {
      value = value
        .filter((item) => item !== null)
        .map((item) => {
          if (item && typeof item === "object" && !Array.isArray(item)) {
            const cleaned = Object.fromEntries(
              Object.entries(item).filter(([, v]) => v !== null),
            );
            return Object.keys(cleaned).length ? cleaned : null;
          }
          return item;
        })
        .filter((item) => item !== null);
    }
    next[key] = value;
  }
  return next;
}

function candidateRelationTables(columnName) {
  const base = String(columnName || "").replace(/_id$/i, "");
  if (!base || base === "id") return [];
  return [...new Set([base, `${base}s`, `${base}es`].filter(Boolean))];
}

function inferSchemaRelations(tables, columns, existingRelations) {
  const tableSet = new Set((tables || []).map((table) => table.name));
  const pkByTable = new Map();
  (columns || []).forEach((column) => {
    if (!pkByTable.has(column.table) && column.key === "PRI") {
      pkByTable.set(column.table, column.name);
    }
  });
  (tables || []).forEach((table) => {
    if (!pkByTable.has(table.name)) pkByTable.set(table.name, "id");
  });

  const relationKey = (rel) =>
    `${rel.table}.${rel.column}->${rel.referencedTable}.${rel.referencedColumn}`;
  const known = new Set((existingRelations || []).map(relationKey));
  const inferred = [];

  (columns || []).forEach((column) => {
    if (!/_id$/i.test(column.name) || column.name.toLowerCase() === "id")
      return;
    for (const candidate of candidateRelationTables(column.name)) {
      if (!tableSet.has(candidate)) continue;
      const relation = {
        table: column.table,
        column: column.name,
        referencedTable: candidate,
        referencedColumn: pkByTable.get(candidate) || "id",
        inferred: true,
      };
      const key = relationKey(relation);
      if (known.has(key)) continue;
      known.add(key);
      inferred.push(relation);
      break;
    }
  });

  return inferred;
}

function safeJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

function parseCookies(req) {
  const raw = String(req?.headers?.cookie || "");
  return Object.fromEntries(
    raw
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf("=");
        if (idx < 0) return [part, ""];
        return [
          decodeURIComponent(part.slice(0, idx)),
          decodeURIComponent(part.slice(idx + 1)),
        ];
      }),
  );
}

function createSession(user) {
  const token = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  sessions.set(token, {
    token,
    user: clone(user),
    createdAt: new Date().toISOString(),
  });
  return token;
}

function getSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  return token ? sessions.get(token) || null : null;
}

function clearSession(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) sessions.delete(token);
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
}

function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`,
  );
}

function normalizeRole(role) {
  const value = String(role || "")
    .trim()
    .toLowerCase();
  if (value === "supadmin" || value === "superadmin") return "supAdmin";
  if (value === "admin") return "admin";
  return "user";
}

function getRoleHome(role) {
  if (role === "supAdmin") return "/superAdmin.html";
  if (role === "admin") return "/admin.html";
  return "/user.html";
}

function sqlString(row, keys = []) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function serializeDateValue(value) {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  const trimmed = String(value).trim();
  return trimmed || null;
}

function isTempClientId(value) {
  return /^[a-z]+_/i.test(String(value || "").trim());
}

function getPreferredColumnName(columns = [], candidates = []) {
  const lowerMap = new Map(
    columns.map((column) => [
      String(column.name || "").toLowerCase(),
      column.name,
    ]),
  );
  for (const candidate of candidates) {
    const match = lowerMap.get(String(candidate || "").toLowerCase());
    if (match) return match;
  }
  return null;
}

function normalizeComparableValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getOrganizationNameForPersistence(record = {}, preferredColumn = "") {
  const rawValue =
    preferredColumn && record?.raw && typeof record.raw === "object"
      ? record.raw[preferredColumn]
      : undefined;
  if (rawValue !== undefined && rawValue !== null && String(rawValue).trim()) {
    return String(rawValue).trim();
  }
  const nextName = String(record?.nom || "").trim();
  if (!nextName) return "";
  if (normalizeComparableValue(nextName) === "organisation") return "";
  return nextName;
}

async function getExternalTableColumns(databaseName, tableName) {
  const pool = await getPool();
  const databaseId = quoteSqlServerIdentifier(databaseName);
  const result = await pool
    .request()
    .input("tableName", sql.NVarChar, tableName)
    .query(
      `SELECT c.name AS name,
              ty.name AS type,
              c.is_nullable AS is_nullable,
              c.is_identity AS is_identity
       FROM ${databaseId}.sys.columns c
       INNER JOIN ${databaseId}.sys.tables t ON t.object_id = c.object_id
       INNER JOIN ${databaseId}.sys.schemas s ON s.schema_id = t.schema_id
       INNER JOIN ${databaseId}.sys.types ty ON ty.user_type_id = c.user_type_id
       WHERE s.name = 'dbo' AND t.name = @tableName
       ORDER BY c.column_id`,
    );
  return result.recordset.map((row) => ({
    name: row.name,
    type: row.type,
    nullable: !!row.is_nullable,
    identity: !!row.is_identity,
  }));
}

async function loadAppSettings() {
  if (!(await tableExists("app_setting"))) return {};
  const pool = await getPool();
  const result = await pool
    .request()
    .query(`SELECT [key], value_json FROM app_setting`);
  return result.recordset.reduce((acc, row) => {
    acc[row.key] = safeJson(row.value_json, null);
    return acc;
  }, {});
}

async function saveAppSettings(settings = {}, transaction = null) {
  if (!(await tableExists("app_setting"))) return;
  const pool = transaction ? null : await getPool();
  const requestFactory = () =>
    transaction ? buildRequest(transaction) : new sql.Request(pool);
  const clearReq = requestFactory();
  await clearReq.query("DELETE FROM app_setting");
  for (const [key, value] of Object.entries(settings || {})) {
    const req = requestFactory();
    req.input("key", sql.NVarChar, String(key));
    req.input("value_json", sql.NVarChar, JSON.stringify(value ?? null));
    await req.query(
      "INSERT INTO app_setting ([key], value_json) VALUES (@key, @value_json)",
    );
  }
}

function buildOrganizationDbRow(record = {}, columns = []) {
  const raw =
    record?.raw && typeof record.raw === "object" ? clone(record.raw) : {};
  const row = { ...raw };
  const nameCol = getPreferredColumnName(columns, ["NameFr", "Name", "Nom"]);
  const cityCol = getPreferredColumnName(columns, ["City", "Ville"]);
  const addressCol = getPreferredColumnName(columns, ["Address", "Adresse"]);
  const phoneCol = getPreferredColumnName(columns, [
    "Phone",
    "Telephone",
    "Tel",
  ]);
  const emailCol = getPreferredColumnName(columns, ["Email", "Mail"]);
  const persistedName = getOrganizationNameForPersistence(record, nameCol);
  if (nameCol && persistedName) row[nameCol] = persistedName;
  if (cityCol && record.ville !== undefined) row[cityCol] = record.ville;
  if (addressCol && record.adresse !== undefined)
    row[addressCol] = record.adresse;
  if (phoneCol && record.tel !== undefined) row[phoneCol] = record.tel;
  if (emailCol && record.email !== undefined) row[emailCol] = record.email;
  return row;
}

function buildAdminDbRow(
  record = {},
  columns = [],
  mappedOrganizationId = null,
) {
  const raw =
    record?.raw && typeof record.raw === "object" ? clone(record.raw) : {};
  const row = { ...raw };
  const nameCol = getPreferredColumnName(columns, ["Name", "Nom"]);
  const emailCol = getPreferredColumnName(columns, ["Email", "Mail"]);
  const passwordCol = getPreferredColumnName(columns, ["PassWord", "Password"]);
  const orgCol = getPreferredColumnName(columns, [
    "IdOrganization",
    "OrganizationId",
  ]);
  const roleCol = getPreferredColumnName(columns, ["Role"]);
  const profileCol = getPreferredColumnName(columns, ["Profil", "Profile"]);
  if (nameCol && record.nom !== undefined) row[nameCol] = record.nom;
  if (emailCol && record.email !== undefined) row[emailCol] = record.email;
  if (
    orgCol &&
    mappedOrganizationId !== undefined &&
    mappedOrganizationId !== null
  )
    row[orgCol] = mappedOrganizationId;
  if (roleCol) row[roleCol] = "admin";
  if (profileCol && record.profile !== undefined)
    row[profileCol] = record.profile;
  if (
    passwordCol &&
    (row[passwordCol] === undefined || row[passwordCol] === null)
  )
    row[passwordCol] = "";
  return row;
}

function quoteSqlServerIdentifier(name) {
  return `[${String(name || "").replace(/]/g, "]]")}]`;
}

function normalizeSqlIdentifier(raw) {
  const value = String(raw || "").trim();
  if (
    (value.startsWith("[") && value.endsWith("]")) ||
    (value.startsWith("`") && value.endsWith("`")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function isWordBoundaryChar(char) {
  return !char || !/[a-z0-9_]/i.test(char);
}

function splitTopLevelSql(text, delimiter = ",") {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = 0;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quote === "'") {
      if (char === "'" && next === "'") {
        i += 1;
        continue;
      }
      if (char === "'") quote = null;
      continue;
    }
    if (quote === '"') {
      if (char === '"') quote = null;
      continue;
    }
    if (quote === "`") {
      if (char === "`") quote = null;
      continue;
    }
    if (quote === "]") {
      if (char === "]") quote = null;
      continue;
    }

    if (char === "'") {
      quote = "'";
      continue;
    }
    if (char === '"') {
      quote = '"';
      continue;
    }
    if (char === "`") {
      quote = "`";
      continue;
    }
    if (char === "[") {
      quote = "]";
      continue;
    }

    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth === 0 && char === delimiter) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }

  const tail = text.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function findTopLevelKeyword(text, keyword, startIndex = 0) {
  const upper = text.toUpperCase();
  const target = keyword.toUpperCase();
  let depth = 0;
  let quote = null;

  for (let i = startIndex; i <= text.length - target.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quote === "'") {
      if (char === "'" && next === "'") {
        i += 1;
        continue;
      }
      if (char === "'") quote = null;
      continue;
    }
    if (quote === '"') {
      if (char === '"') quote = null;
      continue;
    }
    if (quote === "`") {
      if (char === "`") quote = null;
      continue;
    }
    if (quote === "]") {
      if (char === "]") quote = null;
      continue;
    }

    if (char === "'") {
      quote = "'";
      continue;
    }
    if (char === '"') {
      quote = '"';
      continue;
    }
    if (char === "`") {
      quote = "`";
      continue;
    }
    if (char === "[") {
      quote = "]";
      continue;
    }

    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth !== 0) continue;
    if (upper.slice(i, i + target.length) !== target) continue;
    if (!isWordBoundaryChar(upper[i - 1])) continue;
    if (!isWordBoundaryChar(upper[i + target.length])) continue;
    return i;
  }

  return -1;
}

function stripOuterParentheses(text) {
  let value = String(text || "").trim();
  while (value.startsWith("(") && value.endsWith(")")) {
    let depth = 0;
    let quote = null;
    let wraps = true;
    for (let i = 0; i < value.length; i += 1) {
      const char = value[i];
      const next = value[i + 1];
      if (quote === "'") {
        if (char === "'" && next === "'") {
          i += 1;
          continue;
        }
        if (char === "'") quote = null;
        continue;
      }
      if (quote === '"') {
        if (char === '"') quote = null;
        continue;
      }
      if (quote === "`") {
        if (char === "`") quote = null;
        continue;
      }
      if (quote === "]") {
        if (char === "]") quote = null;
        continue;
      }
      if (char === "'") {
        quote = "'";
        continue;
      }
      if (char === '"') {
        quote = '"';
        continue;
      }
      if (char === "`") {
        quote = "`";
        continue;
      }
      if (char === "[") {
        quote = "]";
        continue;
      }
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;
      if (depth === 0 && i < value.length - 1) {
        wraps = false;
        break;
      }
    }
    if (!wraps) break;
    value = value.slice(1, -1).trim();
  }
  return value;
}

function parseSelectStatement(querySql) {
  const sqlText = String(querySql || "")
    .trim()
    .replace(/;+\s*$/, "");
  if (!/^\s*select\b/i.test(sqlText)) return null;

  const fromIndex = findTopLevelKeyword(sqlText, "FROM", 6);
  if (fromIndex < 0) {
    return {
      select: sqlText.replace(/^\s*select\b/i, "").trim(),
      from: "",
      where: "",
      groupBy: "",
      orderBy: "",
      limit: "",
      sql: sqlText,
    };
  }

  const whereIndex = findTopLevelKeyword(sqlText, "WHERE", fromIndex + 4);
  const groupIndex = findTopLevelKeyword(sqlText, "GROUP BY", fromIndex + 4);
  const orderIndex = findTopLevelKeyword(sqlText, "ORDER BY", fromIndex + 4);
  const limitIndex = findTopLevelKeyword(sqlText, "LIMIT", fromIndex + 4);

  const cuts = [whereIndex, groupIndex, orderIndex, limitIndex].filter(
    (idx) => idx >= 0,
  );
  const afterFromIndex = cuts.length ? Math.min(...cuts) : sqlText.length;

  const nextAfterWhere = [groupIndex, orderIndex, limitIndex]
    .filter((idx) => idx > whereIndex)
    .sort((a, b) => a - b)[0];
  const nextAfterGroup = [orderIndex, limitIndex]
    .filter((idx) => idx > groupIndex)
    .sort((a, b) => a - b)[0];
  const nextAfterOrder = [limitIndex]
    .filter((idx) => idx > orderIndex)
    .sort((a, b) => a - b)[0];

  return {
    select: sqlText.slice(6, fromIndex).trim(),
    from: sqlText.slice(fromIndex, afterFromIndex).trim(),
    where:
      whereIndex >= 0
        ? sqlText.slice(whereIndex, nextAfterWhere || sqlText.length).trim()
        : "",
    groupBy:
      groupIndex >= 0
        ? sqlText.slice(groupIndex, nextAfterGroup || sqlText.length).trim()
        : "",
    orderBy:
      orderIndex >= 0
        ? sqlText.slice(orderIndex, nextAfterOrder || sqlText.length).trim()
        : "",
    limit: limitIndex >= 0 ? sqlText.slice(limitIndex).trim() : "",
    sql: sqlText,
  };
}

function parseSelectItem(itemSql) {
  const item = String(itemSql || "").trim();
  const asIndex = findTopLevelKeyword(item, "AS");
  if (asIndex < 0) return { expr: item, alias: null };
  return {
    expr: item.slice(0, asIndex).trim(),
    alias: normalizeSqlIdentifier(item.slice(asIndex + 2).trim()),
  };
}

function unquoteSqlStringLiteral(token) {
  const value = String(token || "").trim();
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return normalizeSqlIdentifier(value);
}

function convertIdentifierQuotes(sqlText) {
  return String(sqlText || "").replace(/`([^`]+)`/g, (_, name) =>
    quoteSqlServerIdentifier(name),
  );
}

function convertLegacyFunctions(sqlText) {
  return convertIdentifierQuotes(sqlText)
    .replace(/\bIFNULL\s*\(/gi, "ISNULL(")
    .replace(/\bNOW\s*\(\s*\)/gi, "GETDATE()")
    .replace(/\bCURDATE\s*\(\s*\)/gi, "CAST(GETDATE() AS DATE)");
}

function stripDanglingSelectCommas(sqlText) {
  return String(sqlText || "")
    .replace(/,\s*(\r?\n\s*FROM\b)/gi, "$1")
    .replace(/,\s*(\r?\n\s*FOR\s+JSON\b)/gi, "$1");
}

function applyTopLevelLimit(sqlText) {
  const parts = parseSelectStatement(sqlText);
  if (!parts?.limit) return sqlText;
  const match = /\bLIMIT\s+(\d+)\s*$/i.exec(parts.limit);
  if (!match) return sqlText;
  const limit = Number(match[1]);
  if (!Number.isFinite(limit) || limit <= 0) return sqlText;

  const body = [
    parts.select,
    parts.from,
    parts.where,
    parts.groupBy,
    parts.orderBy,
  ]
    .filter(Boolean)
    .join("\n");
  if (/^\s*DISTINCT\b/i.test(body)) {
    return `SELECT DISTINCT TOP (${limit}) ${body.replace(/^\s*DISTINCT\b/i, "").trim()}`;
  }
  return `SELECT TOP (${limit}) ${body}`;
}

function isLegacyAggregateExpression(exprSql) {
  const expr = String(exprSql || "").trim();
  return (
    /^JSON_ARRAYAGG\s*\(/i.test(expr) ||
    /^MAX\s*\(/i.test(expr) ||
    /^MIN\s*\(/i.test(expr) ||
    /^COUNT\s*\(/i.test(expr)
  );
}

function compileLegacyAggregateQuery(exprSql, fromClause, whereClause) {
  const expr = String(exprSql || "").trim();
  const fromWhere = [
    convertLegacyFunctions(fromClause),
    convertLegacyFunctions(whereClause),
  ]
    .filter(Boolean)
    .join("\n");

  const jsonObjectMatch =
    /^JSON_ARRAYAGG\s*\(\s*JSON_OBJECT\s*\(([\s\S]*)\)\s*\)$/i.exec(expr);
  if (jsonObjectMatch) {
    const args = splitTopLevelSql(jsonObjectMatch[1]);
    const fields = [];
    for (let i = 0; i < args.length; i += 2) {
      const keyToken = args[i];
      const valueToken = args[i + 1];
      if (!keyToken || !valueToken) continue;
      fields.push(
        `${convertLegacyFunctions(valueToken)} AS ${quoteSqlServerIdentifier(
          unquoteSqlStringLiteral(keyToken),
        )}`,
      );
    }
    return [
      `SELECT ${fields.join(", ")}`,
      fromWhere,
      "FOR JSON PATH, INCLUDE_NULL_VALUES",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const jsonArrayMatch = /^JSON_ARRAYAGG\s*\(([\s\S]*)\)$/i.exec(expr);
  if (jsonArrayMatch) {
    const valueExpr = convertLegacyFunctions(jsonArrayMatch[1]);
    return [
      "SELECT COALESCE(",
      `  '[' + STRING_AGG('\"' + STRING_ESCAPE(CONVERT(NVARCHAR(MAX), ${valueExpr}), 'json') + '\"', ',') + ']',`,
      "  '[]'",
      ")",
      fromWhere,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const maxMatch = /^(MAX|MIN|COUNT)\s*\(([\s\S]*)\)$/i.exec(expr);
  if (maxMatch) {
    return [
      `SELECT ${maxMatch[1].toUpperCase()}(${convertLegacyFunctions(maxMatch[2])})`,
      fromWhere,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [`SELECT ${convertLegacyFunctions(expr)}`, fromWhere]
    .filter(Boolean)
    .join("\n");
}

function translateLegacySelectQuery(querySql) {
  const original = String(querySql || "")
    .trim()
    .replace(/;+\s*$/, "");
  if (!original) return original;

  const parsed = parseSelectStatement(original);
  if (!parsed) {
    return convertLegacyFunctions(original);
  }

  const selectItems = splitTopLevelSql(parsed.select);
  const parsedItems = selectItems.map(parseSelectItem);
  const hasSubqueryItem = parsedItems.some((item) => {
    const inner = stripOuterParentheses(item.expr);
    return /^\s*select\b/i.test(inner);
  });
  const hasAggregateItem = parsedItems.some((item) =>
    isLegacyAggregateExpression(item.expr),
  );

  if (hasSubqueryItem) {
    const rewrittenItems = parsedItems.map((item) => {
      const inner = stripOuterParentheses(item.expr);
      const compiledExpr = /^\s*select\b/i.test(inner)
        ? `(${translateLegacySelectQuery(inner)})`
        : convertLegacyFunctions(item.expr);
      return item.alias
        ? `${compiledExpr} AS ${quoteSqlServerIdentifier(item.alias)}`
        : compiledExpr;
    });

    const rebuilt = [
      "SELECT",
      rewrittenItems.map((item) => `  ${item}`).join(",\n"),
      convertLegacyFunctions(parsed.from),
      convertLegacyFunctions(parsed.where),
      convertLegacyFunctions(parsed.groupBy),
      convertLegacyFunctions(parsed.orderBy),
    ]
      .filter(Boolean)
      .join("\n");

    return applyTopLevelLimit(rebuilt);
  }

  if (hasAggregateItem) {
    if (parsedItems.length === 1 && !parsedItems[0].alias) {
      return compileLegacyAggregateQuery(
        parsedItems[0].expr,
        parsed.from,
        parsed.where,
      );
    }

    return [
      "SELECT",
      parsedItems
        .map((item) => {
          const compiled = compileLegacyAggregateQuery(
            item.expr,
            parsed.from,
            parsed.where,
          );
          return `  (${compiled}) AS ${quoteSqlServerIdentifier(
            item.alias || "value",
          )}`;
        })
        .join(",\n"),
    ].join("\n");
  }

  return applyTopLevelLimit(convertLegacyFunctions(original));
}

function normalizeSelectQueryForSqlServer(querySql) {
  const raw = String(querySql || "").trim();
  if (!raw) return raw;
  if (!/^\s*select\b/i.test(raw)) return raw;
  if (/JSON_ARRAYAGG|JSON_OBJECT|`|\bLIMIT\s+\d+\b/i.test(raw)) {
    return stripDanglingSelectCommas(translateLegacySelectQuery(raw));
  }
  return stripDanglingSelectCommas(convertLegacyFunctions(raw));
}

// ---------------------------------------------------------------------------
// Schema helpers (SQL Server)
// ---------------------------------------------------------------------------

async function tableExists(tableName) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("tname", sql.NVarChar, tableName)
    .query(
      `SELECT COUNT(*) AS cnt
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_NAME = @tname AND TABLE_TYPE = 'BASE TABLE'`,
    );
  return result.recordset[0].cnt > 0;
}

async function tableHasColumn(tableName, columnName) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("tname", sql.NVarChar, tableName)
    .input("cname", sql.NVarChar, columnName)
    .query(
      `SELECT COUNT(*) AS cnt
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_NAME = @tname AND COLUMN_NAME = @cname`,
    );
  return result.recordset[0].cnt > 0;
}

async function ensureSchema() {
  if (schemaReadyPromise) return schemaReadyPromise;
  schemaReadyPromise = (async () => {
    const schemaPath = path.join(ROOT_DIR, "schema.sql");
    if (!fs.existsSync(schemaPath)) return;

    const sqlText = fs.readFileSync(schemaPath, "utf8");
    const pool = await getPool();

    await pool.request().query(sqlText);
  })();

  return schemaReadyPromise;
}

// ---------------------------------------------------------------------------
// Data loaders
// ---------------------------------------------------------------------------

async function loadFamilies() {
  if (!(await tableExists("family"))) return [];
  const hasBeneficiaryMode = await tableHasColumn("family", "beneficiary_mode");
  const hasBeneficiaryTable = await tableHasColumn(
    "family",
    "beneficiary_table",
  );
  const hasBeneficiarySql = await tableHasColumn(
    "family",
    "beneficiary_sql_text",
  );
  const hasFilterCatalog = await tableHasColumn(
    "family",
    "filter_catalog_json",
  );

  const pool = await getPool();
  const result = await pool.request().query(
    `SELECT id, nom, icon, description,
            ${hasBeneficiaryMode ? "beneficiary_mode," : "'table' AS beneficiary_mode,"}
            ${hasBeneficiaryTable ? "beneficiary_table," : "NULL AS beneficiary_table,"}
            ${hasBeneficiarySql ? "beneficiary_sql_text," : "NULL AS beneficiary_sql_text,"}
            ${hasFilterCatalog ? "filter_catalog_json," : "'[]' AS filter_catalog_json,"}
            sql_text, created_at, classes_json
     FROM family
     ORDER BY nom`,
  );
  return result.recordset.map((row) => ({
    id: String(row.id),
    nom: row.nom,
    icon: row.icon,
    description: row.description,
    beneficiaryMode: isScopedOrganizationFamily({
      beneficiaryMode: row.beneficiary_mode,
    })
      ? "organization"
      : "table",
    beneficiaryTable: isScopedOrganizationFamily({
      beneficiaryMode: row.beneficiary_mode,
    })
      ? null
      : row.beneficiary_table || DEFAULT_FAMILY_BENEFICIARY_TABLE,
    beneficiarySql: row.beneficiary_sql_text || "",
    filterCatalog: safeJson(row.filter_catalog_json, []),
    sql: row.sql_text,
    createdAt: row.created_at,
    classes: safeJson(row.classes_json, []),
  }));
}

async function loadOrganizations() {
  const pool = await getPool();
  const result = await pool
    .request()
    .query(`SELECT * FROM [${AUTH_DB_NAME}].[dbo].[Organization] ORDER BY 1`);
  return result.recordset.map((row) => {
    const raw = {};
    Object.entries(row || {}).forEach(([key, value]) => {
      raw[key] = value;
    });
    const idValue =
      row.Id ??
      row.ID ??
      row.id ??
      row.OrganizationId ??
      row.IdOrganization ??
      null;
    return {
      id: idValue === undefined || idValue === null ? "" : String(idValue),
      nom:
        sqlString(row, ["Name", "Nom", "Libelle", "Label", "Title"]) ||
        "Organisation",
      ville: sqlString(row, ["City", "Ville", "Town"]),
      adresse: sqlString(row, ["Address", "Adresse", "Address1"]),
      tel: sqlString(row, ["Phone", "Telephone", "Tel", "Mobile"]),
      email: sqlString(row, ["Email", "Mail"]),
      raw,
      graphicCharters: [],
      createdAt: row.CreatedAt || row.CreatedDate || null,
      updatedAt: row.UpdatedAt || row.ModifiedDate || null,
    };
  });
}

async function loadUsers() {
  const pool = await getPool();
  const result = await pool
    .request()
    .query(`SELECT * FROM [${AUTH_DB_NAME}].[dbo].[User] ORDER BY [Name]`);
  return result.recordset.map((row) => ({
    id: String(row.Id),
    name: row.Name || "",
    email: row.Email || "",
    password: row.PassWord || "",
    organizationId:
      row.IdOrganization === undefined || row.IdOrganization === null
        ? null
        : String(row.IdOrganization),
    role: normalizeRole(row.Role),
    profile: row.Profil || "",
    raw: clone(row),
  }));
}

// async function authenticateUser(identifier, password) {
//   const pool = await getPool();
//   const request = pool.request();
//   request.input("identifier", sql.NVarChar, identifier);
//   request.input("password", sql.NVarChar, password);
//   const result = await request.query(
//     `SELECT TOP (1) *
//      FROM [${AUTH_DB_NAME}].[dbo].[User]
//      WHERE ([Name] = @identifier OR [Email] = @identifier)
//        AND [PassWord] = @password`,
//   );
//   const row = result.recordset[0];
//   if (!row) return null;
//   return {
//     id: String(row.Id),
//     name: row.Name || "",
//     email: row.Email || "",
//     organizationId:
//       row.IdOrganization === undefined || row.IdOrganization === null
//         ? null
//         : String(row.IdOrganization),
//     role: normalizeRole(row.Role),
//     profile: row.Profil || "",
//   };
// }

const users = [
  {
    id: "1",
    name: "Super Admin",
    email: "super.admin@gmail.com",
    password: "azerty",
    role: "supAdmin",
    organizationId: 2,
    profile: "",
  },
  {
    id: "2",
    name: "Admin",
    email: "admin@gmail.com",
    password: "azerty",
    role: "admin",
    organizationId: 2,
    profile: "",
  },
  {
    id: "3",
    name: "User",
    email: "user@gmail.com",
    password: "azerty",
    role: "user",
    organizationId: 2,
    profile: "",
  },
];

async function authenticateUser(identifier, password) {
  // recherche par email ou name
  const user = users.find(
    (u) =>
      (u.email === identifier || u.name === identifier) &&
      u.password === password,
  );

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    organizationId: user.organizationId,
    role: user.role,
    profile: user.profile,
  };
}

async function loadEtablissements() {
  if (!(await tableExists("etablissement"))) return [];
  const hasGraphicCharterJson = await tableHasColumn(
    "etablissement",
    "graphic_charter_json",
  );
  const hasBrandingJson = hasGraphicCharterJson
    ? false
    : await tableHasColumn("etablissement", "branding_json");
  const hasCreatedAt = await tableHasColumn("etablissement", "created_at");
  const hasUpdatedAt = await tableHasColumn("etablissement", "updated_at");

  const pool = await getPool();
  const result = await pool.request().query(
    `SELECT id, nom, ville, adresse, tel,
            ${
              hasGraphicCharterJson
                ? "graphic_charter_json,"
                : hasBrandingJson
                  ? "branding_json AS graphic_charter_json,"
                  : "NULL AS graphic_charter_json,"
            }
            ${hasCreatedAt ? "created_at," : "NULL AS created_at,"}
            ${hasUpdatedAt ? "updated_at" : "NULL AS updated_at"}
     FROM etablissement
     ORDER BY nom`,
  );
  return result.recordset.map((row) => ({
    id: String(row.id),
    nom: row.nom || "",
    ville: row.ville || "",
    adresse: row.adresse || "",
    tel: row.tel || "",
    graphicCharters: safeJson(row.graphic_charter_json, []),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }));
}

async function loadGraphicCharters() {
  if (!(await tableExists("graphic_charter"))) return [];
  const pool = await getPool();
  const result = await pool.request().query(
    `SELECT id, etablissement_id, nom, description, is_default, config_json, created_at, updated_at
     FROM graphic_charter
     ORDER BY etablissement_id, is_default DESC, nom ASC`,
  );
  return result.recordset.map((row) => ({
    id: String(row.id),
    etablissementId: row.etablissement_id ? String(row.etablissement_id) : null,
    name: row.nom || "",
    description: row.description || "",
    isDefault: !!row.is_default,
    config: safeJson(row.config_json, {}),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }));
}

async function loadAdmins() {
  const users = await loadUsers();
  return users
    .filter((user) => user.role === "admin")
    .map((user) => ({
      id: user.id,
      organizationId: user.organizationId,
      etablissementId: user.organizationId,
      nom: user.name,
      email: user.email,
      role: user.role,
      profile: user.profile,
      raw: clone(user.raw || {}),
    }));
}

async function loadTemplates() {
  if (!(await tableExists("template"))) return [];
  const hasOrientation = await tableHasColumn("template", "orientation");
  const hasGraphicCharterId = await tableHasColumn(
    "template",
    "graphic_charter_id",
  );
  const hasFilterProfile = await tableHasColumn(
    "template",
    "filter_profile_json",
  );
  const hasSectionDirections = await tableHasColumn(
    "template",
    "section_directions_json",
  );
  const pool = await getPool();
  const result = await pool.request().query(
    `SELECT id, family_id, etablissement_id, nom, updated_at, has_header, has_footer,
            ${hasGraphicCharterId ? "graphic_charter_id," : "NULL AS graphic_charter_id,"}
            ${hasFilterProfile ? "filter_profile_json," : "'[]' AS filter_profile_json,"}
            ${hasSectionDirections ? "section_directions_json," : "'{}' AS section_directions_json,"}
            ${hasOrientation ? "orientation," : "'portrait' AS orientation,"}
            page_margins_json, header_html, body_html, footer_html
     FROM template
     ORDER BY updated_at DESC, nom ASC`,
  );
  return result.recordset.map((row) => ({
    id: String(row.id),
    familyId: String(row.family_id),
    etablissementId: row.etablissement_id ? String(row.etablissement_id) : null,
    nom: row.nom,
    updatedAt: row.updated_at,
    hasHeader: !!row.has_header,
    hasFooter: !!row.has_footer,
    graphicCharterId: row.graphic_charter_id
      ? String(row.graphic_charter_id)
      : null,
    filterProfile: safeJson(row.filter_profile_json, []),
    sectionDirections: safeJson(row.section_directions_json, {}),
    orientation: row.orientation || "portrait",
    pageMargins: safeJson(row.page_margins_json, {}),
    header: row.header_html || "",
    body: row.body_html || "",
    footer: row.footer_html || "",
  }));
}

async function loadPersonnel() {
  if (!(await tableExists("personnel"))) return [];

  const columns = new Set(
    (await getTableColumns("personnel")).map((column) => column.name),
  );
  const hasDepartementId = columns.has("departement_id");
  const hasDepartementLabel = columns.has("departement");
  const hasDepartementTable =
    hasDepartementId && (await tableExists("departement"));
  const hasEtablissementId = columns.has("etablissement_id");
  const hasPoste = columns.has("poste");
  const hasService = columns.has("service");
  const hasEmail = columns.has("email");
  const hasMatricule = columns.has("matricule");
  const hasNomPrenom = columns.has("nom_prenom");
  const hasNom = columns.has("nom");
  const hasPrenom = columns.has("prenom");

  const displayNameExpr = hasNomPrenom
    ? "p.nom_prenom"
    : hasNom && hasPrenom
      ? "LTRIM(RTRIM(CONCAT(ISNULL(p.prenom, ''), CASE WHEN p.prenom IS NOT NULL AND p.nom IS NOT NULL THEN ' ' ELSE '' END, ISNULL(p.nom, ''))))"
      : hasNom
        ? "p.nom"
        : hasPrenom
          ? "p.prenom"
          : "CAST(p.id AS NVARCHAR(255))";

  const selectParts = [
    "p.id",
    `${displayNameExpr} AS nom_prenom`,
    hasEtablissementId ? "p.etablissement_id" : "NULL AS etablissement_id",
    hasPoste ? "p.poste" : "NULL AS poste",
    hasService ? "p.service" : "NULL AS service",
    hasEmail ? "p.email" : "NULL AS email",
    hasMatricule ? "p.matricule" : "NULL AS matricule",
    hasDepartementId ? "p.departement_id" : "NULL AS departement_id",
    hasDepartementLabel
      ? "p.departement"
      : hasDepartementTable
        ? "d.libelle AS departement"
        : "NULL AS departement",
  ];

  const joinSql =
    hasDepartementTable && !hasDepartementLabel
      ? "LEFT JOIN departement d ON d.id = p.departement_id"
      : "";
  const pool = await getPool();
  const result = await pool.request().query(
    `SELECT ${selectParts.join(", ")}
     FROM personnel p
     ${joinSql}
     ORDER BY nom_prenom`,
  );
  return result.recordset.map((row) => ({
    id: String(row.id),
    nom_prenom: row.nom_prenom || "",
    departement: row.departement || "",
    etablissementId:
      row.etablissement_id === undefined || row.etablissement_id === null
        ? null
        : String(row.etablissement_id),
    poste: row.poste || "",
    service: row.service || "",
    email: row.email || "",
    matricule: row.matricule || "",
    departement_id:
      row.departement_id === undefined || row.departement_id === null
        ? null
        : String(row.departement_id),
  }));
}

async function loadState(currentUser = null) {
  const organizations = await loadOrganizations();
  const graphicCharters = await loadGraphicCharters();
  const chartersByEtab = graphicCharters.reduce((acc, item) => {
    const key = item.etablissementId || "__none__";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const state = normalizeState({
    etablissements: organizations.map((etab) => ({
      ...etab,
      graphicCharters: chartersByEtab[etab.id]?.length
        ? chartersByEtab[etab.id]
        : etab.graphicCharters || [],
    })),
    admins: await loadAdmins(),
    families: await loadFamilies(),
    templates: await loadTemplates(),
    personnel: await loadPersonnel(),
    settings: await loadAppSettings(),
  });
  if (!currentUser || currentUser.role === "supAdmin") return state;
  const orgId = currentUser.organizationId || null;
  return {
    ...state,
    etablissements: state.etablissements.filter((item) => item.id === orgId),
    admins: state.admins.filter((item) => item.etablissementId === orgId),
    templates: state.templates.filter((item) => item.etablissementId === orgId),
    personnel: state.personnel.filter((item) => item.etablissementId === orgId),
  };
}

async function loadSchema() {
  const pool = await getPool();

  const tablesResult = await pool.request().query(
    `SELECT t.TABLE_NAME AS table_name,
            ISNULL(CAST(ep.value AS NVARCHAR(MAX)), '') AS table_comment
     FROM INFORMATION_SCHEMA.TABLES t
     LEFT JOIN sys.extended_properties ep
       ON ep.major_id = OBJECT_ID(t.TABLE_NAME)
      AND ep.minor_id = 0
      AND ep.name = 'MS_Description'
     WHERE t.TABLE_TYPE = 'BASE TABLE'
     ORDER BY t.TABLE_NAME`,
  );

  const columnsResult = await pool.request().query(
    `SELECT c.TABLE_NAME AS table_name,
            c.COLUMN_NAME AS column_name,
            c.DATA_TYPE AS data_type,
            ISNULL(CAST(ep.value AS NVARCHAR(MAX)), '') AS column_comment,
            c.IS_NULLABLE AS is_nullable,
            CASE WHEN kcu.COLUMN_NAME IS NOT NULL THEN 'PRI' ELSE '' END AS column_key
     FROM INFORMATION_SCHEMA.COLUMNS c
     LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
       ON kcu.TABLE_NAME = c.TABLE_NAME
      AND kcu.COLUMN_NAME = c.COLUMN_NAME
      AND kcu.CONSTRAINT_NAME IN (
        SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_TYPE = 'PRIMARY KEY'
      )
     LEFT JOIN sys.extended_properties ep
       ON ep.major_id = OBJECT_ID(c.TABLE_NAME)
      AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(c.TABLE_NAME), c.COLUMN_NAME, 'ColumnId')
      AND ep.name = 'MS_Description'
     ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION`,
  );

  const relationsResult = await pool.request().query(
    `SELECT
       fk_tab.name AS table_name,
       fk_col.name AS column_name,
       pk_tab.name AS referenced_table_name,
       pk_col.name AS referenced_column_name
     FROM sys.foreign_key_columns fkc
     JOIN sys.tables fk_tab ON fkc.parent_object_id = fk_tab.object_id
     JOIN sys.columns fk_col
       ON fkc.parent_object_id = fk_col.object_id
      AND fkc.parent_column_id = fk_col.column_id
     JOIN sys.tables pk_tab ON fkc.referenced_object_id = pk_tab.object_id
     JOIN sys.columns pk_col
       ON fkc.referenced_object_id = pk_col.object_id
      AND fkc.referenced_column_id = pk_col.column_id
     ORDER BY fk_tab.name`,
  );

  const normalizedTables = tablesResult.recordset.map((row) => ({
    name: row.table_name,
    comment: row.table_comment || "",
  }));
  const normalizedColumns = columnsResult.recordset.map((row) => ({
    table: row.table_name,
    name: row.column_name,
    type: row.data_type,
    comment: row.column_comment || "",
    nullable: row.is_nullable === "YES",
    key: row.column_key || "",
  }));
  const normalizedRelations = relationsResult.recordset.map((row) => ({
    table: row.table_name,
    column: row.column_name,
    referencedTable: row.referenced_table_name,
    referencedColumn: row.referenced_column_name,
  }));
  const inferredRelations = inferSchemaRelations(
    normalizedTables,
    normalizedColumns,
    normalizedRelations,
  );

  return {
    tables: normalizedTables,
    columns: normalizedColumns,
    relations: [...normalizedRelations, ...inferredRelations],
  };
}

// ---------------------------------------------------------------------------
// SELECT query runner (named :param → @param)
// ---------------------------------------------------------------------------

async function runSelectQuery(querySql, params = {}) {
  const cleanedSql = normalizeSelectQueryForSqlServer(
    String(querySql || "")
      .trim()
      .replace(/;+\s*$/, ""),
  );
  if (!/^\s*select\b/i.test(cleanedSql)) {
    throw new Error("Seules les requetes SELECT sont autorisees.");
  }
  const { sql: compiledSql, params: namedParams } = parseNamedSql(
    cleanedSql,
    withOrganizationQueryParams(params),
  );
  const pool = await getPool();
  const request = pool.request();
  for (const [key, value] of Object.entries(namedParams)) {
    request.input(key, value);
  }
  const result = await request.query(compiledSql);
  return result.recordset.map(cleanQueryRow);
}

function buildRequest(transaction) {
  return new sql.Request(transaction);
}

async function getTableColumns(tableName) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("tname", sql.NVarChar, tableName)
    .query(
      `SELECT COLUMN_NAME AS name, DATA_TYPE AS type
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_NAME = @tname
       ORDER BY ORDINAL_POSITION`,
    );
  return result.recordset.map((row) => ({
    name: row.name,
    type: row.type,
  }));
}

async function syncOrganizations(stateOrganizations = [], transaction) {
  const columns = await getExternalTableColumns(AUTH_DB_NAME, "Organization");
  if (!columns.length) return new Map();
  const idColumn = getPreferredColumnName(columns, [
    "Id",
    "OrganizationId",
    "IdOrganization",
  ]);
  const uniqueNameColumn = getPreferredColumnName(columns, [
    "NameFr",
    "Name",
    "Nom",
  ]);
  if (!idColumn) return new Map();

  const existingRows = await buildRequest(transaction).query(
    `SELECT * FROM [${AUTH_DB_NAME}].[dbo].[Organization]`,
  );
  const existingById = new Map(
    existingRows.recordset.map((row) => [String(row[idColumn]), row]),
  );
  const existingByName = new Map(
    uniqueNameColumn
      ? existingRows.recordset
          .map((row) => [
            normalizeComparableValue(row[uniqueNameColumn]),
            String(row[idColumn]),
          ])
          .filter(([key]) => key)
      : [],
  );
  const identityColumn = columns.find(
    (column) => column.name === idColumn,
  )?.identity;
  const idMap = new Map();
  const incomingIds = new Set();

  for (const org of stateOrganizations) {
    const sourceId = String(org?.id || "").trim();
    const comparableName = uniqueNameColumn
      ? normalizeComparableValue(
          getOrganizationNameForPersistence(org, uniqueNameColumn),
        )
      : "";
    const existingId =
      sourceId && !isTempClientId(sourceId) && existingById.has(sourceId)
        ? sourceId
        : comparableName && existingByName.has(comparableName)
          ? existingByName.get(comparableName)
          : null;
    const row = buildOrganizationDbRow(
      existingId ? { ...org, raw: existingById.get(existingId) } : org,
      columns,
    );
    const writableColumns = columns.filter(
      (column) => !column.identity && row[column.name] !== undefined,
    );

    if (existingId) {
      incomingIds.add(existingId);
      idMap.set(sourceId || existingId, existingId);
      if (writableColumns.length) {
        const req = buildRequest(transaction);
        req.input("pk", existingId);
        writableColumns.forEach((column, index) => {
          req.input(`c${index}`, row[column.name] ?? null);
        });
        await req.query(
          `UPDATE [${AUTH_DB_NAME}].[dbo].[Organization]
           SET ${writableColumns
             .map(
               (column, index) =>
                 `${quoteSqlServerIdentifier(column.name)} = @c${index}`,
             )
             .join(", ")}
           WHERE ${quoteSqlServerIdentifier(idColumn)} = @pk`,
        );
      }
      continue;
    }

    const insertColumns = columns.filter(
      (column) =>
        (!column.identity || !identityColumn) && row[column.name] !== undefined,
    );
    if (!insertColumns.length) continue;
    const req = buildRequest(transaction);
    insertColumns.forEach((column, index) => {
      req.input(`c${index}`, row[column.name] ?? null);
    });
    const insertSql = `INSERT INTO [${AUTH_DB_NAME}].[dbo].[Organization] (${insertColumns
      .map((column) => quoteSqlServerIdentifier(column.name))
      .join(", ")})
      OUTPUT INSERTED.${quoteSqlServerIdentifier(idColumn)} AS inserted_id
      VALUES (${insertColumns.map((_, index) => `@c${index}`).join(", ")})`;
    const insertResult = await req.query(insertSql);
    const insertedId = String(insertResult.recordset?.[0]?.inserted_id ?? "");
    if (insertedId) {
      incomingIds.add(insertedId);
      idMap.set(sourceId || insertedId, insertedId);
    }
  }

  for (const existingId of existingById.keys()) {
    if (incomingIds.has(existingId)) continue;
    const req = buildRequest(transaction);
    req.input("pk", existingId);
    await req.query(
      `DELETE FROM [${AUTH_DB_NAME}].[dbo].[Organization]
       WHERE ${quoteSqlServerIdentifier(idColumn)} = @pk`,
    );
  }

  return idMap;
}

async function syncAdmins(
  stateAdmins = [],
  transaction,
  organizationIdMap = new Map(),
) {
  const columns = await getExternalTableColumns(AUTH_DB_NAME, "User");
  if (!columns.length) return;
  const idColumn = getPreferredColumnName(columns, ["Id"]);
  if (!idColumn) return;
  const roleColumn = getPreferredColumnName(columns, ["Role"]);
  const existingReq = buildRequest(transaction);
  const existingResult = roleColumn
    ? await existingReq.query(
        `SELECT * FROM [${AUTH_DB_NAME}].[dbo].[User]
         WHERE ${quoteSqlServerIdentifier(roleColumn)} = 'admin'`,
      )
    : await existingReq.query(`SELECT * FROM [${AUTH_DB_NAME}].[dbo].[User]`);
  const existingById = new Map(
    existingResult.recordset.map((row) => [String(row[idColumn]), row]),
  );
  const identityColumn = columns.find(
    (column) => column.name === idColumn,
  )?.identity;
  const incomingIds = new Set();

  for (const admin of stateAdmins) {
    const sourceId = String(admin?.id || "").trim();
    const existingId =
      sourceId && !isTempClientId(sourceId) && existingById.has(sourceId)
        ? sourceId
        : null;
    const resolvedOrganizationId =
      organizationIdMap.get(
        String(admin?.organizationId || admin?.etablissementId || ""),
      ) ||
      String(admin?.organizationId || admin?.etablissementId || "").trim() ||
      null;
    const row = buildAdminDbRow(
      existingId ? { ...admin, raw: existingById.get(existingId) } : admin,
      columns,
      resolvedOrganizationId,
    );
    const writableColumns = columns.filter(
      (column) => !column.identity && row[column.name] !== undefined,
    );

    if (existingId) {
      incomingIds.add(existingId);
      if (writableColumns.length) {
        const req = buildRequest(transaction);
        req.input("pk", existingId);
        writableColumns.forEach((column, index) => {
          req.input(`c${index}`, row[column.name] ?? null);
        });
        await req.query(
          `UPDATE [${AUTH_DB_NAME}].[dbo].[User]
           SET ${writableColumns
             .map(
               (column, index) =>
                 `${quoteSqlServerIdentifier(column.name)} = @c${index}`,
             )
             .join(", ")}
           WHERE ${quoteSqlServerIdentifier(idColumn)} = @pk`,
        );
      }
      continue;
    }

    const insertColumns = columns.filter(
      (column) =>
        (!column.identity || !identityColumn) && row[column.name] !== undefined,
    );
    if (!insertColumns.length) continue;
    const req = buildRequest(transaction);
    insertColumns.forEach((column, index) => {
      req.input(`c${index}`, row[column.name] ?? null);
    });
    const insertSql = `INSERT INTO [${AUTH_DB_NAME}].[dbo].[User] (${insertColumns
      .map((column) => quoteSqlServerIdentifier(column.name))
      .join(", ")})
      OUTPUT INSERTED.${quoteSqlServerIdentifier(idColumn)} AS inserted_id
      VALUES (${insertColumns.map((_, index) => `@c${index}`).join(", ")})`;
    const insertResult = await req.query(insertSql);
    const insertedId = String(insertResult.recordset?.[0]?.inserted_id ?? "");
    if (insertedId) incomingIds.add(insertedId);
  }

  for (const existingId of existingById.keys()) {
    if (incomingIds.has(existingId)) continue;
    const req = buildRequest(transaction);
    req.input("pk", existingId);
    await req.query(
      `DELETE FROM [${AUTH_DB_NAME}].[dbo].[User]
       WHERE ${quoteSqlServerIdentifier(idColumn)} = @pk`,
    );
  }
}

// ---------------------------------------------------------------------------
// State replacement (full replace in a transaction)
// ---------------------------------------------------------------------------

async function replaceState(state, currentUser = null) {
  const normalized = normalizeState(state);

  if (!(await tableExists("family")) || !(await tableExists("template"))) {
    throw new Error(
      "Les tables SQL Server 'family' et 'template' doivent exister avant le lancement.",
    );
  }

  const hasEtablissements = await tableExists("etablissement");
  const hasGraphicCharterTable = await tableExists("graphic_charter");
  const hasAdmins = await tableExists("admin_user");
  const hasGraphicCharterJson = hasEtablissements
    ? await tableHasColumn("etablissement", "graphic_charter_json")
    : false;
  const hasBrandingJson =
    hasEtablissements && !hasGraphicCharterJson
      ? await tableHasColumn("etablissement", "branding_json")
      : false;
  const hasEtabCreatedAt = hasEtablissements
    ? await tableHasColumn("etablissement", "created_at")
    : false;
  const hasEtabUpdatedAt = hasEtablissements
    ? await tableHasColumn("etablissement", "updated_at")
    : false;
  const hasOrientation = await tableHasColumn("template", "orientation");
  const hasGraphicCharterId = await tableHasColumn(
    "template",
    "graphic_charter_id",
  );
  const hasFilterCatalog = await tableHasColumn(
    "family",
    "filter_catalog_json",
  );
  const hasFilterProfile = await tableHasColumn(
    "template",
    "filter_profile_json",
  );
  const hasSectionDirections = await tableHasColumn(
    "template",
    "section_directions_json",
  );

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    const req = () => buildRequest(transaction);

    if (currentUser?.role === "supAdmin") {
      await saveAppSettings(normalized.settings || {}, transaction);
      const organizationIdMap = await syncOrganizations(
        normalized.etablissements,
        transaction,
      );
      await syncAdmins(normalized.admins, transaction, organizationIdMap);
    }

    if (hasGraphicCharterTable)
      await req().query("DELETE FROM graphic_charter");
    await req().query("DELETE FROM template");
    await req().query("DELETE FROM family");

    // --- graphic_charter ---
    if (hasGraphicCharterTable) {
      for (const etab of normalized.etablissements) {
        for (const charter of etab.graphicCharters || []) {
          const r = req();
          r.input("id", sql.NVarChar, charter.id);
          r.input("etablissement_id", sql.NVarChar, etab.id);
          r.input("nom", sql.NVarChar, charter.name || "");
          r.input("description", sql.NVarChar, charter.description || "");
          r.input("is_default", sql.Bit, charter.isDefault ? 1 : 0);
          r.input(
            "config_json",
            sql.NVarChar(sql.MAX),
            JSON.stringify(charter.config || {}),
          );
          r.input(
            "created_at",
            sql.NVarChar,
            serializeDateValue(charter.createdAt),
          );
          r.input(
            "updated_at",
            sql.NVarChar,
            serializeDateValue(charter.updatedAt || charter.createdAt),
          );
          await r.query(
            `INSERT INTO graphic_charter
               (id, etablissement_id, nom, description, is_default, config_json, created_at, updated_at)
             VALUES
               (@id, @etablissement_id, @nom, @description, @is_default, @config_json, @created_at, @updated_at)`,
          );
        }
      }
    }

    // --- families ---
    for (const item of normalized.families) {
      const r = req();
      r.input("id", sql.NVarChar, item.id);
      r.input("nom", sql.NVarChar, item.nom || "");
      r.input("icon", sql.NVarChar, item.icon || "");
      r.input("description", sql.NVarChar, item.description || "");
      r.input(
        "beneficiary_mode",
        sql.NVarChar,
        isScopedOrganizationFamily(item) ? "organization" : "table",
      );
      r.input(
        "beneficiary_table",
        sql.NVarChar,
        isScopedOrganizationFamily(item)
          ? null
          : item.beneficiaryTable || DEFAULT_FAMILY_BENEFICIARY_TABLE,
      );
      r.input("beneficiary_sql_text", sql.NVarChar, item.beneficiarySql || "");
      if (hasFilterCatalog) {
        r.input(
          "filter_catalog_json",
          sql.NVarChar(sql.MAX),
          JSON.stringify(item.filterCatalog || []),
        );
      }
      r.input("sql_text", sql.NVarChar(sql.MAX), item.sql || "");
      r.input("created_at", sql.NVarChar, serializeDateValue(item.createdAt));
      r.input(
        "classes_json",
        sql.NVarChar(sql.MAX),
        JSON.stringify(item.classes || []),
      );
      await r.query(
        `INSERT INTO family
           (id, nom, icon, description, beneficiary_mode, beneficiary_table,
            beneficiary_sql_text, ${hasFilterCatalog ? "filter_catalog_json," : ""} sql_text, created_at, classes_json)
         VALUES
           (@id, @nom, @icon, @description, @beneficiary_mode, @beneficiary_table,
            @beneficiary_sql_text, ${hasFilterCatalog ? "@filter_catalog_json," : ""} @sql_text, @created_at, @classes_json)`,
      );
    }

    // --- templates ---
    for (const item of normalized.templates) {
      const r = req();
      r.input("id", sql.NVarChar, item.id);
      r.input("family_id", sql.NVarChar, item.familyId);
      r.input("etablissement_id", sql.NVarChar, item.etablissementId || null);
      r.input("nom", sql.NVarChar, item.nom || "");
      r.input("updated_at", sql.NVarChar, serializeDateValue(item.updatedAt));
      r.input("has_header", sql.Bit, item.hasHeader ? 1 : 0);
      r.input("has_footer", sql.Bit, item.hasFooter ? 1 : 0);
      r.input(
        "page_margins_json",
        sql.NVarChar(sql.MAX),
        JSON.stringify(item.pageMargins || {}),
      );
      r.input("header_html", sql.NVarChar(sql.MAX), item.header || "");
      r.input("body_html", sql.NVarChar(sql.MAX), item.body || "");
      r.input("footer_html", sql.NVarChar(sql.MAX), item.footer || "");

      const extraCols = [];
      const extraVals = [];

      if (hasOrientation) {
        r.input("orientation", sql.NVarChar, item.orientation || "portrait");
        extraCols.push("orientation");
        extraVals.push("@orientation");
      }
      if (hasGraphicCharterId) {
        r.input(
          "graphic_charter_id",
          sql.NVarChar,
          item.graphicCharterId || null,
        );
        extraCols.push("graphic_charter_id");
        extraVals.push("@graphic_charter_id");
      }
      if (hasFilterProfile) {
        r.input(
          "filter_profile_json",
          sql.NVarChar(sql.MAX),
          JSON.stringify(item.filterProfile || []),
        );
        extraCols.push("filter_profile_json");
        extraVals.push("@filter_profile_json");
      }
      if (hasSectionDirections) {
        r.input(
          "section_directions_json",
          sql.NVarChar(sql.MAX),
          JSON.stringify(item.sectionDirections || {}),
        );
        extraCols.push("section_directions_json");
        extraVals.push("@section_directions_json");
      }

      const baseCols = [
        "id",
        "family_id",
        "etablissement_id",
        "nom",
        "updated_at",
        "has_header",
        "has_footer",
        "page_margins_json",
        "header_html",
        "body_html",
        "footer_html",
      ];
      const baseVals = [
        "@id",
        "@family_id",
        "@etablissement_id",
        "@nom",
        "@updated_at",
        "@has_header",
        "@has_footer",
        "@page_margins_json",
        "@header_html",
        "@body_html",
        "@footer_html",
      ];

      const cols = [...baseCols, ...extraCols].join(", ");
      const vals = [...baseVals, ...extraVals].join(", ");
      await r.query(`INSERT INTO template (${cols}) VALUES (${vals})`);
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, message) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(message);
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".md": "text/markdown; charset=utf-8",
    }[ext] || "application/octet-stream"
  );
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// API router
// ---------------------------------------------------------------------------

async function handleApi(req, res, url) {
  if (!url.pathname.startsWith("/api/")) {
    return false;
  }
  await ensureSchema();
  if (req.method === "OPTIONS") {
    sendText(res, 204, "");
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const identifier = String(body.identifier || "").trim();
    const password = String(body.password || "");
    if (!identifier || !password) {
      sendJson(res, 400, {
        ok: false,
        error: "identifier and password are required",
      });
      return true;
    }
    const user = await authenticateUser(identifier, password);
    if (!user) {
      sendJson(res, 401, { ok: false, error: "Identifiants invalides" });
      return true;
    }
    const token = createSession(user);
    setSessionCookie(res, token);
    sendJson(res, 200, { ok: true, user, redirectTo: getRoleHome(user.role) });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    clearSession(req, res);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/me") {
    const session = getSession(req);
    if (!session?.user) {
      sendJson(res, 401, { ok: false, error: "Not authenticated" });
      return true;
    }
    sendJson(res, 200, {
      ok: true,
      user: session.user,
      redirectTo: getRoleHome(session.user.role),
    });
    return true;
  }

  const session = getSession(req);
  if (!session?.user) {
    sendJson(res, 401, { ok: false, error: "Authentication required" });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/bootstrap") {
    const state = await loadState(session.user);
    sendJson(res, 200, { ok: true, state, user: session.user });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/state") {
    const state = await loadState(session.user);
    sendJson(res, 200, { ok: true, state, user: session.user });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/schema") {
    const schema = await loadSchema();
    sendJson(res, 200, { ok: true, schema });
    return true;
  }

  if (req.method === "PUT" && url.pathname === "/api/state") {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    if (!body.state) {
      sendJson(res, 400, { ok: false, error: "state is required" });
      return true;
    }
    await replaceState(body.state, session.user);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/query") {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const rows = await runSelectQuery(body.sql, body.params || {});
    sendJson(res, 200, { ok: true, rows });
    return true;
  }

  return false;
}

async function handleStatic(req, res, url) {
  const rawPath = url.pathname === "/" ? "/login.html" : url.pathname;
  const htmlPath = rawPath.toLowerCase();
  const isHtml = htmlPath.endsWith(".html") || htmlPath === "/";
  const publicPaths = new Set(["/login.html"]);
  const roleByPath = {
    "/superadmin.html": "supAdmin",
    "/admin.html": "admin",
    "/user.html": "user",
  };
  if (isHtml) {
    const session = getSession(req);
    const requiredRole = roleByPath[htmlPath];
    if (!publicPaths.has(htmlPath) && !session?.user) {
      res.writeHead(302, { Location: "/login.html" });
      res.end();
      return;
    }
    if (publicPaths.has(htmlPath) && session?.user) {
      res.writeHead(302, { Location: getRoleHome(session.user.role) });
      res.end();
      return;
    }
    if (
      requiredRole &&
      session?.user &&
      getRoleHome(session.user.role).toLowerCase() !== htmlPath
    ) {
      res.writeHead(302, { Location: getRoleHome(session.user.role) });
      res.end();
      return;
    }
  }
  const filePath = path.normalize(path.join(ROOT_DIR, rawPath));
  if (!filePath.startsWith(ROOT_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendText(res, 404, "Not found");
    return;
  }

  res.writeHead(200, {
    "Content-Type": getContentType(filePath),
    "Access-Control-Allow-Origin": "*",
  });
  fs.createReadStream(filePath).pipe(res);
}

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const handled = await handleApi(req, res, url);
    if (handled) return;
    await handleStatic(req, res, url);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { ok: false, error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`SIRH-Doc server ready on http://localhost:${PORT}`);
});
