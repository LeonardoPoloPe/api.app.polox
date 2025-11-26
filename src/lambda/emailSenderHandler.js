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

// ./src/lambda/emailSenderHandler.js

const nodemailer = require("nodemailer");

// ⚠️ ATENÇÃO: Essas credenciais DEVEM ser carregadas de variáveis de ambiente
// no seu serverless.yml ou Secrets Manager por segurança.
const SMTP_CONFIG = {
  host: "email-smtp.us-east-1.amazonaws.com", //
  port: 587, //
  secure: false, // Use STARTTLS
  auth: {
    user: process.env.SES_SMTP_USER || "AKIAST6S7QZIO2HH6QFS", //
    pass:
      process.env.SES_SMTP_PASSWORD ||
      "BJCm8ZaKi/K6aGK4bqhkpsCTDlibCttc5jKHieTc6Ny7", //
  },
};

// Remetente verificado no SES
const SENDER_EMAIL = "contato@polox.com.br";

const transporter = nodemailer.createTransport({
  ...SMTP_CONFIG,
  requireTLS: true, // Necessário para STARTTLS
});

exports.handler = async (event, context) => {
  console.log(
    "Evento SNS recebido para processamento:",
    JSON.stringify(event, null, 2)
  );

  try {
    for (const record of event.Records) {
      let emailPayload;
      try {
        // A mensagem do SNS é uma string que contém o JSON que sua API publicou
        emailPayload = JSON.parse(record.Sns.Message);
      } catch (e) {
        console.error(
          "Erro ao parsear mensagem SNS como JSON:",
          record.Sns.Message
        );
        continue;
      }

      // Extrai os dados do payload interno (publicado pelo microsController)
      const { recipient, subject, body } = emailPayload.payload || {};

      if (!recipient || !subject || !body) {
        console.error("Payload incompleto ou inválido:", emailPayload);
        continue;
      }

      // 1. Monta o corpo do e-mail
      const mailOptions = {
        from: SENDER_EMAIL, // Seu e-mail SES verificado
        to: recipient, // O destinatário dinâmico do payload
        subject: subject,
        text: body,
        html: `<p><strong>${subject}</strong></p><p>${body}</p><hr><small>Este e-mail foi enviado via Amazon SES.</small>`,
      };

      // 2. Envia o e-mail via Nodemailer/SES SMTP
      const info = await transporter.sendMail(mailOptions);

      console.log(
        `✅ E-mail enviado com sucesso via Nodemailer/SES para ${recipient}. MessageId: ${info.messageId}`
      );
    }

    return { statusCode: 200, body: "Emails processados com sucesso." };
  } catch (error) {
    console.error("❌ Erro no handler Lambda (SES/SMTP):", error);
    // A falha aqui fará o SNS tentar reentregar
    throw new Error(`Falha no envio de e-mail: ${error.message}`);
  }
};
