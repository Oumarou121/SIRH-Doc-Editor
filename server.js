const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const sql = require("mssql");

const PORT = Number(3000);
const ROOT_DIR = __dirname;
const DEFAULT_FAMILY_BENEFICIARY_TABLE = "personnel";

const config = {
  user: "sa",
  password: "N7vR2pXk9Lm4Qz8T",
  server: "92.222.230.31",
  database: "UnivAdENIMDB",
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
  next.beneficiaryMode =
    next.beneficiaryMode === "etablissement" ? "etablissement" : "table";
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
  next.filterProfile = (
    Array.isArray(next.filterProfile) ? next.filterProfile : []
  )
    .map((entry, index) => normalizeTemplateFilterProfileEntry(entry, index))
    .filter(Boolean);
  next.graphicCharterId = next.graphicCharterId
    ? String(next.graphicCharterId)
    : null;
  return next;
}

function normalizeState(state) {
  const next = state && typeof state === "object" ? state : {};
  return {
    etablissements: Array.isArray(next.etablissements)
      ? clone(next.etablissements)
      : [],
    admins: Array.isArray(next.admins) ? clone(next.admins) : [],
    families: Array.isArray(next.families)
      ? next.families.map((family) => normalizeFamilyRecord(family))
      : [],
    templates: Array.isArray(next.templates)
      ? next.templates.map((template) => normalizeTemplateRecord(template))
      : [],
    personnel: Array.isArray(next.personnel) ? clone(next.personnel) : [],
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
    beneficiaryMode: row.beneficiary_mode || "table",
    beneficiaryTable:
      row.beneficiary_mode === "etablissement"
        ? null
        : row.beneficiary_table || DEFAULT_FAMILY_BENEFICIARY_TABLE,
    beneficiarySql: row.beneficiary_sql_text || "",
    filterCatalog: safeJson(row.filter_catalog_json, []),
    sql: row.sql_text,
    createdAt: row.created_at,
    classes: safeJson(row.classes_json, []),
  }));
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
  if (!(await tableExists("admin_user"))) return [];
  const pool = await getPool();
  const result = await pool
    .request()
    .query(
      "SELECT id, etablissement_id, nom, email FROM admin_user ORDER BY nom",
    );
  return result.recordset.map((row) => ({
    id: String(row.id),
    etablissementId: row.etablissement_id ? String(row.etablissement_id) : null,
    nom: row.nom || "",
    email: row.email || "",
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
  const pool = await getPool();
  const result = await pool.request().query(
    `SELECT id, family_id, etablissement_id, nom, updated_at, has_header, has_footer,
            ${hasGraphicCharterId ? "graphic_charter_id," : "NULL AS graphic_charter_id,"}
            ${hasFilterProfile ? "filter_profile_json," : "'[]' AS filter_profile_json,"}
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

async function loadState() {
  const etablissements = await loadEtablissements();
  const graphicCharters = await loadGraphicCharters();
  const chartersByEtab = graphicCharters.reduce((acc, item) => {
    const key = item.etablissementId || "__none__";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return normalizeState({
    etablissements: etablissements.map((etab) => ({
      ...etab,
      graphicCharters: chartersByEtab[etab.id]?.length
        ? chartersByEtab[etab.id]
        : etab.graphicCharters || [],
    })),
    admins: await loadAdmins(),
    families: await loadFamilies(),
    templates: await loadTemplates(),
    personnel: await loadPersonnel(),
  });
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
    params,
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

// ---------------------------------------------------------------------------
// State replacement (full replace in a transaction)
// ---------------------------------------------------------------------------

async function replaceState(state) {
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

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    const req = () => buildRequest(transaction);

    if (hasGraphicCharterTable)
      await req().query("DELETE FROM graphic_charter");
    if (hasAdmins) await req().query("DELETE FROM admin_user");
    if (hasEtablissements) await req().query("DELETE FROM etablissement");
    await req().query("DELETE FROM template");
    await req().query("DELETE FROM family");

    // --- etablissements ---
    if (hasEtablissements) {
      for (const item of normalized.etablissements) {
        const r = req();
        r.input("id", sql.NVarChar, item.id);
        r.input("nom", sql.NVarChar, item.nom || "");
        r.input("ville", sql.NVarChar, item.ville || "");
        r.input("adresse", sql.NVarChar, item.adresse || "");
        r.input("tel", sql.NVarChar, item.tel || "");

        const extraCols = [];
        const extraVals = [];

        if (hasGraphicCharterJson || hasBrandingJson) {
          const colName = hasGraphicCharterJson
            ? "graphic_charter_json"
            : "branding_json";
          r.input(
            "gcj",
            sql.NVarChar,
            JSON.stringify(item.graphicCharters || item.graphicCharter || []),
          );
          extraCols.push(colName);
          extraVals.push("@gcj");
        }
        if (hasEtabCreatedAt) {
          r.input(
            "created_at",
            sql.NVarChar,
            serializeDateValue(item.createdAt),
          );
          extraCols.push("created_at");
          extraVals.push("@created_at");
        }
        if (hasEtabUpdatedAt) {
          r.input(
            "updated_at",
            sql.NVarChar,
            serializeDateValue(item.updatedAt || item.createdAt),
          );
          extraCols.push("updated_at");
          extraVals.push("@updated_at");
        }

        const cols = [
          "id",
          "nom",
          "ville",
          "adresse",
          "tel",
          ...extraCols,
        ].join(", ");
        const vals = [
          "@id",
          "@nom",
          "@ville",
          "@adresse",
          "@tel",
          ...extraVals,
        ].join(", ");
        await r.query(`INSERT INTO etablissement (${cols}) VALUES (${vals})`);
      }
    }

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
            sql.NVarChar,
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

    // --- admins ---
    if (hasAdmins) {
      for (const item of normalized.admins) {
        const r = req();
        r.input("id", sql.NVarChar, item.id);
        r.input("etablissement_id", sql.NVarChar, item.etablissementId || null);
        r.input("nom", sql.NVarChar, item.nom || "");
        r.input("email", sql.NVarChar, item.email || "");
        await r.query(
          `INSERT INTO admin_user (id, etablissement_id, nom, email)
           VALUES (@id, @etablissement_id, @nom, @email)`,
        );
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
        item.beneficiaryMode || "table",
      );
      r.input(
        "beneficiary_table",
        sql.NVarChar,
        item.beneficiaryMode === "etablissement"
          ? null
          : item.beneficiaryTable || DEFAULT_FAMILY_BENEFICIARY_TABLE,
      );
      r.input("beneficiary_sql_text", sql.NVarChar, item.beneficiarySql || "");
      if (hasFilterCatalog) {
        r.input(
          "filter_catalog_json",
          sql.NVarChar,
          JSON.stringify(item.filterCatalog || []),
        );
      }
      r.input("sql_text", sql.NVarChar, item.sql || "");
      r.input("created_at", sql.NVarChar, serializeDateValue(item.createdAt));
      r.input("classes_json", sql.NVarChar, JSON.stringify(item.classes || []));
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
        sql.NVarChar,
        JSON.stringify(item.pageMargins || {}),
      );
      r.input("header_html", sql.NVarChar, item.header || "");
      r.input("body_html", sql.NVarChar, item.body || "");
      r.input("footer_html", sql.NVarChar, item.footer || "");

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
          sql.NVarChar,
          JSON.stringify(item.filterProfile || []),
        );
        extraCols.push("filter_profile_json");
        extraVals.push("@filter_profile_json");
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
  await ensureSchema();
  if (req.method === "OPTIONS") {
    sendText(res, 204, "");
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/bootstrap") {
    const state = await loadState();
    sendJson(res, 200, { ok: true, state });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/state") {
    const state = await loadState();
    sendJson(res, 200, { ok: true, state });
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
    await replaceState(body.state);
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
  const rawPath = url.pathname === "/" ? "/admin.html" : url.pathname;
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
