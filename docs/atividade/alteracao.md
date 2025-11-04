Sumário da Arquitetura (O que Decidimos)
Para documentar o que falamos, a nova filosofia é:

Identidade vs. Intenção: Separamos quem a pessoa é de o que ela quer comprar.

Quem é (Identidade): A tabela polox.contatos. Ela armazena o Nome, Celular, Email e o tipo ('lead' ou 'cliente'). É a "Fonte Única da Verdade" sobre pessoas.

O que quer (Intenção): A tabela polox.negociacoes. Armazena o funil de vendas, o valor, a origem (LP da Meta), etc.

Duplicidade Zero: A tabela contatos terá uma trava (UNIQUE INDEX) no banco de dados (company_id + phone). Isso torna tecnicamente impossível duplicar um contato por empresa, resolvendo a raiz do seu problema na extensão.

Histórico Unificado: Acabam as tabelas lead_notes e client_notes. Teremos apenas contato_notas. Quando um lead vira cliente (um simples UPDATE no tipo), todo o seu histórico de notas, tags e interesses é 100% preservado.

Fase 1: A Batalha (O Banco de Dados - DDL)
Objetivo: Remover a estrutura antiga e criar a nova fundação. Como não há dados, podemos usar DROP TABLE.

Passo 1.1: Remover as Tabelas "Satélite" (Notas, Tags, Interesses)
Primeiro, removemos tudo que depende de leads e clients.

SQL

DROP TABLE polox.lead_notes;
DROP TABLE polox.lead_tags;
DROP TABLE polox.lead_interests;

DROP TABLE polox.client_notes;
DROP TABLE polox.client_tags;
DROP TABLE polox.client_interests;
Passo 1.2: Remover as Constraints (FKs) e Tabelas Principais
As tabelas leads e clients apontam uma para a outra (converted_to_client_id e converted_from_lead_id). Precisamos quebrar esses elos antes de removê-las.

SQL

-- Quebrar as Foreign Keys
ALTER TABLE polox.clients DROP CONSTRAINT IF EXISTS clients_converted_from_lead_id_fkey;
ALTER TABLE polox.leads DROP CONSTRAINT IF EXISTS fk_leads_converted_client;

-- Remover as tabelas principais
DROP TABLE polox.leads;
DROP TABLE polox.clients;
Passo 1.3: Criar as Novas Tabelas Unificadas
Este é o DDL para a nova arquitetura "Fonte da Verdade".

SQL

-- 1. A NOVA FONTE DA VERDADE (IDENTIDADE)
CREATE TABLE polox.contatos (
    id bigserial NOT NULL PRIMARY KEY,
    company_id int8 NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
    
    -- Colunas de Identidade
    nome varchar(255) NOT NULL,
    email varchar(255) NULL,
    phone varchar(20) NULL,
    company_name varchar(255) NULL, -- (Nome da empresa DO contato)
    document_number varchar(50) NULL,
    document_type varchar(20) NULL,
    
    -- Coluna de Status (A mais importante)
    tipo varchar(20) DEFAULT 'lead'::character varying NOT NULL, -- 'lead' ou 'cliente'
    
    -- Rastreamento de Origem (do lead)
    lead_source varchar(100) NULL,
    first_contact_at timestamptz NULL,
    
    -- Rastreamento de Cliente
    last_purchase_date date NULL,
    lifetime_value_cents int8 DEFAULT 0 NOT NULL,
    
    -- Endereço (Movido de 'clients')
    address_street varchar(255) NULL,
	address_number varchar(20) NULL,
	address_complement varchar(100) NULL,
	address_neighborhood varchar(100) NULL,
	address_city varchar(100) NULL,
	address_state varchar(50) NULL,
	address_country varchar(3) DEFAULT 'BR'::character varying NULL,
	address_postal_code varchar(20) NULL,
    
    -- Metadados
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz NULL,

    -- AS TRAVAS ANTI-DUPLICIDADE
    CONSTRAINT uk_contatos_company_phone UNIQUE (company_id, phone),
    CONSTRAINT uk_contatos_company_email UNIQUE (company_id, email)
);
CREATE INDEX idx_contatos_company_id ON polox.contatos (company_id);
CREATE INDEX idx_contatos_tipo ON polox.contatos (company_id, tipo);


-- 2. A NOVA TABELA DE INTENÇÃO DE COMPRA
CREATE TABLE polox.negociacoes (
    id bigserial NOT NULL PRIMARY KEY,
    company_id int8 NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
    contato_id int8 NOT NULL REFERENCES polox.contatos(id) ON DELETE RESTRICT,
    owner_id int8 NULL REFERENCES polox.users(id) ON DELETE SET NULL, -- Vendedor responsável

    titulo varchar(255) NOT NULL,
    etapa_funil varchar(50) NOT NULL DEFAULT 'novo', -- 'novo', 'qualificado', 'proposta', 'ganhos', 'perdido'
    valor_total_cents int8 DEFAULT 0 NOT NULL,
    origem varchar(100) NULL, -- (Ex: "LP Meta 02/11", "Venda Manual")
    
    -- Metadados
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz NULL
);
CREATE INDEX idx_negociacoes_contato_id ON polox.negociacoes (contato_id);
CREATE INDEX idx_negociacoes_owner_id ON polox.negociacoes (owner_id);
CREATE INDEX idx_negociacoes_etapa_funil ON polox.negociacoes (company_id, etapa_funil);


-- 3. AS NOVAS TABELAS SATÉLITE (UNIFICADAS)

-- Notas (Substitui lead_notes e client_notes)
CREATE TABLE polox.contato_notas (
    id bigserial NOT NULL PRIMARY KEY,
    company_id int8 NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
    contato_id int8 NOT NULL REFERENCES polox.contatos(id) ON DELETE CASCADE,
    created_by_id int8 NOT NULL REFERENCES polox.users(id) ON DELETE RESTRICT,
    note_content text NOT NULL,
    note_type varchar(50) DEFAULT 'general'::character varying,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz NULL
);
CREATE INDEX idx_contato_notas_contato_id ON polox.contato_notas (contato_id);


-- Tags (Substitui lead_tags e client_tags)
CREATE TABLE polox.contato_tags (
    contato_id int8 NOT NULL REFERENCES polox.contatos(id) ON DELETE CASCADE,
    tag_id int8 NOT NULL REFERENCES polox.tags(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (contato_id, tag_id)
);


-- Interesses (Substitui lead_interests e client_interests)
CREATE TABLE polox.contato_interesses (
    contato_id int8 NOT NULL REFERENCES polox.contatos(id) ON DELETE CASCADE,
    interest_id int8 NOT NULL REFERENCES polox.interests(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (contato_id, interest_id)
);
Passo 1.4: Corrigir Tabelas Existentes que Apontavam para clients
Tabelas como tickets, events, sales e financial_transactions precisam agora apontar para contatos.id em vez de clients.id.

SQL

-- Exemplo para a tabela 'tickets' (repita para as outras)
ALTER TABLE polox.tickets DROP CONSTRAINT IF EXISTS tickets_client_id_fkey;
ALTER TABLE polox.tickets RENAME COLUMN client_id TO contato_id;
ALTER TABLE polox.tickets ADD CONSTRAINT fk_tickets_contato 
    FOREIGN KEY (contato_id) REFERENCES polox.contatos(id);

-- Exemplo para 'sales'
ALTER TABLE polox.sales DROP CONSTRAINT IF EXISTS sales_client_id_fkey;
ALTER TABLE polox.sales RENAME COLUMN client_id TO contato_id;
ALTER TABLE polox.sales ADD CONSTRAINT fk_sales_contato 
    FOREIGN KEY (contato_id) REFERENCES polox.contatos(id);

-- Exemplo para 'events'
ALTER TABLE polox.events DROP CONSTRAINT IF EXISTS events_client_id_fkey;
ALTER TABLE polox.events RENAME COLUMN client_id TO contato_id;
ALTER TABLE polox.events ADD CONSTRAINT fk_events_contato 
    FOREIGN KEY (contato_id) REFERENCES polox.contatos(id);

-- Exemplo para 'financial_transactions'
ALTER TABLE polox.financial_transactions DROP CONSTRAINT IF EXISTS financial_transactions_client_id_fkey;
ALTER TABLE polox.financial_transactions RENAME COLUMN client_id TO contato_id;
ALTER TABLE polox.financial_transactions ADD CONSTRAINT fk_financial_transactions_contato 
    FOREIGN KEY (contato_id) REFERENCES polox.contatos(id);
Fase 2: A Lógica (O Backend / API - Node.js)
Objetivo: Remover as rotas e lógicas de Lead/Client e substituí-las pela lógica Contato/Negociação.

Passo 2.1: Remover Rotas Antigas (Limpeza)
Você deve deletar todos os Controllers, Services e Rotas (ex: em routes.js ou similar) relacionados a:

api/leads (GET, POST, PUT, DELETE)

api/clients (GET, POST, PUT, DELETE)

api/leads/:id/notes

api/clients/:id/notes

(e assim por diante para tags e interesses)

Passo 2.2: Criar Novas Rotas Unificadas
CRUD de contatos:

POST /api/contatos (Cria um novo contato, geralmente com tipo='lead')

GET /api/contatos (Lista contatos. Usar query params: GET /api/contatos?tipo=lead ou ?tipo=cliente)

GET /api/contatos/:id (Busca o perfil único)

PUT /api/contatos/:id (Atualiza o perfil)

CRUD de negociacoes:

POST /api/negociacoes (Cria uma nova negociação/oportunidade)

GET /api/negociacoes (Lista negociações para o Funil/Pipeline, ex: ?etapa_funil=novo)

PUT /api/negociacoes/:id (Atualiza a negociação: move no funil, altera valor)

GET /api/contatos/:id/negociacoes (Lista todas as negociações de um contato específico)

CRUD de Satélites Unificados:

POST /api/contatos/:id/notas (Adiciona uma nota ao contato_notas)

GET /api/contatos/:id/notas (Lista todas as notas, unificadas)

Passo 2.3: Implementar a Lógica de Negócio Chave (O "Get-or-Create")
Esta é a lógica mais importante, usada pela sua Extensão e LPs.

Endpoint: POST /api/contatos/get-or-create-with-negotiation

JavaScript

// Pseudocódigo do seu Controller/Service (Node.js)

async function getOrCreateContactWithNegotiation(req, res) {
    const { email, phone, nome, company_id, origem_lp, valor_estimado } = req.body;

    // 1. Tentar encontrar o contato
    // Prioriza o telefone (WhatsApp) ou email
    let contact = await db.contatos.findFirst({
        where: {
            company_id: company_id,
            OR: [
                { phone: phone_normalizado(phone) },
                { email: email }
            ]
        }
    });

    // 2. Se o contato NÃO existir, crie-o.
    if (!contact) {
        contact = await db.contatos.create({
            data: {
                company_id: company_id,
                nome: nome,
                phone: phone_normalizado(phone),
                email: email,
                tipo: 'lead', // Sempre nasce como 'lead'
                first_contact_at: new Date()
            }
        });
    }

    // 3. (O pulo do gato) Crie uma NOVA NEGOCIAÇÃO para esse contato
    // Isso cobre o "Cliente que virou lead de novo"
    const newNegotiation = await db.negociacoes.create({
        data: {
            company_id: company_id,
            contato_id: contact.id,
            owner_id: req.user.id, // Vendedor logado
            titulo: `Negociação de ${nome} (${origem_lp || 'Novo'})`,
            origem: origem_lp || 'Manual',
            valor_total_cents: valor_estimado || 0,
            etapa_funil: 'novo'
        }
    });

    // 4. Retorne o contato e a nova negociação
    res.json({ contact, newNegotiation });
}
Passo 2.4: Implementar a Lógica de "Conversão" (Ganhar)
Quando o vendedor clica em "Ganhos" em uma negociação:

JavaScript

// Endpoint: PUT /api/negociacoes/:id/ganhar
async function winNegotiation(req, res) {
    const { id } = req.params;

    // 1. Marca a negociação como 'ganhos'
    const negotiation = await db.negociacoes.update({
        where: { id: parseInt(id) },
        data: { etapa_funil: 'ganhos' }
    });

    // 2. ATUALIZA o contato para 'cliente'
    // Isso é instantâneo e mantém todo o histórico.
    const contact = await db.contatos.update({
        where: { id: negotiation.contato_id },
        data: {
            tipo: 'cliente',
            last_purchase_date: new Date()
            // (Opcional) Você pode ter um trigger para somar `negotiation.valor_total_cents`
            // no `lifetime_value_cents` do contato.
        }
    });
    
    res.json({ message: "Negociação ganha! Contato atualizado para cliente." });
}
Fase 3: A Experiência (O Frontend / UI - React/Flutter)
Objetivo: Alinhar as telas do seu CRM com a nova API.

Telas de Lista (Menu):

Menu "Leads" (ou "Funil"): Esta tela agora deve buscar em GET /api/negociacoes?etapa_funil=novo. Ela se torna sua tela de Pipeline/Kanban.

Menu "Clientes": Esta tela agora busca em GET /api/contatos?tipo=cliente.

Telas de Perfil (Unificação):

Delete seus componentes LeadProfile.js e ClientProfile.js.

Crie UM componente: ContatoProfile.js (rota /contatos/:id).

Esta tela faz GET /api/contatos/:id para buscar os dados.

Dentro da tela, use lógica condicional:

if (contato.tipo === 'lead') { // Mostra o Funil e o botão "Converter" }

if (contato.tipo === 'cliente') { // Mostra o Histórico de Compras }

O histórico de notas (GET /api/contatos/:id/notas) e negociações (GET /api/contatos/:id/negociacoes) é carregado em abas, dando a visão 360°.

Extensão do WhatsApp (A Causa de Tudo):

A lógica da sua extensão fica 1000x mais simples.

Ela não precisa mais "escolher" entre lead e cliente.

Ela fará UMA chamada: GET /api/contatos/search?phone=...&company_id=... (Crie este endpoint de busca).

A API, graças à trava UNIQUE do banco, retornará zero ou um contato.

Se retornar 0: Botão "Criar novo contato".

Se retornar 1: Mostra o cartão do contato.id, com um distintivo (badge) "Lead" ou "Cliente" (contato.tipo).

Este plano é uma fundação sólida. Comece pelo banco de dados (Fase 1). Assim que o DDL estiver pronto, o resto do sistema (API e UI) vai se encaixar naturalmente. Bom trabalho!

1. Objetivo da Arquitetura
O objetivo desta arquitetura é estabelecer uma Fonte Única da Verdade para cada company_id. Decidimos que a tabela polox.contatos deve garantir a integridade dos dados na camada de banco de dados, impedindo o cadastro de contatos duplicados e "fantasmas".

Para isso, definimos 3 "identificadores-chave" de um contato:

Identificador Legal/Financeiro: document_number (CPF/CNPJ)

Identificador Digital (Formal): email

Identificador Social (Direto): phone (Celular)

2. Regras de Negócio Implementadas
Para fazer valer esta arquitetura, 4 constraints de banco de dados (PostgreSQL) foram definidas na tabela polox.contatos.

Constraint 1: UNIQUE (company_id, document_number)

O que faz: Impede que dois contatos dentro da mesma empresa (company_id) tenham o mesmo número de documento (document_number).

Por que: Garante a integridade financeira e legal. Previne a emissão de contratos, cobranças ou notas fiscais duplicadas para a mesma entidade.

Constraint 2: UNIQUE (company_id, phone)

O que faz: Impede que dois contatos dentro da mesma empresa tenham o mesmo número de telefone (phone).

Por que: Resolve o problema central da extensão do WhatsApp. Garante que cada número de celular aponte para um, e apenas um, contato. Elimina a ambiguidade na busca da extensão.

Constraint 3: UNIQUE (company_id, email)

O que faz: Impede que dois contatos dentro da mesma empresa tenham o mesmo endereço de email.

Por que: Garante a integridade na captura de leads via Landing Pages e formulários. Impede que o mesmo e-mail gere dois leads diferentes.

Constraint 4: CHECK (phone IS NOT NULL OR email IS NOT NULL OR document_number IS NOT NULL)

O que faz: É uma regra "Anti-Fantasma". Ela obriga que todo novo registro na tabela contatos tenha pelo menos um dos três identificadores-chave preenchido.

Por que: Impede que um usuário (ex: vendedor) cadastre "contatos fantasmas" (ex: só com o nome "Leo", sem telefone, e-mail ou documento), o que permitiria a criação de duplicatas, já que as constraints UNIQUE não bloqueiam valores NULL.

3. Resumo da Implementação (DDL)
Abaixo está o DDL final da tabela polox.contatos que reflete essas decisões:

SQL

CREATE TABLE polox.contatos (
    id bigserial NOT NULL PRIMARY KEY,
    company_id int8 NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
    
    -- Colunas de Identidade
    nome varchar(255) NOT NULL,
    email varchar(255) NULL,
    phone varchar(20) NULL,
    document_number varchar(50) NULL,
    
    -- Outras colunas...
    tipo varchar(20) DEFAULT 'lead'::character varying NOT NULL,
    created_at timest_now(),
    updated_at timest_now(),
    deleted_at timestz NULL,
    
    -- ========== TRAVAS DE INTEGRIDADE ============

    -- 1. Trava por EMPRESA + DOCUMENTO (CPF/CNPJ)
    CONSTRAINT uk_contatos_company_document UNIQUE (company_id, document_number),

    -- 2. Trava por EMPRESA + TELEFONE
    CONSTRAINT uk_contatos_company_phone UNIQUE (company_id, phone),

    -- 3. Trava por EMPRESA + EMAIL
    CONSTRAINT uk_contatos_company_email UNIQUE (company_id, email),

    -- 4. Trava "Anti-Fantasma"
    CONSTRAINT chk_contato_tem_identificador
    CHECK (
        phone IS NOT NULL OR 
        email IS NOT NULL OR 
        document_number IS NOT NULL
    )
);


Ajuste no Banco (Necessário)
Vamos adicionar o "dono" ao contato.

SQL

ALTER TABLE polox.contatos
ADD COLUMN owner_id int8 NULL REFERENCES polox.users(id) ON DELETE SET NULL;

CREATE INDEX idx_contatos_owner_id ON polox.contatos (owner_id);
Por que isso? Quando o Vendedor João converte o "Lead Mario", o sistema deve definir contatos.owner_id = (ID do João). Agora, Mario "pertence" ao João.
