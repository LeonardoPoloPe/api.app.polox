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
 * Migration 029: Renomear colunas com palavras reservadas do SQL
 * 
 * Remove o uso de palavras reservadas SQL como "name", "type", "role", "action", "domain", "location"
 * substituindo por nomes mais específicos que evitam a necessidade de aspas duplas nas queries.
 * 
 * Data: 24/10/2025
 * Autor: Sistema
 */

const { Pool } = require('pg');

/**
 * Helper: Renomeia coluna apenas se ela existir
 */
async function renameColumnIfExists(client, schema, table, oldName, newName) {
  const checkQuery = `
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = $1 
      AND table_name = $2 
      AND column_name = $3
  `;
  
  const result = await client.query(checkQuery, [schema, table, oldName]);
  
  if (result.rows.length > 0) {
    await client.query(`
      ALTER TABLE ${schema}.${table} 
      RENAME COLUMN "${oldName}" TO ${newName}
    `);
    return true;
  }
  return false;
}

/**
 * Executa a migration
 * @param {Pool} client - Cliente do banco de dados
 */
async function up(client) {
  console.log('🔄 Iniciando Migration 029: Renomeando colunas com palavras reservadas...');

  try {
    await client.query('BEGIN');

    // 1. USERS - Renomear "name" e "role"
    console.log('  📝 Renomeando colunas em polox.users...');
    await renameColumnIfExists(client, 'polox', 'users', 'name', 'full_name');
    await renameColumnIfExists(client, 'polox', 'users', 'role', 'user_role');

    // 2. COMPANIES - Renomear "name" e "domain"
    console.log('  📝 Renomeando colunas em polox.companies...');
    await renameColumnIfExists(client, 'polox', 'companies', 'name', 'company_name');
    await renameColumnIfExists(client, 'polox', 'companies', 'domain', 'company_domain');

    // 3. AUDIT_LOGS - Renomear "action"
    console.log('  📝 Renomeando colunas em polox.audit_logs...');
    await renameColumnIfExists(client, 'polox', 'audit_logs', 'action', 'audit_action');

    // 4. CUSTOM_FIELDS - Renomear "name"
    console.log('  📝 Renomeando colunas em polox.custom_fields...');
    await renameColumnIfExists(client, 'polox', 'custom_fields', 'name', 'field_name');

    // 5. LEADS - Renomear "name"
    console.log('  📝 Renomeando colunas em polox.leads...');
    await renameColumnIfExists(client, 'polox', 'leads', 'name', 'lead_name');

    // 6. LEAD_NOTES - Renomear "type"
    console.log('  📝 Renomeando colunas em polox.lead_notes...');
    await renameColumnIfExists(client, 'polox', 'lead_notes', 'type', 'note_type');

    // 7. CLIENTS - Renomear "name" e "type"
    console.log('  📝 Renomeando colunas em polox.clients...');
    await renameColumnIfExists(client, 'polox', 'clients', 'name', 'client_name');
    await renameColumnIfExists(client, 'polox', 'clients', 'type', 'client_type');

    // 8. CLIENT_NOTES - Renomear "type"
    console.log('  📝 Renomeando colunas em polox.client_notes...');
    await renameColumnIfExists(client, 'polox', 'client_notes', 'type', 'note_type');

    // 9. PRODUCTS - Renomear "name" e "type"
    console.log('  📝 Renomeando colunas em polox.products...');
    await renameColumnIfExists(client, 'polox', 'products', 'name', 'product_name');
    await renameColumnIfExists(client, 'polox', 'products', 'type', 'product_type');

    // 10. TAGS - Renomear "name"
    console.log('  📝 Renomeando colunas em polox.tags...');
    await renameColumnIfExists(client, 'polox', 'tags', 'name', 'tag_name');

    // 11. FINANCIAL_ACCOUNTS - Renomear "name" e "type"
    console.log('  📝 Renomeando colunas em polox.financial_accounts...');
    await renameColumnIfExists(client, 'polox', 'financial_accounts', 'name', 'account_name');
    await renameColumnIfExists(client, 'polox', 'financial_accounts', 'type', 'account_type');

    // 12. FINANCIAL_TRANSACTIONS - Renomear "type"
    console.log('  📝 Renomeando colunas em polox.financial_transactions...');
    await renameColumnIfExists(client, 'polox', 'financial_transactions', 'type', 'transaction_type');

    // 13. EVENTS - Renomear "type" e "location"
    console.log('  📝 Renomeando colunas em polox.events...');
    await renameColumnIfExists(client, 'polox', 'events', 'type', 'event_type');
    await renameColumnIfExists(client, 'polox', 'events', 'location', 'event_location');

    // 14. NOTIFICATIONS - Renomear "type"
    console.log('  📝 Renomeando colunas em polox.notifications...');
    await renameColumnIfExists(client, 'polox', 'notifications', 'type', 'notification_type');

    // 15. NOTIFICATION_TEMPLATES - Renomear "name" e "type"
    console.log('  📝 Renomeando colunas em polox.notification_templates...');
    await renameColumnIfExists(client, 'polox', 'notification_templates', 'name', 'template_name');
    await renameColumnIfExists(client, 'polox', 'notification_templates', 'type', 'notification_type');

    // 16. PRODUCT_CATEGORIES - Renomear "name"
    console.log('  📝 Renomeando colunas em polox.product_categories...');
    await renameColumnIfExists(client, 'polox', 'product_categories', 'name', 'category_name');

    // 17. SUPPLIERS - Renomear "name"
    console.log('  📝 Renomeando colunas em polox.suppliers...');
    await renameColumnIfExists(client, 'polox', 'suppliers', 'name', 'supplier_name');

    // 18. ACHIEVEMENTS - Renomear "name"
    console.log('  📝 Renomeando colunas em polox.achievements...');
    await renameColumnIfExists(client, 'polox', 'achievements', 'name', 'achievement_name');

    // 19. INTERESTS - Renomear "name"
    console.log('  📝 Renomeando colunas em polox.interests...');
    await renameColumnIfExists(client, 'polox', 'interests', 'name', 'interest_name');

    // 20. PUBLIC.MIGRATIONS - Renomear "name"
    console.log('  📝 Renomeando colunas em public.migrations...');
    await renameColumnIfExists(client, 'public', 'migrations', 'name', 'migration_name');

    // 21. PUBLIC.USERS - Renomear "name" (se existir)
    console.log('  📝 Verificando e renomeando colunas em public.users...');
    await renameColumnIfExists(client, 'public', 'users', 'name', 'full_name');

    await client.query('COMMIT');
    console.log('✅ Migration 029 concluída com sucesso!');
    
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na Migration 029:', error.message);
    throw error;
  }
}

/**
 * Reverte a migration
 * @param {Pool} client - Cliente do banco de dados
 */
async function down(client) {
  console.log('🔄 Revertendo Migration 029: Restaurando nomes originais das colunas...');

  try {
    await client.query('BEGIN');

    // Reverter em ordem inversa
    console.log('  📝 Revertendo public.users...');
    const publicUsersCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'full_name'
    `);
    
    if (publicUsersCheck.rows.length > 0) {
      await client.query('ALTER TABLE public.users RENAME COLUMN full_name TO "name"');
    }

    console.log('  📝 Revertendo public.migrations...');
    await client.query('ALTER TABLE public.migrations RENAME COLUMN migration_name TO "name"');

    console.log('  📝 Revertendo polox.interests...');
    await client.query('ALTER TABLE polox.interests RENAME COLUMN interest_name TO "name"');

    console.log('  📝 Revertendo polox.achievements...');
    await client.query('ALTER TABLE polox.achievements RENAME COLUMN achievement_name TO "name"');

    console.log('  📝 Revertendo polox.suppliers...');
    await client.query('ALTER TABLE polox.suppliers RENAME COLUMN supplier_name TO "name"');

    console.log('  📝 Revertendo polox.product_categories...');
    await client.query('ALTER TABLE polox.product_categories RENAME COLUMN category_name TO "name"');

    console.log('  📝 Revertendo polox.notification_templates...');
    await client.query('ALTER TABLE polox.notification_templates RENAME COLUMN template_name TO "name"');
    await client.query('ALTER TABLE polox.notification_templates RENAME COLUMN notification_type TO "type"');

    console.log('  📝 Revertendo polox.notifications...');
    await client.query('ALTER TABLE polox.notifications RENAME COLUMN notification_type TO "type"');

    console.log('  📝 Revertendo polox.events...');
    await client.query('ALTER TABLE polox.events RENAME COLUMN event_type TO "type"');
    await client.query('ALTER TABLE polox.events RENAME COLUMN event_location TO "location"');

    console.log('  📝 Revertendo polox.financial_transactions...');
    await client.query('ALTER TABLE polox.financial_transactions RENAME COLUMN transaction_type TO "type"');

    console.log('  📝 Revertendo polox.financial_accounts...');
    await client.query('ALTER TABLE polox.financial_accounts RENAME COLUMN account_name TO "name"');
    await client.query('ALTER TABLE polox.financial_accounts RENAME COLUMN account_type TO "type"');

    console.log('  📝 Revertendo polox.tags...');
    await client.query('ALTER TABLE polox.tags RENAME COLUMN tag_name TO "name"');

    console.log('  📝 Revertendo polox.products...');
    await client.query('ALTER TABLE polox.products RENAME COLUMN product_name TO "name"');
    await client.query('ALTER TABLE polox.products RENAME COLUMN product_type TO "type"');

    console.log('  📝 Revertendo polox.client_notes...');
    await client.query('ALTER TABLE polox.client_notes RENAME COLUMN note_type TO "type"');

    console.log('  📝 Revertendo polox.clients...');
    await client.query('ALTER TABLE polox.clients RENAME COLUMN client_name TO "name"');
    await client.query('ALTER TABLE polox.clients RENAME COLUMN client_type TO "type"');

    console.log('  📝 Revertendo polox.lead_notes...');
    await client.query('ALTER TABLE polox.lead_notes RENAME COLUMN note_type TO "type"');

    console.log('  📝 Revertendo polox.leads...');
    await client.query('ALTER TABLE polox.leads RENAME COLUMN lead_name TO "name"');

    console.log('  📝 Revertendo polox.custom_fields...');
    await client.query('ALTER TABLE polox.custom_fields RENAME COLUMN field_name TO "name"');

    console.log('  📝 Revertendo polox.audit_logs...');
    await client.query('ALTER TABLE polox.audit_logs RENAME COLUMN audit_action TO "action"');

    console.log('  📝 Revertendo polox.companies...');
    await client.query('ALTER TABLE polox.companies RENAME COLUMN company_name TO "name"');
    await client.query('ALTER TABLE polox.companies RENAME COLUMN company_domain TO "domain"');

    console.log('  📝 Revertendo polox.users...');
    await client.query('ALTER TABLE polox.users RENAME COLUMN full_name TO "name"');
    await client.query('ALTER TABLE polox.users RENAME COLUMN user_role TO "role"');

    await client.query('COMMIT');
    console.log('✅ Rollback da Migration 029 concluído com sucesso!');
    
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro no rollback da Migration 029:', error.message);
    throw error;
  }
}

module.exports = { up, down };
