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
 * CONTROLLER: MicrosController
 * FINALIDADE: Enviar e-mails diretamente usando Nodemailer/SES SMTP (Síncrono).
 *
 * @swagger
 * tags:
 * - name: Micros
 * description: Envio direto de e-mail via SES/SMTP (Síncrono)
 */

// Importa apenas o que é necessário para a API
const { logger } = require("../utils/logger");
// Importa as dependências do e-mail
const nodemailer = require("nodemailer");

// === CONFIGURAÇÕES SES SMTP (Mova para .env no ambiente real) ===
const SMTP_CONFIG = {
  host: "email-smtp.us-east-1.amazonaws.com",
  port: 587,
  secure: false, // Use STARTTLS
  auth: {
    user: process.env.SES_SMTP_USER || "AKIAST6S7QZIO2HH6QFS",
    pass:
      process.env.SES_SMTP_PASSWORD ||
      "BJCm8ZaKi/K6aGK4bqhkpsCTDlibCttc5jKHieTc6Ny7",
  },
};

const SENDER_EMAIL = "contato@polox.com.br";
const transporter = nodemailer.createTransport({
  ...SMTP_CONFIG,
  requireTLS: true, // Necessário para STARTTLS
});

// === FIM DAS CONFIGURAÇÕES SES SMTP ===



// Bloco Swagger Corrigido em microsController.js
/**
 * @swagger
 * /micros/send-notification:
 * post:
 * tags: [Micros]
 * summary: Envia notificação assíncrona (E-mail, SMS, Push)
 * description: Endpoint usado internamente para processamento rápido de notificações.
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required: [channel, recipient, subject, body]
 * properties:
 * channel:
 * type: string
 * enum: [email, sms, push]
 * description: Canal de envio.
 * example: email
 * recipient:
 * type: string
 * description: Endereço (email, telefone ou userId) do destinatário.
 * example: destinatario@email.com
 * subject:
 * type: string
 * description: Assunto da mensagem (apenas para email).
 * example: Sua fatura está pronta
 * body:
 * type: string
 * description: Conteúdo da mensagem.
 * example: Olá, sua fatura de R$ 100,00 foi gerada.
 * responses:
 * 200:
 * description: Notificação processada com sucesso.
 */
async function sendNotification(req, res) {
  // Verifica autenticação (mantido por segurança)
  if (!req.user || req.user.role !== "super_admin") {
    return res.status(403).json({
      success: false,
      error: "Acesso restrito: apenas super_admin pode acessar este endpoint.",
    });
  }

  const { subject, email, body } = req.body;

  // Monta o corpo do e-mail
  const htmlBody = `<p><strong>${subject}</strong></p><p>${body}</p><hr><small>Este e-mail foi enviado diretamente via Amazon SES/SMTP.</small>`;

  const mailOptions = {
    from: SENDER_EMAIL,
    to: email, // O destinatário dinâmico
    subject: subject,
    text: body,
    html: htmlBody,
  };

  try {
    // EXECUTA O ENVIO SMTP DIRETAMENTE E AGUARDA A RESPOSTA
    const info = await transporter.sendMail(mailOptions);

    const logData = {
      recipient: email,
      subject: subject,
      messageId: info.messageId,
      response: info.response, // Resposta do servidor SMTP
    };

    logger.info(
      "✅ E-mail enviado com sucesso via SES/SMTP (Síncrono)",
      logData
    );

    // Retorna 200 OK (e não 202 Accepted, pois o envio terminou)
    if (typeof res.sendSuccess === "function") {
      return res.sendSuccess(
        {
          success: true,
          messageId: info.messageId,
          info: logData,
        },
        200
      );
    } else {
      return res.status(200).json({
        success: true,
        messageId: info.messageId,
        info: logData,
      });
    }
  } catch (error) {
    logger.error("❌ Erro no Envio de E-mail (SES/SMTP):", {
      error: error.message,
      stack: error.stack,
    });
    // Retorna 500 em caso de falha de conexão/autenticação SMTP
    return res.status(500).json({
      success: false,
      error: error.message,
      message:
        "Falha ao enviar e-mail via SES SMTP. Verifique as credenciais e permissões de rede (VPC).",
    });
  }
}

module.exports = {
  sendNotification,
};
