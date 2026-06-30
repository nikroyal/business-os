const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const targetUrl = 'https://business-os-cf0.pages.dev/developer';
const screenshotDir = '/home/codespace/.gemini/antigravity-cli/brain/232b4742-1c9f-4f5e-b5ef-695aee3eb492';

async function main() {
  console.log('Starting Puppeteer browser verification...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 950 });

  const consoleErrors = [];
  const networkFailures = [];
  const apiRequests = [];

  // Capture console messages
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      // Filter out harmless browser warnings or favicon errors
      if (!text.includes('favicon.ico') && !text.includes('chrome-extension') && !text.includes('autocomplete')) {
        consoleErrors.push(text);
      }
      console.log(`[Browser Console Error] ${text}`);
    } else {
      console.log(`[Browser Console Log] ${text}`);
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(err.message);
    console.log(`[Browser Uncaught Exception] ${err.stack}`);
  });

  // Audit network requests
  page.on('response', response => {
    const req = response.request();
    const url = response.url();
    const status = response.status();
    
    if (url.includes('/api/')) {
      apiRequests.push({ url, status, method: req.method() });
      console.log(`[API Response] ${req.method()} ${url} -> HTTP ${status}`);
      if (status >= 400) {
        networkFailures.push({ url, status, method: req.method() });
      }
    }
  });

  try {
    console.log('Navigating to login page for fresh registration...');
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
    
    // Generate a unique owner email
    const email = `owner-prod-${Date.now()}@businessos.com`;
    console.log(`Using email: ${email}`);
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', 'Password123!');

    console.log('Clicking Create Investor Profile...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Create Investor Profile'));
      if (btn) btn.click();
    });

    console.log('Waiting for signup completion and redirect to dashboard...');
    await new Promise(r => setTimeout(r, 8000));
    
    console.log('Current URL after signup:', page.url());
    if (!page.url().includes('/dashboard')) {
      throw new Error(`Registration failed. Did not redirect to /dashboard. Current URL: ${page.url()}`);
    }

    // Navigate to developer console
    console.log('Navigating to developer console...');
    await page.goto(targetUrl, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 4000));

    const pageText = await page.evaluate(() => document.body.innerText);
    if (pageText.includes('Terminal Access Restricted')) {
      console.error('CRITICAL: Access restricted! Profile role was not OWNER.');
      process.exit(1);
    }

    console.log('/developer page loaded successfully!');

    // Verify all 6 tabs
    const tabs = [
      { id: 'Health', label: 'Platform Health', screenshot: 'screenshot_health.png' },
      { id: 'Queues', label: 'Background Jobs', screenshot: 'screenshot_jobs.png' },
      { id: 'Users', label: 'User Directory', screenshot: 'screenshot_users.png' },
      { id: 'FeatureFlags', label: 'Global Flags', screenshot: 'screenshot_flags.png' },
      { id: 'AuditLogs', label: 'Audit Trail', screenshot: 'screenshot_audit.png' },
      { id: 'AIOrchestrator', label: 'AI Operations Center', screenshot: 'screenshot_ai.png' }
    ];

    for (const t of tabs) {
      console.log(`\n--- Verifying Tab: ${t.label} ---`);
      
      const clicked = await page.evaluate((tabLabel) => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent.includes(tabLabel));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      }, t.label);

      if (!clicked) {
        throw new Error(`Failed to find or click button for tab "${t.label}"`);
      }

      console.log(`Clicked tab "${t.label}", waiting for data load...`);
      await new Promise(r => setTimeout(r, 4500)); // wait for fetches to complete

      // Check for errors
      const renderCheck = await page.evaluate(() => {
        const text = document.body.innerText;
        if (text.includes('API Connection Error') || text.includes('Render Error') || text.includes('TypeError') || text.includes('Cannot read properties')) {
          return { success: false, error: 'Render error or connection crash visible on UI' };
        }
        return { success: true };
      });

      if (!renderCheck.success) {
        console.error(`Tab "${t.label}" rendering failed: ${renderCheck.error}`);
        networkFailures.push({ url: `UI_RENDER_${t.id}`, status: 500, method: 'RENDER' });
      }

      // Take screenshot
      const scPath = path.join(screenshotDir, t.screenshot);
      await page.screenshot({ path: scPath });
      console.log(`Saved screenshot to ${scPath}`);
    }

    console.log('\n--- VERIFICATION SUMMARY ---');
    console.log(`Console Errors count: ${consoleErrors.length}`);
    console.log(`Network/API Failures count: ${networkFailures.length}`);
    console.log(`Total API Requests audited: ${apiRequests.length}`);

    if (consoleErrors.length > 0) {
      console.error('FAIL: Console errors or uncaught exceptions detected.');
    }
    if (networkFailures.length > 0) {
      console.error('FAIL: Non-200 API responses or UI render crashes detected.');
      for (const fail of networkFailures) {
        console.error(`  - ${fail.method} ${fail.url} -> HTTP ${fail.status}`);
      }
    }

    if (consoleErrors.length === 0 && networkFailures.length === 0) {
      console.log('SUCCESS: All checks passed!');
    } else {
      console.log('Verification finished with issues.');
      process.exit(1);
    }

  } catch (error) {
    console.error('Execution exception:', error);
    process.exit(1);
  } finally {
    await browser.close();
    console.log('Puppeteer browser closed.');
  }
}

main();
