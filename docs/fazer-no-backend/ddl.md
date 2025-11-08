-- polox.file_uploads definição

-- Drop table

-- DROP TABLE polox.file_uploads;

CREATE TABLE polox.file_uploads (
id bigserial NOT NULL,
company_id int8 NOT NULL,
uploaded_by int8 NULL,
file_number varchar(50) NOT NULL,
original_name varchar(255) NOT NULL,
file_path varchar(500) NOT NULL,
file_size int8 NOT NULL,
mime_type varchar(100) NOT NULL,
is_public bool DEFAULT false NULL,
created_at timestamptz DEFAULT now() NULL,
updated_at timestamptz DEFAULT now() NULL,
deleted_at timestamptz NULL,
CONSTRAINT file_uploads_pkey PRIMARY KEY (id)
);

-- polox.system_settings definição

-- Drop table

-- DROP TABLE polox.system_settings;

CREATE TABLE polox.system_settings (
id serial4 NOT NULL,
setting_key varchar(100) NOT NULL,
setting_value text NULL,
setting_type varchar(50) DEFAULT 'string'::character varying NULL,
description text NULL,
is_public bool DEFAULT false NULL,
created_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
updated_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
CONSTRAINT system_settings_pkey PRIMARY KEY (id),
CONSTRAINT system_settings_setting_key_key UNIQUE (setting_key)
);
CREATE INDEX idx_system_settings_key ON polox.system_settings USING btree (setting_key);
CREATE INDEX idx_system_settings_public ON polox.system_settings USING btree (is_public);

-- polox.token_blacklist definição

-- Drop table

-- DROP TABLE polox.token_blacklist;

CREATE TABLE polox.token_blacklist (
id bigserial NOT NULL,
token_hash varchar(64) NOT NULL,
expires_at timestamptz NOT NULL,
created_at timestamptz DEFAULT now() NULL,
CONSTRAINT token_blacklist_pkey PRIMARY KEY (id),
CONSTRAINT token_blacklist_token_hash_key UNIQUE (token_hash)
);
CREATE INDEX idx_token_blacklist_expires_at ON polox.token_blacklist USING btree (expires_at);
CREATE INDEX idx_token_blacklist_token_hash ON polox.token_blacklist USING btree (token_hash);

-- polox.companies definição

-- Drop table

-- DROP TABLE polox.companies;

CREATE TABLE polox.companies (
id bigserial NOT NULL,
company_name varchar(255) NOT NULL,
company_domain varchar(100) NULL,
slug varchar(100) NULL,
subscription_plan varchar(50) DEFAULT 'starter'::character varying NOT NULL,
status varchar(50) DEFAULT 'active'::character varying NOT NULL,
max_users int4 DEFAULT 5 NOT NULL,
max_storage_mb int4 DEFAULT 1000 NOT NULL,
industry varchar(100) NULL,
company_size varchar(50) NULL,
country varchar(3) DEFAULT 'BR'::character varying NULL,
timezone varchar(50) DEFAULT 'America/Sao_Paulo'::character varying NULL,
default_language varchar(5) DEFAULT 'pt-BR'::character varying NULL,
enabled_modules jsonb DEFAULT '["dashboard", "users"]'::jsonb NULL,
settings jsonb DEFAULT '{"maxUploadSize": "5MB", "allowPublicRegistration": false, "requireEmailVerification": true}'::jsonb NULL,
admin_name varchar(255) NULL,
admin_email varchar(255) NULL,
admin_phone varchar(20) NULL,
created_at timestamptz DEFAULT now() NULL,
updated_at timestamptz DEFAULT now() NULL,
deleted_at timestamptz NULL,
last_activity timestamptz DEFAULT now() NULL,
trial_ends_at timestamptz NULL,
subscription_ends_at timestamptz NULL,
company_type varchar(10) DEFAULT 'tenant'::character varying NOT NULL,
partner_id int8 NULL,
logo_url varchar(500) NULL,
favicon_url varchar(500) NULL,
primary_color varchar(7) NULL,
secondary_color varchar(7) NULL,
custom_domain varchar(100) NULL,
support_email varchar(255) NULL,
support_phone varchar(20) NULL,
terms_url varchar(500) NULL,
privacy_url varchar(500) NULL,
tenant_plan varchar(50) NULL,
CONSTRAINT companies_company_type_check CHECK (((company_type)::text = ANY ((ARRAY['tenant'::character varying, 'partner'::character varying, 'license'::character varying])::text[]))),
CONSTRAINT companies_custom_domain_key UNIQUE (custom_domain),
CONSTRAINT companies_domain_key UNIQUE (company_domain),
CONSTRAINT companies_pkey PRIMARY KEY (id),
CONSTRAINT companies_slug_key UNIQUE (slug),
CONSTRAINT companies_tenant_plan_check CHECK (((((company_type)::text = 'partner'::text) AND (tenant_plan IS NULL)) OR ((company_type)::text = 'tenant'::text))),
CONSTRAINT companies_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES polox.companies(id) ON DELETE SET NULL
);
CREATE INDEX idx_companies_company_type ON polox.companies USING btree (company_type);
CREATE INDEX idx_companies_created_at ON polox.companies USING btree (created_at);
CREATE INDEX idx_companies_domain ON polox.companies USING btree (company_domain);
CREATE INDEX idx_companies_partner_id ON polox.companies USING btree (partner_id);
CREATE INDEX idx_companies_plan ON polox.companies USING btree (subscription_plan);
CREATE INDEX idx_companies_status ON polox.companies USING btree (status);

-- Table Triggers

create trigger update_companies_updated_at before
update
on
polox.companies for each row execute function polox.update_updated_at_column();

-- polox.custom_fields definição

-- Drop table

-- DROP TABLE polox.custom_fields;

CREATE TABLE polox.custom_fields (
id bigserial NOT NULL,
company_id int8 NULL,
entity_type varchar(50) NOT NULL,
field_name varchar(100) NOT NULL,
field_type varchar(50) NOT NULL,
field_options jsonb NULL,
is_required bool DEFAULT false NOT NULL,
sort_order int4 DEFAULT 0 NOT NULL,
created_at timestamptz DEFAULT now() NOT NULL,
updated_at timestamptz DEFAULT now() NOT NULL,
CONSTRAINT custom_fields_company_entity_name_key UNIQUE (company_id, entity_type, field_name),
CONSTRAINT custom_fields_field_type_check CHECK (((field_type)::text = ANY ((ARRAY['text'::character varying, 'textarea'::character varying, 'numeric'::character varying, 'url'::character varying, 'options'::character varying, 'date'::character varying, 'checkbox'::character varying])::text[]))),
CONSTRAINT custom_fields_pkey PRIMARY KEY (id),
CONSTRAINT fk_custom_fields_company FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE
);
CREATE INDEX idx_custom_fields_company_entity ON polox.custom_fields USING btree (company_id, entity_type);
CREATE INDEX idx_custom_fields_entity_type ON polox.custom_fields USING btree (entity_type);

-- polox.financial_accounts definição

-- Drop table

-- DROP TABLE polox.financial_accounts;

CREATE TABLE polox.financial_accounts (
id bigserial NOT NULL,
company_id int8 NOT NULL,
account_name varchar(255) NOT NULL,
account_type varchar(50) NOT NULL,
bank_name varchar(255) NULL,
account_number varchar(100) NULL,
agency varchar(20) NULL,
current_balance numeric(15, 2) DEFAULT 0.00 NULL,
initial_balance numeric(15, 2) DEFAULT 0.00 NULL,
is_active bool DEFAULT true NULL,
is_default bool DEFAULT false NULL,
description text NULL,
created_at timestamptz DEFAULT now() NULL,
updated_at timestamptz DEFAULT now() NULL,
deleted_at timestamptz NULL,
current_balance_cents int8 DEFAULT 0 NOT NULL,
initial_balance_cents int8 DEFAULT 0 NOT NULL,
CONSTRAINT financial_accounts_pkey PRIMARY KEY (id),
CONSTRAINT financial_accounts_company_id_fkey FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE
);
CREATE INDEX idx_financial_accounts_company_id ON polox.financial_accounts USING btree (company_id);

-- Table Triggers

create trigger update_financial_accounts_updated_at before
update
on
polox.financial_accounts for each row execute function polox.update_updated_at_column();

-- polox.interests definição

-- Drop table

-- DROP TABLE polox.interests;

CREATE TABLE polox.interests (
id bigserial NOT NULL,
interest_name varchar(100) NOT NULL,
category varchar(50) NULL,
description text NULL,
created_at timestamptz DEFAULT now() NULL,
updated_at timestamptz DEFAULT now() NULL,
company_id int8 NULL,
CONSTRAINT chk_interests_category CHECK ((((category)::text = ANY ((ARRAY['product'::character varying, 'service'::character varying, 'industry'::character varying, 'technology'::character varying, 'other'::character varying])::text[])) OR (category IS NULL))),
CONSTRAINT interests_pkey PRIMARY KEY (id),
CONSTRAINT fk_interests_company FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE
);
CREATE INDEX idx_interests_category ON polox.interests USING btree (category) WHERE (category IS NOT NULL);
CREATE INDEX idx_interests_company_id ON polox.interests USING btree (company_id) WHERE (company_id IS NOT NULL);
CREATE UNIQUE INDEX idx_interests_company_name_unique ON polox.interests USING btree (company_id, interest_name) WHERE (company_id IS NOT NULL);
CREATE UNIQUE INDEX idx_interests_global_name_unique ON polox.interests USING btree (interest_name) WHERE (company_id IS NULL);
CREATE INDEX idx_interests_name ON polox.interests USING btree (interest_name);

-- polox.notification_templates definição

-- Drop table

-- DROP TABLE polox.notification_templates;

CREATE TABLE polox.notification_templates (
id bigserial NOT NULL,
company_id int8 NULL,
code varchar(100) NOT NULL,
template_name varchar(255) NOT NULL,
description text NULL,
notification_type varchar(50) NOT NULL,
category varchar(100) NULL,
subject_template text NULL,
body_template text NOT NULL,
variables jsonb DEFAULT '[]'::jsonb NULL,
is_active bool DEFAULT true NULL,
is_system bool DEFAULT false NULL,
created_at timestamptz DEFAULT now() NULL,
updated_at timestamptz DEFAULT now() NULL,
CONSTRAINT notification_templates_code_company_id_key UNIQUE (code, company_id),
CONSTRAINT notification_templates_pkey PRIMARY KEY (id),
CONSTRAINT notification_templates_company_id_fkey FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE
);
CREATE INDEX idx_notification_templates_code ON polox.notification_templates USING btree (code);
CREATE INDEX idx_notification_templates_company_id ON polox.notification_templates USING btree (company_id);
CREATE INDEX idx_notification_templates_type ON polox.notification_templates USING btree (notification_type);

-- polox.product_categories definição

-- Drop table

-- DROP TABLE polox.product_categories;

CREATE TABLE polox.product_categories (
id bigserial NOT NULL,
company_id int8 NOT NULL,
parent_id int8 NULL,
category_name varchar(255) NOT NULL,
slug varchar(255) NOT NULL,
description text NULL,
image_url varchar(500) NULL,
is_active bool DEFAULT true NULL,
sort_order int4 DEFAULT 0 NULL,
created_at timestamptz DEFAULT now() NULL,
updated_at timestamptz DEFAULT now() NULL,
deleted_at timestamptz NULL,
CONSTRAINT product_categories_company_id_slug_key UNIQUE (company_id, slug),
CONSTRAINT product_categories_pkey PRIMARY KEY (id),
CONSTRAINT product_categories_company_id_fkey FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE,
CONSTRAINT product_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES polox.product_categories(id)
);
CREATE INDEX idx_product_categories_company_id ON polox.product_categories USING btree (company_id);
CREATE INDEX idx_product_categories_parent_id ON polox.product_categories USING btree (parent_id);

-- polox.suppliers definição

-- Drop table

-- DROP TABLE polox.suppliers;

CREATE TABLE polox.suppliers (
id bigserial NOT NULL,
company_id int8 NOT NULL,
supplier_name varchar(255) NOT NULL,
company_name varchar(255) NULL,
document_number varchar(50) NULL,
document_type varchar(20) NULL,
email varchar(255) NULL,
phone varchar(20) NULL,
website varchar(255) NULL,
category varchar(100) NULL,
status varchar(50) DEFAULT 'ativo'::character varying NOT NULL,
address_street varchar(255) NULL,
address_number varchar(20) NULL,
address_complement varchar(100) NULL,
address_neighborhood varchar(100) NULL,
address_city varchar(100) NULL,
address_state varchar(50) NULL,
address_country varchar(3) DEFAULT 'BR'::character varying NULL,
address_postal_code varchar(20) NULL,
payment_terms varchar(100) NULL,
credit_limit numeric(15, 2) DEFAULT 0.00 NULL,
contact_person varchar(255) NULL,
contact_phone varchar(20) NULL,
contact_email varchar(255) NULL,
created_at timestamptz DEFAULT now() NULL,
updated_at timestamptz DEFAULT now() NULL,
deleted_at timestamptz NULL,
CONSTRAINT suppliers_pkey PRIMARY KEY (id),
CONSTRAINT suppliers_company_id_fkey FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE
);
CREATE INDEX idx_suppliers_category ON polox.suppliers USING btree (category);
CREATE INDEX idx_suppliers_company_id ON polox.suppliers USING btree (company_id);
CREATE INDEX idx_suppliers_status ON polox.suppliers USING btree (status);

-- Table Triggers

create trigger update_suppliers_updated_at before
update
on
polox.suppliers for each row execute function polox.update_updated_at_column();
create trigger trg_suppliers_cleanup_custom_values after
delete
on
polox.suppliers for each row execute function polox.cleanup_custom_field_values('supplier');

-- polox.tags definição

-- Drop table

-- DROP TABLE polox.tags;

CREATE TABLE polox.tags (
id bigserial NOT NULL,
company_id int8 NULL,
tag_name varchar(255) NOT NULL,
slug varchar(255) NOT NULL,
color varchar(7) DEFAULT '#3498db'::character varying NULL,
is_active bool DEFAULT true NULL,
created_at timestamptz DEFAULT now() NULL,
updated_at timestamptz DEFAULT now() NULL,
deleted_at timestamptz NULL,
CONSTRAINT tags_pkey PRIMARY KEY (id),
CONSTRAINT fk_tags_company FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE
);
CREATE INDEX idx_tags_company_id ON polox.tags USING btree (company_id) WHERE (company_id IS NOT NULL);
CREATE UNIQUE INDEX idx_tags_company_name_slug_unique ON polox.tags USING btree (company_id, tag_name, slug) WHERE (company_id IS NOT NULL);
CREATE UNIQUE INDEX idx_tags_global_name_slug_unique ON polox.tags USING btree (tag_name, slug) WHERE (company_id IS NULL);

-- polox.users definição

-- Drop table

-- DROP TABLE polox.users;

CREATE TABLE polox.users (
id bigserial NOT NULL,
company_id int8 NOT NULL,
full_name varchar(255) NOT NULL,
email varchar(255) NOT NULL,
email_verified_at timestamptz NULL,
password_hash varchar(255) NOT NULL,
user_role varchar(50) DEFAULT 'user'::character varying NOT NULL,
permissions jsonb DEFAULT '[]'::jsonb NULL,
avatar_url varchar(500) NULL,
phone varchar(20) NULL,
user_position varchar(100) NULL,
department varchar(100) NULL,
status varchar(50) DEFAULT 'active'::character varying NOT NULL,
user_language varchar(5) DEFAULT 'pt-BR'::character varying NULL,
timezone varchar(50) DEFAULT 'America/Sao_Paulo'::character varying NULL,
preferences jsonb DEFAULT '{"emailUpdates": true, "notifications": true, "dashboard_layout": "default"}'::jsonb NULL,
last_login_at timestamptz NULL,
last_login_ip inet NULL,
failed_login_attempts int4 DEFAULT 0 NULL,
locked_until timestamptz NULL,
remember_token varchar(100) NULL,
verification_token varchar(100) NULL,
reset_password_token varchar(100) NULL,
reset_password_expires_at timestamptz NULL,
created_at timestamptz DEFAULT now() NULL,
updated_at timestamptz DEFAULT now() NULL,
deleted_at timestamptz NULL,
CONSTRAINT users_company_id_email_key UNIQUE (company_id, email),
CONSTRAINT users_pkey PRIMARY KEY (id),
CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE
);
CREATE INDEX idx_users_company_id ON polox.users USING btree (company_id);
CREATE INDEX idx_users_created_at ON polox.users USING btree (created_at);
CREATE INDEX idx_users_email ON polox.users USING btree (email);
CREATE INDEX idx_users_role ON polox.users USING btree (user_role);
CREATE INDEX idx_users_status ON polox.users USING btree (status);

-- Table Triggers

create trigger update_users_updated_at before
update
on
polox.users for each row execute function polox.update_updated_at_column();

-- polox.achievements definição

-- Drop table

-- DROP TABLE polox.achievements;

CREATE TABLE polox.achievements (
id bigserial NOT NULL,
company_id int8 NOT NULL,
achievement_name varchar(255) NOT NULL,
description text NULL,
category varchar(100) NULL,
icon_url varchar(500) NULL,
badge_color varchar(20) DEFAULT '#FFD700'::character varying NULL,
xp_reward int4 DEFAULT 0 NULL,
coin_reward int4 DEFAULT 0 NULL,
criteria jsonb NOT NULL,
is_active bool DEFAULT true NULL,
is_secret bool DEFAULT false NULL,
created_at timestamptz DEFAULT now() NULL,
updated_at timestamptz DEFAULT now() NULL,
CONSTRAINT achievements_pkey PRIMARY KEY (id),
CONSTRAINT achievements_company_id_fkey FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE
);
CREATE INDEX idx_achievements_category ON polox.achievements USING btree (category);
CREATE INDEX idx_achievements_company_id ON polox.achievements USING btree (company_id);

-- polox.audit_logs definição

-- Drop table

-- DROP TABLE polox.audit_logs;

CREATE TABLE polox.audit_logs (
id bigserial NOT NULL,
company_id int8 NOT NULL,
user_id int8 NULL,
audit_action varchar(50) NOT NULL,
entity_type varchar(100) NOT NULL,
entity_id int8 NOT NULL,
description text NULL,
created_at timestamptz DEFAULT now() NULL,
CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
CONSTRAINT fk_audit_logs_company FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE,
CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES polox.users(id) ON DELETE SET NULL
);

-- polox.contacts definição

-- Drop table

-- DROP TABLE polox.contacts;

CREATE TABLE polox.contacts (
id int8 DEFAULT nextval('polox.contatos_id_seq'::regclass) NOT NULL,
company_id int8 NOT NULL,
nome varchar(255) NOT NULL,
email varchar(255) NULL,
phone varchar(20) NULL,
company_name varchar(255) NULL,
document_number varchar(50) NULL,
document_type varchar(20) NULL,
tipo varchar(20) DEFAULT 'lead'::character varying NOT NULL,
lead_source varchar(100) NULL,
first_contact_at timestamptz NULL,
score int4 DEFAULT 0 NULL,
temperature varchar(20) DEFAULT 'frio'::character varying NULL,
last_purchase_date date NULL,
lifetime_value_cents int8 DEFAULT 0 NOT NULL,
address_street varchar(255) NULL,
address_number varchar(20) NULL,
address_complement varchar(100) NULL,
address_neighborhood varchar(100) NULL,
address_city varchar(100) NULL,
address_state varchar(50) NULL,
address_country varchar(3) DEFAULT 'BR'::character varying NULL,
address_postal_code varchar(20) NULL,
owner_id int8 NULL,
created_at timestamptz DEFAULT now() NULL,
updated_at timestamptz DEFAULT now() NULL,
deleted_at timestamptz NULL,
CONSTRAINT chk_contact_has_identifier CHECK ((((phone IS NOT NULL) AND ((phone)::text <> ''::text)) OR ((email IS NOT NULL) AND ((email)::text <> ''::text)) OR ((document_number IS NOT NULL) AND ((document_number)::text <> ''::text)))),
CONSTRAINT chk_contato_tem_identificador CHECK (((deleted_at IS NOT NULL) OR (phone IS NOT NULL) OR (email IS NOT NULL) OR (document_number IS NOT NULL))),
CONSTRAINT contacts_pkey PRIMARY KEY (id),
CONSTRAINT contatos_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['lead'::character varying, 'cliente'::character varying])::text[]))),
CONSTRAINT contacts_company_id_fkey FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE,
CONSTRAINT contacts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES polox.users(id) ON DELETE SET NULL
);
CREATE INDEX idx_contacts_company_id ON polox.contacts USING btree (company_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_contacts_email ON polox.contacts USING btree (email) WHERE ((email IS NOT NULL) AND (deleted_at IS NULL));
CREATE INDEX idx_contacts_owner_id ON polox.contacts USING btree (owner_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_contacts_phone ON polox.contacts USING btree (phone) WHERE ((phone IS NOT NULL) AND (deleted_at IS NULL));
CREATE INDEX idx_contacts_type ON polox.contacts USING btree (company_id, tipo) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX uk_contacts_company_document ON polox.contacts USING btree (company_id, document_number) WHERE ((document_number IS NOT NULL) AND (deleted_at IS NULL));
CREATE UNIQUE INDEX uk_contacts_company_email ON polox.contacts USING btree (company_id, email) WHERE ((email IS NOT NULL) AND (deleted_at IS NULL));
CREATE UNIQUE INDEX uk_contacts_company_phone ON polox.contacts USING btree (company_id, phone) WHERE ((phone IS NOT NULL) AND (deleted_at IS NULL));

-- polox.custom_field_values definição

-- Drop table

-- DROP TABLE polox.custom_field_values;

CREATE TABLE polox.custom_field_values (
id bigserial NOT NULL,
custom_field_id int8 NOT NULL,
entity_id int8 NOT NULL,
text_value text NULL,
numeric_value numeric(15, 2) NULL,
date_value timestamptz NULL,
boolean_value bool NULL,
created_at timestamptz DEFAULT now() NOT NULL,
updated_at timestamptz DEFAULT now() NOT NULL,
CONSTRAINT custom_field_values_entity_field_key UNIQUE (custom_field_id, entity_id),
CONSTRAINT custom_field_values_pkey PRIMARY KEY (id),
CONSTRAINT fk_custom_field_values_field FOREIGN KEY (custom_field_id) REFERENCES polox.custom_fields(id) ON DELETE CASCADE
);
CREATE INDEX idx_custom_field_values_entity ON polox.custom_field_values USING btree (entity_id);
CREATE INDEX idx_custom_field_values_field ON polox.custom_field_values USING btree (custom_field_id);
CREATE INDEX idx_custom_field_values_field_entity ON polox.custom_field_values USING btree (custom_field_id, entity_id);

-- polox.deals definição

-- Drop table

-- DROP TABLE polox.deals;

CREATE TABLE polox.deals (
id int8 DEFAULT nextval('polox.negociacoes_id_seq'::regclass) NOT NULL,
company_id int8 NOT NULL,
contato_id int8 NOT NULL,
owner_id int8 NULL,
titulo varchar(255) NOT NULL,
etapa_funil varchar(50) DEFAULT 'novo'::character varying NOT NULL,
valor_total_cents int8 DEFAULT 0 NOT NULL,
origem varchar(100) NULL,
closed_at timestamptz NULL,
motivo_perda text NULL,
created_at timestamptz DEFAULT now() NULL,
updated_at timestamptz DEFAULT now() NULL,
deleted_at timestamptz NULL,
CONSTRAINT deals_pkey PRIMARY KEY (id),
CONSTRAINT negociacoes_etapa_funil_check CHECK (((etapa_funil)::text = ANY ((ARRAY['novo'::character varying, 'qualificado'::character varying, 'proposta'::character varying, 'negociacao'::character varying, 'ganhos'::character varying, 'perdido'::character varying])::text[]))),
CONSTRAINT deals_company_id_fkey FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE,
CONSTRAINT deals_contact_id_fkey FOREIGN KEY (contato_id) REFERENCES polox.contacts(id) ON DELETE RESTRICT,
CONSTRAINT deals_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES polox.users(id) ON DELETE SET NULL
);
CREATE INDEX idx_deals_company_id ON polox.deals USING btree (company_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_deals_contact_id ON polox.deals USING btree (contato_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_deals_owner_id ON polox.deals USING btree (owner_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_deals_stage ON polox.deals USING btree (company_id, etapa_funil) WHERE (deleted_at IS NULL);

-- polox.events definição

-- Drop table

-- DROP TABLE polox.events;

CREATE TABLE polox.events (
id bigserial NOT NULL,
company_id int8 NOT NULL,
user_id int8 NOT NULL,
contato_id int8 NULL,
title varchar(255) NOT NULL,
description text NULL,
start_datetime timestamptz NOT NULL,
end_datetime timestamptz NOT NULL,
timezone varchar(50) DEFAULT 'America/Sao_Paulo'::character varying NULL,
event_type varchar(50) DEFAULT 'meeting'::character varying NOT NULL,
status varchar(50) DEFAULT 'scheduled'::character varying NOT NULL,
event_location varchar(255) NULL,
meeting_link varchar(500) NULL,
is_all_day bool DEFAULT false NULL,
is_recurring bool DEFAULT false NULL,
recurrence_pattern jsonb NULL,
reminder_minutes int4 DEFAULT 15 NULL,
created_at timestamptz DEFAULT now() NULL,
updated_at timestamptz DEFAULT now() NULL,
deleted_at timestamptz NULL,
CONSTRAINT events_pkey PRIMARY KEY (id),
CONSTRAINT events_company_id_fkey FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE,
CONSTRAINT events_user_id_fkey FOREIGN KEY (user_id) REFERENCES polox.users(id),
CONSTRAINT fk_events_contact FOREIGN KEY (contato_id) REFERENCES polox.contacts(id)
);
CREATE INDEX idx_events_client_id ON polox.events USING btree (contato_id);
CREATE INDEX idx_events_company_id ON polox.events USING btree (company_id);
CREATE INDEX idx_events_start_datetime ON polox.events USING btree (start_datetime);
CREATE INDEX idx_events_type ON polox.events USING btree (event_type);
CREATE INDEX idx_events_user_id ON polox.events USING btree (user_id);

-- Table Triggers

create trigger update_events_updated_at before
update
on
polox.events for each row execute function polox.update_updated_at_column();
create trigger trg_events_cleanup_custom_values after
delete
on
polox.events for each row execute function polox.cleanup_custom_field_values('event');

-- polox.gamification_history definição

-- Drop table

-- DROP TABLE polox.gamification_history;

CREATE TABLE polox.gamification_history (
id serial4 NOT NULL,
user_id int4 NOT NULL,
event_type varchar(50) NOT NULL,
points_awarded int4 DEFAULT 0 NULL,
points_deducted int4 DEFAULT 0 NULL,
description text NULL,
metadata jsonb DEFAULT '{}'::jsonb NULL,
related_entity_type varchar(50) NULL,
related_entity_id int4 NULL,
triggered_by_user_id int4 NULL,
created_at timestamp DEFAULT now() NULL,
company_id int8 NOT NULL,
CONSTRAINT check_points_mutually_exclusive CHECK ((((points_awarded > 0) AND (points_deducted = 0)) OR ((points_awarded = 0) AND (points_deducted > 0)) OR ((points_awarded = 0) AND (points_deducted = 0)))),
CONSTRAINT gamification_history_pkey PRIMARY KEY (id),
CONSTRAINT gamification_history_points_awarded_check CHECK ((points_awarded >= 0)),
CONSTRAINT gamification_history_points_deducted_check CHECK ((points_deducted >= 0)),
CONSTRAINT fk_gamification_history_company FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE,
CONSTRAINT gamification_history_triggered_by_user_id_fkey FOREIGN KEY (triggered_by_user_id) REFERENCES polox.users(id) ON DELETE SET NULL,
CONSTRAINT gamification_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES polox.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_gamification_history_company_id ON polox.gamification_history USING btree (company_id);
CREATE INDEX idx_gamification_history_created_at ON polox.gamification_history USING btree (created_at DESC);
CREATE INDEX idx_gamification_history_entity ON polox.gamification_history USING btree (related_entity_type, related_entity_id);
CREATE INDEX idx_gamification_history_event_type ON polox.gamification_history USING btree (event_type);
CREATE INDEX idx_gamification_history_metadata ON polox.gamification_history USING gin (metadata);
CREATE INDEX idx_gamification_history_user_event ON polox.gamification_history USING btree (user_id, event_type);
CREATE INDEX idx_gamification_history_user_id ON polox.gamification_history USING btree (user_id);

-- polox.notifications definição

-- Drop table

-- DROP TABLE polox.notifications;

CREATE TABLE polox.notifications (
id bigserial NOT NULL,
company_id int8 NOT NULL,
recipient_user_id int8 NOT NULL,
template_id int8 NULL,
notification_type varchar(50) NOT NULL,
channel varchar(50) DEFAULT 'in_app'::character varying NOT NULL,
title varchar(255) NOT NULL,
message text NOT NULL,
status varchar(50) DEFAULT 'pending'::character varying NOT NULL,
priority varchar(20) DEFAULT 'normal'::character varying NOT NULL,
scheduled_for timestamptz NULL,
sent_at timestamptz NULL,
read_at timestamptz NULL,
metadata jsonb DEFAULT '{}'::jsonb NULL,
related_entity_type varchar(100) NULL,
related_entity_id int8 NULL,
action_url varchar(500) NULL,
action_label varchar(100) NULL,
created_at timestamptz DEFAULT now() NULL,
updated_at timestamptz DEFAULT now() NULL,
CONSTRAINT notifications_pkey PRIMARY KEY (id),
CONSTRAINT notifications_company_id_fkey FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE,
CONSTRAINT notifications_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES polox.users(id) ON DELETE CASCADE,
CONSTRAINT notifications_template_id_fkey FOREIGN KEY (template_id) REFERENCES polox.notification_templates(id)
);
CREATE INDEX idx_notifications_company_id ON polox.notifications USING btree (company_id);
CREATE INDEX idx_notifications_recipient_user_id ON polox.notifications USING btree (recipient_user_id);
CREATE INDEX idx_notifications_scheduled_for ON polox.notifications USING btree (scheduled_for);
CREATE INDEX idx_notifications_status ON polox.notifications USING btree (status);
CREATE INDEX idx_notifications_type ON polox.notifications USING btree (notification_type);

-- polox.products definição

-- Drop table

-- DROP TABLE polox.products;

CREATE TABLE polox.products (
id bigserial NOT NULL,
company_id int8 NOT NULL,
category_id int8 NULL,
supplier_id int8 NULL,
product_name varchar(255) NOT NULL,
description text NULL,
code varchar(100) NULL,
barcode varchar(100) NULL,
product_type varchar(50) DEFAULT 'product'::character varying NULL,
status varchar(50) DEFAULT 'active'::character varying NULL,
cost_price numeric(15, 2) DEFAULT 0.00 NULL,
sale_price numeric(15, 2) NOT NULL,
markup_percentage numeric(5, 2) DEFAULT 0.00 NULL,
stock_quantity int4 DEFAULT 0 NULL,
min_stock_level int4 DEFAULT 0 NULL,
max_stock_level int4 NULL,
stock_unit varchar(20) DEFAULT 'unit'::character varying NULL,
weight numeric(8, 3) NULL,
length numeric(8, 2) NULL,
width numeric(8, 2) NULL,
height numeric(8, 2) NULL,
slug varchar(255) NULL,
meta_title varchar(255) NULL,
meta_description text NULL,
featured_image_url varchar(500) NULL,
gallery_images jsonb DEFAULT '[]'::jsonb NULL,
is_featured bool DEFAULT false NULL,
is_digital bool DEFAULT false NULL,
requires_shipping bool DEFAULT true NULL,
created_at timestamptz DEFAULT now() NULL,
updated_at timestamptz DEFAULT now() NULL,
deleted_at timestamptz NULL,
cost_price_cents int8 DEFAULT 0 NOT NULL,
sale_price_cents int8 DEFAULT 0 NOT NULL,
CONSTRAINT products_company_id_code_key UNIQUE (company_id, code),
CONSTRAINT products_pkey PRIMARY KEY (id),
CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id) REFERENCES polox.suppliers(id),
CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES polox.product_categories(id),
CONSTRAINT products_company_id_fkey FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE
);
CREATE INDEX idx_products_category_id ON polox.products USING btree (category_id);
CREATE INDEX idx_products_code ON polox.products USING btree (code);
CREATE INDEX idx_products_company_id ON polox.products USING btree (company_id);
CREATE INDEX idx_products_status ON polox.products USING btree (status);

-- Table Triggers

create trigger update_products_updated_at before
update
on
polox.products for each row execute function polox.update_updated_at_column();
create trigger trg_products_cleanup_custom_values after
delete
on
polox.products for each row execute function polox.cleanup_custom_field_values('product');

-- polox.sales definição

-- Drop table

-- DROP TABLE polox.sales;

CREATE TABLE polox.sales (
id bigserial NOT NULL,
company_id int8 NOT NULL,
contato_id int8 NULL,
user_id int8 NULL,
sale_number varchar(100) NULL,
total_amount numeric(15, 2) NOT NULL,
discount_amount numeric(15, 2) DEFAULT 0.00 NULL,
tax_amount numeric(15, 2) DEFAULT 0.00 NULL,
net_amount numeric(15, 2) NOT NULL,
status varchar(50) DEFAULT 'pending'::character varying NOT NULL,
sale_date date NOT NULL,
delivery_date date NULL,
payment_method varchar(100) NULL,
payment_status varchar(50) DEFAULT 'pending'::character varying NULL,
payment_due_date date NULL,
payment_date date NULL,
description text NULL,
commission_percentage numeric(5, 2) DEFAULT 0.00 NULL,
commission_amount numeric(15, 2) DEFAULT 0.00 NULL,
commission_paid bool DEFAULT false NULL,
created_at timestamptz DEFAULT now() NULL,
updated_at timestamptz DEFAULT now() NULL,
deleted_at timestamptz NULL,
total_amount_cents int8 DEFAULT 0 NOT NULL,
discount_amount_cents int8 DEFAULT 0 NOT NULL,
tax_amount_cents int8 DEFAULT 0 NOT NULL,
net_amount_cents int8 DEFAULT 0 NOT NULL,
commission_amount_cents int8 DEFAULT 0 NOT NULL,
CONSTRAINT sales_pkey PRIMARY KEY (id),
CONSTRAINT sales_sale_number_key UNIQUE (sale_number),
CONSTRAINT fk_sales_contact FOREIGN KEY (contato_id) REFERENCES polox.contacts(id),
CONSTRAINT sales_company_id_fkey FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE,
CONSTRAINT sales_user_id_fkey FOREIGN KEY (user_id) REFERENCES polox.users(id)
);
CREATE INDEX idx_sales_client_id ON polox.sales USING btree (contato_id);
CREATE INDEX idx_sales_company_id ON polox.sales USING btree (company_id);
CREATE INDEX idx_sales_sale_date ON polox.sales USING btree (sale_date);
CREATE INDEX idx_sales_status ON polox.sales USING btree (status);
CREATE INDEX idx_sales_user_id ON polox.sales USING btree (user_id);

-- Table Triggers

create trigger update_sales_updated_at before
update
on
polox.sales for each row execute function polox.update_updated_at_column();
create trigger trg_sales_cleanup_custom_values after
delete
on
polox.sales for each row execute function polox.cleanup_custom_field_values('sale');

-- polox.supplier_tags definição

-- Drop table

-- DROP TABLE polox.supplier_tags;

CREATE TABLE polox.supplier_tags (
supplier_id int8 NOT NULL,
tag_id int8 NOT NULL,
created_at timestamptz DEFAULT now() NULL,
CONSTRAINT supplier_tags_pkey PRIMARY KEY (supplier_id, tag_id),
CONSTRAINT fk_supplier_tags_supplier FOREIGN KEY (supplier_id) REFERENCES polox.suppliers(id) ON DELETE CASCADE,
CONSTRAINT fk_supplier_tags_tag FOREIGN KEY (tag_id) REFERENCES polox.tags(id) ON DELETE CASCADE
);
CREATE INDEX idx_supplier_tags_supplier_id ON polox.supplier_tags USING btree (supplier_id);
CREATE INDEX idx_supplier_tags_tag_id ON polox.supplier_tags USING btree (tag_id);

-- polox.tickets definição

-- Drop table

-- DROP TABLE polox.tickets;

CREATE TABLE polox.tickets (
id bigserial NOT NULL,
company_id int8 NOT NULL,
contato_id int8 NULL,
created_by_user_id int8 NULL,
assigned_to_user_id int8 NULL,
title varchar(255) NOT NULL,
description text NOT NULL,
status varchar(50) DEFAULT 'open'::character varying NOT NULL,
priority varchar(20) DEFAULT 'medium'::character varying NOT NULL,
category varchar(100) NULL,
due_date timestamptz NULL,
resolved_at timestamptz NULL,
closed_at timestamptz NULL,
satisfaction_rating int4 NULL,
created_at timestamptz DEFAULT now() NULL,
updated_at timestamptz DEFAULT now() NULL,
deleted_at timestamptz NULL,
CONSTRAINT tickets_pkey PRIMARY KEY (id),
CONSTRAINT fk_tickets_contact FOREIGN KEY (contato_id) REFERENCES polox.contacts(id),
CONSTRAINT tickets_assigned_to_user_id_fkey FOREIGN KEY (assigned_to_user_id) REFERENCES polox.users(id),
CONSTRAINT tickets_company_id_fkey FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE,
CONSTRAINT tickets_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES polox.users(id)
);
CREATE INDEX idx_tickets_assigned_to_user_id ON polox.tickets USING btree (assigned_to_user_id);
CREATE INDEX idx_tickets_client_id ON polox.tickets USING btree (contato_id);
CREATE INDEX idx_tickets_company_id ON polox.tickets USING btree (company_id);
CREATE INDEX idx_tickets_priority ON polox.tickets USING btree (priority);
CREATE INDEX idx_tickets_status ON polox.tickets USING btree (status);

-- Table Triggers

create trigger update_tickets_updated_at before
update
on
polox.tickets for each row execute function polox.update_updated_at_column();
create trigger trg_tickets_cleanup_custom_values after
delete
on
polox.tickets for each row execute function polox.cleanup_custom_field_values('ticket');

-- polox.user_achievements definição

-- Drop table

-- DROP TABLE polox.user_achievements;

CREATE TABLE polox.user_achievements (
id bigserial NOT NULL,
user_id int8 NOT NULL,
achievement_id int8 NOT NULL,
unlocked_at timestamptz DEFAULT now() NULL,
CONSTRAINT user_achievements_pkey PRIMARY KEY (id),
CONSTRAINT user_achievements_user_id_achievement_id_key UNIQUE (user_id, achievement_id),
CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES polox.achievements(id) ON DELETE CASCADE,
CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES polox.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_user_achievements_achievement_id ON polox.user_achievements USING btree (achievement_id);
CREATE INDEX idx_user_achievements_user_id ON polox.user_achievements USING btree (user_id);

-- polox.user_gamification_profiles definição

-- Drop table

-- DROP TABLE polox.user_gamification_profiles;

CREATE TABLE polox.user_gamification_profiles (
id bigserial NOT NULL,
user_id int8 NOT NULL,
company_id int8 NOT NULL,
total_xp int4 DEFAULT 0 NULL,
current_level int4 DEFAULT 1 NULL,
current_level_xp int4 DEFAULT 0 NULL,
next_level_xp int4 DEFAULT 100 NULL,
total_coins int4 DEFAULT 0 NULL,
available_coins int4 DEFAULT 0 NULL,
spent_coins int4 DEFAULT 0 NULL,
achievements_count int4 DEFAULT 0 NULL,
missions_completed int4 DEFAULT 0 NULL,
rewards_claimed int4 DEFAULT 0 NULL,
streak_days int4 DEFAULT 0 NULL,
longest_streak int4 DEFAULT 0 NULL,
last_activity_date date NULL,
created_at timestamptz DEFAULT now() NULL,
updated_at timestamptz DEFAULT now() NULL,
CONSTRAINT user_gamification_profiles_pkey PRIMARY KEY (id),
CONSTRAINT user_gamification_profiles_user_id_company_id_key UNIQUE (user_id, company_id),
CONSTRAINT user_gamification_profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE,
CONSTRAINT user_gamification_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES polox.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_user_gamification_profiles_company_id ON polox.user_gamification_profiles USING btree (company_id);
CREATE INDEX idx_user_gamification_profiles_user_id ON polox.user_gamification_profiles USING btree (user_id);

-- polox.user_sessions definição

-- Drop table

-- DROP TABLE polox.user_sessions;

CREATE TABLE polox.user_sessions (
id bigserial NOT NULL,
user_id int8 NOT NULL,
token_id varchar(255) NOT NULL,
refresh_token varchar(255) NULL,
ip_address inet NULL,
user_agent text NULL,
device_info jsonb NULL,
expires_at timestamptz NOT NULL,
revoked_at timestamptz NULL,
status varchar(20) DEFAULT 'active'::character varying NULL,
created_at timestamptz DEFAULT now() NULL,
company_id int8 NOT NULL,
CONSTRAINT user_sessions_pkey PRIMARY KEY (id),
CONSTRAINT user_sessions_refresh_token_key UNIQUE (refresh_token),
CONSTRAINT user_sessions_token_id_key UNIQUE (token_id),
CONSTRAINT fk_user_sessions_company FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE,
CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES polox.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_user_sessions_company_id ON polox.user_sessions USING btree (company_id);
CREATE INDEX idx_user_sessions_expires_at ON polox.user_sessions USING btree (expires_at);
CREATE INDEX idx_user_sessions_status ON polox.user_sessions USING btree (status);
CREATE INDEX idx_user_sessions_token_id ON polox.user_sessions USING btree (token_id);
CREATE INDEX idx_user_sessions_user_id ON polox.user_sessions USING btree (user_id);

-- polox.contact_interests definição

-- Drop table

-- DROP TABLE polox.contact_interests;

CREATE TABLE polox.contact_interests (
contato_id int8 NOT NULL,
interest_id int8 NOT NULL,
created_at timestamptz DEFAULT now() NULL,
CONSTRAINT contato_interesses_pkey PRIMARY KEY (contato_id, interest_id),
CONSTRAINT contact_interests_contact_id_fkey FOREIGN KEY (contato_id) REFERENCES polox.contacts(id) ON DELETE CASCADE,
CONSTRAINT contact_interests_interest_id_fkey FOREIGN KEY (interest_id) REFERENCES polox.interests(id) ON DELETE CASCADE
);
CREATE INDEX idx_contato_interesses_contato_id ON polox.contact_interests USING btree (contato_id);
CREATE INDEX idx_contato_interesses_interest_id ON polox.contact_interests USING btree (interest_id);

-- polox.contact_notes definição

-- Drop table

-- DROP TABLE polox.contact_notes;

CREATE TABLE polox.contact_notes (
id int8 DEFAULT nextval('polox.contato_notas_id_seq'::regclass) NOT NULL,
company_id int8 NOT NULL,
contato_id int8 NOT NULL,
created_by_id int8 NOT NULL,
note_content text NOT NULL,
note_type varchar(50) DEFAULT 'general'::character varying NULL,
created_at timestamptz DEFAULT now() NULL,
updated_at timestamptz DEFAULT now() NULL,
deleted_at timestamptz NULL,
CONSTRAINT contact_notes_pkey PRIMARY KEY (id),
CONSTRAINT contact_notes_company_id_fkey FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE,
CONSTRAINT contact_notes_contact_id_fkey FOREIGN KEY (contato_id) REFERENCES polox.contacts(id) ON DELETE CASCADE,
CONSTRAINT contact_notes_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES polox.users(id) ON DELETE RESTRICT
);
CREATE INDEX idx_contact_notes_company_id ON polox.contact_notes USING btree (company_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_contact_notes_contact_id ON polox.contact_notes USING btree (contato_id) WHERE (deleted_at IS NULL);

-- polox.contact_tags definição

-- Drop table

-- DROP TABLE polox.contact_tags;

CREATE TABLE polox.contact_tags (
contato_id int8 NOT NULL,
tag_id int8 NOT NULL,
created_at timestamptz DEFAULT now() NULL,
CONSTRAINT contato_tags_pkey PRIMARY KEY (contato_id, tag_id),
CONSTRAINT contact_tags_contact_id_fkey FOREIGN KEY (contato_id) REFERENCES polox.contacts(id) ON DELETE CASCADE,
CONSTRAINT contact_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES polox.tags(id) ON DELETE CASCADE
);
CREATE INDEX idx_contato_tags_contato_id ON polox.contact_tags USING btree (contato_id);
CREATE INDEX idx_contato_tags_tag_id ON polox.contact_tags USING btree (tag_id);

-- polox.event_tags definição

-- Drop table

-- DROP TABLE polox.event_tags;

CREATE TABLE polox.event_tags (
event_id int8 NOT NULL,
tag_id int8 NOT NULL,
created_at timestamptz DEFAULT now() NULL,
CONSTRAINT event_tags_pkey PRIMARY KEY (event_id, tag_id),
CONSTRAINT fk_event_tags_event FOREIGN KEY (event_id) REFERENCES polox.events(id) ON DELETE CASCADE,
CONSTRAINT fk_event_tags_tag FOREIGN KEY (tag_id) REFERENCES polox.tags(id) ON DELETE CASCADE
);
CREATE INDEX idx_event_tags_event_id ON polox.event_tags USING btree (event_id);
CREATE INDEX idx_event_tags_tag_id ON polox.event_tags USING btree (tag_id);

-- polox.financial_transactions definição

-- Drop table

-- DROP TABLE polox.financial_transactions;

CREATE TABLE polox.financial_transactions (
id bigserial NOT NULL,
company_id int8 NOT NULL,
account_id int8 NOT NULL,
transaction_type varchar(50) NOT NULL,
category varchar(100) NULL,
amount numeric(15, 2) NOT NULL,
description text NOT NULL,
transaction_date date NOT NULL,
due_date date NULL,
paid_date date NULL,
status varchar(50) DEFAULT 'pending'::character varying NULL,
payment_method varchar(100) NULL,
reference_document varchar(100) NULL,
contato_id int8 NULL,
sale_id int8 NULL,
created_at timestamptz DEFAULT now() NULL,
updated_at timestamptz DEFAULT now() NULL,
deleted_at timestamptz NULL,
amount_cents int8 DEFAULT 0 NOT NULL,
CONSTRAINT financial_transactions_pkey PRIMARY KEY (id),
CONSTRAINT financial_transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES polox.financial_accounts(id),
CONSTRAINT financial_transactions_company_id_fkey FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE,
CONSTRAINT financial_transactions_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES polox.sales(id),
CONSTRAINT fk_financial_transactions_contact FOREIGN KEY (contato_id) REFERENCES polox.contacts(id)
);
CREATE INDEX idx_financial_transactions_account_id ON polox.financial_transactions USING btree (account_id);
CREATE INDEX idx_financial_transactions_company_id ON polox.financial_transactions USING btree (company_id);
CREATE INDEX idx_financial_transactions_date ON polox.financial_transactions USING btree (transaction_date);
CREATE INDEX idx_financial_transactions_type ON polox.financial_transactions USING btree (transaction_type);

-- Table Triggers

create trigger update_financial_transactions_updated_at before
update
on
polox.financial_transactions for each row execute function polox.update_updated_at_column();
create trigger trg_financial_transactions_cleanup_custom_values after
delete
on
polox.financial_transactions for each row execute function polox.cleanup_custom_field_values('financial_transaction');

-- polox.product_tags definição

-- Drop table

-- DROP TABLE polox.product_tags;

CREATE TABLE polox.product_tags (
product_id int8 NOT NULL,
tag_id int8 NOT NULL,
created_at timestamptz DEFAULT now() NULL,
CONSTRAINT product_tags_pkey PRIMARY KEY (product_id, tag_id),
CONSTRAINT fk_product_tags_product FOREIGN KEY (product_id) REFERENCES polox.products(id) ON DELETE CASCADE,
CONSTRAINT fk_product_tags_tag FOREIGN KEY (tag_id) REFERENCES polox.tags(id) ON DELETE CASCADE
);
CREATE INDEX idx_product_tags_product_id ON polox.product_tags USING btree (product_id);
CREATE INDEX idx_product_tags_tag_id ON polox.product_tags USING btree (tag_id);

-- polox.sale_items definição

-- Drop table

-- DROP TABLE polox.sale_items;

CREATE TABLE polox.sale_items (
id bigserial NOT NULL,
sale_id int8 NOT NULL,
product_id int8 NULL,
product_name varchar(255) NOT NULL,
quantity numeric(10, 3) NOT NULL,
unit_price numeric(15, 2) NOT NULL,
total_price numeric(15, 2) NOT NULL,
discount_percentage numeric(5, 2) DEFAULT 0.00 NULL,
discount_amount numeric(15, 2) DEFAULT 0.00 NULL,
created_at timestamptz DEFAULT now() NULL,
unit_price_cents int8 DEFAULT 0 NOT NULL,
total_price_cents int8 DEFAULT 0 NOT NULL,
discount_amount_cents int8 DEFAULT 0 NOT NULL,
CONSTRAINT sale_items_pkey PRIMARY KEY (id),
CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES polox.products(id),
CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES polox.sales(id) ON DELETE CASCADE
);
CREATE INDEX idx_sale_items_product_id ON polox.sale_items USING btree (product_id);
CREATE INDEX idx_sale_items_sale_id ON polox.sale_items USING btree (sale_id);

-- polox.sale_tags definição

-- Drop table

-- DROP TABLE polox.sale_tags;

CREATE TABLE polox.sale_tags (
sale_id int8 NOT NULL,
tag_id int8 NOT NULL,
created_at timestamptz DEFAULT now() NULL,
CONSTRAINT sale_tags_pkey PRIMARY KEY (sale_id, tag_id),
CONSTRAINT fk_sale_tags_sale FOREIGN KEY (sale_id) REFERENCES polox.sales(id) ON DELETE CASCADE,
CONSTRAINT fk_sale_tags_tag FOREIGN KEY (tag_id) REFERENCES polox.tags(id) ON DELETE CASCADE
);
CREATE INDEX idx_sale_tags_sale_id ON polox.sale_tags USING btree (sale_id);
CREATE INDEX idx_sale_tags_tag_id ON polox.sale_tags USING btree (tag_id);

-- polox.ticket_tags definição

-- Drop table

-- DROP TABLE polox.ticket_tags;

CREATE TABLE polox.ticket_tags (
ticket_id int8 NOT NULL,
tag_id int8 NOT NULL,
created_at timestamptz DEFAULT now() NULL,
CONSTRAINT ticket_tags_pkey PRIMARY KEY (ticket_id, tag_id),
CONSTRAINT fk_ticket_tags_tag FOREIGN KEY (tag_id) REFERENCES polox.tags(id) ON DELETE CASCADE,
CONSTRAINT fk_ticket_tags_ticket FOREIGN KEY (ticket_id) REFERENCES polox.tickets(id) ON DELETE CASCADE
);
CREATE INDEX idx_ticket_tags_tag_id ON polox.ticket_tags USING btree (tag_id);
CREATE INDEX idx_ticket_tags_ticket_id ON polox.ticket_tags USING btree (ticket_id);

-- polox.financial_transaction_tags definição

-- Drop table

-- DROP TABLE polox.financial_transaction_tags;

CREATE TABLE polox.financial_transaction_tags (
financial_transaction_id int8 NOT NULL,
tag_id int8 NOT NULL,
created_at timestamptz DEFAULT now() NULL,
CONSTRAINT financial_transaction_tags_pkey PRIMARY KEY (financial_transaction_id, tag_id),
CONSTRAINT fk_financial_transaction_tags_tag FOREIGN KEY (tag_id) REFERENCES polox.tags(id) ON DELETE CASCADE,
CONSTRAINT fk_financial_transaction_tags_transaction FOREIGN KEY (financial_transaction_id) REFERENCES polox.financial_transactions(id) ON DELETE CASCADE
);
CREATE INDEX idx_financial_transaction_tags_tag_id ON polox.financial_transaction_tags USING btree (tag_id);
CREATE INDEX idx_financial_transaction_tags_transaction_id ON polox.financial_transaction_tags USING btree (financial_transaction_id);
