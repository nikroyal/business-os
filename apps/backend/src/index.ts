import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  FINNHUB_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for frontend local development
app.use('/api/*', cors({
  origin: '*', // Allow all in dev, can restrict to localhost:5173 in prod settings
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
}));

// Health Check Endpoint
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    message: 'BusinessOS Edge API is running',
    timestamp: new Date().toISOString(),
    runtime: 'Cloudflare Worker'
  });
});

// User profile API mock route (Phase 1)
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

// Fallback route
app.all('*', (c) => {
  return c.json({ error: 'Endpoint not found' }, 404);
});

export default app;
