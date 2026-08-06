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

export async function clickAddToCart(
  page: Page,
  productName?: string,
  buttonSelector = 'button[id*="add-to-cart" i], button:has-text("Add to Cart"), button:has-text("Add to cart"), .add-to-cart'
): Promise<void> {
  let button = page.locator(buttonSelector).first();

  if (productName) {
    const containers = [
      '.inventory_item',
      '.product-card',
      '.product-item',
      '.card',
      'tr',
      'div'
    ];

    for (const selector of containers) {
      try {
        const card = page.locator(selector).filter({ hasText: productName }).first();
        if (await card.isVisible()) {
          const cardButton = card.locator(buttonSelector).first();
          if (await cardButton.isVisible()) {
            button = cardButton;
            break;
          }
        }
      } catch {
        // Fall back to general locator
      }
    }
  }

  await button.waitFor({ state: "visible", timeout: 10000 });
  await button.click();
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
}

/**
 * Sign in to a login-gated storefront (Sauce Demo). No-op when the page shows
 * no login form — returns false so callers can skip the auth event.
 */
export async function loginToStore(
  page: Page,
  username: string,
  password: string
): Promise<boolean> {
  const loginButton = page.locator('#login-button, button[type="submit"], input[type="submit"]');
  if (!(await loginButton.first().isVisible().catch(() => false))) {
    return false;
  }
  await page.fill('input#user-name, input[name="user-name"], input[type="text"]', username).catch(() => undefined);
  await page.fill('input#password, input[name="password"]', password).catch(() => undefined);
  await loginButton.first().click();

  const inventorySelectors = [
    ".inventory_list",
    "[data-test='inventory-container']",
    "[data-test='product-list']",
    "#inventory_container",
  ];

  for (const selector of inventorySelectors) {
    try {
      await page.locator(selector).first().waitFor({ state: "visible", timeout: 5000 });
      return true;
    } catch {
      // Try the next selector.
    }
  }

  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
  return true;
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
