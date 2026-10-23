const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const ROOT = process.cwd();
  const url = process.env.URL || 'http://localhost:5173/';
  const samplePath = path.join(ROOT, 'scripts', 'sample-import.json');
  if (!fs.existsSync(samplePath)) { console.error('Sample import file not found:', samplePath); process.exit(1); }

  const browser = await chromium.launch({ headless: process.env.HEADLESS === 'true' ? true : false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => {
    const text = `[console:${msg.type()}] ${msg.text()}`;
    console.log(text);
    logs.push(text);
  });
  page.on('pageerror', err => {
    const text = `[pageerror] ${err.message}`;
    console.error(text);
    logs.push(text);
  });

  console.log('Navigating to', url);
  await page.goto(url, { waitUntil: 'networkidle' });

  // Seed legacy localStorage courses so import wizard detects duplicates if Dexie empty
  const existingCourse = {
    title: 'Sample Course A',
    description: 'Existing course to cause a duplicate',
    tags: ['demo'],
    difficulty: 'beginner',
    type: 'text',
    lessons: [{ content: 'Hello world.', contentTranslation: '你好，世界。', language: 'en' }]
  };

  await page.evaluate((c) => {
    try {
      const key = 'custom_courses';
      const prev = localStorage.getItem(key);
      let arr = [];
      if (prev) {
        try { arr = JSON.parse(prev); } catch { arr = []; }
      }
      arr.push(c);
      localStorage.setItem(key, JSON.stringify(arr));
      console.log('Seeded legacy courses in localStorage');
    } catch (e) {
      console.error('Failed to seed localStorage', e);
    }
  }, existingCourse);

  // Try to click the import button by text (multiple fallbacks)
  const importSelectors = [
    'button:has-text("Import")',
    'button:has-text("Import JSON")',
    'button:has-text("导入")',
    'button:has-text("导入 JSON")',
    'button:has-text("JSON")',
  ];

  let clicked = false;
  for (const sel of importSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click({ force: true });
        console.log('Clicked import button via', sel);
        clicked = true;
        break;
      }
    } catch (e) {
      // ignore
    }
  }

  if (!clicked) {
    // As fallback, open the import wizard by dispatching a click on any button with svg + text node containing 'Import' in the innerText
    const found = await page.$$('button');
    for (const btn of found) {
      try {
        const txt = (await btn.innerText()).trim();
        if (!txt) continue;
        if (/import|导入|JSON/i.test(txt)) {
          await btn.click({ force: true });
          console.log('Clicked import by scanning button text:', txt);
          clicked = true;
          break;
        }
      } catch (e) {}
    }
  }

  if (!clicked) {
    console.error('Could not find import button. Aborting.');
    await browser.close();
    process.exit(2);
  }

  // Wait for modal/dropzone to appear - look for input[type=file] inside modal
  await page.waitForSelector('input[type=file]', { timeout: 5000 });
  console.log('Found file input, uploading sample file:', samplePath);

  const inputHandle = await page.$('input[type=file]');
  await inputHandle.setInputFiles(samplePath);

  // Wait for preview area showing 'Preview Import' or the Import button
  await page.waitForTimeout(800); // small delay for parsing
  // Try to click bulk-apply button '应用到所有重复项' or '应用到所有项'
  const applySelectors = ['button:has-text("应用到所有重复项")', 'button:has-text("应用到所有项")', 'button:has-text("Apply")'];
  for (const sel of applySelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click({ force: true });
        console.log('Clicked bulk apply via', sel);
        break;
      }
    } catch (e) {}
  }

  // Click Import button inside wizard
  const importConfirmSelectors = ['button:has-text("Import")', 'button:has-text("Import ' + 'Courses")', 'button:has-text("导入")', 'button:has-text("Import ' + 'Courses")'];
  let confClicked = false;
  for (const sel of importConfirmSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click({ force: true });
        console.log('Clicked import confirm via', sel);
        confClicked = true;
        break;
      }
    } catch (e) {}
  }

  if (!confClicked) {
    // fallback: click last button in modal
    try {
      const modals = await page.$$('div[role="dialog"], .fixed');
      if (modals.length > 0) {
        const lastModal = modals[modals.length - 1];
        const buttons = await lastModal.$$('button');
        if (buttons.length > 0) {
          await buttons[buttons.length - 1].click({ force: true });
          console.log('Clicked last button inside modal as fallback');
          confClicked = true;
        }
      }
    } catch (e) {}
  }

  // Wait a bit for transaction to complete
  await page.waitForTimeout(1500);

  // Take screenshot and save logs
  const outDir = path.join(ROOT, 'logs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const ts = Date.now();
  const shot = path.join(outDir, `import-test-${ts}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  const logFile = path.join(outDir, `import-test-log-${ts}.txt`);
  fs.writeFileSync(logFile, logs.join('\n'), 'utf8');
  console.log('Saved screenshot to', shot);
  console.log('Saved logs to', logFile);

  await browser.close();
  process.exit(0);
})();
