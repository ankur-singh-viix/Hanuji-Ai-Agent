/**
 * One-time interactive login for personal Telegram automation.
 *
 * Run this ONCE manually (not part of `npm run dev`):
 *   npx ts-node scripts/telegram-user-login.ts
 *
 * It will ask for your phone number, the login code Telegram sends you,
 * and your 2FA password if you have one enabled. At the end it prints a
 * session string — copy that into your .env as TELEGRAM_USER_SESSION.
 * You only need to do this once; after that, personalTelegram.ts reuses
 * the saved session automatically on every startup.
 */
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

import input from 'input';

import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH || '';

async function main() {
  if (!apiId || !apiHash) {
    console.error(
      '❌ Missing TELEGRAM_API_ID or TELEGRAM_API_HASH in .env.\n' +
      'Get them from https://my.telegram.org/apps first.'
    );
    process.exit(1);
  }

  const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text('Your phone number (with country code, e.g. +91...): '),
    password: async () => await input.text('2FA password (leave blank if none): '),
    phoneCode: async () => await input.text('Login code sent to your Telegram app: '),
    onError: (err) => console.error(err),
  });

  console.log('\n✅ Logged in successfully!\n');
  console.log('Copy this into your .env as TELEGRAM_USER_SESSION=\n');
  console.log(client.session.save());
  console.log('\n⚠️  Keep this string secret — it grants full access to your Telegram account.\n');

  await client.disconnect();
  process.exit(0);
}

main();