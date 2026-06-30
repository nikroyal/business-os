const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    console.log('Navigating to root to set mock storage...');
    await page.goto('https://business-os-cf0.pages.dev/', { waitUntil: 'networkidle2' });

    await page.evaluate(() => {
      localStorage.setItem('business_os_mock_user', JSON.stringify({
        uid: 'owner',
        email: 'owner@businessos.com',
        displayName: 'Owner'
      }));
      localStorage.setItem('profile_owner', JSON.stringify({
        uid: 'owner',
        email: 'owner@businessos.com',
        displayName: 'Owner',
        role: 'OWNER',
        subscriptionTier: 'pro',
        createdAt: new Date().toISOString()
      }));
    });

    console.log('Navigating to /developer...');
    await page.goto('https://business-os-cf0.pages.dev/developer', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 4000));

    const html = await page.evaluate(() => document.body.innerHTML);
    const text = await page.evaluate(() => document.body.innerText);
    console.log('--- Page text content ---');
    console.log(text);
    console.log('--- Page HTML length ---', html.length);
  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
}
main();
