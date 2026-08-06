/**
 * worker/src/agent/coupon.ts
 *
 * Coupon application and detection of coupon application failure.
 * Implements graceful recovery based on fallback policy if coupon fails.
 */

import type { Page } from "playwright";
import type { FallbackPolicy } from "../types/index.js";

export interface CouponApplyResult {
  success: boolean;
  errorMessage?: string;
  recoveryApplied?: boolean;
}

export async function applyCouponCode(
  page: Page,
  code: string,
  inputSelector = 'input[placeholder*="promo" i], input[name*="coupon" i], input[name*="promo" i], .coupon-input',
  buttonSelector = 'button:has-text("Apply"), button[id*="coupon" i], .coupon-btn'
): Promise<CouponApplyResult> {
  try {
    await page.waitForSelector(inputSelector, { timeout: 5000 });
    await page.fill(inputSelector, code);
    await page.click(buttonSelector);
    await page.waitForLoadState("networkidle");

    // Wait a brief moment for dynamic validation error notices to show in DOM
    await page.waitForTimeout(1000);

    // Look for common failure indicators in DOM
    const hasErrorText = await page.evaluate(() => {
      const texts = [
        "invalid coupon",
        "invalid code",
        "coupon expired",
        "expired code",
        "cannot be applied",
        "not found",
        "error",
      ];
      const bodyText = document.body.innerText.toLowerCase();
      return texts.some((txt) => bodyText.includes(txt));
    });

    if (hasErrorText) {
      return {
        success: false,
        errorMessage: "Discount code invalid or expired.",
      };
    }

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      errorMessage: err instanceof Error ? err.message : "Failed to apply coupon",
    };
  }
}

export async function handleCouponFallback(
  page: Page,
  policy: FallbackPolicy,
  defaultWholesaleCode = "WHOLESALE_DEFAULT"
): Promise<CouponApplyResult> {
  console.log(`[coupon] Recovering with fallback policy: ${policy}`);
  
  if (policy === "abort") {
    return {
      success: false,
      errorMessage: "Aborting run due to coupon application failure policy constraint.",
    };
  }

  if (policy === "best_available") {
    // Try other known fallback codes or proceed anyway
    console.log("[coupon] Falling back to best available promo code...");
    const alternativeCodes = ["WELCOME10", "PROMO5"];
    for (const alt of alternativeCodes) {
      const res = await applyCouponCode(page, alt);
      if (res.success) {
        return { success: true, recoveryApplied: true };
      }
    }
  }

  if (policy === "default_wholesale") {
    console.log(`[coupon] Applying default wholesale tier code: ${defaultWholesaleCode}`);
    const res = await applyCouponCode(page, defaultWholesaleCode);
    return {
      success: res.success,
      errorMessage: res.errorMessage,
      recoveryApplied: res.success,
    };
  }

  // default: proceed without code
  return { success: true, recoveryApplied: false };
}
