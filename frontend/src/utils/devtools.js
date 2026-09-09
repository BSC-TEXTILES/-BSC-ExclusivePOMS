// DevTools / inspection detection — desktop and mobile.
// Combines independent probes and reports a single open/closed signal:
//   1. Baseline-relative window gap: docking DevTools grows outer/inner size
//      difference by hundreds of px while the outer window stays put. A fixed
//      gap (browser chrome, DPI scaling, embedded hosts) is calibrated away.
//   2. `debugger` timing — pauses only when a debugger is attached. Two
//      consecutive spikes are required so startup jank can't false-trip.
//   3. Mobile in-page inspectors injected into the page (Eruda / vConsole).
//   4. Browser automation (navigator.webdriver).

const SIZE_GROWTH_PX = 160;      // gap growth above baseline that signals docking
const TIMING_THRESHOLD_MS = 120; // debugger pause detection
const TIMING_INTERVAL_MS = 2500;
const SIZE_INTERVAL_MS = 1000;

export function createDevToolsWatcher(onChange) {
  // In development mode (Vite dev server, localhost, or 127.0.0.1), disable DevTools detection completely.
  // This allows developers to freely inspect elements, debug, and use browser developer tools.
  if (import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return function stop() {};
  }

  let open = false;
  let sizeFlag = false;
  let timingFlag = false;
  let toolFlag = false;
  let webdriverFlag = false;
  let stopped = false;
  let reported = false;

  // Baselines calibrated from the smallest gaps observed — a docked panel
  // later only counts if the gap grows beyond the best case we have seen.
  let minGapW = Infinity;
  let minGapH = Infinity;
  let consecutiveTimingSpikes = 0;
  const bootTime = Date.now();

  function evalState() {
    const nowOpen = sizeFlag || timingFlag || toolFlag || webdriverFlag;
    if (nowOpen !== open || !reported) {
      open = nowOpen;
      reported = true;
      try { onChange(nowOpen, { sizeFlag, timingFlag, toolFlag, webdriverFlag }); } catch { /* listener error ignored */ }
    }
  }

  // 1. Docked DevTools widen the outer/inner gap; static chrome does not.
  function checkSize() {
    if (stopped) return;
    const gapW = window.outerWidth - window.innerWidth;
    const gapH = window.outerHeight - window.innerHeight;
    if (gapW < minGapW) minGapW = gapW;
    if (gapH < minGapH) minGapH = gapH;
    // Only trust the baseline after a few samples (avoids first-paint weirdness).
    const calibrated = minGapW !== Infinity && Date.now() - bootTime > 3000;
    sizeFlag = calibrated &&
      (gapW - minGapW > SIZE_GROWTH_PX || gapH - minGapH > SIZE_GROWTH_PX);
    evalState();
  }

  // 2. Debugger-timing probe — two consecutive spikes required.
  function checkTiming() {
    if (stopped) return;
    if (Date.now() - bootTime > 2000) {
      const t0 = performance.now();
      // eslint-disable-next-line no-debugger
      debugger;
      const dt = performance.now() - t0;
      if (dt > TIMING_THRESHOLD_MS) consecutiveTimingSpikes += 1;
      else consecutiveTimingSpikes = 0;
      timingFlag = consecutiveTimingSpikes >= 2;
      evalState();
    }
    setTimeout(checkTiming, TIMING_INTERVAL_MS);
  }

  // 3. Mobile in-page inspectors.
  function checkTools() {
    if (stopped) return;
    toolFlag = !!(window.eruda || window.vConsole || window.__VCONSOLE_INSTANCE__);
    evalState();
  }

  // 4. Automation drivers.
  try { webdriverFlag = !!navigator.webdriver; } catch { webdriverFlag = false; }

  // QA hook: lets the team exercise the curtain/alert pipeline end-to-end.
  // It can only be set from the console — which is itself a detection signal.
  window.__pomsSetDevtoolsFlag = (v) => { toolFlag = !!v; evalState(); };

  window.addEventListener('resize', checkSize);
  const sizeTimer = setInterval(checkSize, SIZE_INTERVAL_MS);
  const toolTimer = setInterval(checkTools, 3000);
  checkSize();
  checkTools();
  const timingStart = setTimeout(checkTiming, TIMING_INTERVAL_MS);

  return function stop() {
    stopped = true;
    clearInterval(sizeTimer);
    clearInterval(toolTimer);
    clearTimeout(timingStart);
    window.removeEventListener('resize', checkSize);
    delete window.__pomsSetDevtoolsFlag;
  };
}

// Stable per-tab id so the server can track each browser tab separately.
export function getTabId() {
  try {
    let id = sessionStorage.getItem('poms_tab_id');
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem('poms_tab_id', id);
    }
    return id;
  } catch { return 'no-storage'; }
}
