import axios from 'axios';

const WEBHOOK_URL = `http://localhost:${process.env.WEBHOOK_SERVICE_PORT || 3002}`;
const headers = { 'x-internal-secret': process.env.INTERNAL_API_SECRET };

export const telegramPersonalTools = [
  {
    name: 'read_telegram_contact',
    description:
      'Reads recent messages from a specific person on the user\'s personal Telegram account, by name. Use when the user asks what someone said, or to summarize a conversation with someone on Telegram.',
    schema: {
      type: 'object',
      required: ['contact'],
      properties: {
        contact: { type: 'string', description: 'Name or username of the Telegram contact, e.g. "Hided X"' },
        limit:   { type: 'integer', description: 'How many recent messages to fetch (default 20)' },
      },
    },
    handler: async (params: any) => {
      const contact = params.contact || params.contact_id || params.name;
      if (!contact) {
        throw new Error('No contact name provided — cannot safely guess which chat to read.');
      }
      const res = await axios.get(`${WEBHOOK_URL}/internal/telegram/messages`, {
        headers,
        params: { query: contact, limit: params.limit || 20 },
        timeout: 30000,
      });
      return res.data;
    },
  },

  {
    name: 'send_telegram_message',
    description:
      'Sends a message to a specific person on the user\'s personal Telegram account, on the user\'s behalf. Use when the user explicitly asks to reply to or message someone on Telegram.',
    schema: {
      type: 'object',
      required: ['contact', 'message'],
      properties: {
        contact: { type: 'string', description: 'Name or username of the Telegram contact to message' },
        message: { type: 'string', description: 'The message text to send' },
      },
    },
    handler: async (params: any) => {
      const contact = params.contact || params.contact_id || params.name;
      const message = params.message || params.text;
      if (!contact) {
        throw new Error('No contact name provided — cannot safely guess who to send this to.');
      }
      if (!message) {
        throw new Error('No message text provided.');
      }
      const res = await axios.post(
        `${WEBHOOK_URL}/internal/telegram/send`,
        { query: contact, message },
        { headers, timeout: 30000 }
      );
      return res.data;
    },
  },
];