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

function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

function normalizeState(state) {
  const next = state && typeof state === "object" ? state : {};
  return {
    etablissements: Array.isArray(next.etablissements) ? clone(next.etablissements) : [],
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

async function loadTemplates() {
  if (!(await tableExists("template"))) return [];
  const [rows] = await pool.query(
    `SELECT id, family_id, etablissement_id, nom, updated_at, has_header, has_footer,
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
    const [columns] = await pool.query("SHOW COLUMNS FROM personnel LIKE 'departement_id'");
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
  return normalizeState({
    etablissements: [],
    admins: [],
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
      referencedTable:
        row.referenced_table_name || row.REFERENCED_TABLE_NAME,
      referencedColumn:
        row.referenced_column_name || row.REFERENCED_COLUMN_NAME,
    })),
  };
}

async function runSelectQuery(sql, params = {}) {
  const cleanedSql = String(sql || "").trim().replace(/;+\s*$/, "");
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

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM template");
    await conn.query("DELETE FROM family");

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
      await conn.execute(
        `INSERT INTO template (
          id, family_id, etablissement_id, nom, updated_at, has_header, has_footer,
          page_margins_json, header_html, body_html, footer_html
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.familyId,
          item.etablissementId || null,
          item.nom || "",
          item.updatedAt || null,
          item.hasHeader ? 1 : 0,
          item.hasFooter ? 1 : 0,
          JSON.stringify(item.pageMargins || {}),
          item.header || "",
          item.body || "",
          item.footer || "",
        ],
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
