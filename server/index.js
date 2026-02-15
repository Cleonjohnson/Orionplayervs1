/**
 * Simple Stripe Checkout demo server (Express)
 *
 * Requirements:
 * - Set environment variable STRIPE_SECRET_KEY to your Stripe secret key
 * - Optionally set BASE_URL to your publicly reachable server base (used for Checkout success_url)
 *
 * Endpoints:
 * POST /create-checkout-session  -> { url }
 * POST /webhook                  -> Stripe webhook (configure in Stripe dashboard)
 * POST /verify-code              -> { ok, error } (redeem generated license code)
 *
 * NOTE: This is a demo. For production use secure storage and validation, HTTPS, authentication.
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_KEY) {
  console.warn('Warning: STRIPE_SECRET_KEY not set. Server will fail when creating sessions.');
}
const stripe = require('stripe')(STRIPE_KEY || '');
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || null;

// Helper to send email via SendGrid REST API (no @sendgrid/mail dependency)
async function sendEmailViaSendGrid(to, from, subject, text, html) {
  if (!SENDGRID_API_KEY) return false;
  try {
    const body = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [
        { type: 'text/plain', value: text || '' },
        { type: 'text/html', value: html || '' },
      ],
    };
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (e) {
    console.warn('sendEmailViaSendGrid error', e);
    return false;
  }
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

const DATA_FILE = path.join(__dirname, 'licenses.json');
function loadLicenses() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '{}');
  } catch (e) {
    return {};
  }
}
function saveLicenses(obj) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2));
}
const SUB_FILE = path.join(__dirname, 'subscriptions.json');
function loadSubs() {
  try { return JSON.parse(fs.readFileSync(SUB_FILE, 'utf8') || '{}'); } catch (e) { return {}; }
}
function saveSubs(obj) {
  fs.writeFileSync(SUB_FILE, JSON.stringify(obj, null, 2));
}

app.post('/create-checkout-session', async (req, res) => {
  try {
    const { email } = req.body || {};
    const BASE_URL = process.env.BASE_URL || 'https://example.com';
    // Create a one-time Checkout session (demo price)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Orion Premium Subscription (Demo)' },
            unit_amount: 499, // $4.99 demo
          },
          quantity: 1,
        },
      ],
      success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/cancel`,
      customer_email: email || undefined,
    });
    // Return session url and id so the client can poll by session id.
    res.json({ url: session.url, id: session.id });
  } catch (e) {
    console.error('create-checkout-session error', e);
    res.status(500).json({ error: e?.message || 'Failed to create session' });
  }
});

// Simple webhook receiver that creates a license code when checkout completes.
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), (req, res) => {
  const event = req.body && JSON.parse(req.body.toString());
  try {
    if (event?.type === 'checkout.session.completed') {
      const session = event.data.object;
      // generate code
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      const licenses = loadLicenses();
      licenses[code] = {
        email: session.customer_email || null,
        session_id: session.id,
        createdAt: new Date().toISOString(),
        used: false,
      };
      saveLicenses(licenses);
      console.log('Generated license code', code, 'for', session.customer_email);
      // record subscription
      try {
        const subs = loadSubs();
        subs[session.id] = {
          email: session.customer_email || null,
          session_id: session.id,
          amount_total: session.amount_total || null,
          currency: session.currency || null,
          createdAt: new Date().toISOString(),
        };
        saveSubs(subs);
      } catch (e) { console.warn('save subs error', e); }
      // Send code by email if SendGrid API key configured and we have an email
      if (SENDGRID_API_KEY && session.customer_email) {
        try {
          const from = process.env.SENDGRID_FROM || 'no-reply@orion.example';
          const text = `Thank you for your purchase. Your license code is: ${code}\n\nVisit the app and enter this code under Settings → Redeem to unlock Premium.`;
          const html = `<p>Thank you for your purchase.</p><p>Your license code is: <strong style="font-size:18px">${code}</strong></p><p>Open the Orion app and go to <strong>Settings → Redeem</strong> to unlock Premium features.</p><p>If the app was open during purchase, press <em>Buy on Web</em> again and it will auto-unlock.</p>`;
          const ok = await sendEmailViaSendGrid(session.customer_email, from, 'Your Orion Premium License Code', text, html);
          if (ok) console.log('License code emailed to', session.customer_email);
          else console.warn('SendGrid send failed for', session.customer_email);
        } catch (e) {
          console.warn('SendGrid error', e);
        }
      }
      // Google Analytics measurement protocol event (optional)
      const GA_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID;
      const GA_API_SECRET = process.env.GA_API_SECRET;
      if (GA_MEASUREMENT_ID && GA_API_SECRET) {
        try {
          const mpUrl = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(GA_MEASUREMENT_ID)}&api_secret=${encodeURIComponent(GA_API_SECRET)}`;
          const body = {
            client_id: session.id || `client_${Math.random().toString(36).slice(2,10)}`,
            events: [
              {
                name: 'purchase',
                params: {
                  currency: session.currency || 'USD',
                  value: (session.amount_total || 0) / 100,
                },
              },
            ],
          };
          fetch(mpUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            .then(() => console.log('GA event sent'))
            .catch((e) => console.warn('GA send error', e));
        } catch (e) { console.warn('GA error', e); }
      }
    }
  } catch (e) {
    console.error('webhook handling error', e);
  }
  res.json({ received: true });
});

// Pollable endpoint to check if a license was created for a checkout session
app.get('/session/:id', (req, res) => {
  try {
    const sid = req.params.id;
    if (!sid) return res.json({ ready: false });
    const licenses = loadLicenses();
    for (const [code, rec] of Object.entries(licenses)) {
      if (rec.session_id === sid) {
        return res.json({ ready: true, code, email: rec.email || null, used: !!rec.used });
      }
    }
    return res.json({ ready: false });
  } catch (e) {
    console.error('session check error', e);
    res.status(500).json({ ready: false });
  }
});

app.post('/verify-code', (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) return res.json({ ok: false, error: 'Missing code' });
    const licenses = loadLicenses();
    const record = licenses[code];
    if (!record) return res.json({ ok: false, error: 'Code not found' });
    if (record.used) return res.json({ ok: false, error: 'Code already used' });
    // mark used
    record.used = true;
    record.redeemedAt = new Date().toISOString();
    saveLicenses(licenses);
    return res.json({ ok: true, tier: 'pro', email: record.email || null });
  } catch (e) {
    console.error('verify-code error', e);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`Stripe demo server listening on ${PORT}`));

// --- Gumroad support ---
// Return configured Gumroad product URL (so client doesn't hardcode it)
app.get('/gumroad-product', (req, res) => {
  const url = process.env.GUMROAD_PRODUCT_URL || null;
  if (!url) return res.status(404).json({ error: 'No product configured' });
  res.json({ url });
});

// Gumroad webhook receiver (Gumroad may POST form-encoded data with a 'payload' field)
app.post('/gumroad-webhook', bodyParser.urlencoded({ extended: true }), (req, res) => {
  try {
    let payload = req.body;
    if (payload.payload) {
      try { payload = JSON.parse(payload.payload); } catch (_) {}
    }
    // Try common email fields
    const email = payload.purchaser_email || payload.email || payload.customer_email || null;
    const sale = payload;
    // Create license
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const licenses = loadLicenses();
    licenses[code] = {
      email: email || null,
      source: 'gumroad',
      raw: sale,
      createdAt: new Date().toISOString(),
      used: false,
    };
    saveLicenses(licenses);
    console.log('Gumroad generated license', code, 'for', email);
    // send email if SendGrid API key configured
    if (SENDGRID_API_KEY && email) {
      try {
        const from = process.env.SENDGRID_FROM || 'no-reply@orion.example';
        const text = `Thank you for your purchase. Your license code is: ${code}\n\nOpen the Orion app and go to Settings → Redeem to unlock Premium features.`;
        const html = `<p>Thank you for your purchase.</p><p>Your license code is: <strong style="font-size:18px">${code}</strong></p><p>Open the Orion app and go to <strong>Settings → Redeem</strong> to unlock Premium features.</p>`;
        const ok = await sendEmailViaSendGrid(email, from, 'Your Orion Premium License Code', text, html);
        if (ok) console.log('Gumroad license emailed to', email);
        else console.warn('SendGrid send failed for', email);
      } catch (e) { console.warn('SendGrid send error', e); }
    }
  } catch (e) {
    console.error('gumroad webhook error', e);
  }
  res.json({ received: true });
});

// Allow client to poll for license by buyer email (used for Gumroad flow)
app.get('/licenses-by-email', (req, res) => {
  try {
    const email = (req.query.email || '').trim().toLowerCase();
    if (!email) return res.json({ found: false });
    const licenses = loadLicenses();
    for (const [code, rec] of Object.entries(licenses)) {
      if (rec.email && String(rec.email).toLowerCase() === email && !rec.used) {
        return res.json({ found: true, code, email: rec.email });
      }
    }
    return res.json({ found: false });
  } catch (e) {
    console.error('licenses-by-email error', e);
    res.status(500).json({ found: false });
  }
});

