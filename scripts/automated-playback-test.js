// Automated playback test using Playwright
// - Opens the app at http://localhost:5173/
// - Selects first course checkbox, clicks 'Play Selected' to open PlaylistPlayer
// - Opens PlaylistLibrary and attempts a drag-and-drop into PlaylistPlayer
// - Captures Console messages and writes them to logs/automated-playback-log.json

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const outDir = path.resolve(__dirname, '..', 'logs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `automated-playback-log-${Date.now()}.json`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => {
    try {
      const text = msg.text();
      logs.push({ type: msg.type(), text, location: msg.location() });
      // also print to stdout for visibility
      console.log(`[console:${msg.type()}] ${text}`);
    } catch (e) {}
  });

  page.on('pageerror', err => {
    logs.push({ type: 'pageerror', text: String(err) });
    console.error('pageerror', err);
  });

  try {
    await page.goto('http://localhost:5173/', { timeout: 30000 });
    await page.waitForTimeout(1500);

    // Try to select first course checkbox if any
    try {
      const firstChk = await page.$('table tbody input[type=checkbox]');
      if (firstChk) {
        await firstChk.check();
        console.log('Checked first course checkbox');
      }
    } catch (e) { console.warn('select checkbox failed', e); }

    // Click Play Selected button - try English and Chinese labels
    const playSelectors = ['button:has-text("Play Selected")', 'button:has-text("加入播放列表")', 'button:has-text("Play Selected")'];
    let clicked = false;
    for (const sel of playSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click();
          clicked = true;
          console.log('Clicked Play Selected via', sel);
          break;
        }
      } catch (e) {}
    }

    // If not clicked, try any button with exact text 'Play Selected' fallback
    if (!clicked) {
      try {
        const btn = await page.$('button');
        if (btn) { await btn.click(); console.log('Clicked first button fallback'); }
      } catch (e) {}
    }

    // Wait for PlaylistPlayer modal to appear (look for header '播放列表' or '播放列表 -')
    try {
      await page.waitForSelector('text=播放列表', { timeout: 5000 });
      console.log('PlaylistPlayer appeared (text=播放列表)');
    } catch (e) {
      // fallback: wait a bit
      await page.waitForTimeout(1000);
    }

    // Open PlaylistLibrary sidebar by clicking the '播放列表' button in header (if present)
    try {
      const libBtn = await page.$('button:has-text("播放列表")');
      if (libBtn) {
        await libBtn.click();
        console.log('Opened PlaylistLibrary');
        await page.waitForTimeout(800);
      }
    } catch (e) { console.warn('open library failed', e); }

    // Attempt drag-and-drop: find any draggable element and the player modal target
    try {
      const draggable = await page.$('[draggable]');
      const player = await page.$('div:has-text("播放列表 -")');
      if (draggable && player) {
        const srcBox = await draggable.boundingBox();
        const dstBox = await player.boundingBox();
        if (srcBox && dstBox) {
          await page.mouse.move(srcBox.x + srcBox.width/2, srcBox.y + srcBox.height/2);
          await page.mouse.down();
          await page.mouse.move(dstBox.x + dstBox.width/2, dstBox.y + dstBox.height/2, { steps: 10 });
          await page.mouse.up();
          console.log('Performed mouse drag-drop');
        }
      } else {
        console.warn('No draggable or player target found for drag-drop');
      }
    } catch (e) { console.warn('drag-drop attempt failed', e); }

    // Wait for TTS logs (listen for tts-play-start / tts-play-end) for up to 20s
    console.log('Collecting TTS-related console logs for 20s...');
    await page.waitForTimeout(20000);

  } catch (err) {
    console.error('Automation error', err);
    logs.push({ type: 'automation-error', text: String(err) });
  } finally {
    // Write logs
    try {
      fs.writeFileSync(outFile, JSON.stringify(logs, null, 2));
      console.log('Saved logs to', outFile);
    } catch (e) { console.error('Failed to write logs', e); }
    await browser.close();
    process.exit(0);
  }
})();
