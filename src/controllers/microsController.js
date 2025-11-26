/**
 * ============================================================================
 * POLO X - Proprietary System / Sistema Proprietário
 * ============================================================================
 *
 * (Conteúdo de direitos autorais omitido para brevidade)
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

/**
 * @swagger
 * /micros/send-notification:
 * post:
 * summary: Envia e-mail diretamente via SES SMTP (Síncrono)
 * tags: [Micros]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - subject
 * - email
 * - body
 * properties:
 * subject:
 * type: string
 * example: "Bem-vindo ao Polox!"
 * email:
 * type: string
 * format: email
 * example: "usuario@exemplo.com"
 * body:
 * type: string
 * example: "Seu cadastro foi realizado com sucesso."
 * responses:
 * 200:
 * description: E-mail enviado com sucesso
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * success:
 * type: boolean
 * messageId:
 * type: string
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
