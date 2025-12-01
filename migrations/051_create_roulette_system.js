/**
 * ============================================================================
 * POLO X - Proprietary System / Sistema Proprietário
 * ============================================================================
 *
 * Copyright (c) 2025 Polo X Manutencao de Equipamentos de Informatica LTDA
 * CNPJ: 55.419.946/0001-89
 *
 * Legal Name / Razão Social: Polo X Manutencao de Equipamentos de Informatica LTDA
 * Trade Name / Nome Fantasia: Polo X
 *
 * Developer / Desenvolvedor: Leonardo Polo Pereira
 *
 * LICENSING STATUS / STATUS DE LICENCIAMENTO: Restricted Use / Uso Restrito
 * ALL RIGHTS RESERVED / TODOS OS DIREITOS RESERVADOS
 *
 * This code is proprietary and confidential. It is strictly prohibited to:
 * Este código é proprietário e confidencial. É estritamente proibido:
 * - Copy, modify or distribute without express authorization
 * - Copiar, modificar ou distribuir sem autorização expressa
 * - Use or integrate in any other project
 * - Usar ou integrar em outros projetos
 * - Share with unauthorized third parties
 * - Compartilhar com terceiros não autorizados
 *
 * Violations will be prosecuted under Brazilian Law:
 * Violações serão processadas conforme Lei Brasileira:
 * - Law 9.609/98 (Software Law / Lei do Software)
 * - Law 9.610/98 (Copyright Law / Lei de Direitos Autorais)
 * - Brazilian Penal Code Art. 184 (Código Penal Brasileiro Art. 184)
 *
 * INPI Registration: In progress / Em andamento
 *
 * For licensing / Para licenciamento: contato@polox.com.br
 * ============================================================================
 */

/**
 * Migration: 0XX_create_roulette_system
 * Descrição: Cria as tabelas roulettes, roulette_prizes e roulette_spins_history para o sistema de Roletas (Gamificação).
 * Data: 2025-11-27
 */

const up = async (client) => {
    console.log('🔄 Criando tabelas do sistema de Roletas...');

    // 1. Tabela polox.roulettes (Configuração Principal)
    await client.query(`
        CREATE TABLE polox.roulettes (
            id bigserial NOT NULL,
            company_id int8 NOT NULL,
            roulette_name varchar(255) NOT NULL,
            description text NULL,
            
            -- Configurações de Uso
            max_spins int4 DEFAULT 1 NOT NULL,
            is_single_use bool DEFAULT false NOT NULL,
            
            -- Personalização Visual
            general_colors jsonb DEFAULT '{"primary": "#8A2BE2", "secondary": "#4B0082", "background": "#FFFFFF"}'::jsonb NULL,
            background_image_url varchar(500) NULL,
            custom_title varchar(255) NULL,
            button_text varchar(100) DEFAULT 'Rodar agora!'::character varying NOT NULL,

            -- Metadados
            is_active bool DEFAULT true NOT NULL,
            start_date timestamptz DEFAULT now() NULL,
            end_date timestamptz NULL,
            created_at timestamptz DEFAULT now() NOT NULL,
            updated_at timestamptz DEFAULT now() NOT NULL,
            deleted_at timestamptz NULL,
            
            CONSTRAINT roulettes_pkey PRIMARY KEY (id),
            CONSTRAINT fk_roulettes_company FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE
        );
        CREATE INDEX idx_roulettes_company_id ON polox.roulettes USING btree (company_id);
    `);

    // 2. Tabela polox.roulette_prizes (Prêmios e Probabilidade)
    await client.query(`
        CREATE TABLE polox.roulette_prizes (
            id bigserial NOT NULL,
            roulette_id int8 NOT NULL,
            prize_description varchar(255) NOT NULL,
            
            -- Detalhes do Prêmio
            prize_type varchar(50) DEFAULT 'discount_percent'::character varying NOT NULL,
            prize_value numeric(15, 2) DEFAULT 0.00 NOT NULL,
            
            -- Probabilidade e Visual
            color_code varchar(7) DEFAULT '#3498DB'::character varying NOT NULL,
            probability_weight int4 DEFAULT 10 NOT NULL,
            quantity_available int4 NULL,

            -- Conversão / Resgate
            resend_link_url varchar(500) NULL,
            redirection_type varchar(50) DEFAULT 'url'::character varying NOT NULL,
            
            created_at timestamptz DEFAULT now() NOT NULL,
            updated_at timestamptz DEFAULT now() NOT NULL,
            
            CONSTRAINT roulette_prizes_pkey PRIMARY KEY (id),
            CONSTRAINT fk_prizes_roulette FOREIGN KEY (roulette_id) REFERENCES polox.roulettes(id) ON DELETE CASCADE
        );
        CREATE INDEX idx_roulette_prizes_roulette_id ON polox.roulette_prizes USING btree (roulette_id);
    `);

    // 3. Tabela polox.roulette_spins_history (Rastreamento e Conversão)
    await client.query(`
        CREATE TABLE polox.roulette_spins_history (
            id bigserial NOT NULL,
            roulette_id int8 NOT NULL,
            contact_id int8 NULL,
            vendor_user_id int8 NULL,
            
            prize_id int8 NULL,
            spin_count int4 NOT NULL,
            spin_date timestamptz DEFAULT now() NOT NULL,

            -- Conversão (BI Metrics)
            redeem_code varchar(36) NULL,
            is_claimed bool DEFAULT false NOT NULL,
            claimed_at timestamptz NULL,
            claimed_method varchar(50) NULL,
            
            CONSTRAINT spins_history_pkey PRIMARY KEY (id),
            CONSTRAINT fk_spins_roulette FOREIGN KEY (roulette_id) REFERENCES polox.roulettes(id) ON DELETE CASCADE,
            CONSTRAINT fk_spins_contact FOREIGN KEY (contact_id) REFERENCES polox.contacts(id) ON DELETE SET NULL,
            CONSTRAINT fk_spins_vendor FOREIGN KEY (vendor_user_id) REFERENCES polox.users(id) ON DELETE SET NULL,
            CONSTRAINT fk_spins_prize FOREIGN KEY (prize_id) REFERENCES polox.roulette_prizes(id) ON DELETE SET NULL
        );
        CREATE INDEX idx_spins_history_contact_id ON polox.roulette_spins_history USING btree (contact_id);
        CREATE UNIQUE INDEX uk_spins_history_redeem_code ON polox.roulette_spins_history USING btree (redeem_code) WHERE (redeem_code IS NOT NULL);
    `);

    // Adicionar triggers de updated_at para as novas tabelas
    await client.query(`
        CREATE TRIGGER update_roulettes_updated_at BEFORE UPDATE ON polox.roulettes 
        FOR EACH ROW EXECUTE FUNCTION polox.update_updated_at_column();

        CREATE TRIGGER update_roulette_prizes_updated_at BEFORE UPDATE ON polox.roulette_prizes 
        FOR EACH ROW EXECUTE FUNCTION polox.update_updated_at_column();
    `);

    console.log('✅ Migration 0XX_create_roulette_system concluída com sucesso!');
};

const down = async (client) => {
    console.log('🔄 Revertendo migration 0XX_create_roulette_system...');
    
    // Remover triggers
    await client.query(`
        DROP TRIGGER IF EXISTS update_roulettes_updated_at ON polox.roulettes;
        DROP TRIGGER IF EXISTS update_roulette_prizes_updated_at ON polox.roulette_prizes;
    `);

    // Remover tabelas na ordem inversa de dependência
    await client.query(`
        DROP TABLE IF EXISTS polox.roulette_spins_history CASCADE;
        DROP TABLE IF EXISTS polox.roulette_prizes CASCADE;
        DROP TABLE IF EXISTS polox.roulettes CASCADE;
    `);

    console.log('✅ Rollback da migration 0XX_create_roulette_system concluído!');
};

module.exports = { up, down };