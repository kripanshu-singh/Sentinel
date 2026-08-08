/**
 * worker/src/agent/form-filler.ts
 *
 * Playwright helper for filling forms, modifying quantities,
 * and performing interactive checkout actions.
 */

import type { Page } from "playwright";

export async function updateCartQuantity(
  page: Page,
  quantity: number,
  inputSelector = 'input[name="quantity"], input[type="number"], .quantity-input'
): Promise<void> {
  try {
    await page.waitForSelector(inputSelector, { timeout: 5000 });
    await page.fill(inputSelector, quantity.toString());
    
    // Check if there is an Update button
    const updateButton = await page.$('button:has-text("Update"), button[title*="Update" i], .btn-update');
    if (updateButton) {
      await updateButton.click();
      await page.waitForLoadState("networkidle");
    } else {
      await page.press(inputSelector, "Enter");
      await page.waitForLoadState("networkidle");
    }
  } catch (err: unknown) {
    console.warn("[form-filler] Warning updating cart quantity:", err instanceof Error ? err.message : err);
  }
}

/**
 * Derive a SauceDemo-style data-test selector from a product display name.
 *
 * SauceDemo uses a predictable convention:
 *   "Sauce Labs Fleece Jacket"  →  [data-test="add-to-cart-sauce-labs-fleece-jacket"]
 *   "Sauce Labs Bike Light"     →  [data-test="add-to-cart-sauce-labs-bike-light"]
 *
 * This is far more reliable than `.first()` or container-text matching because
 * SauceDemo has no search — all items are always visible on the same page.
 */
function sauceDemoAddToCartSelector(productName: string): string {
  const slug = productName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `[data-test="add-to-cart-${slug}"]`;
}

export async function clickAddToCart(
  page: Page,
  productName?: string,
  sku?: string,
  aliases: string[] = [],
): Promise<void> {
  const GENERIC_SELECTOR =
    'button[id*="add-to-cart" i], button:has-text("Add to Cart"), button:has-text("Add to cart"), button:has-text("Add to Bag"), .add-to-cart';

  // "primary" is the ACTUAL extracted product name (real DOM title). "aliases"
  // are secondary names (user's phrasing / plan query) tried when no exact hit.
  const candidates = [productName, ...aliases].filter((n): n is string => Boolean(n));

  // Strategy 1: Find the product card by name, click the Add-to-Cart inside it.
  // This is the generic strategy that works for most storefronts.
  const cardSelectors = [".inventory_item", ".product-card", ".product-item", ".card", "[data-testid*='product']", "li"];
  for (const sel of cardSelectors) {
    for (const name of candidates) {
      try {
        const card = page.locator(sel).filter({ hasText: name }).first();
        if (await card.isVisible({ timeout: 1500 })) {
          const btn = card.locator(GENERIC_SELECTOR).first();
          if (await btn.isVisible({ timeout: 1500 })) {
            await btn.click();
            await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
            return;
          }
        }
      } catch {
        // Try next card selector
      }
    }

    // Strategy 1b: match the card by sku
    if (sku) {
      try {
        const card = page
          .locator(`${sel}:has([data-test*="${sku}" i])`)
          .first();
        if (await card.isVisible({ timeout: 1500 })) {
          const btn = card.locator(GENERIC_SELECTOR).first();
          if (await btn.isVisible({ timeout: 1500 })) {
            await btn.click();
            await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
            return;
          }
        }
      } catch {
        // Try next card selector
      }
    }
  }

  // Strategy 2: SauceDemo data-test attribute — kept as a reliable fallback
  // for the demo store only (harmless on other sites when selector not found).
  for (const name of candidates) {
    const dataTestSel = sauceDemoAddToCartSelector(name);
    try {
      const btn = page.locator(dataTestSel).first();
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click();
        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
        return;
      }
    } catch {
      // Not a SauceDemo page or selector not found — try next name
    }
  }

  // Strategy 2b: some storefronts key their add-to-cart button by SKU/data-test
  if (sku) {
    const skuSel = sauceDemoAddToCartSelector(sku);
    try {
      const btn = page.locator(skuSel).first();
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click();
        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
        return;
      }
    } catch {
      // fall through
    }
  }

  // Strategy 3: Generic last resort. Only reached when NO name/sku matched.
  // Check if a generic add-to-cart button is visible before attempting to click.
  const button = page.locator(GENERIC_SELECTOR).first();
  const isVisible = await button.isVisible({ timeout: 2500 }).catch(() => false);
  if (!isVisible) {
    console.warn(
      `[form-filler] No visible add-to-cart button found on current page for "${candidates[0] || sku || 'item'}". Skipping add-to-cart step cleanly.`
    );
    return;
  }

  await button.click();
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
}

/**
 * Sign in to a login-gated storefront.
 *
 * Returns:
 *   - `loginFormDetected`: whether a login form was present on the page
 *   - `authenticated`: whether login succeeded
 *
 * This is a no-op when the page shows no login form (loginFormDetected: false).
 * Credentials may be empty strings when the caller has none — in that case the
 * function detects the form but does NOT attempt to submit it, leaving
 * loginFormDetected: true and authenticated: false so the caller can pause for
 * human input instead of crashing.
 */
export async function loginToStore(
  page: Page,
  username: string,
  password: string
): Promise<{ authenticated: boolean; loginFormDetected: boolean }> {
  // A true login form must contain a password input field. Search submit buttons
  // or newsletter forms without password fields must never be flagged as login forms.
  const hasPasswordField = await page.locator('input[type="password"]').first().isVisible().catch(() => false);
  if (!hasPasswordField) {
    return { authenticated: false, loginFormDetected: false };
  }

  const loginButton = page.locator('#login-button, button[type="submit"], input[type="submit"]');
  if (!(await loginButton.first().isVisible().catch(() => false))) {
    return { authenticated: false, loginFormDetected: false };
  }

  // Login form detected. If credentials are empty, don't attempt to submit —
  // let the caller handle the missing-credentials case via HITL.
  if (!username || !password) {
    return { authenticated: false, loginFormDetected: true };
  }

  const usernameSelectors = [
    'input#user-name',
    'input[name="user-name"]',
    'input[data-test="username"]',
    'input[autocomplete="username"]',
    'input[name="username"]',
    'input[name="email"]',
    'input[type="email"]',
    'input[type="text"]',
  ];

  for (const sel of usernameSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 })) {
        await el.fill(username);
        break;
      }
    } catch {}
  }

  const passwordSelectors = [
    'input#password',
    'input[name="password"]',
    'input[data-test="password"]',
    'input[type="password"]',
    'input[autocomplete="current-password"]',
  ];

  for (const sel of passwordSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 })) {
        await el.fill(password);
        break;
      }
    } catch {}
  }

  await loginButton.first().click();

  const inventorySelectors = [
    ".inventory_list",
    "[data-test='inventory-container']",
    "[data-test='product-list']",
    "#inventory_container",
    "main",
    "[role='main']",
  ];

  for (const selector of inventorySelectors) {
    try {
      await page.locator(selector).first().waitFor({ state: "visible", timeout: 5000 });
      return { authenticated: true, loginFormDetected: true };
    } catch {
      // Try the next selector.
    }
  }

  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
  // If we're no longer on the login page, assume success.
  const stillOnLoginForm = await loginButton.first().isVisible().catch(() => false);
  return { authenticated: !stillOnLoginForm, loginFormDetected: true };
}

export async function openCartAndCheckout(page: Page): Promise<void> {
  const cartButton = page.locator('#shopping_cart_container, a.shopping_cart_link, button:has-text("Cart")').first();
  await cartButton.waitFor({ state: "visible", timeout: 10000 });
  await cartButton.click();
  await page.locator('#checkout, button:has-text("Checkout")').first().waitFor({ state: "visible", timeout: 10000 });
  const itemCount = await page.locator('.cart_item, .cart_list_item').count();
  if (itemCount === 0) {
    throw new Error("Cart is empty — add a product to the cart before checking out.");
  }
  await page.locator('#checkout, button:has-text("Checkout")').first().click();
  await page.locator('#first-name, input[name*="first" i]').first().waitFor({ state: "visible", timeout: 10000 });
}

export async function continueToReview(page: Page): Promise<void> {
  await page.locator("#continue").click();
  await page.locator(".checkout_summary_container").waitFor({ timeout: 10000 });
}

export async function completeCheckout(
  page: Page,
  fields: Record<string, string>
): Promise<void> {
  await openCartAndCheckout(page);
  await fillCheckoutForm(page, fields);
  await continueToReview(page);
}

export async function fillCheckoutForm(
  page: Page,
  fields: Record<string, string>
): Promise<void> {
  // Common form field selectors mapped to keys
  const mapping: Record<string, string[]> = {
    firstName: ['input[name*="first" i]', 'input[id*="first" i]', 'input[autocomplete*="given-name"]'],
    lastName: ['input[name*="last" i]', 'input[id*="last" i]', 'input[autocomplete*="family-name"]'],
    address: ['input[name*="address" i]', 'input[id*="address1" i]', 'input[autocomplete*="address-line1"]'],
    city: ['input[name*="city" i]', 'input[id*="city" i]', 'input[autocomplete*="address-level2"]'],
    postalCode: ['input[id*="postal" i]', 'input[name*="zip" i]', 'input[name*="post" i]', 'input[autocomplete*="postal-code"]'],
    email: ['input[type="email"]', 'input[name*="email" i]'],
    phone: ['input[type="tel"]', 'input[name*="phone" i]'],
  };

  for (const [key, value] of Object.entries(fields)) {
    const selectors = mapping[key] ?? [`input[name*="${key}" i]`, `input[id*="${key}" i]`];
    let filled = false;

    for (const selector of selectors) {
      try {
        const el = await page.$(selector);
        if (el && await el.isVisible()) {
          await el.fill(value);
          filled = true;
          break;
        }
      } catch {
        // Try next selector
      }
    }

    if (!filled) {
      console.warn(`[form-filler] Could not find field to fill for key: ${key}`);
    }
  }
}
