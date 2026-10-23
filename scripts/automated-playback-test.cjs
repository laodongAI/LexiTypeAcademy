// Automated playback test using Playwright (CommonJS)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const outDir = path.resolve(__dirname, '..', 'logs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `automated-playback-log-${Date.now()}.json`);

  // Allow overriding headless via env var HEADLESS ("false" => headful)
  const headlessEnv = process.env.HEADLESS;
  const headless = typeof headlessEnv === 'string' ? (headlessEnv.toLowerCase() !== 'false') : true;
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => {
    try {
      const text = msg.text();
      logs.push({ type: msg.type(), text, location: msg.location() });
      console.log(`[console:${msg.type()}] ${text}`);
    } catch (e) {}
  });

  page.on('pageerror', err => {
    logs.push({ type: 'pageerror', text: String(err) });
    console.error('pageerror', err);
  });

  try {
    await page.goto('http://localhost:5173/', { timeout: 30000 });
    await page.waitForTimeout(800);

    // Inject a visible test-start button that resumes AudioContext on click.
    await page.evaluate(() => {
      try {
        if (document.getElementById('automated-start-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'automated-start-btn';
        btn.textContent = '开始播放（测试）';
        Object.assign(btn.style, {
          position: 'fixed',
          right: '20px',
          bottom: '20px',
          zIndex: '99999',
          padding: '10px 14px',
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
          cursor: 'pointer'
        });
        btn.addEventListener('click', async () => {
          try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) {
              console.warn('No AudioContext available');
              return;
            }
            if (!window.__automatedAudioContext) {
              window.__automatedAudioContext = new AC();
            }
            const ac = window.__automatedAudioContext;
            if (ac.state === 'suspended') await ac.resume();
            // create tiny silent buffer to ensure gesture activates audio
            const buf = ac.createBuffer(1, 1, ac.sampleRate);
            const src = ac.createBufferSource();
            src.buffer = buf;
            src.connect(ac.destination);
            try { src.start(0); } catch (e) { /* ignore */ }
            window.__automatedGestureDone = true;
            console.log('Automated start button clicked - audio resumed');
            // remove button so it doesn't interfere further
            setTimeout(() => btn.remove(), 500);
          } catch (err) { console.error('automated start click error', err); }
        });
        document.body.appendChild(btn);
      } catch (err) { console.error('inject start button failed', err); }
    });

    // Click the injected button to produce a user gesture (works in headful mode)
    try {
      await page.click('#automated-start-btn', { timeout: 5000 });
      await page.waitForTimeout(500);
    } catch (e) {
      // if click failed (e.g., headless), continue — fallback tries will still run
      console.warn('automated start button click failed', e);
    }

    // Ensure there's a saved playlist to play: inject a temporary playlist into localStorage
    try {
      await page.evaluate(() => {
        try {
          const key = 'saved_playlists';
          const sample = [{ ts: Date.now(), name: '自动化测试播放列表', items: [{ en: 'This is an automated test sentence for TTS playback.' }] }];
          localStorage.setItem(key, JSON.stringify(sample));
          console.log('Injected test saved_playlists');
        } catch (err) { console.error('inject saved_playlists failed', err); }
      });
    } catch (e) { console.warn('page.evaluate inject playlist failed', e); }

    // Try to open the PlaylistLibrary by clicking the header button labeled '播放列表' or 'Playlist'
    try {
      const openSelectors = ['button:has-text("播放列表")', 'button:has-text("Playlist")', 'button:has-text("播放列表")'];
      let opened = false;
      for (const sel of openSelectors) {
        try {
          const el = await page.$(sel);
          if (el) { await el.click(); opened = true; console.log('Clicked open playlist library via', sel); break; }
        } catch (e) {}
      }
      if (!opened) {
        // fallback: click any button that contains '播放' text
        try {
          const btns = await page.$$('button');
          for (const b of btns) {
            const txt = await b.innerText();
            if (txt && txt.includes('播放')) { await b.click(); opened = true; console.log('Clicked open playlist library via fallback'); break; }
          }
        } catch (e) {}
      }
      await page.waitForTimeout(600);
    } catch (e) { console.warn('open library click failed', e); }

    // In the library, click the first 'Play' button to load playlist into the player
    try {
      // Wait for the library panel to appear
      await page.waitForTimeout(500);
      // Try to click a button with text 'Play' or the Chinese '播放' inside the panel
      const playBtn = await page.$('button:has-text("Play")');
      if (playBtn) {
        await playBtn.click();
        console.log('Clicked library Play');
      } else {
        // fallback: find a button with '播放' text
        const btns = await page.$$('button');
        for (const b of btns) {
          const txt = await b.innerText();
          if (txt && (txt.trim() === '播放' || txt.trim().includes('播放'))) { await b.click(); console.log('Clicked library Play (chinese)'); break; }
        }
      }
      await page.waitForTimeout(600);
    } catch (e) { console.warn('click library play failed', e); }

    // Now try to click the Play button inside the PlaylistPlayer modal
    try {
      // Wait a moment for the player modal to appear
      await page.waitForTimeout(800);
      // Click 'Play' button inside player
      const playerPlay = await page.$('button:has-text("Play")');
      if (playerPlay) {
        await playerPlay.click();
        console.log('Clicked player Play');
      } else {
        // fallback: click the first button labeled 'Play' or '播放'
        const btns = await page.$$('button');
        for (const b of btns) {
          const txt = await b.innerText();
          if (txt && (txt.trim() === 'Play' || txt.trim() === '播放')) { await b.click(); console.log('Clicked player Play via fallback'); break; }
        }
      }
      await page.waitForTimeout(400);
    } catch (e) { console.warn('click player play failed', e); }

    // As a fallback, directly call ttsManager.speak if available on window
    try {
      // Wait until Sherpa provider reports ready (if available)
      try {
        await page.waitForFunction('window.__SHERPA_READY__ === true', { timeout: 15000 });
        console.log('Sherpa reported ready via window.__SHERPA_READY__');
      } catch (waitErr) {
        console.warn('Sherpa ready wait timed out or not available, proceeding to call speak anyway');
      }

      const sid = await page.evaluate(() => {
        try {
          // @ts-ignore
          if (window.ttsManager && typeof window.ttsManager.speak === 'function') {
            // speak returns speakId
            // speak a short test sentence to ensure provider emits events
            // @ts-ignore
            return window.ttsManager.speak('Automated test final speak to trigger events.', false, 'en', { rate: 1.0 });
          }
          return null;
        } catch (err) { console.error('direct speak failed', err); return null; }
      });
      if (sid) console.log('Called window.ttsManager.speak, speakId=', sid);
      // Wait a bit and retry speak to ensure provider had time to initialize
      await page.waitForTimeout(1200);
      try {
        const sid2 = await page.evaluate(() => {
          try {
            // @ts-ignore
            if (window.ttsManager && typeof window.ttsManager.speak === 'function') {
              // second speak to ensure provider is ready
              // @ts-ignore
              return window.ttsManager.speak('Automated test speak after init.', false, 'en', { rate: 1.0 });
            }
            return null;
          } catch (err) { console.error('direct speak retry failed', err); return null; }
        });
        if (sid2) console.log('Called window.ttsManager.speak (retry), speakId=', sid2);
      } catch (e) { console.warn('direct ttsManager.speak retry failed', e); }
    } catch (e) { console.warn('direct ttsManager.speak invoke failed', e); }

    try {
      const firstChk = await page.$('table tbody input[type=checkbox]');
      if (firstChk) {
        await firstChk.check();
        console.log('Checked first course checkbox');
      }
    } catch (e) { console.warn('select checkbox failed', e); }

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

    if (!clicked) {
      try {
        const btn = await page.$('button');
        if (btn) { await btn.click(); console.log('Clicked first button fallback'); }
      } catch (e) {}
    }

    try {
      await page.waitForSelector('text=播放列表', { timeout: 5000 });
      console.log('PlaylistPlayer appeared (text=播放列表)');
    } catch (e) {
      await page.waitForTimeout(1000);
    }

    try {
      const libBtn = await page.$('button:has-text("播放列表")');
      if (libBtn) {
        await libBtn.click();
        console.log('Opened PlaylistLibrary');
        await page.waitForTimeout(800);
      }
    } catch (e) { console.warn('open library failed', e); }

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

    console.log('Collecting TTS-related console logs for 20s...');
    await page.waitForTimeout(20000);

  } catch (err) {
    console.error('Automation error', err);
    logs.push({ type: 'automation-error', text: String(err) });
  } finally {
    try {
      fs.writeFileSync(outFile, JSON.stringify(logs, null, 2));
      console.log('Saved logs to', outFile);
    } catch (e) { console.error('Failed to write logs', e); }
    await browser.close();
    process.exit(0);
  }
})();
