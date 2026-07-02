import { queryQwenText, queryQwenVision } from '../lib/qwen.js';

const ANALYSIS_SYSTEM_PROMPT = `You are Sentinel Agent, an expert email security analyst AI. Your job is to analyze emails for threats including phishing, spoofing, malware, brand impersonation, and social engineering.

You will receive:
- Email metadata (sender, subject, headers)
- Email body text
- Optionally: sandbox scan results (screenshots of visited URLs, DOM content, network requests)

Analyze ALL evidence and respond with a JSON object containing:
{
  "threatType": "phishing" | "spoofing" | "malware" | "brand_impersonation" | "social_engineering" | "spam" | "legitimate",
  "indicators": ["list of specific red flags found"],
  "confidence": 0-100,
  "shortReason": "one-sentence concise explanation for the user extension UI",
  "reasoning": "detailed explanation of why this is or isn't a threat",
  "impersonatedBrand": "brand name if applicable, null otherwise",
  "urgencyTactics": true/false,
  "linkAnalysis": "summary of any suspicious URLs found",
  "headerAnalysis": "summary of SPF/DKIM/header anomalies"
}

CRITICAL RULES — READ CAREFULLY:
1. ASSUME INNOCENCE: Treat every email as legitimate UNTIL you find concrete, undeniable evidence of malice. Most emails are real.
2. SPF/DKIM will ALWAYS say "not checked" — we do not have access to raw headers. NEVER use missing authentication as evidence of threat. Ignore the headers section entirely.
3. URL obfuscation is NORMAL: Gmail, Mailchimp, SendGrid, Grammarly, banks, and virtually all modern marketing platforms use long tracking URLs, click-tracking subdomains (click.company.com, lnk.company.com), and base64 parameters. This is standard email marketing — NOT phishing.
4. Subdomains are NORMAL: mail.company.com, e.company.com, news.company.com are standard sending infrastructure. A subdomain of a legitimate domain is NOT suspicious.
5. Only flag as phishing/malware if: the sender domain is COMPLETELY UNRELATED to the brand (e.g., paypal-security.ru sending as PayPal), OR the email explicitly asks for passwords/credentials/payment, OR links point to known malicious domains.
6. Promotional emails with deals, discounts, urgency language like "limited time" or "act now" are NORMAL marketing tactics — NOT social engineering unless combined with credential harvesting.
7. CONFIDENCE must be 0-100 (integer). For legitimate emails, set confidence to 10-30. For suspicious, 40-70. For genuinely dangerous, 75-100. NEVER return 0.
8. If in doubt, classify as "legitimate" with low confidence rather than falsely accusing a real company of phishing.

Be thorough but fair. Focus on actual danger to the user, not theoretical imperfections.`;

/**
 * Analyze an email using Qwen AI.
 * If scan results contain screenshots, uses vision model.
 * Otherwise uses text-only model.
 */
export async function analyzeEmail(email, scanResults = null) {
  console.log('🔍 Analyzing email with Qwen AI...');

  const userPrompt = buildAnalysisPrompt(email, scanResults);

  // Check if we have screenshots to analyze
  const screenshots = scanResults?.screenshots || [];

  let result;
  if (screenshots.length > 0) {
    console.log(`  📸 Including ${screenshots.length} screenshot(s) for vision analysis`);
    result = await queryQwenVision(ANALYSIS_SYSTEM_PROMPT, userPrompt, screenshots);
  } else {
    result = await queryQwenText(ANALYSIS_SYSTEM_PROMPT, userPrompt);
  }

  // Ensure we have a valid structure
  return {
    threatType: result.threatType || 'unknown',
    indicators: result.indicators || [],
    confidence: result.confidence || 15,
    shortReason: result.shortReason || 'No summary provided',
    reasoning: result.reasoning || 'Analysis could not be completed',
    impersonatedBrand: result.impersonatedBrand || null,
    urgencyTactics: result.urgencyTactics || false,
    linkAnalysis: result.linkAnalysis || null,
    headerAnalysis: result.headerAnalysis || null,
  };
}

function buildAnalysisPrompt(email, scanResults) {
  let prompt = `=== EMAIL METADATA ===
From: ${email.sender}
Reply-To: ${email.replyTo || email.sender}
Subject: ${email.subject}

=== HEADERS ===
SPF: ${email.headers?.spf || 'not checked'}
DKIM: ${email.headers?.dkim || 'not checked'}

=== EMAIL BODY ===
${email.bodyText || '(empty)'}

=== URLS FOUND ===
${(email.urls || []).join('\n') || 'none'}

=== ATTACHMENTS ===
${(email.attachments || []).map((a) => `${a.filename} (${a.mimeType})`).join('\n') || 'none'}`;

  if (scanResults) {
    prompt += `\n\n=== SANDBOX SCAN RESULTS ===`;
    if (scanResults.urlResults) {
      for (const [url, result] of Object.entries(scanResults.urlResults)) {
        prompt += `\n\nURL: ${url}`;
        prompt += `\nFinal URL: ${result.finalUrl || 'N/A'}`;
        prompt += `\nRedirects: ${result.redirectCount || 0}`;
        prompt += `\nPage Title: ${result.pageTitle || 'N/A'}`;
        prompt += `\nDOM Summary: ${result.domText?.substring(0, 500) || 'N/A'}`;
        prompt += `\nSuspicious Networks: ${JSON.stringify(result.suspiciousRequests || [])}`;
      }
    }
    if (scanResults.attachmentContent) {
      prompt += `\n\n=== ATTACHMENT CONTENT ===\n${scanResults.attachmentContent}`;
    }
  }

  return prompt;
}
