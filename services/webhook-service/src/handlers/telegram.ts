import { Router } from 'express';
import axios from 'axios';
import { logger } from '../lib/logger';
import { messageQueue } from '../lib/queue';

export const telegramRouter = Router();

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const AGENT_URL = `http://localhost:${process.env.AGENT_SERVICE_PORT || 3001}`;

// Handle incoming Telegram messages
telegramRouter.post('/', async (req, res) => {
  // Immediately acknowledge
  res.status(200).json({ ok: true });

  const update = req.body;

  // Only process text messages
  if (!update?.message?.text) return;

  const { message } = update;
  const userId = `tg_${message.from.id}`;
  const chatId = message.chat.id;
  const text   = message.text;
  const name   = `${message.from.first_name || ''} ${message.from.last_name || ''}`.trim();

  logger.info('Telegram message received', { userId, chatId, textLength: text.length });

  // Handle /start command
  if (text === '/start') {
    await sendTelegramMessage(chatId,
      `🐒 *Hanu Ji here!* Namaste ${name || 'there'}!\n\nI'm your personal AI assistant. I can help you:\n\n📅 *Schedule & manage meetings*\n💬 *Answer questions*\n✅ *Track tasks*\n\nJust type naturally — like talking to a smart assistant!\n\nTry: _"What's my schedule today?"_ or _"Schedule a call tomorrow at 3pm"_`
    );
    return;
  }

  // Handle /help command
  if (text === '/help') {
    await sendTelegramMessage(chatId,
      `🐒 *Hanu Ji Commands:*\n\n📅 _"Schedule meeting tomorrow 3pm"_\n📋 _"What's on my calendar today?"_\n🗑 _"Cancel my 5pm call"_\n❓ _"What's the capital of Japan?"_\n\n_Just speak naturally — I understand context!_`
    );
    return;
  }

  // Show typing indicator
  await sendTypingAction(chatId);

  try {
    // Call agent service directly (or queue for heavy load)
    const response = await axios.post(`${AGENT_URL}/process`, {
      userId,
      channel: 'telegram',
      message: text,
      sessionId: `${chatId}`,
      userMeta: { name, telegramId: message.from.id },
    }, { timeout: 30000 });

    const { reply, needsConfirmation, confirmationData } = response.data;

    if (needsConfirmation && confirmationData) {
      // Send inline keyboard for confirmation
      await sendTelegramInlineKeyboard(chatId, reply, [
        [
          { text: '✅ Yes, do it', callback_data: `confirm:${JSON.stringify(confirmationData)}` },
          { text: '❌ Cancel',     callback_data: 'cancel' },
        ],
      ]);
    } else {
      await sendTelegramMessage(chatId, reply);
    }

  } catch (err: any) {
    logger.error('Agent call failed', { err: err.message });
    await sendTelegramMessage(chatId, '⚠️ I had trouble processing that. Please try again in a moment.');
  }
});

// Handle callback queries (button presses)
telegramRouter.post('/callback', async (req, res) => {
  res.status(200).json({ ok: true });

  const { callback_query } = req.body;
  if (!callback_query) return;

  const chatId = callback_query.message.chat.id;
  const userId = `tg_${callback_query.from.id}`;
  const data   = callback_query.data;

  if (data === 'cancel') {
    await sendTelegramMessage(chatId, '👍 Cancelled. Anything else?');
    return;
  }

  if (data.startsWith('confirm:')) {
    const toolCall = JSON.parse(data.replace('confirm:', ''));
    // Re-send to agent with confirmed flag
    const response = await axios.post(`${AGENT_URL}/process`, {
      userId,
      channel: 'telegram',
      message: `[CONFIRMED] Execute: ${JSON.stringify(toolCall)}`,
    });
    await sendTelegramMessage(chatId, response.data.reply);
  }
});

// ── Telegram API helpers ──────────────────────────────────
async function sendTelegramMessage(chatId: number, text: string) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id:    chatId,
      text:       text,
      parse_mode: 'Markdown',
    });
  } catch (err: any) {
    logger.error('Telegram send failed', { err: err.message, chatId });
  }
}

async function sendTypingAction(chatId: number) {
  try {
    await axios.post(`${TELEGRAM_API}/sendChatAction`, {
      chat_id: chatId,
      action:  'typing',
    });
  } catch {}
}

async function sendTelegramInlineKeyboard(chatId: number, text: string, keyboard: any[][]) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id:      chatId,
      text:         text,
      parse_mode:   'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (err: any) {
    logger.error('Telegram keyboard send failed', { err: err.message });
  }
}
