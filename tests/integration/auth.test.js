/**
 * 🔐 TESTES DE AUTENTICAÇÃO
 * Cobre login, registro, logout, JWT validation
 */

const request = require("supertest");
const { DatabaseHelper } = require("../helpers/database");

describe("🔐 Autenticação", () => {
  let helper;
  let testCompany;
  let testUser;
  let validToken;

  beforeAll(async () => {
    helper = new DatabaseHelper(global.testPool);
  });

  beforeEach(async () => {
    // Criar empresa e usuário de teste para cada caso
    testCompany = await helper.createTestCompany({
      company_name: `Test Company ${Date.now()}`,
    });

    testUser = await helper.createTestUser(testCompany.id, {
      name: "Test User",
      email: `test${Date.now()}@example.com`,
      password: "Test@123",
      role: "admin",
    });
  });

  // ==========================================
  // LOGIN TESTS
  // ==========================================

  describe("POST /api/v1/auth/login", () => {
    test("✅ Deve fazer login com credenciais válidas", async () => {
      const response = await request(global.app)
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: "Test@123",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user.password_hash).toBeUndefined(); // Não deve expor senha
    });

    test("✅ Deve retornar JWT válido", async () => {
      const response = await request(global.app)
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: "Test@123",
        })
        .expect(200);

      const token = response.body.data.token;

      // Token deve ter 3 partes separadas por ponto
      const parts = token.split(".");
      expect(parts).toHaveLength(3);

      // Deve poder decodificar (sem verificar assinatura aqui)
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
      expect(payload.id).toBe(testUser.id);
      expect(payload.email).toBe(testUser.email);
    });

    test("❌ Deve rejeitar senha incorreta", async () => {
      const response = await request(global.app)
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: "WrongPassword123",
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/credenciais|credentials|invalid/i);
    });

    test("❌ Deve rejeitar usuário inexistente", async () => {
      const response = await request(global.app)
        .post("/api/v1/auth/login")
        .send({
          email: "naoexiste@example.com",
          password: "Test@123",
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test("❌ Deve rejeitar email inválido", async () => {
      const response = await request(global.app)
        .post("/api/v1/auth/login")
        .send({
          email: "email-invalido",
          password: "Test@123",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test("✅ Deve funcionar em português (pt-BR)", async () => {
      const response = await request(global.app)
        .post("/api/v1/auth/login")
        .set("Accept-Language", "pt-BR")
        .send({
          email: testUser.email,
          password: "Test@123",
        })
        .expect(200);

      expect(response.body.message).toMatch(/sucesso/i);
    });

    test("✅ Deve funcionar em inglês (en)", async () => {
      const response = await request(global.app)
        .post("/api/v1/auth/login")
        .set("Accept-Language", "en")
        .send({
          email: testUser.email,
          password: "Test@123",
        })
        .expect(200);

      expect(response.body.message).toMatch(/success/i);
    });

    test("✅ Deve funcionar em espanhol (es)", async () => {
      const response = await request(global.app)
        .post("/api/v1/auth/login")
        .set("Accept-Language", "es")
        .send({
          email: testUser.email,
          password: "Test@123",
        })
        .expect(200);

      expect(response.body.message).toMatch(/éxito|exitoso/i);
    });

    test("❌ Deve validar campos obrigatórios", async () => {
      const response = await request(global.app)
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          // Falta password
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test("✅ Deve atualizar last_login após login bem-sucedido", async () => {
      await request(global.app)
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: "Test@123",
        })
        .expect(200);

      // Buscar usuário atualizado do banco
      const result = await global.testPool.query(
        "SELECT last_login_at FROM polox.users WHERE id = $1",
        [testUser.id]
      );

      expect(result.rows[0].last_login_at).not.toBeNull();
    });
  });

  // ==========================================
  // REGISTER TESTS
  // ==========================================

  describe("POST /api/v1/auth/register", () => {
    test("✅ Deve criar novo usuário com dados válidos", async () => {
      const newUserData = {
        name: "New User",
        email: `newuser${Date.now()}@example.com`,
        password: "NewPass@123",
        companyId: testCompany.id,
      };

      const response = await request(global.app)
        .post("/api/v1/auth/register")
        .send(newUserData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(newUserData.email);
      expect(response.body.data.token).toBeDefined();
    });

    test("✅ Deve hashear senha corretamente", async () => {
      const newUserData = {
        name: "Hash Test User",
        email: `hashtest${Date.now()}@example.com`,
        password: "PlainPassword123",
        companyId: testCompany.id,
      };

      const response = await request(global.app)
        .post("/api/v1/auth/register")
        .send(newUserData)
        .expect(201);

      const userId = response.body.data.user.id;

      // Buscar senha hasheada do banco
      const result = await global.testPool.query(
        "SELECT password_hash FROM polox.users WHERE id = $1",
        [userId]
      );

      const passwordHash = result.rows[0].password_hash;

      // Hash não deve ser igual à senha original
      expect(passwordHash).not.toBe("PlainPassword123");

      // Hash deve começar com $2b$ (bcrypt)
      expect(passwordHash).toMatch(/^\$2[aby]\$/);

      // Hash deve ter tamanho de bcrypt (~60 chars)
      expect(passwordHash.length).toBeGreaterThan(50);
    });

    test("❌ Deve rejeitar email duplicado", async () => {
      const duplicateData = {
        name: "Duplicate User",
        email: testUser.email, // Email já existe
        password: "Test@123",
        companyId: testCompany.id,
      };

      const response = await request(global.app)
        .post("/api/v1/auth/register")
        .send(duplicateData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/já existe|already exists|existe/i);
    });

    test("❌ Deve validar formato de email", async () => {
      const response = await request(global.app)
        .post("/api/v1/auth/register")
        .send({
          name: "Test User",
          email: "email-invalido",
          password: "Test@123",
          companyId: testCompany.id,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test("❌ Deve exigir senha com mínimo 6 caracteres", async () => {
      const response = await request(global.app)
        .post("/api/v1/auth/register")
        .send({
          name: "Test User",
          email: `test${Date.now()}@example.com`,
          password: "12345", // Apenas 5 caracteres
          companyId: testCompany.id,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test("✅ Deve criar usuário em empresa específica", async () => {
      const newUserData = {
        name: "Company User",
        email: `companyuser${Date.now()}@example.com`,
        password: "Test@123",
        companyId: testCompany.id,
      };

      const response = await request(global.app)
        .post("/api/v1/auth/register")
        .send(newUserData)
        .expect(201);

      expect(response.body.data.user.companyId).toBe(testCompany.id);
    });

    test("✅ Deve atribuir role padrão (user)", async () => {
      const newUserData = {
        name: "Default Role User",
        email: `defaultrole${Date.now()}@example.com`,
        password: "Test@123",
        companyId: testCompany.id,
      };

      const response = await request(global.app)
        .post("/api/v1/auth/register")
        .send(newUserData)
        .expect(201);

      expect(response.body.data.user.role).toBe("user");
    });

    test("✅ Deve criar com timestamps corretos", async () => {
      const beforeCreate = new Date();

      const newUserData = {
        name: "Timestamp User",
        email: `timestamp${Date.now()}@example.com`,
        password: "Test@123",
        companyId: testCompany.id,
      };

      const response = await request(global.app)
        .post("/api/v1/auth/register")
        .send(newUserData)
        .expect(201);

      const afterCreate = new Date();
      const createdAt = new Date(response.body.data.user.createdAt);

      expect(createdAt).toBeInstanceOf(Date);
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime()
      );
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });
  });

  // ==========================================
  // LOGOUT TESTS
  // ==========================================

  describe("POST /api/v1/auth/logout", () => {
    beforeEach(async () => {
      // Fazer login para obter token
      const loginResponse = await request(global.app)
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: "Test@123",
        });

      validToken = loginResponse.body.data.token;
    });

    test("✅ Deve deslogar usuário autenticado", async () => {
      const response = await request(global.app)
        .post("/api/v1/auth/logout")
        .set("Authorization", `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test("✅ Deve retornar sucesso mesmo sem token (idempotente)", async () => {
      const response = await request(global.app)
        .post("/api/v1/auth/logout")
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  // ==========================================
  // TOKEN VALIDATION TESTS
  // ==========================================

  describe("Token JWT Validation", () => {
    test("✅ Deve validar token JWT válido", async () => {
      const loginResponse = await request(global.app)
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: "Test@123",
        });

      const token = loginResponse.body.data.token;

      // Usar token em rota protegida
      const response = await request(global.app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test("❌ Deve rejeitar token malformado", async () => {
      const response = await request(global.app)
        .get("/api/v1/users/me")
        .set("Authorization", "Bearer token-invalido")
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test("❌ Deve rejeitar requisição sem token", async () => {
      const response = await request(global.app)
        .get("/api/v1/users/me")
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test("❌ Deve rejeitar token sem Bearer prefix", async () => {
      const loginResponse = await request(global.app)
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: "Test@123",
        });

      const token = loginResponse.body.data.token;

      const response = await request(global.app)
        .get("/api/v1/users/me")
        .set("Authorization", token) // Sem "Bearer "
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
