/**
 * Personal Telegram automation — reads YOUR real DMs and auto-replies
 * using the same Hanu Ji brain as the bot and web chat.
 *
 * Only starts if TELEGRAM_API_ID, TELEGRAM_API_HASH, and
 * TELEGRAM_USER_SESSION are all present in .env (see
 * scripts/telegram-user-login.ts for how to generate the session).
 *
 * ⚠️ This automates a personal Telegram account, which is against
 * Telegram's Terms of Service and can result in the account being
 * restricted or banned. Proceed at your own risk.
 */
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage, NewMessageEvent } from 'telegram/events';
import axios from 'axios';
import { logger } from './lib/logger';

const AGENT_URL = `http://localhost:${process.env.AGENT_SERVICE_PORT || 3001}`;

// Optional: comma-separated list of Telegram user IDs to NEVER auto-reply to
// (e.g. your own alt accounts, or specific people you want to handle yourself).
const EXCLUDED_USER_IDS = (process.env.TELEGRAM_PERSONAL_EXCLUDE || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// The connected client, kept module-level so the internal HTTP endpoints
// (see index.ts) can use it to read/send messages on demand, in addition
// to the automatic reply loop below.
let personalClient: TelegramClient | null = null;

// Tracks the last time we sent a message to each contact, to guard against
// accidental double-sends (e.g. the user retrying a command after a false
// "timed out" error, while the first send actually succeeded).
const lastSentAt = new Map<string, number>();
const SEND_COOLDOWN_MS = 60 * 1000;

export async function startPersonalTelegram() {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH;
  const sessionString = process.env.TELEGRAM_USER_SESSION;

  if (!apiId || !apiHash || !sessionString) {
    logger.info(
      'Personal Telegram automation not configured — skipping. ' +
      '(Set TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_USER_SESSION to enable.)'
    );
    return;
  }

  const client = new TelegramClient(
    new StringSession(sessionString),
    apiId,
    apiHash,
    {
      connectionRetries: 10,
      retryDelay: 2000,
      autoReconnect: true,
      timeout: 20,
    }
  );

  await client.connect();
  personalClient = client;

  const me = await client.getMe();
  logger.info('📱 Personal Telegram automation connected', { as: me.username || me.id?.toString() });

  client.addEventHandler(async (event: NewMessageEvent) => {
    try {
      const message = event.message;

      // Only handle real 1:1 private chats, never groups/channels
      if (!event.isPrivate) return;

      const sender = await message.getSender();
      if (!sender) return;

      // Don't reply to yourself, and don't get into loops with bots
      // (including your own Hanu Ji Bot, if you also message it from here)
      // @ts-ignore - runtime shape from GramJS
      if (sender.bot) return;
      // @ts-ignore
      if (sender.id?.equals?.(me.id)) return;

      // @ts-ignore
      const senderId = sender.id?.toString?.() || '';
      if (EXCLUDED_USER_IDS.includes(senderId)) {
        logger.info('Skipping excluded sender', { senderId });
        return;
      }

      const text = message.text;
      if (!text) return; // skip stickers/photos/etc for now

      logger.info('Personal Telegram DM received', { senderId, textLength: text.length });

      const response = await axios.post(
        `${AGENT_URL}/process`,
        {
          userId: `tgu_${senderId}`,
          channel: 'telegram_personal',
          message: text,
        },
        { timeout: 300000 }
      );

      const reply = response.data?.reply;
      if (reply) {
        await client.sendMessage(message.chatId!, { message: reply });
      }
    } catch (err: any) {
      logger.error('Personal Telegram handler failed', { err: err.message });
    }
  }, new NewMessage({ incoming: true }));
}

/**
 * Finds a contact/dialog by name or username (case-insensitive substring
 * match) and returns their N most recent messages. Used by the
 * read_telegram_contact agent tool.
 */
export async function getContactMessages(query: string, limit: number = 20) {
  if (!personalClient) throw new Error('Personal Telegram is not connected');
  if (!query || !query.trim()) {
    throw new Error('No contact search query provided — refusing to guess which chat to read.');
  }

  const dialogs = await personalClient.getDialogs({});
  const match = findDialog(dialogs, query);

  if (!match) throw new Error(`No Telegram contact found matching "${query}"`);

  const messages = await personalClient.getMessages(match.entity, { limit });

  return {
    contact: match.name,
    messages: messages
      .filter((m) => m.text)
      .reverse()
      .map((m) => ({
        fromMe: m.out,
        text: m.text,
        date: new Date(m.date * 1000).toISOString(),
      })),
  };
}

/**
 * Finds a dialog (contact/chat) matching a query, checking both the
 * display name and username, tolerant of a leading "@", extra spaces,
 * and case differences (e.g. "@HidedX", "hided x", "Hided X" all match).
 */
function findDialog(dialogs: any[], query: string) {
  const normalize = (s: string) => s.toLowerCase().replace(/^@/, '').replace(/\s+/g, '');
  const target = normalize(query);

  return dialogs.find((d) => {
    const name = d.name ? normalize(d.name) : '';
    const username = d.entity?.username ? normalize(d.entity.username) : '';
    return (name && name.includes(target)) || (username && username.includes(target));
  });
}

/**
 * Finds a contact/dialog by name or username and sends them a message.
 * Used by the send_telegram_message agent tool.
 */
export async function sendMessageToContact(query: string, text: string) {
  if (!personalClient) throw new Error('Personal Telegram is not connected');
  if (!query || !query.trim()) {
    throw new Error('No contact search query provided — refusing to guess who to send to.');
  }

 const dialogs = await personalClient.getDialogs({});
  const match = findDialog(dialogs, query);

  if (!match) throw new Error(`No Telegram contact found matching "${query}"`);

  const contactKey = match.name || query;
  const lastSent = lastSentAt.get(contactKey);
  if (lastSent && Date.now() - lastSent < SEND_COOLDOWN_MS) {
    const secondsLeft = Math.ceil((SEND_COOLDOWN_MS - (Date.now() - lastSent)) / 1000);
    throw new Error(
      `A message was already sent to ${contactKey} in the last minute. ` +
      `Please wait ${secondsLeft}s and confirm again if you really want to send another message — ` +
      `this is a safety guard against accidental duplicate sends.`
    );
  }

  if (!match.entity) {
    throw new Error(`Found contact '${match.name || query}' but no entity available to send message to.`);
  }

  await personalClient.sendMessage(match.entity, { message: text });
  lastSentAt.set(contactKey, Date.now());

  return { contact: match.name, sent: true };
}