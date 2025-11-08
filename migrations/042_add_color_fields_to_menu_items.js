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
 * Migration: 042 - Adicionar campos de cores aos menus
 *
 * Adiciona personalização de cores para os itens de menu:
 * - svg_color: Cor do ícone SVG (ex: #3B82F6)
 * - background_color: Cor de fundo (hover) (ex: #EFF6FF)
 * - text_color: Cor do texto (ex: #1E40AF)
 *
 * Formato: Hexadecimal (#RRGGBB) com validação via constraint
 */

module.exports = {
  up: async (client) => {
    console.log("🔄 Adicionando campos de cores à tabela menu_items...");

    // Adicionar colunas de cores
    await client.query(`
      ALTER TABLE polox.menu_items
      ADD COLUMN svg_color VARCHAR(7) NULL,
      ADD COLUMN background_color VARCHAR(7) NULL,
      ADD COLUMN text_color VARCHAR(7) NULL;
    `);

    console.log("✅ Colunas de cores adicionadas");

    // Adicionar constraints de validação para formato hexadecimal
    console.log("🔄 Adicionando validações de formato hexadecimal...");

    await client.query(`
      ALTER TABLE polox.menu_items
      ADD CONSTRAINT chk_svg_color_format 
        CHECK (svg_color IS NULL OR svg_color ~* '^#[0-9A-F]{6}$'),
      ADD CONSTRAINT chk_background_color_format 
        CHECK (background_color IS NULL OR background_color ~* '^#[0-9A-F]{6}$'),
      ADD CONSTRAINT chk_text_color_format 
        CHECK (text_color IS NULL OR text_color ~* '^#[0-9A-F]{6}$');
    `);

    console.log("✅ Validações de formato adicionadas");

    // Adicionar comentários nas colunas
    await client.query(`
      COMMENT ON COLUMN polox.menu_items.svg_color IS 'Cor do ícone SVG em formato hexadecimal (#RRGGBB)';
      COMMENT ON COLUMN polox.menu_items.background_color IS 'Cor de fundo no hover em formato hexadecimal (#RRGGBB)';
      COMMENT ON COLUMN polox.menu_items.text_color IS 'Cor do texto em formato hexadecimal (#RRGGBB)';
    `);

    console.log("✅ Comentários adicionados");

    // Atualizar menus existentes com cores padrão (opcional)
    console.log("🔄 Aplicando cores padrão aos menus existentes...");

    await client.query(`
      UPDATE polox.menu_items
      SET 
        svg_color = '#3B82F6',       -- Azul padrão
        background_color = '#EFF6FF', -- Azul claro hover
        text_color = '#1E40AF'        -- Azul escuro texto
      WHERE deleted_at IS NULL
        AND svg_color IS NULL
        AND background_color IS NULL
        AND text_color IS NULL;
    `);

    console.log("✅ Cores padrão aplicadas aos menus existentes");

    console.log("✅ Migration 042 concluída com sucesso!");
  },

  down: async (client) => {
    console.log("🔄 Revertendo migration 042...");

    // Remover constraints
    await client.query(`
      ALTER TABLE polox.menu_items
      DROP CONSTRAINT IF EXISTS chk_svg_color_format,
      DROP CONSTRAINT IF EXISTS chk_background_color_format,
      DROP CONSTRAINT IF EXISTS chk_text_color_format;
    `);

    // Remover colunas
    await client.query(`
      ALTER TABLE polox.menu_items
      DROP COLUMN IF EXISTS svg_color,
      DROP COLUMN IF EXISTS background_color,
      DROP COLUMN IF EXISTS text_color;
    `);

    console.log("✅ Migration 042 revertida com sucesso!");
  },
};
