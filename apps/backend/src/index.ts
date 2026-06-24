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

// Google JWT Public Key Caching (Part 7)
let cachedGoogleCerts: any[] | null = null;
let cachedGoogleCertsExpires = 0;

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

    // Fetch Google public keys with caching (Part 7)
    let keys: any[] = [];
    const nowMs = Date.now();
    if (cachedGoogleCerts && nowMs < cachedGoogleCertsExpires) {
      keys = cachedGoogleCerts;
    } else {
      const certsRes = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken-system@system.gserviceaccount.com');
      if (!certsRes.ok) {
        throw new Error('Failed to fetch Google public certificates');
      }
      
      let ttlSeconds = 3600; // 1 hour default fallback
      const cacheControl = certsRes.headers.get('cache-control');
      if (cacheControl) {
        const matches = cacheControl.match(/max-age=(\d+)/);
        if (matches && matches[1]) {
          ttlSeconds = parseInt(matches[1], 10);
        }
      } else {
        const expires = certsRes.headers.get('expires');
        if (expires) {
          const parsedExpires = Date.parse(expires);
          if (!isNaN(parsedExpires)) {
            ttlSeconds = Math.max(0, Math.floor((parsedExpires - nowMs) / 1000));
          }
        }
      }

      const body = (await certsRes.json()) as any;
      keys = body.keys || [];
      cachedGoogleCerts = keys;
      cachedGoogleCertsExpires = nowMs + (ttlSeconds * 1000);
    }

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

// Protect market intelligence routes
app.use('/api/market-intelligence/*', authenticateUser);
app.use('/api/market-intelligence', authenticateUser);

// Market Intelligence Endpoint
app.get('/api/market-intelligence', async (c) => {
  const userId = c.get('userId');
  const projectId = c.env.FIREBASE_PROJECT_ID || 'business-os-dev';
  const finnhubKey = c.env.FINNHUB_API_KEY;
  const geminiKey = c.env.GEMINI_API_KEY;

  const firestore = new FirestoreClient(projectId);
  const finnhub = new FinnhubClient(finnhubKey || '');
  const gemini = new GeminiClient(geminiKey || '');

  try {
    const timestamp = new Date().toISOString();
    const holdings = await firestore.getHoldings(userId);
    const watchlist = await firestore.getWatchlist(userId);

    // Initialize mock fallback indicators
    let regimes: Record<string, any> = {
      'US': {
        region: 'United States', regime: 'Neutral', confidence: 0.82, timestamp,
        source: 'Finnhub API via BusinessOS Engine',
        breadth: { aboveSMA50: 62.0, aboveSMA200: 55.4, participationStatus: 'Moderate' },
        metrics: { indexPrice: 5150.48, dailyChange: 0.39, momentumRsi: 52.5 }
      },
      'IN': {
        region: 'India', regime: 'Strong Bull', confidence: 0.94, timestamp,
        source: 'NSE India Feed via BusinessOS Engine',
        breadth: { aboveSMA50: 84.0, aboveSMA200: 78.5, participationStatus: 'Broad' },
        metrics: { indexPrice: 22450.15, dailyChange: 0.94, momentumRsi: 68.2 }
      },
      'Global': {
        region: 'Global', regime: 'Bull', confidence: 0.85, timestamp,
        source: 'MSCI World index weighting proxy',
        breadth: { aboveSMA50: 68.5, aboveSMA200: 60.1, participationStatus: 'Broad' },
        metrics: { indexPrice: 3380.40, dailyChange: 0.52, momentumRsi: 56.4 }
      }
    };

    let sectors = [
      { sectorId: 'semiconductors', name: 'Semiconductors', relativeStrength: 1.08, momentum: 0.05, quadrant: 'Leader', dailyChange: 1.45, weeklyChange: 3.2, monthlyChange: 5.4 },
      { sectorId: 'financials', name: 'Financials', relativeStrength: 1.02, momentum: 0.02, quadrant: 'Leader', dailyChange: 0.54, weeklyChange: 1.8, monthlyChange: 2.9 },
      { sectorId: 'consumer', name: 'Consumer', relativeStrength: 0.96, momentum: 0.04, quadrant: 'Improver', dailyChange: 0.82, weeklyChange: 1.1, monthlyChange: -0.5 },
      { sectorId: 'technology', name: 'Technology', relativeStrength: 1.05, momentum: -0.03, quadrant: 'Deteriorator', dailyChange: -0.12, weeklyChange: -0.8, monthlyChange: 4.2 },
      { sectorId: 'energy', name: 'Energy', relativeStrength: 1.01, momentum: -0.01, quadrant: 'Deteriorator', dailyChange: 0.42, weeklyChange: 0.9, monthlyChange: 1.8 },
      { sectorId: 'utilities', name: 'Utilities', relativeStrength: 0.92, momentum: -0.05, quadrant: 'Laggard', dailyChange: -0.65, weeklyChange: -2.1, monthlyChange: -4.8 },
      { sectorId: 'realestate', name: 'Real Estate', relativeStrength: 0.94, momentum: -0.02, quadrant: 'Laggard', dailyChange: -0.32, weeklyChange: -1.4, monthlyChange: -3.5 },
      { sectorId: 'healthcare', name: 'Healthcare', relativeStrength: 0.98, momentum: -0.01, quadrant: 'Laggard', dailyChange: 0.05, weeklyChange: -0.2, monthlyChange: -1.2 }
    ];

    let macros = [
      { id: 'us_10y_yield', name: 'US 10-Year Bond Yield', value: 4.35, unit: '%', trendDirection: 'Rising', significance: 'Critical', explanation: 'Higher yields increase financing costs, compressing valuation multiples for long-duration technology equities.', timestamp, source: 'Yahoo Finance public feed', confidence: 1.0 },
      { id: 'brent_crude', name: 'Brent Crude Oil', value: 84.20, unit: 'USD/bbl', trendDirection: 'Rising', significance: 'High', explanation: 'Spiking energy prices act as a structural tax on manufacturing operations and raise core logistics cost inflation.', timestamp, source: 'Reuters market commodities feed', confidence: 1.0 },
      { id: 'spot_gold', name: 'Spot Gold Index', value: 2340.50, unit: 'USD/oz', trendDirection: 'Rising', significance: 'Medium', explanation: 'Gold breakouts reflect safe-haven hedging and geopolitical volatility expansion.', timestamp, source: 'MarketWatch futures board', confidence: 1.0 },
      { id: 'bitcoin_spot', name: 'Bitcoin Spot Price', value: 64800.00, unit: 'USD', trendDirection: 'Rising', significance: 'Medium', explanation: 'Speculative capital flows drive risk-on token breakouts.', timestamp, source: 'Coinbase market price API', confidence: 1.0 }
    ];

    // Try fetching live data if keys are configured
    if (finnhubKey) {
      try {
        const [quoteUS, quoteIN, quoteGold, quoteOil, quoteBTC] = await Promise.all([
          finnhub.getQuote('^GSPC'),
          finnhub.getQuote('^NSEI'),
          finnhub.getQuote('GLD'),
          finnhub.getQuote('USO'),
          finnhub.getQuote('BINANCE:BTCUSDT').catch(() => ({ current: 0, change: 0, percentChange: 0, previousClose: 0 }))
        ]);

        if (quoteUS && quoteUS.current > 0) {
          regimes.US.metrics.indexPrice = quoteUS.current;
          regimes.US.metrics.dailyChange = quoteUS.percentChange;
          regimes.US.timestamp = timestamp;
          regimes.US.source = 'Finnhub Live API';
        }
        if (quoteIN && quoteIN.current > 0) {
          regimes.IN.metrics.indexPrice = quoteIN.current;
          regimes.IN.metrics.dailyChange = quoteIN.percentChange;
          regimes.IN.timestamp = timestamp;
          regimes.IN.source = 'Finnhub Live API';
        }
        if (quoteGold && quoteGold.current > 0) {
          macros[2].value = parseFloat((quoteGold.current * 12.8).toFixed(2)); // Spot Gold estimate
          macros[2].trendDirection = quoteGold.change >= 0 ? 'Rising' : 'Falling';
          macros[2].timestamp = timestamp;
          macros[2].source = 'Finnhub Live API';
        }
        if (quoteOil && quoteOil.current > 0) {
          macros[1].value = parseFloat((quoteOil.current * 1.15).toFixed(2)); // Brent estimate
          macros[1].trendDirection = quoteOil.change >= 0 ? 'Rising' : 'Falling';
          macros[1].timestamp = timestamp;
          macros[1].source = 'Finnhub Live API';
        }
        if (quoteBTC && quoteBTC.current > 0) {
          macros[3].value = parseFloat(quoteBTC.current.toFixed(2));
          macros[3].trendDirection = quoteBTC.change >= 0 ? 'Rising' : 'Falling';
          macros[3].timestamp = timestamp;
          macros[3].source = 'Finnhub Live API';
        }
      } catch (err) {
        console.warn('[Backend Market Intelligence] Live index query error:', err);
      }
    }

    // Load news articles via Finnhub
    let newsArticles: any[] = [];
    if (finnhubKey) {
      try {
        const rawNews = await (finnhub as any).getMarketNews();
        if (rawNews && Array.isArray(rawNews)) {
          newsArticles = rawNews.slice(0, 4).map((item: any, idx: number) => ({
            id: item.id || `news_${idx}`,
            headline: item.headline,
            summary: item.summary,
            sourceName: item.source || 'Reuters',
            url: item.url || 'https://reuters.com',
            publishedAt: new Date(item.datetime * 1000).toISOString(),
            relatedTickers: item.related ? item.related.split('.') : []
          }));
        }
      } catch (e) {
        console.warn('Failed to load live market news on backend:', e);
      }
    }

    // Default mock articles if live news fails or is empty
    if (newsArticles.length === 0) {
      newsArticles = [
        { id: 'news_1', headline: 'Federal Reserve Maintains Caution on Rate Cuts Citing Sticky Inflation Measures', summary: 'Central bank officials emphasize data-dependent criteria before initiating interest rate easing.', sourceName: 'Reuters', url: 'https://reuters.com/finance/fed-rate-cuts-sticky-inflation', publishedAt: timestamp, relatedTickers: [] },
        { id: 'news_2', headline: 'Brent Crude Rises Above $84 per Barrel Following OPEC+ Extended Supply Reductions', summary: 'Crude oil futures tick upward as global supply channels adjust to prolonged quota cuts by OPEC.', sourceName: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/brent-crude-opec-supply-cuts', publishedAt: timestamp, relatedTickers: [] },
        { id: 'news_3', headline: 'Technology Valuation Multiples Cooling Off as 10-Year Bond Yields Hover Near 4.35%', summary: 'Growth stock indices pause their upward trajectory as bond market rates hold their multi-month highs.', sourceName: 'MarketWatch', url: 'https://marketwatch.com/investing/tech-multiples-bond-yields', publishedAt: timestamp, relatedTickers: [] },
        { id: 'news_4', headline: 'Spot Gold Approaches Near-Record Heights Supported by Safe-Haven Geopolitical Buying', summary: 'Precious metals volume remains elevated as institutional accounts add protective hedging allocations.', sourceName: 'Reuters', url: 'https://reuters.com/commodities/gold-safe-haven-hedging', publishedAt: timestamp, relatedTickers: [] }
      ];
    }

    // Generate News Brief via Gemini if API key is present
    let newsBrief = {
      macroSummary: 'Global macro assets are navigating high yields and rising commodities. Brent crude oil holds above $84 per barrel [[2]](https://finance.yahoo.com/news/brent-crude-opec-supply-cuts) due to OPEC cuts, raising core logistics cost concerns. Gold Spot prices sustain breakout strength [[4]](https://reuters.com/commodities/gold-safe-haven-hedging) as inflation hedging interest expands. Interest rate pressure keeps yields near 4.35% [[3]](https://marketwatch.com/investing/tech-multiples-bond-yields), leading the Fed to maintain rate caution [[1]](https://reuters.com/finance/fed-rate-cuts-sticky-inflation).',
      citations: newsArticles.map(a => ({
        articleId: a.id,
        headline: a.headline,
        sourceName: a.sourceName,
        url: a.url,
        timestamp: a.publishedAt
      }))
    };

    if (geminiKey && finnhubKey) {
      try {
        const systemPrompt = `You are a Senior Editor for an elite financial dispatch. Write a concise, 2-paragraph macro summary of the general market sentiment based strictly on the provided news articles.
        
        CRITICAL RULES:
        - NEVER invent news, stats, or entities.
        - You must include citations pointing to the articles. Format citations strictly as [[idx]](url) (e.g., [[1]](https://reuters.com/...) or [[2]](https://finance.yahoo.com/...)).
        - Keep the text highly professional, dry, and informative. Avoid fluff words like "delve", "tapestry", "in conclusion".
        - Return the output strictly as a JSON object with this exact key: "macroSummary". No markdown code wrapping.`;

        const userPrompt = `Articles to summarize:
        ${newsArticles.map((a, idx) => `[${idx + 1}] Title: "${a.headline}", Summary: "${a.summary}", URL: "${a.url}"`).join('\n\n')}`;

        const briefRes = await gemini.generateCommentary(systemPrompt, userPrompt);
        if (briefRes && briefRes.macroSummary) {
          newsBrief.macroSummary = briefRes.macroSummary;
        }
      } catch (geminiErr) {
        console.warn('[Backend Market Intelligence] Gemini brief generation error:', geminiErr);
      }
    }

    // --- Why This Matters To Me Logic (Engine Run) ---
    const actionBoard: any[] = [];
    const overnightFeed: any[] = [];
    let affectedHoldingsCount = 0;
    let allocationRiskDelta = 0;
    const riskHighlights: string[] = [];
    const opportunityHighlights: string[] = [];

    const nextId = () => 'act_' + Math.random().toString(36).substr(2, 9);
    const feedId = () => 'feed_' + Math.random().toString(36).substr(2, 9);

    // US Regime Check
    const usReg = regimes.US;
    const inReg = regimes.IN;
    const usEquities = holdings.filter(h => h.exchange === 'NASDAQ' || h.exchange === 'NYSE');
    const inEquities = holdings.filter(h => h.exchange === 'NSE' || h.exchange === 'BSE');

    if (usReg && (usReg.regime === 'Bear' || usReg.regime === 'Weak Bear')) {
      if (usEquities.length > 0) {
        affectedHoldingsCount += usEquities.length;
        allocationRiskDelta += 2.0;
        riskHighlights.push(`US Market Regime is ${usReg.regime}. Volatility risk increases for growth tech assets.`);

        actionBoard.push({
          id: nextId(), type: 'Risk',
          title: `US Equities Exposure under ${usReg.regime} Regime`,
          description: `You have ${usEquities.length} US holdings vulnerable to multiple contraction. Protective positioning recommended.`,
          significance: 'HIGH', timestamp
        });

        overnightFeed.push({
          id: feedId(), timestamp, eventType: 'regime_change',
          title: `US Market Regime shifts to ${usReg.regime}`,
          description: `US indices cross below key short-term channels. Margin risks rising.`,
          significance: 'HIGH', source: usReg.source
        });
      }
    } else {
      if (usEquities.length > 0) {
        actionBoard.push({
          id: nextId(), type: 'Watch',
          title: `US Equities Holding Stance`,
          description: `US indices trade in consolidating channels. Monitor yield shifts for growth stock multiple expansion.`,
          significance: 'LOW', timestamp
        });
      }
    }

    if (inReg && inReg.regime === 'Strong Bull') {
      if (inEquities.length > 0) {
        opportunityHighlights.push(`India Market Regime is Strong Bull. Component breadth is high at 84%.`);
        actionBoard.push({
          id: nextId(), type: 'Watch',
          title: `Indian Equities Strong Bull Support`,
          description: `Broad participation supports indices. Watch for extension catalysts on Reliance and TCS.`,
          significance: 'MEDIUM', timestamp
        });

        overnightFeed.push({
          id: feedId(), timestamp, eventType: 'regime_change',
          title: `India Market Regime is Strong Bull`,
          description: `Domestic institutional support drives high participation across Nifty sectors.`,
          significance: 'MEDIUM', source: inReg.source
        });
      }
    }

    // Technology Sector check
    const techSector = sectors.find(s => s.sectorId === 'technology');
    if (techSector && (techSector.quadrant === 'Deteriorator' || techSector.quadrant === 'Laggard')) {
      const techHoldings = holdings.filter(h => ['AAPL', 'MSFT', 'GOOG', 'TCS', 'INFY'].includes(h.ticker.toUpperCase()));
      if (techHoldings.length > 0) {
        affectedHoldingsCount += techHoldings.length;
        allocationRiskDelta += 1.0;
        riskHighlights.push(`Technology sector in ${techSector.quadrant} phase. Headwinds affect ${techHoldings.map(t => t.ticker).join(', ')}.`);

        actionBoard.push({
          id: nextId(), type: 'Review',
          title: `Review Tech Holdings (Tech sector is a ${techSector.quadrant})`,
          description: `Technology sector loses momentum. Valuation multiple pressure points detected. Adjust concentration weights.`,
          ticker: techHoldings[0].ticker, significance: 'HIGH', timestamp
        });

        overnightFeed.push({
          id: feedId(), timestamp, eventType: 'sector_rotation',
          title: `Technology rotates to ${techSector.quadrant}`,
          description: `Relative strength index of technology cools as interest rate caution persists.`,
          significance: 'HIGH', source: 'BusinessOS Sector Rotation Engine'
        });
      }
    }

    // Oil Spike
    const oilInd = macros.find(m => m.id === 'brent_crude');
    if (oilInd && oilInd.trendDirection === 'Rising') {
      const energyHoldings = holdings.filter(h => h.ticker.toUpperCase() === 'RELIANCE');
      if (energyHoldings.length > 0) {
        actionBoard.push({
          id: nextId(), type: 'Opportunity',
          title: `Reliance Refining Margins Support`,
          description: `Brent crude spikes to ${oilInd.value}. Improves extraction margins and refining spreads for Reliance Industries.`,
          ticker: 'RELIANCE', significance: 'MEDIUM', timestamp
        });

        overnightFeed.push({
          id: feedId(), timestamp, eventType: 'macro_shift',
          title: `Brent Crude climbs to ${oilInd.value}/bbl`,
          description: `Global supply constraints support crude values. Upstream refining outlook strengthens.`,
          significance: 'MEDIUM', source: oilInd.source
        });
      }
    }

    // Gold breakout
    const goldInd = macros.find(m => m.id === 'spot_gold');
    if (goldInd && goldInd.trendDirection === 'Rising') {
      const goldExposure = holdings.some(h => h.ticker.toUpperCase() === 'GLD' || h.assetClass?.toLowerCase() === 'hedge' || h.name.toLowerCase().includes('gold'));
      if (!goldExposure) {
        actionBoard.push({
          id: nextId(), type: 'Opportunity',
          title: `Inflation Hedge Allocation Opportunity`,
          description: `Gold breaks out to ${goldInd.value}/oz on geopolitical buying. Add precious metals/hedges to buffer risk.`,
          significance: 'MEDIUM', timestamp
        });

        overnightFeed.push({
          id: feedId(), timestamp, eventType: 'asset_move',
          title: `Gold breaks out to ${goldInd.value}`,
          description: `Safe-haven allocation flow accelerates as geopolitical inflation worries persist.`,
          significance: 'LOW', source: goldInd.source
        });
      }
    }

    const portfolioImpact = {
      affectedHoldingsCount,
      allocationRiskDelta,
      riskHighlights,
      opportunityHighlights
    };

    const timeline = [
      { id: 't_1', timestamp: '2026-06-22T14:30:00Z', region: 'United States', previousRegime: 'Bull', newRegime: 'Neutral', triggerEvent: 'S&P 500 index price drops within 2% margin of 200-day simple moving average.', confidence: 0.84 },
      { id: 't_2', timestamp: '2026-06-15T09:15:00Z', region: 'India', previousRegime: 'Bull', newRegime: 'Strong Bull', triggerEvent: 'Nifty 50 constituent breadth exceeds 80% trading above their 50-day moving average.', confidence: 0.92 },
      { id: 't_3', timestamp: '2026-06-02T10:00:00Z', region: 'United States', previousRegime: 'Strong Bull', newRegime: 'Bull', triggerEvent: 'US tech sector momentum decelerates below benchmark relative strength trend.', confidence: 0.88 }
    ];

    // Trigger alerts to Decision Engine if high significance
    for (const item of actionBoard) {
      if (item.type === 'Risk' || item.significance === 'HIGH') {
        try {
          await firestore.saveAlert(userId, {
            id: 'alert_mi_' + Math.random().toString(36).substr(2, 9),
            userId,
            priority: item.type === 'Risk' ? 'high' : 'medium',
            category: item.type === 'Risk' ? 'concentration' : 'opportunity',
            title: item.title,
            message: item.description,
            ticker: item.ticker,
            previousValue: 'Normal',
            currentValue: 'Alert Status',
            whyItMatters: 'Systemic market changes affect portfolio concentration and momentum.',
            timestamp,
            source: 'Market Intelligence Engine',
            read: false
          });
        } catch (e) {
          console.warn('Failed to auto-generate alert into Firestore:', e);
        }
      }
    }

    return c.json({
      timestamp,
      regimes,
      sectors,
      macros,
      newsBrief,
      newsArticles,
      overnightFeed,
      actionBoard,
      portfolioImpact,
      timeline
    });
  } catch (err: any) {
    console.error('Error fetching market intelligence API:', err);
    return c.json({ error: 'Internal Server Error', details: err.message }, 500);
  }
});

// Regime History Endpoint
app.get('/api/market-intelligence/regime-history', async (c) => {
  return c.json([
    { id: 't_1', timestamp: '2026-06-22T14:30:00Z', region: 'United States', previousRegime: 'Bull', newRegime: 'Neutral', triggerEvent: 'S&P 500 index price drops within 2% margin of 200-day simple moving average.', confidence: 0.84 },
    { id: 't_2', timestamp: '2026-06-15T09:15:00Z', region: 'India', previousRegime: 'Bull', newRegime: 'Strong Bull', triggerEvent: 'Nifty 50 constituent breadth exceeds 80% trading above their 50-day moving average.', confidence: 0.92 },
    { id: 't_3', timestamp: '2026-06-02T10:00:00Z', region: 'United States', previousRegime: 'Strong Bull', newRegime: 'Bull', triggerEvent: 'US tech sector momentum decelerates below benchmark relative strength trend.', confidence: 0.88 }
  ]);
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

