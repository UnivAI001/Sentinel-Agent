/**
 * Gmail Ingestion Module
 * 
 * This module will connect to Gmail via OAuth 2.0 to pull new emails.
 * GCP credentials (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN)
 * need to be set in .env before this will work.
 * 
 * For now, the module exports a function that accepts email objects directly,
 * so the pipeline can be tested without Gmail credentials.
 */

import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

let gmailClient = null;

/**
 * Initialize the Gmail API client using OAuth2 credentials.
 */
function getGmailClient() {
  if (gmailClient) return gmailClient;

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.warn('⚠️  Gmail credentials not set. Use ingestManual() to pass emails directly.');
    return null;
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });

  gmailClient = google.gmail({ version: 'v1', auth: oauth2 });
  return gmailClient;
}

/**
 * Fetch new unread emails from Gmail.
 */
export async function ingestFromGmail(maxResults = 10) {
  const gmail = getGmailClient();
  if (!gmail) {
    throw new Error('Gmail not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN in .env');
  }

  console.log('📬 Fetching new emails from Gmail...');

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread',
    maxResults,
  });

  const messageIds = res.data.messages || [];
  if (messageIds.length === 0) {
    console.log('  No new emails found.');
    return [];
  }

  console.log(`  Found ${messageIds.length} new email(s)`);

  const emails = [];
  for (const { id } of messageIds) {
    const msg = await gmail.users.messages.get({
      userId: 'me',
      id,
      format: 'full',
    });

    const email = parseGmailMessage(msg.data);
    emails.push(email);
  }

  return emails;
}

/**
 * Parse a raw Gmail API message into our standard email format.
 */
function parseGmailMessage(message) {
  const headers = message.payload.headers || [];
  const getHeader = (name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const sender = getHeader('From');
  const replyTo = getHeader('Reply-To') || sender;
  const subject = getHeader('Subject');
  const receivedSPF = getHeader('Received-SPF');
  const dkimSignature = getHeader('DKIM-Signature');

  // Extract body text
  let bodyText = '';
  if (message.payload.body?.data) {
    bodyText = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
  } else if (message.payload.parts) {
    const textPart = message.payload.parts.find((p) => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      bodyText = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
    }
  }

  // Extract URLs from body
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  const urls = bodyText.match(urlRegex) || [];

  // Extract attachments metadata
  const attachments = [];
  if (message.payload.parts) {
    for (const part of message.payload.parts) {
      if (part.filename && part.filename.length > 0) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body?.size || 0,
          attachmentId: part.body?.attachmentId,
        });
      }
    }
  }

  return {
    id: message.id,
    threadId: message.threadId,
    sender,
    replyTo,
    subject,
    bodyText,
    headers: {
      spf: receivedSPF.includes('pass') ? 'pass' : receivedSPF.includes('fail') ? 'fail' : 'unknown',
      dkim: dkimSignature ? 'present' : 'missing',
    },
    urls,
    attachments,
    receivedAt: new Date(parseInt(message.internalDate)).toISOString(),
    gmailId: message.id,
  };
}

/**
 * Manual ingestion — pass email objects directly for testing.
 * This is the function used when Gmail is not yet configured.
 */
export async function ingestManual(emailObjects) {
  console.log(`📬 Manual ingestion: ${emailObjects.length} email(s) loaded`);
  return emailObjects;
}
