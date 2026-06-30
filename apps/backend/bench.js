const { performance } = require('perf_hooks');

async function sequential(seriesIds) {
  for (const seriesId of seriesIds) {
    await new Promise(r => setTimeout(r, 100)); // simulate 100ms fetch
  }
}

async function parallel(seriesIds) {
  const promises = seriesIds.map(async (seriesId) => {
    await new Promise(r => setTimeout(r, 100));
  });
  await Promise.all(promises);
}

async function run() {
  const seriesIds = ['UNRATE', 'CPIAUCSL', 'CPILFESL', 'FEDFUNDS', 'DGS2', 'DGS10', 'T10Y2Y'];

  const startSeq = performance.now();
  await sequential(seriesIds);
  const endSeq = performance.now();
  console.log(`Sequential: ${endSeq - startSeq}ms`);

  const startPar = performance.now();
  await parallel(seriesIds);
  const endPar = performance.now();
  console.log(`Parallel: ${endPar - startPar}ms`);
}

run();
