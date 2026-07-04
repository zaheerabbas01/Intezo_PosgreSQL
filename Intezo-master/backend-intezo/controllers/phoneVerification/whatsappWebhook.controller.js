import {
  verifyIncomingWhatsAppMessage,
  verifyWebhookChallengeToken,
  verifyWebhookSignature
} from '../../services/whatsappVerificationService.js';

export const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (
    mode === 'subscribe' &&
    challenge &&
    verifyWebhookChallengeToken(token)
  ) {
    return res.status(200).type('text/plain').send(String(challenge));
  }

  return res.sendStatus(403);
};

const getTextMessages = (payload) => {
  const messages = [];

  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      for (const message of change?.value?.messages || []) {
        if (message?.type === 'text' && message?.from && message?.text?.body) {
          messages.push({
            from: message.from,
            message: message.text.body
          });
        }
      }
    }
  }

  return messages;
};

export const receiveWebhook = async (req, res) => {
  if (!verifyWebhookSignature(req.rawBody, req.get('x-hub-signature-256'))) {
    return res.sendStatus(401);
  }

  const messages = getTextMessages(req.body);
  const results = await Promise.allSettled(
    messages.map((message) => verifyIncomingWhatsAppMessage(message))
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error(
        'WhatsApp verification webhook processing failed:',
        result.reason?.message || 'Unknown error'
      );
    }
  }

  return res.sendStatus(200);
};
