import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

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

// Fallback route
app.all('*', (c) => {
  return c.json({ error: 'Endpoint not found' }, 404);
});

export default app;
