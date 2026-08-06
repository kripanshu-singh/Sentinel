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
  buttonSelector = 'button[id*="add-to-cart" i], button:has-text("Add to Cart"), .add-to-cart'
): Promise<void> {
  // `.first()` avoids Playwright strict-mode violations when the storefront
  // renders several add-to-cart buttons at once (e.g. Sauce Demo inventory grid).
  const button = page.locator(buttonSelector).first();
  await button.waitFor({ timeout: 5000 });
  await button.click();
  await page.waitForLoadState("networkidle");
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
  const loginButton = page.locator("#login-button");
  if (!(await loginButton.isVisible().catch(() => false))) {
    return false;
  }
  await page.fill("#user-name", username);
  await page.fill("#password", password);
  await loginButton.click();
  await page.locator(".inventory_list").waitFor({ timeout: 15000 });
  return true;
}

export async function openCartAndCheckout(page: Page): Promise<void> {
  await page.locator("#shopping_cart_container").click();
  await page.locator("#checkout").waitFor({ timeout: 5000 });
  const itemCount = await page.locator(".cart_item").count();
  if (itemCount === 0) {
    throw new Error("Cart is empty — add a product to the cart before checking out.");
  }
  await page.locator("#checkout").click();
  await page.locator("#first-name").waitFor({ timeout: 10000 });
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
