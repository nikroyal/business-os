const { performance } = require('perf_hooks');

// Node 18+ has built-in fetch
if (typeof fetch === 'undefined') {
  global.fetch = async (url) => {
    return new Promise(r => setTimeout(() => {
      r({
        ok: true,
        json: async () => ({ observations: [] })
      })
    }, 150));
  };
} else {
  const originalFetch = fetch;
  global.fetch = async (url) => {
    // Mock the delay
    return new Promise(r => setTimeout(() => {
      r({
        ok: true,
        json: async () => ({ observations: [] })
      })
    }, 150));
  };
}

async function sequential(seriesIds, apiKey) {
  const indicators = [];
  const timestamp = new Date().toISOString();

  for (const seriesId of seriesIds) {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=15`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`FRED returned HTTP ${res.status} for ${seriesId}`);
    }
    const data = await res.json();
    indicators.push(data);
  }
  return indicators;
}

async function parallel(seriesIds, apiKey) {
  const timestamp = new Date().toISOString();

  const promises = seriesIds.map(async (seriesId) => {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=15`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`FRED returned HTTP ${res.status} for ${seriesId}`);
    }
    const data = await res.json();
    return data;
  });

  const indicators = await Promise.all(promises);
  return indicators;
}

async function run() {
  const seriesIds = ['UNRATE', 'CPIAUCSL', 'CPILFESL', 'FEDFUNDS', 'DGS2', 'DGS10', 'T10Y2Y'];
  const apiKey = 'test_key';

  // Warmup
  await sequential(['UNRATE'], apiKey);
  await parallel(['UNRATE'], apiKey);

  let seqTotal = 0;
  let parTotal = 0;
  const ITERS = 3;

  for(let i=0; i<ITERS; i++) {
      const startSeq = performance.now();
      await sequential(seriesIds, apiKey);
      seqTotal += performance.now() - startSeq;

      const startPar = performance.now();
      await parallel(seriesIds, apiKey);
      parTotal += performance.now() - startPar;
  }

  console.log(`Average Sequential: ${(seqTotal/ITERS).toFixed(2)}ms`);
  console.log(`Average Parallel: ${(parTotal/ITERS).toFixed(2)}ms`);
  console.log(`Improvement: ${(100 - (parTotal/seqTotal)*100).toFixed(2)}%`);
}

run();
