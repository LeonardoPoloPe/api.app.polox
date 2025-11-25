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
