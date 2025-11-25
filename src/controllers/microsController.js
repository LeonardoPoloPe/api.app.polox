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
 * FINALIDADE: Publicar mensagens no Amazon SNS para processamento assíncrono.
 *
 * @swagger
 * tags:
 *   - name: Micros
 *     description: Microserviço para publicação de mensagens SNS
 */

const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { logger } = require("../utils/logger");

const TOPIC_ARN = "arn:aws:sns:us-east-1:180294223440:PoloX";
const snsClient = new SNSClient({ region: "us-east-1" });

/**
 * @swagger
 * /micros/send-notification:
 *   post:
 *     summary: Publica mensagem no SNS para envio de email
 *     tags: [Micros]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject
 *               - email
 *               - body
 *             properties:
 *               subject:
 *                 type: string
 *                 example: "Bem-vindo ao Polox!"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "usuario@exemplo.com"
 *               body:
 *                 type: string
 *                 example: "Seu cadastro foi realizado com sucesso."
 *     responses:
 *       202:
 *         description: Mensagem publicada com sucesso no SNS
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 messageId:
 *                   type: string
 *                 event:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                 payload:
 *                   type: object
 */
async function sendNotification(req, res) {
  // Log para diagnóstico do usuário autenticado
  console.log("[MicrosController] req.user:", req.user);
  // Verifica se está logado e se é super_admin
  if (!req.user || req.user.role !== "super_admin") {
    return res.status(403).json({
      success: false,
      error: "Acesso restrito: apenas super_admin pode acessar este endpoint.",
    });
  }

  const data = req.body;
  const message = {
    event: "USER_REGISTERED",
    timestamp: new Date().toISOString(),
    payload: {
      subject: data.subject,
      email: data.email,
      body: data.body,
    },
  };

  const params = {
    TopicArn: TOPIC_ARN,
    Message: JSON.stringify(message),
  };

  try {
    const result = await snsClient.send(new PublishCommand(params));
    logger.info("SNS Publish Success", {
      messageId: result.MessageId,
      payload: message,
    });
    if (typeof res.sendSuccess === "function") {
      return res.sendSuccess(
        {
          success: true,
          messageId: result.MessageId,
          event: message.event,
          timestamp: message.timestamp,
          payload: message.payload,
        },
        202
      );
    } else {
      // fallback for express default
      return res.status(202).json({
        success: true,
        messageId: result.MessageId,
        event: message.event,
        timestamp: message.timestamp,
        payload: message.payload,
      });
    }
  } catch (error) {
    logger.error("SNS Publish Error", {
      error: error.message,
      payload: message,
    });
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

module.exports = {
  sendNotification,
};
