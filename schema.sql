CREATE TABLE IF NOT EXISTS family (
  id VARCHAR(64) PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  icon VARCHAR(32) DEFAULT '',
  description TEXT NULL,
  sql_text LONGTEXT NULL,
  created_at VARCHAR(64) NULL,
  classes_json LONGTEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS etablissement (
  id VARCHAR(64) PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  ville VARCHAR(255) NULL,
  adresse TEXT NULL,
  tel VARCHAR(64) NULL,
  graphic_charter_json LONGTEXT NULL,
  created_at VARCHAR(64) NULL,
  updated_at VARCHAR(64) NULL
);

CREATE TABLE IF NOT EXISTS graphic_charter (
  id VARCHAR(64) PRIMARY KEY,
  etablissement_id VARCHAR(64) NOT NULL,
  nom VARCHAR(255) NOT NULL,
  description TEXT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  config_json LONGTEXT NOT NULL,
  created_at VARCHAR(64) NULL,
  updated_at VARCHAR(64) NULL,
  INDEX idx_graphic_charter_etab (etablissement_id),
  INDEX idx_graphic_charter_default (etablissement_id, is_default)
);

CREATE TABLE IF NOT EXISTS admin_user (
  id VARCHAR(64) PRIMARY KEY,
  etablissement_id VARCHAR(64) NOT NULL,
  nom VARCHAR(255) NOT NULL,
  email VARCHAR(255) NULL,
  INDEX idx_admin_user_etab (etablissement_id)
);

CREATE TABLE IF NOT EXISTS template (
  id VARCHAR(64) PRIMARY KEY,
  family_id VARCHAR(64) NOT NULL,
  etablissement_id VARCHAR(64) NULL,
  graphic_charter_id VARCHAR(64) NULL,
  nom VARCHAR(255) NOT NULL,
  updated_at VARCHAR(64) NULL,
  has_header TINYINT(1) NOT NULL DEFAULT 0,
  has_footer TINYINT(1) NOT NULL DEFAULT 0,
  orientation VARCHAR(16) NULL,
  page_margins_json LONGTEXT NULL,
  header_html LONGTEXT NULL,
  body_html LONGTEXT NULL,
  footer_html LONGTEXT NULL,
  INDEX idx_template_family (family_id),
  INDEX idx_template_etab (etablissement_id)
);
