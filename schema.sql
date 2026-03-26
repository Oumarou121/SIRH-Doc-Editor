CREATE TABLE IF NOT EXISTS family (
  id VARCHAR(64) PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  icon VARCHAR(32) DEFAULT '',
  description TEXT NULL,
  sql_text LONGTEXT NULL,
  created_at VARCHAR(64) NULL,
  classes_json LONGTEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS template (
  id VARCHAR(64) PRIMARY KEY,
  family_id VARCHAR(64) NOT NULL,
  etablissement_id VARCHAR(64) NULL,
  nom VARCHAR(255) NOT NULL,
  updated_at VARCHAR(64) NULL,
  has_header TINYINT(1) NOT NULL DEFAULT 0,
  has_footer TINYINT(1) NOT NULL DEFAULT 0,
  page_margins_json LONGTEXT NULL,
  header_html LONGTEXT NULL,
  body_html LONGTEXT NULL,
  footer_html LONGTEXT NULL,
  INDEX idx_template_family (family_id),
  INDEX idx_template_etab (etablissement_id)
);
