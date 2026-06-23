import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  FINNHUB_API_KEY: string;
  GEMINI_API_KEY: string;
  FIREBASE_PROJECT_ID?: string;
  RESEND_API_KEY?: string;
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
app.use('/api/health/services', authenticateUser);

// Services Health Check Endpoint
app.get('/api/health/services', async (c) => {
  const finnhubKey = c.env.FINNHUB_API_KEY;
  const geminiKey = c.env.GEMINI_API_KEY;
  const resendKey = c.env.RESEND_API_KEY;

  const results = {
    finnhub: { status: 'operational', description: 'Finnhub API is operational' },
    gemini: { status: 'operational', description: 'Gemini API is operational' },
    resend: { status: 'operational', description: 'Resend API is operational' }
  };

  // 1. Finnhub Check
  if (!finnhubKey) {
    results.finnhub = { status: 'not_configured', description: 'FINNHUB_API_KEY is not configured in backend secrets' };
  } else {
    try {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${finnhubKey}`);
      if (!res.ok) {
        results.finnhub = { status: 'failure', description: `Finnhub returned HTTP ${res.status}` };
      }
    } catch (err: any) {
      results.finnhub = { status: 'failure', description: `Finnhub is unreachable: ${err.message || err}` };
    }
  }

  // 2. Gemini Check
  if (!geminiKey) {
    results.gemini = { status: 'not_configured', description: 'GEMINI_API_KEY is not configured in backend secrets' };
  } else {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'say ok' }] }]
        })
      });
      if (!res.ok) {
        results.gemini = { status: 'failure', description: `Gemini API returned HTTP ${res.status}` };
      }
    } catch (err: any) {
      results.gemini = { status: 'failure', description: `Gemini is unreachable: ${err.message || err}` };
    }
  }

  // 3. Resend Check
  if (!resendKey) {
    results.resend = { status: 'not_configured', description: 'RESEND_API_KEY is not configured in backend secrets' };
  } else {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        headers: {
          'Authorization': `Bearer ${resendKey}`
        }
      });
      if (res.status === 401) {
        results.resend = { status: 'failure', description: 'Invalid Resend API Key' };
      } else if (res.status >= 500) {
        results.resend = { status: 'degraded', description: `Resend API returned HTTP ${res.status}` };
      }
    } catch (err: any) {
      results.resend = { status: 'failure', description: `Resend is unreachable: ${err.message || err}` };
    }
  }

  return c.json(results);
});

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

app.use('/api/intelligence/*', authenticateUser);

import { 
  FirestoreClient, 
  FinnhubClient, 
  GeminiClient, 
  IntelligenceService 
} from './dispatch';

// 1. Get Canonical Company Intelligence
app.get('/api/intelligence/company', async (c) => {
  const symbol = c.req.query('symbol');
  const exchange = c.req.query('exchange') || 'NASDAQ';
  if (!symbol) {
    return c.json({ error: 'Symbol parameter is required' }, 400);
  }

  const projectId = c.env.FIREBASE_PROJECT_ID || 'business-os-dev';
  const finnhubKey = c.env.FINNHUB_API_KEY;
  const geminiKey = c.env.GEMINI_API_KEY;

  if (!finnhubKey) {
    return c.json({ error: 'Finnhub API key not configured on backend' }, 500);
  }

  const firestore = new FirestoreClient(projectId);
  const finnhub = new FinnhubClient(finnhubKey);
  const gemini = new GeminiClient(geminiKey || '');

  try {
    const key = `${symbol.toUpperCase()}:${exchange.toUpperCase()}`;
    let intel = await firestore.getCompanyIntelligence(symbol, exchange);
    
    // If not found or stale (> 7 days), regenerate
    const isStale = intel ? (Date.now() - new Date(intel.updatedAt).getTime() > 7 * 24 * 60 * 60 * 1000) : true;
    if (isStale) {
      console.log(`[Intelligence API] Company record for ${key} is missing or stale. Generating...`);
      intel = await IntelligenceService.generateCompanyIntelligence(symbol, exchange, finnhub, gemini);
      await firestore.saveCompanyIntelligence(intel);
    }

    return c.json(intel);
  } catch (err: any) {
    console.error(`[Intelligence API] Error fetching company intelligence:`, err);
    return c.json({ error: 'Failed to retrieve company intelligence', details: err.message }, 500);
  }
});

// 2. Recalculate Conviction Score for a Ticker
app.post('/api/intelligence/recalculate-conviction', async (c) => {
  const userId = c.get('userId');
  const { ticker, exchange } = await c.req.json();
  if (!ticker) {
    return c.json({ error: 'Ticker is required' }, 400);
  }
  const ex = exchange || 'NASDAQ';

  const projectId = c.env.FIREBASE_PROJECT_ID || 'business-os-dev';
  const firestore = new FirestoreClient(projectId);

  try {
    // 1. Get canonical company intelligence
    let intel = await firestore.getCompanyIntelligence(ticker, ex);
    if (!intel) {
      const finnhubKey = c.env.FINNHUB_API_KEY;
      const geminiKey = c.env.GEMINI_API_KEY;
      if (!finnhubKey) throw new Error('Finnhub API key not configured');
      const finnhub = new FinnhubClient(finnhubKey);
      const gemini = new GeminiClient(geminiKey || '');
      intel = await IntelligenceService.generateCompanyIntelligence(ticker, ex, finnhub, gemini);
      await firestore.saveCompanyIntelligence(intel);
    }

    // 2. Fetch User Profile for Risk posture
    let riskProfile: 'conservative' | 'moderate' | 'aggressive' = 'moderate';
    try {
      const userProfileRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}`);
      if (userProfileRes.ok) {
        const userDoc = await userProfileRes.json() as any;
        const profile = userDoc.fields?.riskProfile?.stringValue;
        if (profile === 'conservative' || profile === 'moderate' || profile === 'aggressive') {
          riskProfile = profile;
        }
      }
    } catch (e) {
      console.warn('Failed to read user risk profile, defaulting to moderate', e);
    }

    // 3. Fetch holdings to get concentration weight
    const holdings = await firestore.getHoldings(userId);
    const targetHolding = holdings.find(h => h.ticker.toUpperCase() === ticker.toUpperCase());

    // Compute Conviction
    const conviction = IntelligenceService.calculateConviction(userId, intel, targetHolding || null, riskProfile);
    await firestore.saveUserConviction(conviction);

    return c.json(conviction);
  } catch (err: any) {
    console.error(`[Conviction API] Recalculation failed:`, err);
    return c.json({ error: 'Recalculation failed', details: err.message }, 500);
  }
});

// 3. Get all User Conviction Scores
app.get('/api/intelligence/convictions', async (c) => {
  const userId = c.get('userId');
  const projectId = c.env.FIREBASE_PROJECT_ID || 'business-os-dev';
  const firestore = new FirestoreClient(projectId);

  try {
    const list = await firestore.getAllUserConvictions(userId);
    return c.json(list);
  } catch (err: any) {
    console.error(`[Conviction API] Error listing convictions:`, err);
    return c.json({ error: 'Failed to retrieve convictions', details: err.message }, 500);
  }
});

// 4. Get Business School Concept Case Study
app.get('/api/intelligence/business-school/case', async (c) => {
  const conceptId = c.req.query('conceptId');
  const symbol = c.req.query('symbol');
  const exchange = c.req.query('exchange') || 'NASDAQ';

  if (!conceptId || !symbol) {
    return c.json({ error: 'conceptId and symbol parameters are required' }, 400);
  }

  const projectId = c.env.FIREBASE_PROJECT_ID || 'business-os-dev';
  const firestore = new FirestoreClient(projectId);

  const CONCEPTS: Record<string, { name: string; definition: string; equation: string }> = {
    operating_leverage: {
      name: 'Operating Leverage',
      definition: 'A measure of how revenue growth translates into growth in operating income based on the ratio of fixed vs variable costs.',
      equation: 'Operating Leverage = % Change in EBIT / % Change in Revenue'
    },
    economic_moats: {
      name: 'Economic Moats',
      definition: 'A business\'s ability to maintain a competitive advantage over its competitors to protect its long-term profits and market share.',
      equation: 'Moat Strength = High Return on Invested Capital (ROIC) vs Cost of Capital (WACC)'
    },
    free_cash_flow_margin: {
      name: 'Free Cash Flow Margin',
      definition: 'The percentage of revenue that a company converts into free cash flow, representing true deployable cash profits.',
      equation: 'FCF Margin = Free Cash Flow / Revenue'
    },
    financial_solvency: {
      name: 'Leverage & Financial Solvency',
      definition: 'Evaluating a company\'s debt burden relative to its equity capitalization to measure structural insolvency risk.',
      equation: 'Leverage Ratio = Total Debt / Total Equity'
    }
  };

  const concept = CONCEPTS[conceptId];
  if (!concept) {
    return c.json({ error: 'Unknown concept ID' }, 400);
  }

  try {
    let intel = await firestore.getCompanyIntelligence(symbol, exchange);
    if (!intel) {
      const finnhubKey = c.env.FINNHUB_API_KEY;
      const geminiKey = c.env.GEMINI_API_KEY;
      if (!finnhubKey) throw new Error('Finnhub API key not configured');
      const finnhub = new FinnhubClient(finnhubKey);
      const gemini = new GeminiClient(geminiKey || '');
      intel = await IntelligenceService.generateCompanyIntelligence(symbol, exchange, finnhub, gemini);
      await firestore.saveCompanyIntelligence(intel);
    }

    let dynamicNarrative = '';
    if (conceptId === 'operating_leverage') {
      const gm = intel.research.fundamentals?.grossMargin;
      const om = intel.research.fundamentals?.operatingMargin;
      const gmText = gm !== null && gm !== undefined ? `${gm.toFixed(1)}%` : 'strong';
      const omText = om !== null && om !== undefined ? `${om.toFixed(1)}%` : 'healthy';
      dynamicNarrative = `${intel.name} illustrates operating leverage in the ${intel.sector} sector. With a gross margin of ${gmText} and an operating margin of ${omText}, unit economics are highly favorable. As sales expand, fixed costs (such as research and development and infrastructure) remain stable, driving operating profits to expand much faster than top-line revenues.`;
    } else if (conceptId === 'economic_moats') {
      const roic = intel.research.fundamentals?.roic;
      const roicText = roic !== null && roic !== undefined ? `${roic.toFixed(1)}%` : 'strong';
      dynamicNarrative = `${intel.name}'s competitive advantage is evaluated as a "${intel.research.moatRating.toUpperCase()}" moat, backed by ROIC of ${roicText}. Qualitative assessment shows: ${intel.research.moatRationale}. High moat profiles allow companies to defend their profit margins against competitive duplication, leading to sustained high returns on capital.`;
    } else if (conceptId === 'free_cash_flow_margin') {
      const rg = intel.research.fundamentals?.revenueGrowthYoy;
      const eg = intel.research.fundamentals?.earningsGrowthYoy;
      const rgText = rg !== null && rg !== undefined ? `+${rg.toFixed(1)}% YoY` : 'steady growth';
      const egText = eg !== null && eg !== undefined ? `+${eg.toFixed(1)}% YoY` : 'steady expansion';
      dynamicNarrative = `${intel.name} converts revenue to deployable cash with a Free Cash Flow (FCF) margin of ${intel.research.freeCashFlowMargin.toFixed(1)}%, backed by YoY revenue growth of ${rgText} and earnings growth of ${egText}. This high conversion indicates low capital intensity, allowing ${intel.name} to self-fund expansion, pay down leverage, or return cash to owners.`;
    } else if (conceptId === 'financial_solvency') {
      const de = intel.research.fundamentals?.debtToEquity !== null && intel.research.fundamentals?.debtToEquity !== undefined 
        ? intel.research.fundamentals.debtToEquity 
        : intel.research.leverageRatio;
      dynamicNarrative = `Evaluating ${intel.name}'s balance sheet solvency showing a Debt/Equity ratio of ${de.toFixed(2)}. In general, leverage ratios below 0.50 indicate conservative capital structure and strong safety buffers. This profile reduces insolvency risks during macro rate-hiking cycles, assuring structural stability.`;
    }

    return c.json({
      conceptId,
      conceptName: concept.name,
      definition: concept.definition,
      equation: concept.equation,
      companyExample: symbol.toUpperCase(),
      companyName: intel.name,
      caseStudyNarrative: dynamicNarrative,
      updatedAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.error(`[Business School API] Error:`, err);
    return c.json({ error: 'Failed to compile case study', details: err.message }, 500);
  }
});

// Fallback route

app.all('*', (c) => {
  return c.json({ error: 'Endpoint not found' }, 404);
});

import { checkAndRunScheduled } from './dispatch';

export default {
  fetch: app.fetch,
  async scheduled(event: any, env: Bindings, ctx: any) {
    console.log('[Worker Cron] Triggered scheduled event:', event.cron);
    ctx.waitUntil(checkAndRunScheduled(env as any));
  }
};

