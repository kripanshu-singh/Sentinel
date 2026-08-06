/**
 * worker/src/agent/navigator.ts
 *
 * Playwright helper for browser session orchestration.
 * Handles page navigation, search execution, and DOM snapshotting.
 */

import { chromium, type Browser, type Page } from "playwright";

export class Navigator {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(): Promise<Page> {
    const headless = process.env.PLAYWRIGHT_HEADLESS !== "false";
    this.browser = await chromium.launch({
      headless,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    
    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    
    this.page = await context.newPage();
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
    await page.goto(url, { waitUntil: "networkidle" });
  }

  async search(query: string): Promise<void> {
    const page = this.getPage();
    const searchInput = page
      .locator('input[type="search"], input[name="q"], input[placeholder*="Search" i], input[aria-label*="Search" i], input[placeholder*="search" i]')
      .first();

    try {
      await searchInput.waitFor({ state: "visible", timeout: 3000 });
      await searchInput.fill(query);
      await searchInput.press("Enter");
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
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
