/**
 * worker/src/agent/navigator.ts
 *
 * Playwright helper for browser session orchestration.
 * Handles page navigation, search execution, and DOM snapshotting.
 *
 * Stealth mode: patches ~10 fingerprint signals so common bot detectors
 * (Cloudflare, PerimeterX, DataDome, Amazon's internal checks) don't
 * immediately block the session. This is not a silver bullet — heavy
 * anti-bot walls (hCaptcha, reCAPTCHA v3) still require a solving service.
 */

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

// ---------------------------------------------------------------------------
// Stealth init script — injected into every page before any JS runs.
// Covers the most commonly fingerprinted signals.
// ---------------------------------------------------------------------------
const STEALTH_INIT_SCRIPT = `
(function () {
  // 1. Hide navigator.webdriver
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

  // 2. Restore realistic plugins array (headless Chrome has 0 plugins)
  Object.defineProperty(navigator, 'plugins', {
    get: () => {
      const plugins = [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
      ];
      plugins.refresh = () => {};
      return plugins;
    },
  });

  // 3. Realistic languages
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

  // 4. Restore chrome object (missing in headless)
  if (!window.chrome) {
    window.chrome = {
      runtime: {
        PlatformOs: { MAC: 'mac', WIN: 'win', ANDROID: 'android', CROS: 'cros', LINUX: 'linux', OPENBSD: 'openbsd' },
        PlatformArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64', MIPS: 'mips', MIPS64: 'mips64' },
        PlatformNaclArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64', MIPS: 'mips', MIPS64: 'mips64' },
        RequestUpdateCheckStatus: { THROTTLED: 'throttled', NO_UPDATE: 'no_update', UPDATE_AVAILABLE: 'update_available' },
        OnInstalledReason: { INSTALL: 'install', UPDATE: 'update', CHROME_UPDATE: 'chrome_update', SHARED_MODULE_UPDATE: 'shared_module_update' },
        OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
      },
    };
  }

  // 5. Pass permissions query (some sites check Notification.permission)
  const originalQuery = window.navigator.permissions?.query;
  if (originalQuery) {
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission, onchange: null })
        : originalQuery(parameters);
  }

  // 6. Consistent screen dimensions
  Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
  Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
})();
`;

// Randomise between 1280×800, 1366×768, 1440×900 to vary fingerprint
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
];

// Rotate between realistic desktop Chrome UAs
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Random delay between min…max ms — breaks timing-based bot detectors */
async function humanDelay(minMs = 300, maxMs = 900): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  await new Promise((r) => setTimeout(r, ms));
}

export class Navigator {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async initialize(): Promise<Page> {
    const headless = process.env.PLAYWRIGHT_HEADLESS !== "false";
    const userAgent = pick(USER_AGENTS);
    const viewport = pick(VIEWPORTS);

    this.browser = await chromium.launch({
      headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        // ── Critical stability flags ────────────────────────────────────────
        // Chromium's default /dev/shm allocation (64MB) is too small for
        // heavy sites (Amazon, eBay) and causes "Page crashed" errors.
        // Writing to /tmp instead prevents the crash.
        "--disable-dev-shm-usage",
        // Disable the zygote process — avoids crashes in resource-constrained envs
        "--no-zygote",
        // ── Stealth flags ───────────────────────────────────────────────────
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        "--disable-gpu-sandbox",
        "--disable-features=MediaFoundationVideoCapture",
        // ── Memory / performance / network ──────────────────────────────────
        // Disable HTTP/2 multiplexing — avoids ERR_HTTP2_PROTOCOL_ERROR on sites
        // like Myntra/Ajio that RST HTTP/2 streams for automated browser contexts.
        "--disable-http2",
        // Limit renderer memory so a heavy page doesn't OOM the whole process
        "--renderer-process-limit=2",
        "--max-old-space-size=512",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-extensions",
      ],
    });

    this.context = await this.browser.newContext({
      viewport,
      userAgent,
      locale: "en-US",
      timezoneId: "America/New_York",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    await this.context.addInitScript(STEALTH_INIT_SCRIPT);

    this.page = await this.context.newPage();

    // Block images, fonts, and media to cut page weight by ~60%.
    // This dramatically reduces memory usage and crash rate on heavy sites
    // (Amazon, eBay) while still loading all HTML, CSS, and JS the extractor needs.
    await this.page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (["image", "media", "font"].includes(type)) {
        route.abort().catch(() => undefined);
      } else {
        route.continue().catch(() => undefined);
      }
    });

    return this.page;
  }

  getPage(): Page {
    if (!this.page) {
      throw new Error("Navigator not initialized. Call initialize() first.");
    }
    return this.page;
  }

  async navigate(url: string): Promise<void> {
    const page = this.getPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    // Brief human-like pause after page load
    await humanDelay(500, 1200);
    // Wait for network to settle (non-fatal if it times out)
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => undefined);
  }

  async search(query: string): Promise<void> {
    const page = this.getPage();
    const searchInput = page
      .locator('input[type="search"], input[name="q"], input[placeholder*="Search" i], input[aria-label*="Search" i], input[placeholder*="search" i]')
      .first();

    try {
      await searchInput.waitFor({ state: "visible", timeout: 5000 });
      // Type like a human — character by character with small delays
      await searchInput.click();
      await humanDelay(100, 300);
      await searchInput.pressSequentially(query, { delay: 50 + Math.random() * 80 });
      await humanDelay(200, 500);
      await searchInput.press("Enter");
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
      return;
    } catch {
      // Some storefronts do not expose a dedicated search box. In that case, we
      // simply wait for a product list or any content change and continue.
      const fallbackSelectors = [
        ".inventory_list",
        "[data-testid='inventory-container']",
        "[data-testid='product-grid']",
        "main",
        "body",
      ];

      for (const selector of fallbackSelectors) {
        try {
          await page.locator(selector).first().waitFor({ state: "visible", timeout: 3000 });
          break;
        } catch {
          // Keep trying the next selector.
        }
      }
    }
  }

  async getDOMSnapshot(): Promise<string> {
    const page = this.getPage();
    // Return visible HTML or text content to send to the LLM extractor
    return page.evaluate(() => {
      // Clean up scripts, styles, svg to fit context window limits
      const clone = document.documentElement.cloneNode(true) as HTMLElement;
      const toRemove = clone.querySelectorAll("script, style, svg, iframe, noscript");
      toRemove.forEach((el: Element) => el.remove());
      return clone.outerHTML;
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }
}
