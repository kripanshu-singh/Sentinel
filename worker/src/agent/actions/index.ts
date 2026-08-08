/**
 * worker/src/agent/actions/index.ts
 *
 * Tiny action executors — the atomic browser primitives.
 * The `execute` node is a thin loop over these; it never reimplements steps inline,
 * so the graph cannot grow a 600-line switch.
 */

import type { Page } from "playwright";
import type { Navigator } from "../navigator.js";
import { updateCartQuantity, clickAddToCart, completeCheckout, loginToStore } from "../form-filler.js";
import { applyCouponCode, handleCouponFallback } from "../coupon.js";
import type { FallbackPolicy } from "../../types/index.js";

export interface ActionContext {
  navigator: Navigator;
  page: Page;
}

export interface ActionResult {
  url?: string;
  screenshot?: string;
}

export interface LoginActionResult extends ActionResult {
  authenticated: boolean;
  /** True when a login form was found on the page (whether or not login succeeded). */
  loginFormDetected: boolean;
}

export interface CouponActionResult extends ActionResult {
  success: boolean;
  errorMessage?: string;
  recoveryApplied?: boolean;
}

async function screenshotOf(page: Page): Promise<string | undefined> {
  try {
    const buffer = await page.screenshot({ type: "png" });
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return undefined;
  }
}

export async function navigate(ctx: ActionContext, url: string): Promise<ActionResult> {
  await ctx.navigator.navigate(url);
  return { url, screenshot: await screenshotOf(ctx.page) };
}

export async function login(
  ctx: ActionContext,
  username: string,
  password: string
): Promise<LoginActionResult> {
  const { authenticated, loginFormDetected } = await loginToStore(ctx.page, username, password);
  return { authenticated, loginFormDetected, screenshot: await screenshotOf(ctx.page) };
}

export async function search(ctx: ActionContext, query: string): Promise<ActionResult> {
  await ctx.navigator.search(query);
  return { screenshot: await screenshotOf(ctx.page) };
}

export async function addToCart(
  ctx: ActionContext,
  quantity: number,
  productName?: string,
  sku?: string,
  aliases?: string[]
): Promise<ActionResult> {
  await updateCartQuantity(ctx.page, quantity);
  await clickAddToCart(ctx.page, productName, sku, aliases);
  return { screenshot: await screenshotOf(ctx.page) };
}

export async function applyCoupon(
  ctx: ActionContext,
  code: string
): Promise<CouponActionResult> {
  const result = await applyCouponCode(ctx.page, code);
  return { ...result, screenshot: await screenshotOf(ctx.page) };
}

export async function applyCouponFallback(
  ctx: ActionContext,
  policy: FallbackPolicy
): Promise<CouponActionResult> {
  const result = await handleCouponFallback(ctx.page, policy);
  return { ...result, screenshot: await screenshotOf(ctx.page) };
}

export async function fillForm(
  ctx: ActionContext,
  fields: Record<string, string>
): Promise<ActionResult> {
  await completeCheckout(ctx.page, fields);
  return { screenshot: await screenshotOf(ctx.page) };
}

export async function captureScreenshot(ctx: ActionContext): Promise<string | undefined> {
  return screenshotOf(ctx.page);
}
