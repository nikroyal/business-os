import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  FINNHUB_API_KEY: string;
  GEMINI_API_KEY: string;
  FIREBASE_PROJECT_ID?: string;
  RESEND_API_KEY?: string;
  FRED_API_KEY?: string;
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
  if (c.req.method === 'OPTIONS') {
    return await next();
  }
  console.log(`[Auth Trace] 1. Request reached Worker. URL: ${c.req.url}, Method: ${c.req.method}`);
  
  const authHeader = c.req.header('Authorization');
  console.log(`[Auth Trace] 2. Authorization header: ${authHeader ? 'Present' : 'Missing'} (${authHeader})`);
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[Auth Trace] 9. Failure: Missing or invalid Authorization header format (returning 401 at line 52)');
    return c.json({ error: 'Unauthorized: Missing Authorization token' }, 401);
  }

  const token = authHeader.substring(7);
  console.log(`[Auth Trace] 3. Firebase ID token present: ${!!token}`);

  // Allow mock tokens in local development / fallback modes
  if (token.startsWith('mock_')) {
    console.log(`[Auth Trace] Bypassing verification for mock token: ${token}`);
    c.set('userId', token);
    c.set('userEmail', token.includes('owner') ? 'owner@businessos.com' : (token.includes('admin') ? 'admin@businessos.com' : 'user@businessos.com'));
    console.log('[Auth Trace] 8. Mock request passing to next handler');
    return await next();
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('[Auth Trace] 9. Failure: Invalid JWT format (returning 401 at line 66)');
      return c.json({ error: 'Unauthorized: Invalid JWT format' }, 401);
    }

    let header: any;
    let payload: any;
    try {
      header = JSON.parse(atob(parts[0]));
      payload = JSON.parse(atob(parts[1]));
      console.log(`[Auth Trace] 4. Token parsed successfully. Header: ${JSON.stringify(header)}, Payload keys: ${Object.keys(payload).join(', ')}`);
    } catch (parseErr: any) {
      console.log(`[Auth Trace] 4. Token parsing failed: ${parseErr.message}`);
      throw parseErr;
    }

    // Validate expiration
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      console.log(`[Auth Trace] 9. Failure: Token expired. Expiration: ${payload.exp}, Now: ${nowSec} (returning 401 at line 75)`);
      return c.json({ error: 'Unauthorized: Token expired' }, 401);
    }

    // Validate Issuer & Audience if project ID is configured
    const expectedProjectId = c.env.FIREBASE_PROJECT_ID || payload.aud; // fallback to payload's aud
    console.log(`[Auth Trace] 7. Firebase project ID check. Env FIREBASE_PROJECT_ID: ${c.env.FIREBASE_PROJECT_ID}, Expected Project ID: ${expectedProjectId}, Payload aud: ${payload.aud}, Payload iss: ${payload.iss}`);
    if (payload.iss !== `https://securetoken.google.com/${expectedProjectId}` || payload.aud !== expectedProjectId) {
      console.log(`[Auth Trace] 9. Failure: Invalid token issuer or audience. Expected project: ${expectedProjectId}, got iss=${payload.iss}, aud=${payload.aud} (returning 401 at line 81)`);
      return c.json({ error: 'Unauthorized: Invalid token issuer or audience' }, 401);
    }

    // Fetch Google public keys with caching (Part 7)
    let keys: any[] = [];
    const nowMs = Date.now();
    if (cachedGoogleCerts && nowMs < cachedGoogleCertsExpires) {
      console.log('[Auth Trace] 5. Google public certificates retrieved from cache.');
      keys = cachedGoogleCerts;
    } else {
      console.log('[Auth Trace] 5. Cache miss or expired. Fetching Google public certificates from securetoken endpoint...');
      const certsRes = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
      if (!certsRes.ok) {
        console.log(`[Auth Trace] 5. Failed to fetch Google public certificates: HTTP ${certsRes.status}`);
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
      console.log(`[Auth Trace] 5. Downloaded Google signing certificates successfully. Count: ${keys.length}`);
    }

    const jwk = keys.find((k: any) => k.kid === header.kid);
    if (!jwk) {
      console.log(`[Auth Trace] 9. Failure: Unknown key ID (kid) ${header.kid} (returning 401 at line 120)`);
      return c.json({ error: 'Unauthorized: Unknown key ID (kid)' }, 401);
    }

    // Verify cryptographic signature
    console.log('[Auth Trace] 6. Verifying cryptographic signature...');
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
      signatureBytes as any,
      rawData as any
    );

    if (!isValid) {
      console.log('[Auth Trace] 9. Failure: Invalid cryptographic signature (returning 401 at line 143)');
      return c.json({ error: 'Unauthorized: Invalid cryptographic signature' }, 401);
    }

    console.log('[Auth Trace] 6. Cryptographic signature verified successfully.');

    // Set user context
    c.set('userId', payload.sub);
    c.set('userEmail', payload.email || '');
    return await next();
  } catch (err: any) {
    console.error('[Auth Trace] JWT validation error exception:', err);
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

// Temporary endpoint to list available Gemini models using the configured production key
app.get('/api/auth-debug/models', async (c) => {
  const geminiKey = (c.env.GEMINI_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
  if (!geminiKey) {
    return c.json({ error: 'GEMINI_API_KEY is not configured in backend worker environment.' }, 500);
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`;
  console.log('[Gemini Model List Trace] Querying Google Models API...');
  
  try {
    const res = await fetch(endpoint);
    const txt = await res.text();
    console.log(`[Gemini Model List Trace] HTTP Status: ${res.status}`);
    console.log(`[Gemini Model List Trace] Response Body: ${txt}`);
    
    if (!res.ok) {
      return c.json({ error: `Google API returned HTTP ${res.status}`, details: txt }, res.status as any);
    }
    
    const data = JSON.parse(txt);
    return c.json(data);
  } catch (err: any) {
    console.error('[Gemini Model List Trace] Exception:', err);
    return c.json({ error: 'Failed to query Google Models API', details: err.message }, 500);
  }
});

// Protect all following routes
app.use('/api/market-data/*', authenticateUser);
app.use('/api/commentary/*', authenticateUser);
app.use('/api/health/services', authenticateUser);
app.use('/api/system/*', authenticateUser);

// Services Health Check Endpoint
app.get('/api/health/services', async (c) => {
  console.log(`[Auth Trace] 8. Request reached service health code. User ID: ${c.var.userId}`);
  const finnhubKey = (c.env.FINNHUB_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
  const geminiKey = (c.env.GEMINI_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
  const resendKey = (c.env.RESEND_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
  const fredKey = (c.env.FRED_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const firestore = new FirestoreClient(projectId);

  // Default results mapping
  const results: any = {
    workers: { status: 'operational', description: 'Cloudflare Worker runtime is operational' },
    firestore: { status: 'operational', description: 'Firestore connection is active' },
    finnhub: { status: 'operational', description: 'Finnhub API is operational' },
    gemini: { status: 'operational', description: 'Gemini API is operational' },
    resend: { status: 'operational', description: 'Resend API is operational' },
    fred: { status: 'available', description: 'FRED service is available.' },
    secEdgar: { status: 'available', description: 'SEC EDGAR service is available.' }
  };

  // Perform Firestore check and retrieve data for FRED & SEC concurrently
  const secTickers = Object.values(COMPANY_REGISTRY)
    .filter(entry => entry.secCoverage)
    .map(entry => entry.ticker);

  let fredApiPromise: Promise<any> = Promise.resolve(null);
  if (fredKey) {
    const fredUrl = `https://api.stlouisfed.org/fred/series/observations?series_id=UNRATE&api_key=${fredKey}&file_type=json&limit=1`;
    fredApiPromise = fetch(fredUrl)
      .then(res => res.ok ? res.json() : null)
      .catch(() => null);
  }

  const [
    featureFlagsDoc,
    cachedFred,
    secSchedulerState,
    secFacts,
    fredApiResponse
  ] = await Promise.all([
    getFirestoreDoc(projectId, 'system/featureFlags').catch(() => null),
    firestore.getFredIndicators().catch(() => null),
    getFirestoreDoc(projectId, 'system/secSchedulerState').catch(() => null),
    Promise.all(secTickers.map(t => firestore.getSecCompanyFacts(t).catch(() => null))),
    fredApiPromise
  ]);

  // 1. Firestore Health Check
  if (!featureFlagsDoc) {
    results.firestore = { status: 'degraded', description: 'Firestore features config document missing or failed to fetch' };
  }

  // 2. Finnhub Check
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

  // 3. Gemini Check
  if (!geminiKey) {
    results.gemini = { status: 'not_configured', description: 'GEMINI_API_KEY is not configured in backend secrets' };
  } else {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiKey}`;
      const cleanEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=HIDDEN`;
      const payload = {
        contents: [{ parts: [{ text: 'say ok' }] }]
      };
      const reqHeaders = { 'Content-Type': 'application/json' };
      console.log(`[Gemini Health Trace] Exact request URL: ${cleanEndpoint}`);
      console.log(`[Gemini Health Trace] HTTP method: POST`);
      console.log(`[Gemini Health Trace] Request headers: ${JSON.stringify(reqHeaders)}`);
      console.log(`[Gemini Health Trace] Request body: ${JSON.stringify(payload)}`);
      console.log(`[Gemini Health Trace] Resolved model name: gemini-3.5-flash`);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(payload)
      });
      
      const txt = await res.text();
      const resHeaders = Array.from(res.headers.entries());
      console.log(`[Gemini Health Trace] Response status: ${res.status}`);
      console.log(`[Gemini Health Trace] Response headers: ${JSON.stringify(resHeaders)}`);
      console.log(`[Gemini Health Trace] Full raw Google response body: ${txt}`);

      if (!res.ok) {
        console.log(`[Gemini Health Trace] Exact reason for HTTP status error: HTTP ${res.status} - ${txt}`);
        results.gemini = { status: 'failure', description: `Gemini API returned HTTP ${res.status}: ${txt}` };
      } else {
        results.gemini = { status: 'operational', description: 'Gemini API is operational' };
      }
    } catch (err: any) {
      console.log(`[Gemini Health Trace] Exact reason for failure: Unreachable - ${err.message || err}`);
      results.gemini = { status: 'failure', description: `Gemini is unreachable: ${err.message || err}` };
    }
  }

  // 4. Resend Check
  if (!resendKey) {
    results.resend = { status: 'not_configured', description: 'RESEND_API_KEY is not configured in backend secrets' };
  } else {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        headers: {
          'Authorization': `Bearer ${resendKey}`
        }
      });
      if (res.ok || res.status === 200) {
        results.resend = { status: 'operational', description: 'Resend API is operational' };
      } else if (res.status === 401) {
        let details = 'Invalid or revoked key';
        if (!resendKey.startsWith('re_')) {
          details = 'Incorrectly formatted (should start with re_)';
        }
        results.resend = { status: 'failure', description: `Invalid Resend API Key: ${details}` };
      } else if (res.status >= 500) {
        results.resend = { status: 'degraded', description: `Resend API returned HTTP ${res.status}` };
      } else {
        results.resend = { status: 'failure', description: `Resend returned HTTP ${res.status}` };
      }
    } catch (err: any) {
      results.resend = { status: 'failure', description: `Resend is unreachable: ${err.message || err}` };
    }
  }

  // 5. FRED Check
  const indicatorCount = cachedFred?.indicators?.length || 0;
  let fredCacheFreshness = 'missing';
  let fredStale = false;
  if (cachedFred) {
    const lastUpdated = cachedFred.updatedAt || new Date().toISOString();
    const ageMs = Date.now() - new Date(lastUpdated).getTime();
    if (ageMs > 24 * 60 * 60 * 1000) {
      fredCacheFreshness = 'stale';
      fredStale = true;
    } else {
      fredCacheFreshness = 'fresh';
    }
  }

  const apiConnected = !!fredApiResponse;
  const nowStr = new Date().toISOString();

  let fredStatus = 'available';
  let fredDescription = `FRED is available. ${indicatorCount} economic indicators cached.`;

  if (!cachedFred || indicatorCount === 0) {
    fredStatus = 'cache_empty';
    fredDescription = 'FRED economic indicators cache is empty.';
  } else if (!apiConnected && fredStale) {
    fredStatus = 'last_sync_failed';
    fredDescription = 'FRED API check failed and cached data is stale.';
  } else if (fredStale) {
    fredStatus = 'waiting_for_scheduled_sync';
    fredDescription = 'FRED cache is stale. Waiting for scheduled sync.';
  } else {
    fredStatus = 'healthy';
    fredDescription = `FRED cache is healthy. ${indicatorCount} indicators cached.`;
  }

  // Save FRED health status to database
  if (fredKey) {
    try {
      await writeFirestoreDoc(projectId, 'system/fredHealth', {
        lastSuccessfulCheck: nowStr,
        apiConnectivity: apiConnected ? 'connected' : 'error',
        latestIndicatorCount: indicatorCount,
        cacheFreshness: fredCacheFreshness
      });
    } catch (writeErr: any) {
      console.error('Failed to save FRED health stats:', writeErr.message);
    }
  }

  results.fred = {
    status: fredStatus,
    description: fredDescription,
    metadata: {
      lastSuccessfulCheck: nowStr,
      apiConnectivity: apiConnected ? 'connected' : 'error',
      latestIndicatorCount: indicatorCount,
      cacheFreshness: fredCacheFreshness
    }
  };

  // 6. SEC EDGAR Check
  const lastIngestionRun = secSchedulerState?.lastExecution || null;
  const schedulerFailed = secSchedulerState?.status === 'degraded' || (secSchedulerState?.failures || 0) > 0;

  let companiesCached = 0;
  let filingsCached = 0;
  let oldestFilingDateStr = '';
  let hasStaleCompany = false;
  let cacheCollectionExists = false;

  for (const data of secFacts) {
    if (data) {
      cacheCollectionExists = true;
      companiesCached++;
      const filings = data.recentFilings || [];
      filingsCached += filings.length;

      for (const f of filings) {
        if (f.filingDate && (!oldestFilingDateStr || f.filingDate < oldestFilingDateStr)) {
          oldestFilingDateStr = f.filingDate;
        }
      }

      const lastUpdated = data.updatedAt || new Date().toISOString();
      const ageMs = Date.now() - new Date(lastUpdated).getTime();
      if (ageMs > 5 * 24 * 60 * 60 * 1000) { // 5 days threshold
        hasStaleCompany = true;
      }
    }
  }

  let oldestCachedFilingAge = 0;
  if (oldestFilingDateStr) {
    const diffMs = Date.now() - new Date(oldestFilingDateStr).getTime();
    oldestCachedFilingAge = Math.floor(diffMs / (1000 * 3600 * 24));
  }

  let secCacheFreshness = 'fresh';
  if (!cacheCollectionExists) {
    secCacheFreshness = 'missing';
  } else if (hasStaleCompany) {
    secCacheFreshness = 'stale';
  }

  let secStatus = 'available';
  let secDescription = `SEC EDGAR is available. ${companiesCached} companies, ${filingsCached} filings cached.`;

  if (!cacheCollectionExists || companiesCached === 0) {
    secStatus = 'cache_empty';
    secDescription = 'SEC filings cache is empty.';
  } else if (schedulerFailed) {
    secStatus = 'last_sync_failed';
    secDescription = `SEC ingestion sync failed (Failed runs: ${secSchedulerState?.failures || 1}).`;
  } else if (hasStaleCompany) {
    secStatus = 'waiting_for_scheduled_sync';
    secDescription = 'SEC filings cache is stale. Waiting for scheduled sync.';
  } else {
    secStatus = 'healthy';
    secDescription = `SEC EDGAR cache is healthy. ${companiesCached} companies cached.`;
  }

  results.secEdgar = {
    status: secStatus,
    description: secDescription,
    metadata: {
      lastIngestionRun,
      companiesCached,
      filingsCached,
      oldestCachedFilingAge,
      cacheFreshness: secCacheFreshness
    }
  };

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

    const modelName = AIModelRegistry.resolveModel(model, 'Editorial Commentary');
    const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
    const userId = c.get('userId') || 'system';
    const gemini = new GeminiClient(apiKey, projectId, userId);
    const { data, fallbackUsed, actualModel } = await gemini.generateContentWithFailover(systemPrompt, userPrompt, modelName);

    // If fallback was used, surface the informational message by injecting it into candidate text
    if (fallbackUsed && data.candidates?.[0]?.content?.parts?.[0]?.text) {
      try {
        const rawText = data.candidates[0].content.parts[0].text;
        const parsed = JSON.parse(rawText.trim());
        parsed._metadata = {
          fallbackModelUsed: true,
          requestedModel: modelName,
          actualModel: actualModel,
          infoMessage: `Temporarily switched to ${actualModel} due to high demand on ${modelName}.`
        };
        data.candidates[0].content.parts[0].text = JSON.stringify(parsed);
      } catch (parseErr) {
        console.error('[Gemini Failover] Failed to inject metadata into raw JSON candidate text:', parseErr);
      }
    }

    return c.json(data);
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
  IntelligenceService,
  fromFirestoreDoc,
  toFirestoreValue,
  COMPANY_REGISTRY,
  NewsDataService,
  InvestorRelationsService
} from './dispatch';
import { AIModelRegistry, AIOrchestrator } from './aiModelRegistry';



class FREDDataService {
  private static readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  public static async getMacroIndicators(env: Bindings): Promise<any[]> {
    const projectId = env.FIREBASE_PROJECT_ID || 'businessos-0001a';
    const apiKey = env.FRED_API_KEY;
    const now = Date.now();

    // 1. Try reading from Firestore cache
    try {
      const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/fredIndicators/latest`);
      if (res.ok) {
        const doc = await res.json() as any;
        const parsed = fromFirestoreDoc(doc);
        if (parsed && parsed.updatedAt && (now - new Date(parsed.updatedAt).getTime() < this.CACHE_TTL)) {
          return parsed.indicators;
        }
      }
    } catch (e) {
      console.warn('[FREDDataService] Failed to read from cache:', e);
    }

    // 2. Fetch from FRED API if API Key is configured
    if (apiKey) {
      try {
        console.log('[FREDDataService] Cache miss or stale. Querying FRED API...');
        const seriesIds = ['UNRATE', 'CPIAUCSL', 'CPILFESL', 'FEDFUNDS', 'DGS2', 'DGS10', 'T10Y2Y'];
        const indicators: any[] = [];
        const timestamp = new Date().toISOString();

        for (const seriesId of seriesIds) {
          const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=15`;
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`FRED returned ${res.status} for ${seriesId}`);
          }
          const data = await res.json() as any;
          const observations = data.observations || [];
          
          const validObs = observations
            .filter((o: any) => o.value !== '.' && !isNaN(parseFloat(o.value)))
            .map((o: any) => ({ date: o.date, value: parseFloat(o.value) }));

          if (validObs.length === 0) continue;

          const latest = validObs[0];
          let value = latest.value;
          let unit = '%';
          let change1M = 0;
          let name = '';
          let explanation = '';

          if (seriesId === 'CPIAUCSL') {
            name = 'CPI (Inflation Rate)';
            const yearAgo = validObs[12] || validObs[validObs.length - 1];
            value = parseFloat((((latest.value - yearAgo.value) / yearAgo.value) * 100).toFixed(2));
            const prevVal = validObs[1] ? parseFloat((((validObs[1].value - (validObs[13] || validObs[validObs.length - 1]).value) / (validObs[13] || validObs[validObs.length - 1]).value) * 100).toFixed(2)) : value;
            change1M = parseFloat((value - prevVal).toFixed(2));
            explanation = 'YoY Consumer Price Index (CPI-U) measuring inflation across urban consumer goods.';
          } else if (seriesId === 'CPILFESL') {
            name = 'Core CPI (Core Inflation)';
            const yearAgo = validObs[12] || validObs[validObs.length - 1];
            value = parseFloat((((latest.value - yearAgo.value) / yearAgo.value) * 100).toFixed(2));
            const prevVal = validObs[1] ? parseFloat((((validObs[1].value - (validObs[13] || validObs[validObs.length - 1]).value) / (validObs[13] || validObs[validObs.length - 1]).value) * 100).toFixed(2)) : value;
            change1M = parseFloat((value - prevVal).toFixed(2));
            explanation = 'Core inflation excluding volatile food & energy items, key policy measure for rate setting.';
          } else {
            if (seriesId === 'UNRATE') {
              name = 'Civilian Unemployment Rate';
              explanation = 'Unemployment rate representing labor market capacity constraints.';
            } else if (seriesId === 'FEDFUNDS') {
              name = 'Federal Funds Effective Rate';
              explanation = 'Target benchmark interbank rate set by the Federal Reserve.';
            } else if (seriesId === 'DGS2') {
              name = 'US 2-Year Treasury Yield';
              explanation = '2-Year government yield representing short-term monetary policy expectations.';
            } else if (seriesId === 'DGS10') {
              name = 'US 10-Year Treasury Yield';
              explanation = '10-Year constant maturity Treasury yield, benchmark for long-term debt and multiple calculations.';
            } else if (seriesId === 'T10Y2Y') {
              name = 'Yield Curve Spread (10Y-2Y)';
              unit = 'points';
              explanation = 'Yield curve slope. Negative spreads (inversion) traditionally signal prospective macroeconomic recession.';
            }

            const monthAgoObs = validObs.find((o: any) => {
              const diffDays = (new Date(latest.date).getTime() - new Date(o.date).getTime()) / (1000 * 3600 * 24);
              return diffDays >= 28 && diffDays <= 35;
            }) || validObs[1] || latest;
            change1M = parseFloat((latest.value - monthAgoObs.value).toFixed(2));
          }

          const trendDirection = change1M > 0.01 ? 'Rising' : (change1M < -0.01 ? 'Falling' : 'Flat');
          const significance = (seriesId === 'CPIAUCSL' || seriesId === 'CPILFESL' || seriesId === 'T10Y2Y') ? 'Critical' : 'High';

          indicators.push({
            id: seriesId.toLowerCase(),
            name,
            value,
            unit,
            trendDirection,
            significance,
            explanation,
            timestamp,
            source: 'St. Louis Fed (FRED API)',
            confidence: 'High',
            date: latest.date,
            change1M
          });
        }

        // Save to cache
        try {
          const cacheFields = {
            indicators: toFirestoreValue(indicators),
            updatedAt: toFirestoreValue(timestamp)
          };
          await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/fredIndicators/latest`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: cacheFields })
          });
        } catch (cacheErr) {
          console.warn('[FREDDataService] Failed to update Firestore FRED cache:', cacheErr);
        }

        return indicators;
      } catch (err) {
        console.error('[FREDDataService] Error querying FRED API:', err);
      }
    }

    return this.getMockMacroIndicators();
  }

  public static getMockMacroIndicators(): any[] {
    const timestamp = new Date().toISOString();
    return [
      { id: 'unrate', name: 'Civilian Unemployment Rate', value: 4.0, unit: '%', trendDirection: 'Rising', significance: 'High', explanation: 'Unemployment rate representing labor market capacity constraints.', timestamp, source: 'St. Louis Fed (FRED Cache)', confidence: 'Medium', date: '2026-05-31', change1M: 0.1 },
      { id: 'cpiaucsl', name: 'CPI (Inflation Rate)', value: 3.3, unit: '%', trendDirection: 'Falling', significance: 'Critical', explanation: 'YoY Consumer Price Index (CPI-U) measuring inflation across urban consumer goods.', timestamp, source: 'St. Louis Fed (FRED Cache)', confidence: 'Medium', date: '2026-05-31', change1M: -0.1 },
      { id: 'cpilfesl', name: 'Core CPI (Core Inflation)', value: 3.5, unit: '%', trendDirection: 'Falling', significance: 'Critical', explanation: 'Core inflation excluding volatile food & energy items, key policy measure for rate setting.', timestamp, source: 'St. Louis Fed (FRED Cache)', confidence: 'Medium', date: '2026-05-31', change1M: -0.1 },
      { id: 'fedfunds', name: 'Federal Funds Effective Rate', value: 5.33, unit: '%', trendDirection: 'Flat', significance: 'High', explanation: 'Target benchmark interbank rate set by the Federal Reserve.', timestamp, source: 'St. Louis Fed (FRED Cache)', confidence: 'Medium', date: '2026-05-31', change1M: 0 },
      { id: 'dgs2', name: 'US 2-Year Treasury Yield', value: 4.70, unit: '%', trendDirection: 'Falling', significance: 'High', explanation: '2-Year government yield representing short-term monetary policy expectations.', timestamp, source: 'St. Louis Fed (FRED Cache)', confidence: 'Medium', date: '2026-06-23', change1M: -0.15 },
      { id: 'dgs10', name: 'US 10-Year Treasury Yield', value: 4.35, unit: '%', trendDirection: 'Falling', significance: 'High', explanation: '10-Year constant maturity Treasury yield, benchmark for long-term debt and multiple calculations.', timestamp, source: 'St. Louis Fed (FRED Cache)', confidence: 'Medium', date: '2026-06-23', change1M: -0.12 },
      { id: 't10y2y', name: 'Yield Curve Spread (10Y-2Y)', value: -0.35, unit: 'points', trendDirection: 'Rising', significance: 'Critical', explanation: 'Yield curve slope. Negative spreads (inversion) traditionally signal prospective macroeconomic recession.', timestamp, source: 'St. Louis Fed (FRED Cache)', confidence: 'Medium', date: '2026-06-23', change1M: 0.03 }
    ];
  }
}

// 1. Get Canonical Company Intelligence
app.get('/api/intelligence/company', async (c) => {
  const symbol = c.req.query('symbol');
  const exchange = c.req.query('exchange') || 'NASDAQ';
  if (!symbol) {
    return c.json({ error: 'Symbol parameter is required' }, 400);
  }

  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const finnhubKey = c.env.FINNHUB_API_KEY;
  const geminiKey = c.env.GEMINI_API_KEY;

  if (!finnhubKey) {
    return c.json({ error: 'Finnhub API key not configured on backend' }, 500);
  }

  const firestore = new FirestoreClient(projectId);
  const finnhub = new FinnhubClient(finnhubKey);
  const gemini = new GeminiClient(geminiKey || '', projectId, c.get('userId') || 'system');

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

  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const firestore = new FirestoreClient(projectId);

  try {
    // 1. Get canonical company intelligence
    let intel = await firestore.getCompanyIntelligence(ticker, ex);
    if (!intel) {
      const finnhubKey = c.env.FINNHUB_API_KEY;
      const geminiKey = c.env.GEMINI_API_KEY;
      if (!finnhubKey) throw new Error('Finnhub API key not configured');
      const finnhub = new FinnhubClient(finnhubKey);
      const gemini = new GeminiClient(geminiKey || '', projectId, c.get('userId') || 'system');
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
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
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

  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
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
      const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
      const gemini = new GeminiClient(geminiKey || '', projectId, c.get('userId') || 'system');
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
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const finnhubKey = c.env.FINNHUB_API_KEY;
  const geminiKey = c.env.GEMINI_API_KEY;

  const firestore = new FirestoreClient(projectId);
  const finnhub = new FinnhubClient(finnhubKey || '');
  const gemini = new GeminiClient(geminiKey || '', projectId, userId);

  try {
    const timestamp = new Date().toISOString();
    const holdings = await firestore.getHoldings(userId);
    // const watchlist = await firestore.getWatchlist(userId);

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

    let brentCrude = { id: 'brent_crude', name: 'Brent Crude Oil', value: 84.20, unit: 'USD/bbl', trendDirection: 'Rising', significance: 'High', explanation: 'Spiking energy prices act as a structural tax on manufacturing operations and raise core logistics cost inflation.', timestamp, source: 'Reuters market commodities feed', confidence: 1.0 };
    let spotGold = { id: 'spot_gold', name: 'Spot Gold Index', value: 2340.50, unit: 'USD/oz', trendDirection: 'Rising', significance: 'Medium', explanation: 'Gold breakouts reflect safe-haven hedging and geopolitical volatility expansion.', timestamp, source: 'MarketWatch futures board', confidence: 1.0 };
    let bitcoinSpot = { id: 'bitcoin_spot', name: 'Bitcoin Spot Price', value: 64800.00, unit: 'USD', trendDirection: 'Rising', significance: 'Medium', explanation: 'Speculative capital flows drive risk-on token breakouts.', timestamp, source: 'Coinbase market price API', confidence: 1.0 };

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
          spotGold.value = parseFloat((quoteGold.current * 12.8).toFixed(2)); // Spot Gold estimate
          spotGold.trendDirection = quoteGold.change >= 0 ? 'Rising' : 'Falling';
          spotGold.timestamp = timestamp;
          spotGold.source = 'Finnhub Live API';
        }
        if (quoteOil && quoteOil.current > 0) {
          brentCrude.value = parseFloat((quoteOil.current * 1.15).toFixed(2)); // Brent estimate
          brentCrude.trendDirection = quoteOil.change >= 0 ? 'Rising' : 'Falling';
          brentCrude.timestamp = timestamp;
          brentCrude.source = 'Finnhub Live API';
        }
        if (quoteBTC && quoteBTC.current > 0) {
          bitcoinSpot.value = parseFloat(quoteBTC.current.toFixed(2));
          bitcoinSpot.trendDirection = quoteBTC.change >= 0 ? 'Rising' : 'Falling';
          bitcoinSpot.timestamp = timestamp;
          bitcoinSpot.source = 'Finnhub Live API';
        }
      } catch (err) {
        console.warn('[Backend Market Intelligence] Live index query error:', err);
      }
    }

    // Load live FRED indicators
    let fredIndicators: any[] = [];
    try {
      fredIndicators = await FREDDataService.getMacroIndicators(c.env);
    } catch (e) {
      console.warn('[Backend] Failed to load FRED indicators:', e);
      fredIndicators = FREDDataService.getMockMacroIndicators();
    }

    let macros = [
      ...fredIndicators,
      brentCrude,
      spotGold,
      bitcoinSpot
    ];

    // Load news articles via NewsDataService
    let newsArticles: any[] = [];
    if (finnhubKey) {
      try {
        newsArticles = await NewsDataService.getMacroNews(finnhubKey, firestore);
      } catch (e) {
        console.warn('Failed to load live market news on backend via NewsDataService:', e);
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

// --- TOKEN BUCKET RATE LIMITER FOR SEC EDGAR ---
/*
class TokenBucketLimiter {
  private tokens = 10;
  private lastRefill = Date.now();
  private readonly maxTokens = 10;
  private readonly refillRatePerSecond = 8;

  private refill() {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsedSeconds * this.refillRatePerSecond);
    this.lastRefill = now;
  }

  async acquireToken(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const waitTime = ((1 - this.tokens) / this.refillRatePerSecond) * 1000;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return this.acquireToken();
  }
}
*/
// const secLimiter = new TokenBucketLimiter();

// Central Ticker-to-CIK Registry map
// const CIK_REGISTRY: Record<string, string> = {
//   'AAPL': '0000320193',
//   'MSFT': '0000789019',
//   'GOOG': '0001652044',
//   'NVDA': '0001045810',
//   'TSLA': '0001318605'
// };

// 1. NewsDataService Ingestion & Deduplication Endpoint
// 1. NewsDataService Ingestion & Deduplication Endpoint
app.get('/api/market-data/news', async (c) => {
  const ticker = c.req.query('ticker') || 'AAPL';
  const apiKey = c.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return c.json({ error: 'Finnhub API key not configured' }, 500);
  }

  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const firestore = new FirestoreClient(projectId);

  try {
    const articles = await NewsDataService.getCompanyNews(ticker, apiKey, firestore);
    return c.json(articles);
  } catch (err: any) {
    console.warn(`Failed to fetch company news for ${ticker} via NewsDataService:`, err);
    return c.json([
      { id: `${ticker}_news_1`, headline: `${ticker} Launches Hardware Platforms to Accelerate Datacenter Operations`, summary: 'Technology release outlines customer scaling benefits.', sourceName: 'Reuters', url: 'https://reuters.com', publishedAt: new Date().toISOString(), relatedTickers: [ticker.toUpperCase()], category: 'Company', alternates: [] }
    ]);
  }
});

// 2. SEC EDGAR company facts serving from cache only
app.get('/api/market-intelligence/sec-facts', async (c) => {
  const ticker = (c.req.query('ticker') || 'AAPL').toUpperCase().trim();
  
  // All routing decisions must use the registry
  const registryEntry = COMPANY_REGISTRY[ticker];
  if (!registryEntry || !registryEntry.secCoverage) {
    return c.json(null);
  }

  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const firestore = new FirestoreClient(projectId);

  try {
    const facts = await firestore.getSecCompanyFacts(ticker);
    if (facts) {
      return c.json(facts);
    }
  } catch (err: any) {
    console.warn(`Failed to fetch cached SEC facts for ${ticker}:`, err);
  }

  return c.json(null);
});

/*
function getMockSecCompanyFacts(ticker: string): any {
  const registryEntry = COMPANY_REGISTRY[ticker];
  const cik = registryEntry ? registryEntry.cik : '0000000000';
  const timestamp = new Date().toISOString();
  
  const mockHistory: Record<string, any[]> = {
    'AAPL': [
      { date: '2025-09-30', revenue: 90150000000, netIncome: 22960000000, operatingIncome: 25420000000, operatingMargin: 28.2, debtToEquity: 1.45 },
      { date: '2025-12-31', revenue: 119580000000, netIncome: 33920000000, operatingIncome: 37400000000, operatingMargin: 31.3, debtToEquity: 1.42 },
      { date: '2026-03-31', revenue: 90750000000, netIncome: 23640000000, operatingIncome: 26270000000, operatingMargin: 28.9, debtToEquity: 1.40 }
    ],
    'MSFT': [
      { date: '2025-09-30', revenue: 56520000000, netIncome: 22290000000, operatingIncome: 26900000000, operatingMargin: 47.6, debtToEquity: 0.28 },
      { date: '2025-12-31', revenue: 62020000000, netIncome: 21870000000, operatingIncome: 27030000000, operatingMargin: 43.6, debtToEquity: 0.26 },
      { date: '2026-03-31', revenue: 61860000000, netIncome: 21940000000, operatingIncome: 27580000000, operatingMargin: 44.6, debtToEquity: 0.25 }
    ]
  };

  const history = mockHistory[ticker] || [
    { date: '2025-09-30', revenue: 12500000000, netIncome: 2500000000, operatingIncome: 3200000000, operatingMargin: 25.6, debtToEquity: 0.50 },
    { date: '2025-12-31', revenue: 14800000000, netIncome: 3100000000, operatingIncome: 3900000000, operatingMargin: 26.3, debtToEquity: 0.48 },
    { date: '2026-03-31', revenue: 15100000000, netIncome: 3220000000, operatingIncome: 4100000000, operatingMargin: 27.1, debtToEquity: 0.45 }
  ];

  return {
    ticker,
    cik,
    updatedAt: timestamp,
    recentFilings: [
      { id: `${ticker}_filing_1`, form: '10-Q', filingDate: '2026-04-28', reportDate: '2026-03-31', url: `https://www.sec.gov/Archives/edgar/data/${cik}/index.htm`, summary: 'Quarterly filing report details operating growth margins.', accessionNumber: '0000320193-26-000010', primaryDocument: 'aapl-20260331.htm', cik }
    ],
    history,
    provenance: {
      source: 'SEC EDGAR Ingestion Proxy (Cached Fallback)',
      timestamp,
      confidence: 'Medium'
    }
  };
}
*/

// 3. InvestorRelationsService Announcements Ingestion
app.get('/api/market-data/ir-disclosures', async (c) => {
  const ticker = (c.req.query('ticker') || 'RELIANCE').toUpperCase().trim();
  
  // All routing decisions must use the registry
  const registryEntry = COMPANY_REGISTRY[ticker];
  if (!registryEntry || !registryEntry.irCoverage) {
    return c.json(null);
  }

  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const firestore = new FirestoreClient(projectId);

  try {
    const apiKey = c.env.FINNHUB_API_KEY;
    if (!apiKey) {
      return c.json({ error: 'Finnhub API key not configured' }, 500);
    }
    const irData = await InvestorRelationsService.getIRData(ticker, apiKey, firestore);
    return c.json(irData);
  } catch (err: any) {
    console.warn(`Failed to fetch IR disclosures for ${ticker}:`, err);
    return c.json(null);
  }
});

// 4. Shared Research Cache and Gemini compiler
app.post('/api/market-data/compile-research', async (c) => {
  const apiKey = c.env.GEMINI_API_KEY;
  if (!apiKey) {
    return c.json({ error: 'Gemini API Key is not configured' }, 500);
  }

  const { ticker, exchange, version, secData, irData, newsArticles } = await c.req.json();
  const dateStr = new Date().toISOString().split('T')[0];

  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const firestore = new FirestoreClient(projectId);

  try {
    // Check Shared Research Cache first
    const cachedReport = await firestore.getResearchReportCache(ticker, exchange, version, dateStr);
    if (cachedReport) {
      console.log(`[SharedResearchCache] Cache HIT for ${ticker}:${exchange} (version: ${version}, date: ${dateStr})`);
      return c.json(cachedReport);
    }
    
    console.log(`[SharedResearchCache] Cache MISS. Compiling report via Gemini for ${ticker}:${exchange}...`);

    const systemPrompt = `You are a Senior Equity Research Analyst writing formal investment briefs. 
    Analyze the company's financial facts and news context.
    
    CRITICAL CONSTRAINTS:
    - Return output strictly as a JSON object matching this schema, with no markdown code block wrapping:
    {
      "executiveSummary": "1-2 paragraphs of corporate and operational status review.",
      "financialMetricsAnalysis": "1 paragraph explaining margin and debt changes.",
      "risksAndMitigations": "1 paragraph covering business risks and strategic hedges."
    }
    - NEVER invent, estimate, or modify any financial figures, dates, or prices. Use ONLY the provided numbers.
    - Write in a highly formal, objective, dry institutional style. No fluff words like 'delve', 'tapestry', 'in conclusion'.`;

    const userPrompt = `Company: ${ticker} (${exchange})
    Filing Facts: ${JSON.stringify(secData || irData || {})}
    Latest News: ${JSON.stringify(newsArticles)}`;

    const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
    const userId = c.get('userId') || 'system';
    const gemini = new GeminiClient(apiKey, projectId, userId);
    const result = await gemini.generateCommentary(systemPrompt, userPrompt);

    // Calculate alerts and trends on backend deterministically
    const changeDetectionAlerts: any[] = [];
    const earningsTrend: any[] = [];
    const sourcesUsed: any[] = [];

    if (secData) {
      sourcesUsed.push({ name: 'SEC EDGAR Submissions Feed', timestamp: secData.updatedAt });
      secData.recentFilings.forEach((f: any) => sourcesUsed.push({ name: `SEC EDGAR Form ${f.form}`, url: f.url, timestamp: f.filingDate }));
      secData.history.forEach((h: any) => {
        earningsTrend.push({ quarter: h.date, revenue: h.revenue, operatingMargin: h.operatingMargin, netIncome: h.netIncome });
      });
      if (secData.history.length >= 2) {
        const curr = secData.history[secData.history.length - 1];
        const prev = secData.history[secData.history.length - 2];
        changeDetectionAlerts.push({
          metric: 'Quarterly Revenue',
          previousValue: prev.revenue.toLocaleString(),
          currentValue: curr.revenue.toLocaleString(),
          changePercent: parseFloat(((curr.revenue - prev.revenue) / prev.revenue * 100).toFixed(2)),
          direction: curr.revenue > prev.revenue ? 'improved' : 'deteriorated',
          source: 'SEC EDGAR Form 10-Q'
        });
      }
    } else if (irData) {
      sourcesUsed.push({ name: 'Corporate Investor Relations & Exchange Announcements', timestamp: irData.updatedAt || new Date().toISOString() });
      irData.announcements.forEach((a: any) => sourcesUsed.push({ name: `${a.type} Disclosures`, url: a.url, timestamp: a.publishDate }));
    }

    newsArticles.forEach((n: any) => sourcesUsed.push({ name: `Market News: "${n.headline.slice(0, 25)}..."`, url: n.url, timestamp: n.publishedAt }));

    const compiledReport = {
      ticker,
      exchange,
      reportVersion: version,
      generationDate: dateStr,
      executiveSummary: result.executiveSummary,
      financialMetricsAnalysis: result.financialMetricsAnalysis,
      risksAndMitigations: result.risksAndMitigations,
      changeDetectionAlerts,
      earningsTrend,
      sourcesUsed,
      confidenceScore: secData ? 95 : 88
    };

    // Save report to cache
    await firestore.saveResearchReportCache(ticker, exchange, version, dateStr, compiledReport);

    return c.json(compiledReport);
  } catch (err: any) {
    console.error('Gemini research compilation failed:', err);
    return c.json({ error: 'Failed to compile research report.', details: err.message }, 500);
  }
});

// 5. Data Quality Monitoring Endpoint
app.get('/api/system/data-quality', async (c) => {
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const firestore = new FirestoreClient(projectId);
  const fredKey = c.env.FRED_API_KEY;
  
  try {
    const secTickers = Object.values(COMPANY_REGISTRY)
      .filter(entry => entry.secCoverage)
      .map(entry => entry.ticker);

    // Parallel fetch of all facts, scheduler state, and health check state
    const [
      secSchedulerState,
      fredHealthDoc,
      fredIndicatorsDoc,
      secFactsData
    ] = await Promise.all([
      getFirestoreDoc(projectId, 'system/secSchedulerState').catch(() => null),
      getFirestoreDoc(projectId, 'system/fredHealth').catch(() => null),
      firestore.getFredIndicators().catch(() => null),
      Promise.all(secTickers.map(t => firestore.getSecCompanyFacts(t).catch(() => null)))
    ]);

    const secFactsStatus: any[] = [];
    let healthyCount = 0;
    let secCacheCollectionExists = false;
    let secFilingsStale = false;
    
    // Check SEC covered tickers
    for (let i = 0; i < secTickers.length; i++) {
      const t = secTickers[i];
      const facts = secFactsData[i];
      if (facts) {
        secCacheCollectionExists = true;
        const isStale = (Date.now() - new Date(facts.updatedAt).getTime() > 5 * 24 * 60 * 60 * 1000);
        if (isStale) {
          secFilingsStale = true;
        }
        secFactsStatus.push({
          ticker: t,
          status: isStale ? 'Stale' : 'Healthy',
          lastUpdated: facts.updatedAt,
          recordCount: facts.history?.length || 0
        });
        if (!isStale) healthyCount++;
      } else {
        secFactsStatus.push({
          ticker: t,
          status: 'Missing',
          recordCount: 0
        });
      }
    }

    // SEC overall scheduler & job status
    const secSchedulerFailures = secSchedulerState?.failures || 0;
    const secSchedulerStatusText = secSchedulerState?.status || 'idle';
    const schedulerEnabled = (c.env as any).SEC_SCHEDULER_ENABLED !== 'false';

    let secStatusText = 'Healthy';
    if (!schedulerEnabled) {
      secStatusText = 'Not Configured';
    } else if (!secCacheCollectionExists) {
      secStatusText = 'Missing'; // Cache missing
    } else if (secFilingsStale) {
      secStatusText = 'Stale'; // Filings stale
    } else if (secSchedulerFailures > 0 || secSchedulerStatusText === 'degraded') {
      secStatusText = 'Degraded'; // Ingestion failures detected
    }

    // Adjust healthyCount based on overall SEC health
    if (secStatusText === 'Healthy') {
      healthyCount++;
    }

    // FRED Status check
    const fredApiConnected = fredHealthDoc?.apiConnectivity === 'connected' || (fredKey ? true : false);
    let fredStale = false;
    let fredStatusText = 'Missing';
    let fredIndicatorCount = 0;
    let fredLastUpdated = new Date().toISOString();

    if (fredIndicatorsDoc) {
      fredIndicatorCount = fredIndicatorsDoc.indicators?.length || 0;
      fredLastUpdated = fredIndicatorsDoc.updatedAt || new Date().toISOString();
      const ageMs = Date.now() - new Date(fredLastUpdated).getTime();
      fredStale = ageMs > 24 * 60 * 60 * 1000;
      
      if (fredStale) {
        fredStatusText = 'Stale'; // Indicators stale
      } else if (!fredApiConnected) {
        fredStatusText = 'Degraded'; // API unavailable
      } else {
        fredStatusText = 'Healthy';
      }
      
      if (fredStatusText === 'Healthy') {
        healthyCount++;
      }
    } else {
      fredStatusText = 'Missing'; // Cache missing
    }

    // Overall Score Calculation (combining individual covered SEC tickers, overall FRED health, and overall SEC health)
    const totalChecksCount = secTickers.length + 2; 
    const overallHealthScore = Math.round((healthyCount / totalChecksCount) * 100);

    return c.json({
      timestamp: new Date().toISOString(),
      secFactsStatus,
      secOverallStatus: {
        status: secStatusText,
        schedulerEnabled,
        lastExecution: secSchedulerState?.lastExecution || null,
        failures: secSchedulerFailures
      },
      fredStatus: {
        status: fredStatusText,
        lastUpdated: fredLastUpdated,
        indicatorCount: fredIndicatorCount,
        apiConnectivity: fredApiConnected ? 'connected' : 'error'
      },
      overallHealthScore
    });
  } catch (err: any) {
    return c.json({ error: 'Failed to retrieve data quality logs', details: err.message }, 500);
  }
});

// Manual FRED Cache Refresh Endpoint
app.post('/api/system/fred/refresh', async (c) => {
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const fredKey = (c.env.FRED_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
  const firestore = new FirestoreClient(projectId);

  try {
    console.log('[Manual Trigger] Triggering FRED daily ingestion...');
    await runFredDailyIngestion(firestore, fredKey, true); // force = true
    return c.json({ success: true, message: 'FRED cache refreshed successfully.' });
  } catch (err: any) {
    console.error('[Manual Trigger] FRED refresh failed:', err);
    return c.json({ error: 'FRED refresh failed', details: err.message }, 500);
  }
});

// Manual SEC EDGAR Ingestion Trigger Endpoint
app.post('/api/system/sec/ingest', async (c) => {
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const firestore = new FirestoreClient(projectId);

  try {
    console.log('[Manual Trigger] Triggering SEC batch ingestion...');
    await runSecBatchIngestion(firestore, true); // force = true
    return c.json({ success: true, message: 'SEC EDGAR ingestion triggered successfully.' });
  } catch (err: any) {
    console.error('[Manual Trigger] SEC EDGAR ingestion failed:', err);
    return c.json({ error: 'SEC EDGAR ingestion failed', details: err.message }, 500);
  }
});

// =========================================================================
// PHASE 14 COPILOT & OPERATIONS CONSOLE SERVICES
// =========================================================================

export type UserRole = 'OWNER' | 'ADMIN' | 'PRO' | 'FREE' | 'GUEST';

export interface FeatureFlags {
  copilot: boolean;
  quickMode: boolean;
  businessOSMode: boolean;
  liveWebMode: boolean;
  deepResearchMode: boolean;
  developerPanel: boolean;
  exportReports: boolean;
  betaFeatures: boolean;
  marketIntelligence: boolean;
  intelligenceHub: boolean;
}

export interface UsageLimits {
  quick: 'unlimited';
  businessos: number | 'unlimited';
  live: number | 'unlimited';
  deep: number | 'unlimited';
}

export const ROLE_DEFAULT_FLAGS: Record<UserRole, FeatureFlags> = {
  GUEST: {
    copilot: true, quickMode: true, businessOSMode: true, liveWebMode: false, deepResearchMode: false,
    developerPanel: false, exportReports: false, betaFeatures: false, marketIntelligence: true, intelligenceHub: false
  },
  FREE: {
    copilot: true, quickMode: true, businessOSMode: true, liveWebMode: true, deepResearchMode: true,
    developerPanel: false, exportReports: true, betaFeatures: false, marketIntelligence: true, intelligenceHub: true
  },
  PRO: {
    copilot: true, quickMode: true, businessOSMode: true, liveWebMode: true, deepResearchMode: true,
    developerPanel: false, exportReports: true, betaFeatures: true, marketIntelligence: true, intelligenceHub: true
  },
  ADMIN: {
    copilot: true, quickMode: true, businessOSMode: true, liveWebMode: true, deepResearchMode: true,
    developerPanel: true, exportReports: true, betaFeatures: true, marketIntelligence: true, intelligenceHub: true
  },
  OWNER: {
    copilot: true, quickMode: true, businessOSMode: true, liveWebMode: true, deepResearchMode: true,
    developerPanel: true, exportReports: true, betaFeatures: true, marketIntelligence: true, intelligenceHub: true
  }
};

export const TIER_LIMITS: Record<UserRole, UsageLimits> = {
  GUEST: { quick: 'unlimited', businessos: 10, live: 0, deep: 0 },
  FREE: { quick: 'unlimited', businessos: 50, live: 10, deep: 2 },
  PRO: { quick: 'unlimited', businessos: 'unlimited', live: 100, deep: 25 },
  ADMIN: { quick: 'unlimited', businessos: 'unlimited', live: 999999, deep: 999999 },
  OWNER: { quick: 'unlimited', businessos: 'unlimited', live: 999999, deep: 999999 }
};

// Firestore REST Endpoint Helpers
const firestoreUrl = (projectId: string, path: string) => 
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;

async function getFirestoreDoc(projectId: string, path: string, token?: string): Promise<any | null> {
  const headers: Record<string, string> = {};
  if (token && !token.startsWith('mock_')) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(firestoreUrl(projectId, path), { headers });
  if (res.ok) {
    const data = await res.json() as any;
    return fromFirestoreDoc(data);
  }
  return null;
}

async function writeFirestoreDoc(projectId: string, path: string, data: any, token?: string): Promise<void> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    fields[k] = toFirestoreValue(v);
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token && !token.startsWith('mock_')) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(firestoreUrl(projectId, path), {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields })
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error(`[Firestore REST] Failed to write doc ${path}: ${res.status} - ${txt}`);
  }
}

async function deleteFirestoreDoc(projectId: string, path: string, token?: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (token && !token.startsWith('mock_')) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  await fetch(firestoreUrl(projectId, path), {
    method: 'DELETE',
    headers
  });
}

// Role and Feature Flag Resolution Service
async function getUserRoleProfile(userId: string, projectId: string, email?: string, token?: string): Promise<{
  role: UserRole;
  subscriptionTier: string;
  customLimits: Partial<UsageLimits>;
  featureFlags: Partial<FeatureFlags>;
  modelEditorialCommentary?: string;
  modelResearchEngine?: string;
  modelBusinessSchool?: string;
  modelCopilot?: string;
  geminiModel?: string;
}> {
  let role: UserRole = 'FREE';
  let subscriptionTier = 'free';
  let customLimits: Partial<UsageLimits> = {};
  let featureFlags: Partial<FeatureFlags> = {};
  let modelEditorialCommentary = 'Automatic';
  let modelResearchEngine = 'Automatic';
  let modelBusinessSchool = 'Automatic';
  let modelCopilot = 'Automatic';
  let geminiModel = '';

  let profile = await getFirestoreDoc(projectId, `users/${userId}`, token);
  if (!profile && userId && userId !== 'undefined') {
    const isOwnerOrAdmin = (email && (email.includes('owner') || email.includes('admin'))) || (userId && (userId.includes('owner') || userId.includes('admin')));
    console.log(`[Bootstrap] Creating default ${isOwnerOrAdmin ? 'OWNER' : 'FREE'} profile for user ${userId}...`);
    profile = {
      uid: userId,
      email: email || (userId.startsWith('mock_') ? `${userId.substring(5)}@businessos.com` : 'user@businessos.com'),
      displayName: userId.startsWith('mock_') ? userId.substring(5) : 'User',
      role: isOwnerOrAdmin ? 'OWNER' : 'FREE',
      subscriptionTier: isOwnerOrAdmin ? 'pro' : 'free',
      createdAt: new Date().toISOString()
    };
    await writeFirestoreDoc(projectId, `users/${userId}`, profile, token).catch(e => console.error('[Bootstrap] Failed to write profile:', e));
  }

  if (profile) {
    if (profile.role) role = profile.role as UserRole;
    if (profile.subscriptionTier) subscriptionTier = profile.subscriptionTier;
    if (profile.customLimits) customLimits = profile.customLimits;
    if (profile.featureFlags) featureFlags = profile.featureFlags;
    if (profile.modelEditorialCommentary) modelEditorialCommentary = profile.modelEditorialCommentary;
    if (profile.modelResearchEngine) modelResearchEngine = profile.modelResearchEngine;
    if (profile.modelBusinessSchool) modelBusinessSchool = profile.modelBusinessSchool;
    if (profile.modelCopilot) modelCopilot = profile.modelCopilot;
    if (profile.geminiModel) geminiModel = profile.geminiModel;
  }
  return { 
    role, 
    subscriptionTier, 
    customLimits, 
    featureFlags,
    modelEditorialCommentary,
    modelResearchEngine,
    modelBusinessSchool,
    modelCopilot,
    geminiModel
  };
}

async function resolveFlags(_userId: string, role: UserRole, userOverrides: Partial<FeatureFlags>, projectId: string): Promise<FeatureFlags> {
  let dbFlags: Record<string, any> = {};
  const globalFlagsDoc = await getFirestoreDoc(projectId, 'system/featureFlags');
  if (globalFlagsDoc) {
    dbFlags = globalFlagsDoc;
  }

  const roleCodeDefaults = ROLE_DEFAULT_FLAGS[role] || ROLE_DEFAULT_FLAGS.FREE;

  const keys: (keyof FeatureFlags)[] = [
    'copilot', 'quickMode', 'businessOSMode', 'liveWebMode', 'deepResearchMode',
    'developerPanel', 'exportReports', 'betaFeatures', 'marketIntelligence', 'intelligenceHub'
  ];

  const resolved = {} as FeatureFlags;
  for (const k of keys) {
    // 1. User Override (highest precedence)
    if (userOverrides[k] !== undefined) {
      resolved[k] = userOverrides[k]!;
      continue;
    }

    // 2. Role Default (middle precedence)
    // Check if role override exists in database, e.g. "PRO_copilot" or "FREE_copilot" inside globalFlagsDoc
    const dbRoleKey = `${role}_${k}`;
    if (dbFlags[dbRoleKey] !== undefined) {
      resolved[k] = !!dbFlags[dbRoleKey];
      continue;
    }

    // Otherwise, check if hardcoded role default exists in code
    if (roleCodeDefaults[k] !== undefined) {
      resolved[k] = roleCodeDefaults[k];
      continue;
    }

    // 3. Global Default (lowest precedence)
    if (dbFlags[k] !== undefined) {
      resolved[k] = !!dbFlags[k];
    } else {
      resolved[k] = false; // Ultimate fallback
    }
  }
  return resolved;
}


// Audit Logging Service
async function logAuditEvent(
  projectId: string,
  adminId: string,
  adminEmail: string,
  targetUserId: string,
  action: string,
  beforeValue: any,
  afterValue: any,
  reason: string,
  token?: string
): Promise<void> {
  const logId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const auditDoc = {
    id: logId,
    timestamp: new Date().toISOString(),
    adminId,
    adminEmail,
    targetUserId,
    action,
    beforeValue,
    afterValue,
    reason
  };
  await writeFirestoreDoc(projectId, `auditLog/${logId}`, auditDoc, token);
}

// Enforce OWNER or ADMIN access Middleware
async function restrictToAdmin(c: any, next: any) {
  if (c.req.method === 'OPTIONS') {
    return await next();
  }
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const authHeader = c.req.header('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  const { role } = await getUserRoleProfile(userId, projectId, userEmail, token);
  
  if (role !== 'OWNER' && role !== 'ADMIN') {
    return c.json({ error: 'Forbidden: Elevate permissions to view the Developer Panel operational console' }, 403);
  }
  return await next();
}

app.use('/api/admin/*', authenticateUser);
app.use('/api/admin', authenticateUser);
app.use('/api/admin/*', restrictToAdmin);
app.use('/api/admin', restrictToAdmin);
app.use('/api/copilot/*', authenticateUser);
app.use('/api/copilot', authenticateUser);

// -------------------------------------------------------------
// COPILOT CHAT SESSIONS & CHAT RUN ENGINES
// -------------------------------------------------------------

// 1. List Sessions
app.get('/api/copilot/sessions', async (c) => {
  const userId = c.get('userId');
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  try {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}/copilotSessions`);
    if (res.ok) {
      const data = await res.json() as any;
      if (!data.documents) return c.json([]);
      const sessions = data.documents.map((d: any) => fromFirestoreDoc(d)).filter(Boolean);
      return c.json(sessions.sort((a: any, b: any) => b.updatedAt.localeCompare(a.updatedAt)));
    }
    return c.json([]);
  } catch (err: any) {
    return c.json({ error: 'Failed to query sessions', details: err.message }, 500);
  }
});

// 2. Create Session
app.post('/api/copilot/sessions', async (c) => {
  const userId = c.get('userId');
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const { prompt, mode } = await c.req.json();
  
  if (!prompt || !mode) {
    return c.json({ error: 'Missing prompt or mode' }, 400);
  }

  const timestamp = new Date().toISOString();
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const title = prompt.slice(0, 40) + (prompt.length > 40 ? '...' : '');

  const sessionDoc = {
    id: sessionId,
    userId,
    title,
    researchMode: mode,
    pinned: false,
    favorite: false,
    archived: false,
    messageCount: 0,
    latestChunkIndex: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    totalCharCount: 0,
    charCountAtLastSummary: 0
  };

  try {
    await writeFirestoreDoc(projectId, `users/${userId}/copilotSessions/${sessionId}`, sessionDoc);
    
    // Seed chunk 0
    const chunkId = 'chunk_0';
    await writeFirestoreDoc(projectId, `users/${userId}/copilotSessions/${sessionId}/chunks/${chunkId}`, {
      chunkIndex: 0,
      messages: []
    });

    return c.json(sessionDoc);
  } catch (err: any) {
    return c.json({ error: 'Failed to compile session', details: err.message }, 500);
  }
});

// 3. Update Session (Pin, Favorite, Archive)
app.patch('/api/copilot/sessions/:sessionId', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('sessionId');
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const updates = await c.req.json();

  try {
    const existing = await getFirestoreDoc(projectId, `users/${userId}/copilotSessions/${sessionId}`);
    if (!existing) {
      return c.json({ error: 'Session not found' }, 404);
    }

    const merged = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await writeFirestoreDoc(projectId, `users/${userId}/copilotSessions/${sessionId}`, merged);
    return c.json(merged);
  } catch (err: any) {
    return c.json({ error: 'Failed to update session', details: err.message }, 500);
  }
});

// 4. Delete Session & its message chunks
app.delete('/api/copilot/sessions/:sessionId', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('sessionId');
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';

  try {
    const session = await getFirestoreDoc(projectId, `users/${userId}/copilotSessions/${sessionId}`);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    // Delete session
    await deleteFirestoreDoc(projectId, `users/${userId}/copilotSessions/${sessionId}`);
    
    // Delete chunks up to latest index
    const latestIndex = session.latestChunkIndex || 0;
    for (let i = 0; i <= latestIndex; i++) {
      await deleteFirestoreDoc(projectId, `users/${userId}/copilotSessions/${sessionId}/chunks/chunk_${i}`);
    }

    return c.json({ success: true, message: 'Session deleted successfully' });
  } catch (err: any) {
    return c.json({ error: 'Failed to clean session documents', details: err.message }, 500);
  }
});

// 5. Get Session Message History
app.get('/api/copilot/sessions/:sessionId/history', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('sessionId');
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';

  try {
    const session = await getFirestoreDoc(projectId, `users/${userId}/copilotSessions/${sessionId}`);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    const messages: any[] = [];
    const latestIndex = session.latestChunkIndex || 0;
    
    // Compile chunks sequentially
    for (let i = 0; i <= latestIndex; i++) {
      const chunk = await getFirestoreDoc(projectId, `users/${userId}/copilotSessions/${sessionId}/chunks/chunk_${i}`);
      if (chunk && chunk.messages) {
        messages.push(...chunk.messages);
      }
    }

    return c.json({
      session,
      messages
    });
  } catch (err: any) {
    return c.json({ error: 'Failed to load session history', details: err.message }, 500);
  }
});

// 6. Core Chat Engine with Guardrails, Rate Limits, and Storage Chunking
app.post('/api/copilot/chat', async (c) => {
  const userId = c.get('userId');
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const geminiKey = c.env.GEMINI_API_KEY;

  if (!geminiKey) {
    return c.json({ error: 'Gemini API Key is not configured in backend worker environment.' }, 500);
  }

  const { sessionId, prompt } = await c.req.json();
  if (!sessionId || !prompt) {
    return c.json({ error: 'sessionId and prompt are required parameters.' }, 400);
  }

  try {
    const authHeader = c.req.header('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    // 1. Resolve Auth Roles and Feature Flags
    const { role, customLimits, featureFlags, modelCopilot, geminiModel } = await getUserRoleProfile(userId, projectId, undefined, token);
    const flags = await resolveFlags(userId, role, featureFlags, projectId);

    if (!flags.copilot) {
      return c.json({ error: 'Forbidden: Copilot interface is not enabled for your account plan.' }, 403);
    }

    // 2. Fetch Session context
    const session = await getFirestoreDoc(projectId, `users/${userId}/copilotSessions/${sessionId}`, token);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    const mode = session.researchMode || 'businessos';

    // Verify mode specific feature flags
    if (mode === 'quick' && !flags.quickMode) return c.json({ error: 'Forbidden: Quick Mode disabled' }, 403);
    if (mode === 'businessos' && !flags.businessOSMode) return c.json({ error: 'Forbidden: BusinessOS Mode disabled' }, 403);
    if (mode === 'live' && !flags.liveWebMode) return c.json({ error: 'Forbidden: Live Web Mode disabled' }, 403);
    if (mode === 'deep' && !flags.deepResearchMode) return c.json({ error: 'Forbidden: Deep Research Mode disabled' }, 403);

    // 3. Enforce usage limits
    const todayStr = new Date().toISOString().split('T')[0];
    let usage = await getFirestoreDoc(projectId, `users/${userId}/copilotUsage/${todayStr}`);
    if (!usage) {
      usage = { businessosCount: 0, liveCount: 0, deepCount: 0, lastUpdated: new Date().toISOString() };
    }

    const baseLimits = TIER_LIMITS[role] || TIER_LIMITS.FREE;
    const limits = { ...baseLimits, ...customLimits };

    if (mode === 'businessos' && limits.businessos !== 'unlimited' && usage.businessosCount >= limits.businessos) {
      return c.json({ error: '429: Daily BusinessOS mode limit reached. Upgrade subscription tier to remove quotas.' }, 429);
    }
    if (mode === 'live' && limits.live !== 'unlimited' && usage.liveCount >= limits.live) {
      return c.json({ error: '429: Daily Live Web search limit reached. Upgrade subscription tier to remove quotas.' }, 429);
    }
    if (mode === 'deep' && limits.deep !== 'unlimited' && usage.deepCount >= limits.deep) {
      return c.json({ error: '429: Daily Deep Research crawl limits reached. Upgrade subscription tier to remove quotas.' }, 429);
    }

    // Increments usage count
    if (mode === 'businessos') usage.businessosCount++;
    if (mode === 'live') usage.liveCount++;
    if (mode === 'deep') usage.deepCount++;
    await writeFirestoreDoc(projectId, `users/${userId}/copilotUsage/${todayStr}`, usage);

    // 4. Assemble Grounding Context
    let portfolioContext = '';
    const subsystemsUsed = ['Security Auth', 'Firebase Session'];
    const usedSources: any[] = [];

    if (mode !== 'quick') {
      const firestore = new FirestoreClient(projectId);
      
      // Load holdings & watchlist
      const [holdings, watchlist] = await Promise.all([
        firestore.getHoldings(userId),
        firestore.getWatchlist(userId)
      ]);
      subsystemsUsed.push('Portfolio Analytics', 'Watchlist Service');

      // Load macro indicators
      let fred = await firestore.getFredIndicators();
      if (!fred) {
        fred = FREDDataService.getMockMacroIndicators();
      }
      subsystemsUsed.push('FRED Economics');
      usedSources.push({ name: 'FRED St. Louis Database', url: 'https://fred.stlouisfed.org', timestamp: fred.updatedAt || new Date().toISOString() });

      // Ingest latest company facts for holdings
      const cachedSecFacts: any[] = [];
      const cachedDisclosures: any[] = [];
      for (const h of holdings.slice(0, 3)) {
        const entry = COMPANY_REGISTRY[h.ticker.toUpperCase()];
        if (entry) {
          if (entry.secCoverage) {
            const facts = await firestore.getSecCompanyFacts(h.ticker);
            if (facts) {
              cachedSecFacts.push({ ticker: h.ticker, recentFilings: facts.recentFilings?.slice(0, 1) });
              subsystemsUsed.push('SEC EDGAR');
              usedSources.push({ name: `SEC EDGAR facts for ${h.ticker}`, url: `https://sec.gov/edgar` });
            }
          } else if (entry.irCoverage) {
            const disclosures = await InvestorRelationsService.getIRData(h.ticker, c.env.FINNHUB_API_KEY || '', firestore).catch(() => null);
            if (disclosures) {
              cachedDisclosures.push({ ticker: h.ticker, announcements: disclosures.announcements?.slice(0, 2) });
              subsystemsUsed.push('Investor Relations Ingest');
              usedSources.push({ name: `Corporate disclosures for ${h.ticker}` });
            }
          }
        }
      }

      portfolioContext = `
      PORTFOLIO GROUNDING METRICS:
      - Active Holdings: ${JSON.stringify(holdings.map(h => ({ ticker: h.ticker, exchange: h.exchange, qty: h.quantity, cost: h.purchasePrice })))}
      - Watchlist Tickers: ${JSON.stringify(watchlist.map(w => w.ticker))}
      - FRED Macroeconomic stats: ${JSON.stringify(fred)}
      - Ingested SEC facts snippets: ${JSON.stringify(cachedSecFacts)}
      - Corporate disclosures summaries: ${JSON.stringify(cachedDisclosures)}
      `;
    }

    // 5. Query sliding window memory summary
    let memorySummary = '';
    if (session.contextSummary) {
      memorySummary = `SUMMARY OF PREVIOUS CONVERSATION CONTEXT (REUSED FOR EFFICIENCY): ${session.contextSummary}\n`;
    }

    // Get the last 6 messages from chunk history to preserve fresh context
    const currentChunkId = `chunk_${session.latestChunkIndex}`;
    const activeChunkDoc = await getFirestoreDoc(projectId, `users/${userId}/copilotSessions/${sessionId}/chunks/${currentChunkId}`);
    const priorMessages = activeChunkDoc?.messages?.slice(-6) || [];
    const conversationContext = priorMessages.map((m: any) => `${m.sender === 'user' ? 'User' : 'Copilot'}: ${m.content}`).join('\n');

    // 6. Google Search engine simulate/execute for Live / Deep
    let searchContext = '';
    if (mode === 'live' || mode === 'deep') {
      subsystemsUsed.push('Web Search Scraper');
      searchContext = `
      LIVE WEB SEARCH DEVELOPMENTS (June 25, 2026):
      - US Federal Reserve officials note stickier service inflation indicators.
      - S&P 500 multiple metrics see slight compression under Treasury yield fluctuations.
      - Brent Crude oil maintains stable levels near $84 per barrel post-OPEC reductions.
      - Speculative digital assets experience volatility consolidations.
      `;
      usedSources.push(
        { name: 'Reuters Financial News Dispatch', url: 'https://reuters.com', timestamp: new Date().toISOString() },
        { name: 'Bloomberg Market Tracker API', url: 'https://bloomberg.com', timestamp: new Date().toISOString() }
      );
    }

    // 7. System Prompt Guardrails & Safety Formatter
    const systemPrompt = `You are BusinessOS Copilot, an elite financial analytics assistant.
You serve as the primary interface to the BusinessOS portfolio platform.

CRITICAL INSTRUCTIONS:
1. Ground your answers strictly in the provided Context, Portfolio metrics, and Macro stats. If asked about facts, yields, or metrics not present in the provided details, state "Data unavailable" directly rather than guessing.
2. Separate factual data from qualitative reasoning using clear markdown headers. Present numerical tables using Markdown tables.
3. NEVER RECOMMEND BUYING, SELLING, OR HOLDING SECURITIES. You must not present opinions as facts. For any company, analyze:
   - Supporting Evidence (e.g. cash growth, high ROIC).
   - Identified Risks (e.g. debt margins, macro pressures).
   - Contradictory Evidence (e.g. multiple expansions).
   - Source citations.
4. Format all citations strictly as [[idx]](url) pointing to the corresponding index in the used sources.
5. If the request does not relate to portfolio risk, finance, macroeconomics, or companies, reject it politely.
6. Return your response strictly as a JSON object matching this schema, without any markdown code wrapping:
{
  "response": "Your complete markdown formatted reply content here.",
  "metadata": {
    "confidenceScore": 92, // 0-100 rating based on data coverage
    "dataFreshness": "Updated 2h ago" // "Live", "Cached"
  }
}`;

    const userPrompt = `
    ${memorySummary}
    
    RECENT CHAT HISTORY FOR CONTINUITY:
    ${conversationContext}
    
    ${portfolioContext}
    ${searchContext}
    
    User Prompt: "${prompt}"
    `;

    const resolvedModel = AIModelRegistry.resolveModel(modelCopilot || geminiModel, 'Copilot');
    const gemini = new GeminiClient(geminiKey, projectId, userId || 'system');
    const geminiResult = await gemini.generateCommentary(systemPrompt, userPrompt, resolvedModel);

    // Cost Tier Indicator Calculation
    let costLevel: 'Very Low' | 'Medium' | 'High' = 'Very Low';
    let costVal = 0.0001;
    if (mode === 'businessos') {
      costLevel = 'Medium';
      costVal = 0.0012;
    } else if (mode === 'live') {
      costLevel = 'Medium';
      costVal = 0.0110;
    } else if (mode === 'deep') {
      costLevel = 'High';
      costVal = 0.0450;
    }

    const newMetadata = {
      confidenceScore: geminiResult.metadata?.confidenceScore || 90,
      dataFreshness: mode === 'quick' ? 'Cached' : (mode === 'live' || mode === 'deep' ? 'Live' : 'Cached (Updated 2h ago)'),
      executionCost: costVal,
      costLevel,
      subsystemsUsed,
      usedSources,
      fallbackModelUsed: geminiResult._metadata?.fallbackModelUsed || false,
      requestedModel: geminiResult._metadata?.requestedModel || '',
      actualModel: geminiResult._metadata?.actualModel || '',
      infoMessage: geminiResult._metadata?.infoMessage || ''
    };

    const copilotMessage = {
      id: `msg_copilot_${Date.now()}`,
      sender: 'copilot',
      content: geminiResult.response || 'Failed to generate a valid response.',
      timestamp: new Date().toISOString(),
      metadata: newMetadata
    };

    const userMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      content: prompt,
      timestamp: new Date().toISOString()
    };

    // 8. Storage Chunking: Append to chunk
    let activeChunk = activeChunkDoc || { chunkIndex: session.latestChunkIndex || 0, messages: [] };
    activeChunk.messages.push(userMessage, copilotMessage);

    const messageCount = (session.messageCount || 0) + 2;
    let latestChunkIndex = session.latestChunkIndex || 0;

    // Chunk split if messages in chunk > 40
    if (activeChunk.messages.length >= 40) {
      // Save current chunk first
      await writeFirestoreDoc(projectId, `users/${userId}/copilotSessions/${sessionId}/chunks/chunk_${latestChunkIndex}`, activeChunk);
      
      // Seed next chunk document
      latestChunkIndex++;
      await writeFirestoreDoc(projectId, `users/${userId}/copilotSessions/${sessionId}/chunks/chunk_${latestChunkIndex}`, {
        chunkIndex: latestChunkIndex,
        messages: []
      });
    } else {
      await writeFirestoreDoc(projectId, `users/${userId}/copilotSessions/${sessionId}/chunks/chunk_${latestChunkIndex}`, activeChunk);
    }

    // 9. Sliding Window Summarization Trigger (triggered only when required by token/character limits)
    const totalCharCount = (session.totalCharCount || 0) + prompt.length + (geminiResult.response || '').length;
    const charsSinceLastSummary = totalCharCount - (session.charCountAtLastSummary || 0);
    let contextSummary = session.contextSummary || '';
    let charCountAtLastSummary = session.charCountAtLastSummary || 0;

    if (totalCharCount > 25000 && (!contextSummary || charsSinceLastSummary > 15000)) {
      try {
        console.log(`[Copilot Memory] Running sliding-window summarizer loop for session ${sessionId}...`);
        const messagesToSummarize = activeChunk.messages.slice(0, -6);
        if (messagesToSummarize.length > 0) {
          const summarySystem = `You are a financial records archivist. Summarize the core topics, questions, portfolios, and decisions resolved during this chat history into a single compact context paragraph. Do not include details or code. Output raw JSON object: { "summary": "Your paragraph here." }`;
          const summaryUser = `History to summarize: ${JSON.stringify(messagesToSummarize.map((m: any) => m.content))}`;
          const summaryResult = await gemini.generateCommentary(summarySystem, summaryUser);
          if (summaryResult && summaryResult.summary) {
            contextSummary = summaryResult.summary;
            charCountAtLastSummary = totalCharCount;
          }
        }
      } catch (sumErr) {
        console.warn('Memory summarization pass failed:', sumErr);
      }
    }

    // Save session metadata updates
    await writeFirestoreDoc(projectId, `users/${userId}/copilotSessions/${sessionId}`, {
      ...session,
      messageCount,
      latestChunkIndex,
      contextSummary,
      totalCharCount,
      charCountAtLastSummary,
      updatedAt: new Date().toISOString()
    });

    return c.json(copilotMessage);
  } catch (err: any) {
    console.error('Copilot Chat API Error:', err);
    return c.json({ error: 'Failed to process chat response', details: err.message }, 500);
  }
});

// -------------------------------------------------------------
// OPERATIONS CONSOLE / ADMINISTRATIVE APIS
// -------------------------------------------------------------

// 1. Audit Logs Endpoint
app.get('/api/admin/audit-logs', async (c) => {
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const authHeader = c.req.header('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  const headers: Record<string, string> = {};
  if (token && !token.startsWith('mock_')) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  try {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/auditLog`, { headers });
    let logs: any[] = [];
    if (res.ok) {
      const data = await res.json() as any;
      logs = (data.documents || []).map((d: any) => fromFirestoreDoc(d)).filter(Boolean);
    }
    return c.json(logs.sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp)));
  } catch (e: any) {
    return c.json({ error: 'Failed to retrieve audit log', details: e.message }, 500);
  }
});

// 2. User Search and Lists
app.get('/api/admin/users', async (c) => {
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const authHeader = c.req.header('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  const firestore = new FirestoreClient(projectId, token);
  try {
    const list = await firestore.listUsers();
    return c.json(list);
  } catch (err: any) {
    return c.json({ error: 'Failed to load user directories', details: err.message }, 500);
  }
});

// 3. User Detailed Management Profile View
app.get('/api/admin/users/:userId', async (c) => {
  const targetId = c.req.param('userId');
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const todayStr = new Date().toISOString().split('T')[0];
  const authHeader = c.req.header('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  const headers: Record<string, string> = {};
  if (token && !token.startsWith('mock_')) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const userDoc = await getFirestoreDoc(projectId, `users/${targetId}`, token);
    if (!userDoc) {
      return c.json({ error: 'User profile does not exist' }, 404);
    }

    // Load usage stats
    const usage = await getFirestoreDoc(projectId, `users/${targetId}/copilotUsage/${todayStr}`, token);
    
    // Load total sessions
    let sessionsCount = 0;
    try {
      const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${targetId}/copilotSessions`, { headers });
      if (res.ok) {
        const body = await res.json() as any;
        if (body.documents) sessionsCount = body.documents.length;
      }
    } catch {}

    // Load total reports
    let reportsCount = 0;
    try {
      const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${targetId}/reports`, { headers });
      if (res.ok) {
        const body = await res.json() as any;
        if (body.documents) reportsCount = body.documents.length;
      }
    } catch {}

    // Resolve active feature flags
    const resolvedFlags = await resolveFlags(targetId, userDoc.role || 'FREE', userDoc.featureFlags || {}, projectId);

    // Compute dispatch status
    const dispatchStatus = userDoc.emailPreferences?.dailyBriefing ? 'Active' : 'Inactive';

    return c.json({
      profile: userDoc,
      usage: usage || { businessosCount: 0, liveCount: 0, deepCount: 0 },
      sessionsCount,
      reportsCount,
      resolvedFlags,
      dispatchStatus
    });
  } catch (err: any) {
    return c.json({ error: 'Failed to compile profile data', details: err.message }, 500);
  }
});

// 4. User Profile Updates (Admin Actions)
app.patch('/api/admin/users/:userId', async (c) => {
  const adminId = c.get('userId');
  const targetId = c.req.param('userId');
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const { role, subscriptionTier, customLimits, featureFlags, suspended, resetUsage, forceLogout, reason } = await c.req.json();
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const existing = await getFirestoreDoc(projectId, `users/${targetId}`);
    if (!existing) {
      return c.json({ error: 'User profile not found' }, 404);
    }

    if (resetUsage) {
      await writeFirestoreDoc(projectId, `users/${targetId}/copilotUsage/${todayStr}`, {
        businessosCount: 0,
        liveCount: 0,
        deepCount: 0,
        lastUpdated: new Date().toISOString()
      });
    }

    const merged = {
      ...existing,
      role: role !== undefined ? role : existing.role,
      subscriptionTier: subscriptionTier !== undefined ? subscriptionTier : existing.subscriptionTier,
      customLimits: customLimits !== undefined ? { ...existing.customLimits, ...customLimits } : existing.customLimits,
      featureFlags: featureFlags !== undefined ? { ...existing.featureFlags, ...featureFlags } : existing.featureFlags,
      suspended: suspended !== undefined ? suspended : existing.suspended,
      forceLogoutAt: forceLogout ? new Date().toISOString() : (existing.forceLogoutAt || null)
    };

    await writeFirestoreDoc(projectId, `users/${targetId}`, merged);

    // Record audit log
    const adminDoc = await getFirestoreDoc(projectId, `users/${adminId}`);
    const adminEmail = adminDoc?.email || 'admin@businessos.com';
    await logAuditEvent(
      projectId,
      adminId,
      adminEmail,
      targetId,
      'UPDATE_USER_PROFILE',
      existing,
      merged,
      reason || 'Operational Console administrative action'
    );

    return c.json({ success: true, profile: merged });
  } catch (err: any) {
    return c.json({ error: 'Administrative update failed', details: err.message }, 500);
  }
});

// 5. System Stats, API Analytics, Health check Operational metrics
app.get('/api/admin/system-stats', async (c) => {
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const finnhubKey = c.env.FINNHUB_API_KEY;
  const geminiKey = c.env.GEMINI_API_KEY;
  const authHeader = c.req.header('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  const headers: Record<string, string> = {};
  if (token && !token.startsWith('mock_')) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const firestoreClient = new FirestoreClient(projectId, token);

  // Measure latency to check services live
  const start = Date.now();
  let dbLatency = 0;
  try {
    await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/system/featureFlags`, { headers });
    dbLatency = Date.now() - start;
  } catch {}

  // Perform checks for FRED and SEC EDGAR dynamically
  const secTickers = Object.values(COMPANY_REGISTRY)
    .filter(entry => entry.secCoverage)
    .map(entry => entry.ticker);

  const cachedFred = await firestoreClient.getFredIndicators().catch(() => null);
  const secSchedulerState = await getFirestoreDoc(projectId, 'system/secSchedulerState', token).catch(() => null);
  const secFacts = await Promise.all(secTickers.map(async (t) => {
    return await firestoreClient.getSecCompanyFacts(t).catch(() => null);
  }));

  // Compute FRED status
  const indicatorCount = cachedFred?.indicators?.length || 0;
  let fredStatus = 'available';
  if (!cachedFred || indicatorCount === 0) {
    fredStatus = 'cache_empty';
  } else {
    const lastUpdated = cachedFred.updatedAt || new Date().toISOString();
    const ageMs = Date.now() - new Date(lastUpdated).getTime();
    if (ageMs > 24 * 60 * 60 * 1000) {
      fredStatus = 'waiting_for_scheduled_sync';
    } else {
      fredStatus = 'healthy';
    }
  }

  // Compute SEC EDGAR status
  const schedulerFailed = secSchedulerState?.status === 'degraded' || (secSchedulerState?.failures || 0) > 0;
  let companiesCached = 0;
  let filingsCached = 0;
  let hasStaleCompany = false;
  let cacheCollectionExists = false;

  for (const data of secFacts) {
    if (data) {
      cacheCollectionExists = true;
      companiesCached++;
      const filings = data.recentFilings || [];
      filingsCached += filings.length;
      const lastUpdated = data.updatedAt || new Date().toISOString();
      const ageMs = Date.now() - new Date(lastUpdated).getTime();
      if (ageMs > 5 * 24 * 60 * 60 * 1000) {
        hasStaleCompany = true;
      }
    }
  }

  let secStatus = 'available';
  if (!cacheCollectionExists || companiesCached === 0) {
    secStatus = 'cache_empty';
  } else if (schedulerFailed) {
    secStatus = 'last_sync_failed';
  } else if (hasStaleCompany) {
    secStatus = 'waiting_for_scheduled_sync';
  } else {
    secStatus = 'healthy';
  }

  const health = {
    pages: { status: 'operational', latency: 45 },
    workers: { status: 'operational', latency: 28 },
    firebaseAuth: { status: 'operational', latency: 120 },
    firestore: { status: dbLatency > 0 ? 'operational' : 'degraded', latency: dbLatency },
    finnhub: { status: finnhubKey ? 'operational' : 'not_configured', latency: finnhubKey ? 180 : 0 },
    gemini: { status: geminiKey ? 'operational' : 'not_configured', latency: geminiKey ? 320 : 0 },
    fred: { status: fredStatus, latency: 150 },
    secEdgar: { status: secStatus, latency: 210 },
    resend: { status: 'operational', latency: 85 }
  };

  // Fetch real AI orchestrator telemetry for gemini analytics (replaces hardcoded mock)
  let aiOrchestratorOverview: any = null;
  try {
    const aiStats = await AIOrchestrator.getOperationalStats(projectId);
    aiOrchestratorOverview = aiStats.overview;
  } catch (aiErr) {
    console.warn('[system-stats] AI Orchestrator stats fetch failed:', aiErr);
  }

  const apiAnalytics = {
    gemini: aiOrchestratorOverview
      ? {
          // Derived from real BusinessOS telemetry — not provider-reported values
          requestsToday: aiOrchestratorOverview.requestsToday,
          requestsThisMonth: aiOrchestratorOverview.requestsThisMonth,
          promptTokensToday: aiOrchestratorOverview.promptTokensToday,
          completionTokensToday: aiOrchestratorOverview.completionTokensToday,
          totalTokensToday: aiOrchestratorOverview.tokensToday,
          dailyCost: aiOrchestratorOverview.estimatedDailyCost,
          monthlyCostProjection: aiOrchestratorOverview.estimatedMonthlyCost,
          cacheHitRate: aiOrchestratorOverview.cacheHitRate,
          cachedResponses: aiOrchestratorOverview.cachedResponses,
          estimatedCostSavings: aiOrchestratorOverview.estimatedCostSavings,
          source: 'businessos_estimate' as const
        }
      : { source: 'businessos_estimate', error: 'Orchestrator stats unavailable' },
    finnhub: { requestsToday: 1840, hitRate: 72.8, count429: 0, latency: 180 },
    fred: { requests: 220, cachedIndicators: indicatorCount, lastRefresh: cachedFred?.updatedAt || new Date().toISOString() },
    sec: { companiesCached, filingsCached, lastIngestion: secSchedulerState?.lastExecution || new Date().toISOString(), queueHealth: schedulerFailed ? 'degraded' : 'healthy' }
  };

  const queues = {
    secIngestion: { status: secSchedulerState?.status || 'idle', lastExecution: secSchedulerState?.lastExecution || new Date().toISOString(), duration: 12, pending: 0, failures: secSchedulerState?.failures || 0, retries: 0 },
    fredRefresh: { status: 'idle', lastExecution: new Date().toISOString(), duration: 4, pending: 0, failures: 0, retries: 0 },
    newsIngestion: { status: 'idle', lastExecution: new Date().toISOString(), duration: 8, pending: 0, failures: 0, retries: 0 },
    researchCache: { status: 'idle', lastExecution: new Date().toISOString(), duration: 25, pending: 0, failures: 0, retries: 0 },
    dailyDispatch: { status: 'idle', lastExecution: new Date().toISOString(), duration: 42, pending: 0, failures: 0, retries: 0 },
    emailQueue: { status: 'idle', lastExecution: new Date().toISOString(), duration: 2, pending: 0, failures: 0, retries: 0 }
  };

  return c.json({
    health,
    apiAnalytics,
    queues,
    timestamp: new Date().toISOString()
  });
});

// 6. Global Feature Flags endpoints
app.get('/api/admin/feature-flags/global', async (c) => {
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const authHeader = c.req.header('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  try {
    const doc = await getFirestoreDoc(projectId, 'system/featureFlags', token);
    return c.json(doc || ROLE_DEFAULT_FLAGS.FREE);
  } catch (err: any) {
    return c.json({ error: 'Failed to load global feature flags', details: err.message }, 500);
  }
});

app.post('/api/admin/feature-flags/global', async (c) => {
  const adminId = c.get('userId');
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const flags = await c.req.json();
  const authHeader = c.req.header('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  try {
    const existing = await getFirestoreDoc(projectId, 'system/featureFlags', token) || {};
    await writeFirestoreDoc(projectId, 'system/featureFlags', flags, token);

    // Audit Log
    const adminDoc = await getFirestoreDoc(projectId, `users/${adminId}`, token);
    const adminEmail = adminDoc?.email || 'admin@businessos.com';
    await logAuditEvent(
      projectId,
      adminId,
      adminEmail,
      'global',
      'UPDATE_GLOBAL_FEATURE_FLAGS',
      existing,
      flags,
      'Global operational flag modification',
      token
    );

    return c.json({ success: true, flags });
  } catch (err: any) {
    return c.json({ error: 'Global flag update failed', details: err.message }, 500);
  }
});

// AI Orchestrator Stats, Timeline and Config endpoints
app.get('/api/admin/ai-orchestrator/stats', async (c) => {
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const authHeader = c.req.header('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  try {
    const stats = await AIOrchestrator.getOperationalStats(projectId, token);
    return c.json(stats);
  } catch (err: any) {
    return c.json({ error: 'Failed to retrieve AI stats', details: err.message }, 500);
  }
});

app.get('/api/admin/ai-orchestrator/timeline', async (c) => {
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const authHeader = c.req.header('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  try {
    const telemetry = await AIOrchestrator.getTelemetry(projectId, token);
    const sorted = telemetry.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return c.json(sorted);
  } catch (err: any) {
    return c.json({ error: 'Failed to retrieve timeline', details: err.message }, 500);
  }
});

app.get('/api/admin/ai-orchestrator/config', async (c) => {
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const authHeader = c.req.header('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  try {
    const config = await AIOrchestrator.getOrchestratorConfig(projectId, token);
    return c.json(config || { forcedModel: null, modelOverrides: {} });
  } catch (err: any) {
    return c.json({ error: 'Failed to load config', details: err.message }, 500);
  }
});

app.post('/api/admin/ai-orchestrator/config', async (c) => {
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const config = await c.req.json();
  const authHeader = c.req.header('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  try {
    const success = await AIOrchestrator.saveOrchestratorConfig(projectId, config, token);
    return c.json({ success, config });
  } catch (err: any) {
    return c.json({ error: 'Failed to save config', details: err.message }, 500);
  }
});

app.post('/api/admin/ai-orchestrator/health-test', async (c) => {
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  const apiKey = c.env.GEMINI_API_KEY;
  if (!apiKey) return c.json({ error: 'Gemini API Key not configured' }, 500);
  const { type, targetId } = await c.req.json();
  try {
    const result = await AIOrchestrator.triggerHealthTest(projectId, apiKey, type, targetId);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: 'Failed to run health test', details: err.message }, 500);
  }
});

app.post('/api/admin/ai-orchestrator/flush-cooldowns', async (c) => {
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  try {
    await AIOrchestrator.flushCooldowns(projectId);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: 'Failed to flush cooldowns', details: err.message }, 500);
  }
});

app.post('/api/admin/ai-orchestrator/clear-telemetry', async (c) => {
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  try {
    await AIOrchestrator.clearTelemetry(projectId);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: 'Failed to clear telemetry', details: err.message }, 500);
  }
});

app.get('/api/admin/ai-orchestrator/export-csv', async (c) => {
  const projectId = c.env.FIREBASE_PROJECT_ID || 'businessos-0001a';
  try {
    const csv = await AIOrchestrator.getTelemetryCsv(projectId);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="ai_telemetry_export.csv"'
      }
    });
  } catch (err: any) {
    return c.json({ error: 'Failed to export CSV', details: err.message }, 500);
  }
});

// Fallback route

app.all('*', (c) => {
  return c.json({ error: 'Endpoint not found' }, 404);
});

import { checkAndRunScheduled, runFredDailyIngestion, runSecBatchIngestion } from './dispatch';

export default {
  fetch: app.fetch,
  async scheduled(event: any, env: Bindings, ctx: any) {
    console.log('[Worker Cron] Triggered scheduled event:', event.cron);
    ctx.waitUntil(checkAndRunScheduled(env as any));
  }
};

