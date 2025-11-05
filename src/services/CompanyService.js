const { query } = require("../models/database");

class CompanyService {
  /**
   * Retorna a árvore apenas das empresas vinculadas ao Super Admin logado (via partner_id)
   */
  static async buildMyCompanyTree(superAdminCompanyId) {
    const sql = `
      WITH RECURSIVE company_tree AS (
          SELECT
              id,
              company_name,
              company_type,
              partner_id,
              status,
              1 AS level
          FROM polox.companies
          WHERE partner_id = $1 AND deleted_at IS NULL
          UNION ALL
          SELECT
              c.id,
              c.company_name,
              c.company_type,
              c.partner_id,
              c.status,
              ct.level + 1
          FROM polox.companies c
          JOIN company_tree ct ON c.partner_id = ct.id
          WHERE c.deleted_at IS NULL
      )
      SELECT
          ct.id,
          ct.company_name,
          ct.company_type,
          ct.partner_id,
          ct.status,
          ct.level,
          COALESCE(
              (
                  SELECT json_agg(json_build_object(
                      'id', u.id,
                      'full_name', u.full_name,
                      'email', u.email,
                      'user_role', u.user_role,
                      'status', u.status
                  ))
                  FROM polox.users u
                  WHERE u.company_id = ct.id AND u.deleted_at IS NULL
              ),
              '[]'::json
          ) AS users
      FROM company_tree ct
      ORDER BY ct.level, ct.company_name;
    `;
    try {
      const { rows } = await query(sql, [superAdminCompanyId]);
      const map = {};
      const tree = [];
      rows.forEach((company) => {
        company.children = [];
        map[company.id] = company;
      });
      rows.forEach((company) => {
        if (company.partner_id !== null) {
          if (map[company.partner_id]) {
            map[company.partner_id].children.push(company);
          }
        } else {
          tree.push(company);
        }
      });
      return tree;
    } catch (error) {
      console.error("Erro ao buscar árvore de empresas do parceiro:", error);
      throw new Error("Falha ao consultar dados da hierarquia do parceiro.");
    }
  }
  /**
   * Executa a query recursiva no PostgreSQL para buscar todas as empresas e seus respectivos usuários.
   */
  static async fetchCompanyTreeData() {
    const sql = `
      WITH RECURSIVE company_tree AS (
          SELECT
              id,
              company_name,
              company_type,
              partner_id,
              status,
              1 AS level
          FROM polox.companies
          WHERE partner_id IS NULL AND deleted_at IS NULL
          UNION ALL
          SELECT
              c.id,
              c.company_name,
              c.company_type,
              c.partner_id,
              c.status,
              ct.level + 1
          FROM polox.companies c
          JOIN company_tree ct ON c.partner_id = ct.id
          WHERE c.deleted_at IS NULL
      )
      SELECT
          ct.id,
          ct.company_name,
          ct.company_type,
          ct.partner_id,
          ct.status,
          ct.level,
          COALESCE(
              (
                  SELECT json_agg(json_build_object(
                      'id', u.id,
                      'full_name', u.full_name,
                      'email', u.email,
                      'user_role', u.user_role,
                      'status', u.status
                  ))
                  FROM polox.users u
                  WHERE u.company_id = ct.id AND u.deleted_at IS NULL
              ),
              '[]'::json
          ) AS users
      FROM company_tree ct
      ORDER BY ct.level, ct.company_name;
    `;
    try {
      const { rows } = await query(sql);
      return rows;
    } catch (error) {
      console.error("Erro ao buscar árvore de empresas:", error);
      throw new Error("Falha ao consultar dados da hierarquia.");
    }
  }

  /**
   * Constrói a árvore de empresas completa a partir da lista "plana" do banco.
   */
  static async buildCompanyTree() {
    const flatCompanyList = await this.fetchCompanyTreeData();
    const map = {};
    const tree = [];
    flatCompanyList.forEach((company) => {
      company.children = [];
      map[company.id] = company;
    });
    flatCompanyList.forEach((company) => {
      if (company.partner_id !== null) {
        if (map[company.partner_id]) {
          map[company.partner_id].children.push(company);
        }
      } else {
        tree.push(company);
      }
    });
    return tree;
  }
}

module.exports = CompanyService;
