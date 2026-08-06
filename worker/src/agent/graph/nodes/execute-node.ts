/**
 * worker/src/agent/graph/nodes/execute-node.ts
 *
 * EXECUTE node — a deterministic step machine. Processes ONE plan step per
 * invocation, then routes to the next node via the `next` channel:
 *
 *   action steps   → "execute"  (self-loop, next step)
 *   extract_product→ "extract"
 *   check_price    → "validate"
 *   draft_report   → "report_node"
 *   terminal state → "end"
 *
 * All side effects run through the tiny action executors; no step logic is
 * inlined here.
 */

import { sessionManager } from "../../session/session-manager.js";
import * as actions from "../../actions/index.js";
import type { ActionContext } from "../../actions/index.js";
import { emitEvent, transition } from "../emit.js";
import { failRun, MAX_RETRIES_PER_NODE, retryUpdate } from "../retry.js";
import type { StepPlan } from "../../../types/index.js";
import type { SentinelStateUpdate, SentinelStateValue } from "../state.js";

const DEFAULT_STOREFRONT_URL = "https://www.saucedemo.com/";

// Public demo credentials for Sauce Demo (standard_user / secret_sauce) — not secrets.
const SAUCEDEMO_USERNAME = "standard_user";
const SAUCEDEMO_PASSWORD = "secret_sauce";

const SHIPPING_FIELDS = {
  firstName: "Sentinel",
  lastName: "Reconciler",
  postalCode: "94103",
};

function quantityFromGoal(goal: string): number {
  const match = goal.match(/(\d+)\s*unit/i);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Open a URL, sign in to the demo portal if present, and return the resulting
 * screenshot for transparency. Shared by the navigate step and the first-entry
 * default navigation below.
 */
async function navigateAndLogin(
  runId: string,
  ctx: ActionContext,
  url: string
): Promise<{ url?: string; screenshot: string | null }> {
  await emitEvent(runId, "NAVIGATE", "Navigating", `Opening url: ${url}`, "pending", { url });
  const result = await actions.navigate(ctx, url);
  await emitEvent(runId, "NAVIGATE", "Navigation complete", `Loaded ${url}`, "success", { url: result.url, screenshot: result.screenshot });

  // Portals gate the catalog behind a login form (Sauce Demo does). Sign in
  // with the demo account so the product listing is reachable; no-op if the
  // storefront exposes no login form.
  const loginResult = await actions.login(ctx, SAUCEDEMO_USERNAME, SAUCEDEMO_PASSWORD);
  if (loginResult.authenticated) {
    await emitEvent(
      runId,
      "NAVIGATE",
      "Signed in",
      "Authenticated to vendor portal with demo credentials",
      "success",
      { screenshot: loginResult.screenshot }
    );
  }

  return { url: result.url, screenshot: loginResult.screenshot ?? result.screenshot ?? null };
}

export async function executeNode(
  state: SentinelStateValue
): Promise<SentinelStateUpdate> {
  const { runId, input, planResult, stepIndex, sessionId } = state;

  if (state.status === "FAILED" || state.status === "ABORTED") {
    return { next: "end" };
  }
  if (!planResult) {
    return { next: "end" };
  }

  const plan = planResult.plan;

  // Lazily create the browser session on first entry (principle: browser launches
  // only after planning). sessionId lives in state; the Page never does.
  if (sessionId == null) {
    await transition(runId, "NAVIGATING");
    const session = await sessionManager.get(runId);
    const ctx: ActionContext = { navigator: session.navigator, page: session.page };
    await emitEvent(runId, "NAVIGATE", "Starting browser", "Initializing headless browser viewport...", "pending");
    await emitEvent(runId, "NAVIGATE", "Browser initialized", "Connected to Chromium context successfully", "success");

    // Plans don't always carry a navigate step (deterministic fallback, LLM
    // omissions). Open the default storefront so the first action never runs
    // against a blank page.
    if (plan[stepIndex]?.kind !== "navigate") {
      const { screenshot } = await navigateAndLogin(runId, ctx, DEFAULT_STOREFRONT_URL);
      return {
        sessionId: runId,
        stepIndex,
        currentURL: DEFAULT_STOREFRONT_URL,
        currentScreenshot: screenshot,
        status: "NAVIGATING",
        next: "execute",
      };
    }
  }

  if (stepIndex >= plan.length) {
    // Plan exhausted — wrap up with the report node.
    return { sessionId: runId, status: "NAVIGATING", next: "report_node" };
  }

  const step = plan[stepIndex];
  const session = await sessionManager.get(runId);
  const ctx: actions.ActionContext = { navigator: session.navigator, page: session.page };
  const base: SentinelStateUpdate = {
    sessionId: runId,
    stepIndex: stepIndex + 1,
    lastAction: step.description,
    next: "execute",
  };

  try {
    switch (step.kind) {
    case "navigate": {
      const url = (step.params?.url as string | undefined) ?? DEFAULT_STOREFRONT_URL;
      const { url: resolvedUrl, screenshot } = await navigateAndLogin(runId, ctx, url);

      return {
        ...base,
        currentURL: resolvedUrl ?? url,
        currentScreenshot: screenshot,
      };
    }

    case "search": {
      // Product name comes from the plan (params.query, set by the LLM from the
      // goal). Fall back to the user's own goal text — never a hardcoded product.
      const query = (step.params?.query as string | undefined) ?? input.goal;
      await emitEvent(runId, "SEARCH", "Searching catalog", `Searching for "${query}"`, "pending");
      const result = await actions.search(ctx, query);
      await emitEvent(runId, "SEARCH", "Search complete", `Found results matching "${query}"`, "success", { screenshot: result.screenshot });
      return { ...base, currentScreenshot: result.screenshot ?? null };
    }

    case "add_to_cart": {
      const qty = quantityFromGoal(input.goal);
      await emitEvent(runId, "FORM_FILL", "Adding items to cart", `Adding quantity: ${qty}`, "pending");
      const result = await actions.addToCart(ctx, qty);
      await emitEvent(runId, "FORM_FILL", "Cart updated", "Items successfully loaded into session cart", "success", { screenshot: result.screenshot });
      return { ...base, currentScreenshot: result.screenshot ?? null };
    }

    case "apply_coupon": {
      if (!input.discountCode) {
        return base;
      }
      await emitEvent(runId, "VALIDATE", "Applying discount code", `Attempting promo application: ${input.discountCode}`, "pending");
      const couponResult = await actions.applyCoupon(ctx, input.discountCode);

      if (!couponResult.success) {
        await emitEvent(runId, "VALIDATE", "Promo code failed", couponResult.errorMessage ?? "Invalid coupon", "error", { screenshot: couponResult.screenshot, errorMessage: couponResult.errorMessage });
        await transition(runId, "RECOVERING");

        const fallbackResult = await actions.applyCouponFallback(ctx, input.fallbackPolicy);
        if (!fallbackResult.success) {
          await transition(runId, "ABORTED");
          await emitEvent(runId, "RECOVER", "Fallback failed", fallbackResult.errorMessage ?? "Graceful recovery aborted", "error");
          return { ...base, status: "ABORTED", next: "end" };
        }

        await emitEvent(runId, "RECOVER", "Graceful recovery applied", "Proceeding under fallback guidelines", "success", { screenshot: fallbackResult.screenshot });
        return { ...base, currentScreenshot: fallbackResult.screenshot ?? null };
      }

      await emitEvent(runId, "VALIDATE", "Promo code applied", "Coupon discount accepted by checkout gateway", "success", { screenshot: couponResult.screenshot });
      return { ...base, currentScreenshot: couponResult.screenshot ?? null };
    }

    case "pause_for_approval":
      await emitEvent(runId, "CHECK", "Human confirmation needed", "The agent has paused to ask for your approval before proceeding.", "pending");
      return {
        ...base,
        status: "HITL_PENDING",
        pendingHITL: true,
        requiresApproval: true,
        next: "validate",
      };

    case "fill_form": {
      await transition(runId, "FORM_FILLING");
      await emitEvent(runId, "FORM_FILL", "Opening checkout", "Moving cart to checkout and filling the shipping form...", "pending");
      const result = await actions.fillForm(ctx, SHIPPING_FIELDS);
      await emitEvent(runId, "FORM_FILL", "Checkout prepared", "Shipping details filled; order staged at the final review screen", "success", { screenshot: result.screenshot });
      return { ...base, currentScreenshot: result.screenshot ?? null };
    }

    case "validate": {
      await transition(runId, "VALIDATING");
      await emitEvent(runId, "VALIDATE", "Final validation", "Double checking totals, taxes and fees", "pending");
      await emitEvent(runId, "VALIDATE", "Validation passed", "Order matches planned thresholds exactly", "success");
      return base;
    }

    case "extract_product":
      return { ...base, status: "EXTRACTING", next: "extract" };

    case "check_price":
      return { ...base, status: "CHECKING", next: "validate" };

    case "draft_report":
      return { ...base, status: "DRAFT_READY", next: "report_node" };

    default:
      // Unknown step kind — skip it rather than crash.
      console.warn(`[execute:${runId}] Skipping unknown step kind: ${(step as { kind: string }).kind}`);
      return base;
    }
  } catch (error: unknown) {
    // Phase C — a thrown step error routes to REPLAN while `execute` has retry
    // budget; otherwise the run FAILS.
    // Strip ANSI escape codes (Playwright error logs) so control characters
    // never leak into the replan prompt or the failure event.
    const detail = (error instanceof Error ? error.message : String(error)).replace(
      /\u001b\[[0-9;]*m/g,
      ""
    );
    const retries = state.nodeRetries["execute"] ?? 0;

    if (retries >= MAX_RETRIES_PER_NODE) {
      await emitEvent(
        runId,
        "RECOVER",
        "Step failed",
        `Step ${step.kind} failed again (attempt ${retries + 1}).`,
        "error",
        { step: step.kind, nodeRetries: state.nodeRetries }
      );
      return failRun(
        runId,
        "RECOVER",
        "Run failed",
        `Step ${step.kind} could not recover after ${MAX_RETRIES_PER_NODE} replans: ${detail.slice(0, 160)}`
      );
    }

    await emitEvent(
      runId,
      "RECOVER",
      "Step failed — replanning",
      `Step ${step.kind} failed (attempt ${retries + 1}/${MAX_RETRIES_PER_NODE}): ${detail.slice(0, 160)}`,
      "error",
      { step: step.kind, retry: retries + 1 }
    );
    return retryUpdate(state, "execute", "step_error", `${step.kind}: ${detail.slice(0, 160)}`);
  }
}
