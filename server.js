const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const mysql = require("mysql2/promise");

const PORT = Number(process.env.PORT || 3000);
const DB_URL =
  process.env.SIRHDOC_DATABASE_URL ||
  "mysql://sirhdoc_user:%40Mamoudou123@localhost:3306/sirhdoc";
const ROOT_DIR = __dirname;

const pool = mysql.createPool(DB_URL);

let schemaReadyPromise = null;

function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

function normalizeState(state) {
  const next = state && typeof state === "object" ? state : {};
  return {
    etablissements: Array.isArray(next.etablissements)
      ? clone(next.etablissements)
      : [],
    admins: Array.isArray(next.admins) ? clone(next.admins) : [],
    families: Array.isArray(next.families) ? clone(next.families) : [],
    templates: Array.isArray(next.templates) ? clone(next.templates) : [],
    personnel: Array.isArray(next.personnel) ? clone(next.personnel) : [],
  };
}

function parseNamedSql(sql, params = {}) {
  const values = [];
  const compiled = sql.replace(/:([a-zA-Z_]\w*)/g, (_, key) => {
    values.push(params[key] ?? null);
    return "?";
  });
  return { sql: compiled, values };
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

async function tableExists(tableName) {
  const [rows] = await pool.query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

async function tableHasColumn(tableName, columnName) {
  const [rows] = await pool.query("SHOW COLUMNS FROM ?? LIKE ?", [
    tableName,
    columnName,
  ]);
  return rows.length > 0;
}

async function ensureSchema() {
  if (schemaReadyPromise) return schemaReadyPromise;
  schemaReadyPromise = (async () => {
    const schemaPath = path.join(ROOT_DIR, "schema.sql");
    if (!fs.existsSync(schemaPath)) return;
    const sql = fs.readFileSync(schemaPath, "utf8");
    const statements = sql
      .split(/;\s*(?:\r?\n|$)/)
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await pool.query(statement);
    }

    if (await tableExists("template")) {
      if (!(await tableHasColumn("template", "graphic_charter_id"))) {
        await pool.query(
          "ALTER TABLE template ADD COLUMN graphic_charter_id VARCHAR(64) NULL AFTER etablissement_id",
        );
      }
      if (!(await tableHasColumn("template", "orientation"))) {
        await pool.query(
          "ALTER TABLE template ADD COLUMN orientation VARCHAR(16) NULL AFTER has_footer",
        );
      }
    }
  })();
  return schemaReadyPromise;
}

async function loadFamilies() {
  if (!(await tableExists("family"))) return [];
  const [rows] = await pool.query(
    "SELECT id, nom, icon, description, sql_text, created_at, classes_json FROM family ORDER BY nom",
  );
  return rows.map((row) => ({
    id: String(row.id),
    nom: row.nom,
    icon: row.icon,
    description: row.description,
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
  const [rows] = await pool.query(
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
  return rows.map((row) => ({
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
  const [rows] = await pool.query(
    `SELECT id, etablissement_id, nom, description, is_default, config_json, created_at, updated_at
     FROM graphic_charter
     ORDER BY etablissement_id, is_default DESC, nom ASC`,
  );
  return rows.map((row) => ({
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
  const [rows] = await pool.query(
    `SELECT id, etablissement_id, nom, email
     FROM admin_user
     ORDER BY nom`,
  );
  return rows.map((row) => ({
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
  const [rows] = await pool.query(
    `SELECT id, family_id, etablissement_id, nom, updated_at, has_header, has_footer,
            ${hasGraphicCharterId ? "graphic_charter_id," : "NULL AS graphic_charter_id,"}
            ${hasOrientation ? "orientation," : "'portrait' AS orientation,"}
            page_margins_json, header_html, body_html, footer_html
     FROM template
     ORDER BY updated_at DESC, nom ASC`,
  );
  return rows.map((row) => ({
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
    orientation: row.orientation || "portrait",
    pageMargins: safeJson(row.page_margins_json, {}),
    header: row.header_html || "",
    body: row.body_html || "",
    footer: row.footer_html || "",
  }));
}

async function loadPersonnel() {
  if (!(await tableExists("personnel"))) return [];

  let hasDepartementId = false;
  try {
    const [columns] = await pool.query(
      "SHOW COLUMNS FROM personnel LIKE 'departement_id'",
    );
    hasDepartementId = columns.length > 0;
  } catch (_) {}

  const sql = hasDepartementId
    ? `SELECT p.id, p.nom_prenom, p.departement_id, d.libelle AS departement
       FROM personnel p
       LEFT JOIN departement d ON d.id = p.departement_id
       ORDER BY p.nom_prenom`
    : "SELECT id, nom_prenom FROM personnel ORDER BY nom_prenom";

  const [rows] = await pool.query(sql);
  return rows.map((row) => ({
    id: String(row.id),
    nom_prenom: row.nom_prenom || "",
    departement: row.departement || "",
    departement_id:
      row.departement_id === undefined || row.departement_id === null
        ? null
        : row.departement_id,
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
  const [tables] = await pool.query(
    `SELECT table_name, table_comment
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
     ORDER BY table_name`,
  );
  const [columns] = await pool.query(
    `SELECT table_name, column_name, data_type, column_comment, is_nullable, column_key
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
     ORDER BY table_name, ordinal_position`,
  );
  const [relations] = await pool.query(
    `SELECT table_name, column_name, referenced_table_name, referenced_column_name
     FROM information_schema.key_column_usage
     WHERE table_schema = DATABASE() AND referenced_table_name IS NOT NULL
     ORDER BY table_name, ordinal_position`,
  );

  return {
    tables: tables.map((row) => ({
      name: row.table_name || row.TABLE_NAME,
      comment: row.table_comment || row.TABLE_COMMENT || "",
    })),
    columns: columns.map((row) => ({
      table: row.table_name || row.TABLE_NAME,
      name: row.column_name || row.COLUMN_NAME,
      type: row.data_type || row.DATA_TYPE,
      comment: row.column_comment || row.COLUMN_COMMENT || "",
      nullable: (row.is_nullable || row.IS_NULLABLE) === "YES",
      key: row.column_key || row.COLUMN_KEY || "",
    })),
    relations: relations.map((row) => ({
      table: row.table_name || row.TABLE_NAME,
      column: row.column_name || row.COLUMN_NAME,
      referencedTable: row.referenced_table_name || row.REFERENCED_TABLE_NAME,
      referencedColumn:
        row.referenced_column_name || row.REFERENCED_COLUMN_NAME,
    })),
  };
}

async function runSelectQuery(sql, params = {}) {
  const cleanedSql = String(sql || "")
    .trim()
    .replace(/;+\s*$/, "");
  if (!/^\s*select\b/i.test(cleanedSql)) {
    throw new Error("Seules les requetes SELECT sont autorisees.");
  }
  const { sql: compiledSql, values } = parseNamedSql(cleanedSql, params);
  const [rows] = await pool.query(compiledSql, values);
  return rows.map(cleanQueryRow);
}

async function replaceState(state) {
  const normalized = normalizeState(state);

  if (!(await tableExists("family")) || !(await tableExists("template"))) {
    throw new Error(
      "Les tables MySQL 'family' et 'template' doivent exister avant le lancement.",
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
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (hasGraphicCharterTable) await conn.query("DELETE FROM graphic_charter");
    if (hasAdmins) await conn.query("DELETE FROM admin_user");
    if (hasEtablissements) await conn.query("DELETE FROM etablissement");
    await conn.query("DELETE FROM template");
    await conn.query("DELETE FROM family");

    if (hasEtablissements) {
      for (const item of normalized.etablissements) {
        const columns = ["id", "nom", "ville", "adresse", "tel"];
        const placeholders = ["?", "?", "?", "?", "?"];
        const values = [
          item.id,
          item.nom || "",
          item.ville || "",
          item.adresse || "",
          item.tel || "",
        ];
        if (hasGraphicCharterJson || hasBrandingJson) {
          columns.push(
            hasGraphicCharterJson ? "graphic_charter_json" : "branding_json",
          );
          placeholders.push("?");
          values.push(
            JSON.stringify(item.graphicCharters || item.graphicCharter || []),
          );
        }
        if (hasEtabCreatedAt) {
          columns.push("created_at");
          placeholders.push("?");
          values.push(item.createdAt || null);
        }
        if (hasEtabUpdatedAt) {
          columns.push("updated_at");
          placeholders.push("?");
          values.push(item.updatedAt || item.createdAt || null);
        }
        await conn.execute(
          `INSERT INTO etablissement (${columns.join(", ")})
           VALUES (${placeholders.join(", ")})`,
          values,
        );
      }
    }

    if (hasGraphicCharterTable) {
      for (const etab of normalized.etablissements) {
        for (const charter of etab.graphicCharters || []) {
          await conn.execute(
            `INSERT INTO graphic_charter (
              id, etablissement_id, nom, description, is_default, config_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              charter.id,
              etab.id,
              charter.name || "",
              charter.description || "",
              charter.isDefault ? 1 : 0,
              JSON.stringify(charter.config || {}),
              charter.createdAt || null,
              charter.updatedAt || charter.createdAt || null,
            ],
          );
        }
      }
    }

    if (hasAdmins) {
      for (const item of normalized.admins) {
        await conn.execute(
          `INSERT INTO admin_user (id, etablissement_id, nom, email)
           VALUES (?, ?, ?, ?)`,
          [
            item.id,
            item.etablissementId || null,
            item.nom || "",
            item.email || "",
          ],
        );
      }
    }

    for (const item of normalized.families) {
      await conn.execute(
        `INSERT INTO family (id, nom, icon, description, sql_text, created_at, classes_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.nom || "",
          item.icon || "",
          item.description || "",
          item.sql || "",
          item.createdAt || null,
          JSON.stringify(item.classes || []),
        ],
      );
    }

    for (const item of normalized.templates) {
      const columns = [
        "id",
        "family_id",
        "etablissement_id",
        "nom",
        "updated_at",
        "has_header",
        "has_footer",
      ];
      const placeholders = ["?", "?", "?", "?", "?", "?", "?"];
      const values = [
        item.id,
        item.familyId,
        item.etablissementId || null,
        item.nom || "",
        item.updatedAt || null,
        item.hasHeader ? 1 : 0,
        item.hasFooter ? 1 : 0,
      ];

      if (hasOrientation) {
        columns.push("orientation");
        placeholders.push("?");
        values.push(item.orientation || "portrait");
      }

      if (hasGraphicCharterId) {
        columns.push("graphic_charter_id");
        placeholders.push("?");
        values.push(item.graphicCharterId || null);
      }

      columns.push(
        "page_margins_json",
        "header_html",
        "body_html",
        "footer_html",
      );
      placeholders.push("?", "?", "?", "?");
      values.push(
        JSON.stringify(item.pageMargins || {}),
        item.header || "",
        item.body || "",
        item.footer || "",
      );

      await conn.execute(
        `INSERT INTO template (${columns.join(", ")})
         VALUES (${placeholders.join(", ")})`,
        values,
      );
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

function safeJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

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
