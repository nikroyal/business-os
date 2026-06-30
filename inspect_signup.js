const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('console', msg => console.log(`[Browser Console Log] ${msg.text()}`));
  page.on('pageerror', err => console.error(`[Browser Exception] ${err.stack}`));

  // Capture API responses
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/') || url.includes('identitytoolkit')) {
      console.log(`[Response] ${url} -> HTTP ${response.status()}`);
      try {
        const body = await response.text();
        console.log(`  Body: ${body.substring(0, 300)}`);
      } catch (e) {}
    }
  });

  try {
    console.log('Navigating directly to login page...');
    await page.goto('https://business-os-cf0.pages.dev/login', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    console.log('Toggling to Sign Up...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Sign Up'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    console.log('Filling fresh signup fields...');
    await page.type('input[placeholder="John Doe"]', 'Production Verifier');
    
    // Generate a unique email using timestamp to avoid "email already in use" errors!
    const email = `owner-prod-${Date.now()}@businessos.com`;
    console.log(`Using email: ${email}`);
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', 'Password123!');

    console.log('Clicking Create Investor Profile...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Create Investor Profile'));
      if (btn) btn.click();
    });

    console.log('Waiting 8 seconds for signup completion...');
    await new Promise(r => setTimeout(r, 8000));
    
    console.log('URL after signup:', page.url());
    const text = await page.evaluate(() => document.body.innerText);
    console.log('Body text sample:', text.substring(0, 300));
  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
}
main();
