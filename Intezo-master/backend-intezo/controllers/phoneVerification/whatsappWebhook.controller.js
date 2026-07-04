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
  const signature = req.get('x-hub-signature-256');
  const rawBodyAvailable = Buffer.isBuffer(req.rawBody);

  if (!verifyWebhookSignature(req.rawBody, signature)) {
    console.warn('WhatsApp webhook rejected: invalid signature', {
      signatureProvided: Boolean(signature),
      rawBodyAvailable,
      rawBodyBytes: rawBodyAvailable ? req.rawBody.length : 0
    });
    return res.sendStatus(401);
  }

  const messages = getTextMessages(req.body);
  console.info('WhatsApp webhook received', {
    textMessageCount: messages.length
  });

  const results = await Promise.allSettled(
    messages.map((message) => verifyIncomingWhatsAppMessage(message))
  );

  const summary = {
    textMessageCount: messages.length,
    matchedCount: 0,
    verifiedCount: 0,
    failureCount: 0,
    reasons: {}
  };

  for (const result of results) {
    if (result.status === 'rejected') {
      summary.failureCount += 1;
      console.error(
        'WhatsApp verification webhook processing failed:',
        result.reason?.message || 'Unknown error'
      );
      continue;
    }

    if (result.value.matched) summary.matchedCount += 1;
    if (result.value.verified) summary.verifiedCount += 1;

    const reason = result.value.reason || 'unspecified';
    summary.reasons[reason] = (summary.reasons[reason] || 0) + 1;
  }

  console.info('WhatsApp webhook processing summary', summary);
  return res.sendStatus(200);
};
