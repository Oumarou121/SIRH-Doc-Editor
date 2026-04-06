IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'family')
BEGIN
CREATE TABLE [family] (
  id NVARCHAR(64) PRIMARY KEY,
  nom NVARCHAR(255) NOT NULL,
  icon NVARCHAR(32) DEFAULT '',
  description NVARCHAR(MAX) NULL,
  beneficiary_mode NVARCHAR(32) NULL,
  beneficiary_table NVARCHAR(128) NULL,
  beneficiary_display_column_1 NVARCHAR(128) NULL,
  beneficiary_display_column_2 NVARCHAR(128) NULL,
  beneficiary_sql_text NVARCHAR(MAX) NULL,
  filter_catalog_json NVARCHAR(MAX) NULL,
  sql_text NVARCHAR(MAX) NULL,
  created_at NVARCHAR(64) NULL,
  classes_json NVARCHAR(MAX) NOT NULL
);
END;

IF COL_LENGTH('family', 'filter_catalog_json') IS NULL
BEGIN
  ALTER TABLE [family] ADD filter_catalog_json NVARCHAR(MAX) NULL;
END;

IF COL_LENGTH('family', 'beneficiary_display_column_1') IS NULL
BEGIN
  ALTER TABLE [family] ADD beneficiary_display_column_1 NVARCHAR(128) NULL;
END;

IF COL_LENGTH('family', 'beneficiary_display_column_2') IS NULL
BEGIN
  ALTER TABLE [family] ADD beneficiary_display_column_2 NVARCHAR(128) NULL;
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'etablissement')
BEGIN
CREATE TABLE [etablissement] (
  id NVARCHAR(64) PRIMARY KEY,
  nom NVARCHAR(255) NOT NULL,
  ville NVARCHAR(255) NULL,
  adresse NVARCHAR(MAX) NULL,
  tel NVARCHAR(64) NULL,
  graphic_charter_json NVARCHAR(MAX) NULL,
  created_at NVARCHAR(64) NULL,
  updated_at NVARCHAR(64) NULL
);
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'graphic_charter')
BEGIN
CREATE TABLE [graphic_charter] (
  id NVARCHAR(64) PRIMARY KEY,
  etablissement_id NVARCHAR(64) NOT NULL,
  nom NVARCHAR(255) NOT NULL,
  description NVARCHAR(MAX) NULL,
  is_default BIT NOT NULL DEFAULT 0,
  config_json NVARCHAR(MAX) NOT NULL,
  created_at NVARCHAR(64) NULL,
  updated_at NVARCHAR(64) NULL
);
END;

IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'idx_graphic_charter_etab')
CREATE INDEX idx_graphic_charter_etab ON [graphic_charter](etablissement_id);

IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'idx_graphic_charter_default')
CREATE INDEX idx_graphic_charter_default ON [graphic_charter](etablissement_id, is_default);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'admin_user')
BEGIN
CREATE TABLE [admin_user] (
  id NVARCHAR(64) PRIMARY KEY,
  etablissement_id NVARCHAR(64) NOT NULL,
  nom NVARCHAR(255) NOT NULL,
  email NVARCHAR(255) NULL
);
END;

IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'idx_admin_user_etab')
CREATE INDEX idx_admin_user_etab ON [admin_user](etablissement_id);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'template')
BEGIN
CREATE TABLE [template] (
  id NVARCHAR(64) PRIMARY KEY,
  family_id NVARCHAR(64) NOT NULL,
  etablissement_id NVARCHAR(64) NULL,
  graphic_charter_id NVARCHAR(64) NULL,
  nom NVARCHAR(255) NOT NULL,
  updated_at NVARCHAR(64) NULL,
  has_header BIT NOT NULL DEFAULT 0,
  has_footer BIT NOT NULL DEFAULT 0,
  orientation NVARCHAR(16) NULL,
  filter_profile_json NVARCHAR(MAX) NULL,
  page_margins_json NVARCHAR(MAX) NULL,
  header_html NVARCHAR(MAX) NULL,
  body_html NVARCHAR(MAX) NULL,
  footer_html NVARCHAR(MAX) NULL
);
END;

IF COL_LENGTH('template', 'filter_profile_json') IS NULL
BEGIN
  ALTER TABLE [template] ADD filter_profile_json NVARCHAR(MAX) NULL;
END;

IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'idx_template_family')
CREATE INDEX idx_template_family ON [template](family_id);

IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'idx_template_etab')
CREATE INDEX idx_template_etab ON [template](etablissement_id);
