import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  FINNHUB_API_KEY: string;
  GEMINI_API_KEY: string;
  FIREBASE_PROJECT_ID?: string;
};

type Variables = {
  userId: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Enable CORS for frontend local development
app.use('/api/*', cors({
  origin: '*', // Allow all in dev, can restrict to localhost:5173 in prod settings
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
}));

// Base64Url decoding helper
function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// In-memory rate limiting map for Gemini calls
const lastGeminiCallTimes = new Map<string, number>();

// Middleware to authenticate Firebase JWT
async function authenticateUser(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing Authorization token' }, 401);
  }

  const token = authHeader.substring(7);

  // Allow mock tokens in local development / fallback modes
  if (token.startsWith('mock_')) {
    c.set('userId', token);
    return await next();
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return c.json({ error: 'Unauthorized: Invalid JWT format' }, 401);
    }

    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));

    // Validate expiration
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      return c.json({ error: 'Unauthorized: Token expired' }, 401);
    }

    // Validate Issuer & Audience if project ID is configured
    const expectedProjectId = c.env.FIREBASE_PROJECT_ID || payload.aud; // fallback to payload's aud
    if (payload.iss !== `https://securetoken.google.com/${expectedProjectId}` || payload.aud !== expectedProjectId) {
      return c.json({ error: 'Unauthorized: Invalid token issuer or audience' }, 401);
    }

    // Fetch Google public keys
    const certsRes = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken-system@system.gserviceaccount.com');
    if (!certsRes.ok) {
      throw new Error('Failed to fetch Google public certificates');
    }
    const { keys } = (await certsRes.json()) as any;
    const jwk = keys.find((k: any) => k.kid === header.kid);
    if (!jwk) {
      return c.json({ error: 'Unauthorized: Unknown key ID (kid)' }, 401);
    }

    // Verify cryptographic signature
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const rawData = new TextEncoder().encode(parts[0] + '.' + parts[1]);
    const signatureBytes = base64UrlDecode(parts[2]);

    const isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      signatureBytes,
      rawData
    );

    if (!isValid) {
      return c.json({ error: 'Unauthorized: Invalid cryptographic signature' }, 401);
    }

    // Set user context
    c.set('userId', payload.sub);
    return await next();
  } catch (err: any) {
    console.error('JWT validation error:', err);
    return c.json({ error: 'Unauthorized: Token verification failed', details: err.message }, 401);
  }
}

// Health Check Endpoint (Public)
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    message: 'BusinessOS Edge API is running',
    timestamp: new Date().toISOString(),
    runtime: 'Cloudflare Worker'
  });
});

// User profile API mock route (Phase 1 - Public)
app.post('/api/auth-debug', async (c) => {
  try {
    const body = await c.req.json();
    return c.json({
      authenticated: true,
      user: body,
      message: 'Token verification simulated successfully on Cloudflare Edge.'
    });
  } catch (err: any) {
    return c.json({
      authenticated: false,
      error: err.message || 'Verification failed'
    }, 400);
  }
});

// Protect all following routes
app.use('/api/market-data/*', authenticateUser);
app.use('/api/commentary/*', authenticateUser);

// Quote Endpoint
app.get('/api/market-data/quote', async (c) => {
  const symbol = c.req.query('symbol');
  if (!symbol) {
    return c.json({ error: 'Symbol parameter is required' }, 400);
  }

  const apiKey = c.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return c.json({ error: 'Finnhub API key not configured on backend' }, 500);
  }

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      return c.json({ error: `Finnhub returned HTTP ${res.status}` }, res.status as any);
    }
    const data = await res.json();
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message || 'Internal Server Error' }, 500);
  }
});

// Metadata Endpoint
app.get('/api/market-data/metadata', async (c) => {
  const symbol = c.req.query('symbol');
  if (!symbol) {
    return c.json({ error: 'Symbol parameter is required' }, 400);
  }

  const apiKey = c.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return c.json({ error: 'Finnhub API key not configured on backend' }, 500);
  }

  try {
    const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      return c.json({ error: `Finnhub returned HTTP ${res.status}` }, res.status as any);
    }
    const data = await res.json();
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message || 'Internal Server Error' }, 500);
  }
});

// Historical Data Endpoint
app.get('/api/market-data/historical', async (c) => {
  const symbol = c.req.query('symbol');
  const from = c.req.query('from');
  const to = c.req.query('to');

  if (!symbol || !from || !to) {
    return c.json({ error: 'Symbol, from, and to parameters are required' }, 400);
  }

  const apiKey = c.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return c.json({ error: 'Finnhub API key not configured on backend' }, 500);
  }

  try {
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      return c.json({ error: `Finnhub returned HTTP ${res.status}` }, res.status as any);
    }
    const data = await res.json();
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message || 'Internal Server Error' }, 500);
  }
});

// Gemini Commentary Endpoint
app.post('/api/commentary/generate', async (c) => {
  const apiKey = c.env.GEMINI_API_KEY;
  if (!apiKey) {
    return c.json({ error: 'Gemini API Key is not configured on the backend.' }, 500);
  }

  const userId = c.get('userId');

  // Rate limiting (backend level)
  const now = Date.now();
  const lastCall = lastGeminiCallTimes.get(userId) || 0;
  if (now - lastCall < 5000) {
    return c.json({ error: 'Too many requests. Please wait before generating commentary again.' }, 429);
  }
  lastGeminiCallTimes.set(userId, now);

  try {
    const { systemPrompt, userPrompt, model } = await c.req.json();
    if (!systemPrompt || !userPrompt) {
      return c.json({ error: 'Missing systemPrompt or userPrompt parameters' }, 400);
    }

    const modelName = model || 'gemini-1.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${systemPrompt}\n\n${userPrompt}`
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return c.json({ error: `Gemini API returned HTTP ${res.status}`, details: errText }, res.status as any);
    }

    const data = (await res.json()) as any;
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return c.json({ error: 'Empty response content from Gemini model.' }, 500);
    }

    const parsed = JSON.parse(rawText.trim());
    return c.json(parsed);
  } catch (err: any) {
    console.error('Gemini backend commentary error:', err);
    return c.json({ error: 'Internal Server Error', details: err.message }, 500);
  }
});

// Fallback route
app.all('*', (c) => {
  return c.json({ error: 'Endpoint not found' }, 404);
});

export default app;
