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
import { extractQuantityForProduct } from "../../../lib/goal-rules.js";
import { drainSteers } from "../../../storage/redis.js";
import { RunLogger } from "../../../lib/logger.js";
import type { StepPlan } from "../../../types/index.js";
import type { ReplanEntry, SentinelStateUpdate, SentinelStateValue } from "../state.js";


// Placeholder fields used for checkout form when no fields are provided in the plan.
// These are generic demo values — real storefronts should supply fields via the plan.
const PLACEHOLDER_SHIPPING_FIELDS = {
  firstName: "Sentinel",
  lastName: "Reconciler",
  postalCode: "94103",
};

function quantityFromGoal(goal: string): number {
  const match = goal.match(/(\d+)\s*unit/i);
  return match ? parseInt(match[1], 10) : 1;
}

function productNameFromStep(step: StepPlan, goal: string): string | undefined {
  const name =
    (step.params?.targetName as string | undefined) ??
    (step.params?.query as string | undefined);
  return name ?? goal;
}

function quantityForStep(step: StepPlan, goal: string): number {
  const planQty = step.params?.quantity;
  if (typeof planQty === "number" && Number.isFinite(planQty) && planQty > 0) {
    return Math.round(planQty);
  }
  const productName = productNameFromStep(step, goal);
  return extractQuantityForProduct(goal, productName);
}

/**
 * Open a URL and sign in if the storefront has a login form.
 *
 * Credential resolution priority:
 *   1. `state.input.credentials` provided by the operator via the UI
 *   2. If a login form is detected and no credentials are available, pause and
 *      emit a HITL_PENDING event asking the operator to supply them — never
 *      guess or hardcode credentials for arbitrary storefronts.
 */
async function navigateAndLogin(
  runId: string,
  ctx: ActionContext,
  url: string,
  credentials?: { username: string; password: string }
): Promise<{ url?: string; screenshot: string | null; hitlRequired?: boolean }> {
  await emitEvent(runId, "NAVIGATE", "Navigating", `Opening url: ${url}`, "pending", { url });
  const result = await actions.navigate(ctx, url);
  await emitEvent(runId, "NAVIGATE", "Navigation complete", `Loaded ${url}`, "success", { url: result.url, screenshot: result.screenshot });

  // Check if the page has a login form before attempting any login.
  const loginResult = await actions.login(
    ctx,
    credentials?.username ?? "",
    credentials?.password ?? ""
  );

  if (loginResult.loginFormDetected && !loginResult.authenticated) {
    // Login form found but we have no credentials — pause for human input.
    if (!credentials) {
      await emitEvent(
        runId,
        "NAVIGATE",
        "Login required",
        "This storefront requires authentication. Please provide credentials via the HITL panel and approve to continue, or abort the run.",
        "error",
        { screenshot: loginResult.screenshot, requiresCredentials: true }
      );
      return { url: result.url, screenshot: loginResult.screenshot ?? result.screenshot ?? null, hitlRequired: true };
    }
    // Credentials were provided but login still failed.
    await emitEvent(
      runId,
      "NAVIGATE",
      "Login failed",
      "Authentication failed with the provided credentials. Check username/password and retry.",
      "error",
      { screenshot: loginResult.screenshot }
    );
    return { url: result.url, screenshot: loginResult.screenshot ?? result.screenshot ?? null };
  }

  if (loginResult.authenticated) {
    await emitEvent(
      runId,
      "NAVIGATE",
      "Signed in",
      `Authenticated to vendor portal${credentials ? " with provided credentials" : ""}`,
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
  const runLog = new RunLogger(runId);

  if (state.status === "FAILED" || state.status === "ABORTED") {
    return { next: "end" };
  }
  if (!planResult) {
    return { next: "end" };
  }

  // Drain live operator steer instructions at step boundaries (ADR-012)
  const pendingSteers = await drainSteers(runId);
  if (pendingSteers.length > 0) {
    const steerEntries: ReplanEntry[] = [];
    for (const instruction of pendingSteers) {
      await emitEvent(
        runId,
        "STEER",
        "Operator steer received",
        instruction,
        "success",
        { instruction }
      );
      steerEntries.push({
        node: "execute",
        reason: "human_instruction",
        retry: 0,
        detail: instruction,
        timestamp: new Date().toISOString(),
      });
    }
    await transition(runId, "RECOVERING");
    return {
      sessionId: runId,
      replanContext: steerEntries,
      status: "RECOVERING",
      next: "replan",
    };
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
    // omissions). We need a URL to open the browser against — use storefrontUrl
    // from the input if set, otherwise require the LLM to have emitted a navigate
    // step (the updated system prompt enforces this). Surface a clear error rather
    // than silently opening a hardcoded demo URL.
    if (plan[stepIndex]?.kind !== "navigate") {
      const fallbackUrl = input.storefrontUrl;
      if (!fallbackUrl) {
        // The plan has no navigate step and no storefrontUrl was supplied.
        // Fail the run cleanly and transition database status to FAILED.
        return failRun(
          runId,
          "NAVIGATE",
          "No storefront URL",
          "No navigate step in plan and no storefrontUrl provided. Please include a URL in your goal (e.g. 'on https://www.amazon.com') or set the Storefront URL field."
        );
      }
      const { screenshot, hitlRequired } = await navigateAndLogin(runId, ctx, fallbackUrl, input.credentials);
      if (hitlRequired) {
        return {
          sessionId: runId,
          stepIndex,
          currentURL: fallbackUrl,
          currentScreenshot: screenshot,
          status: "HITL_PENDING",
          pendingHITL: true,
          requiresApproval: true,
          next: "validate",
        };
      }
      return {
        sessionId: runId,
        stepIndex,
        currentURL: fallbackUrl,
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
    status: state.status || "NAVIGATING",
    next: "execute",
  };

  try {
    switch (step.kind) {
    case "navigate": {
      const url = (step.params?.url as string | undefined) ?? input.storefrontUrl;
      if (!url) {
        return failRun(
          runId,
          "NAVIGATE",
          "No storefront URL",
          "Navigate step has no URL and no storefrontUrl was provided. Please specify a URL in the goal or set the Storefront URL field."
        );
      }
      const { url: resolvedUrl, screenshot, hitlRequired } = await navigateAndLogin(runId, ctx, url, input.credentials);
      if (hitlRequired) {
        return {
          ...base,
          currentURL: resolvedUrl ?? url,
          currentScreenshot: screenshot,
          status: "HITL_PENDING",
          pendingHITL: true,
          requiresApproval: true,
          next: "validate",
        };
      }
      return {
        ...base,
        currentURL: resolvedUrl ?? url,
        currentScreenshot: screenshot,
        status: "NAVIGATING",
      };
    }

    case "search": {
      const query = (step.params?.query as string | undefined) ?? input.goal;
      await emitEvent(runId, "SEARCH", "Searching catalog", `Searching for "${query}"`, "pending");
      const result = await actions.search(ctx, query);
      // On searchless storefronts like SauceDemo the search action is a no-op
      // (no search box). Scroll the matching inventory card into view so the
      // page state is meaningful before the extract step runs.
      try {
        const card = ctx.page
          .locator(".inventory_item, .product-card, .product-item")
          .filter({ hasText: query })
          .first();
        if (await card.isVisible({ timeout: 2000 })) {
          await card.scrollIntoViewIfNeeded();
        }
      } catch {
        // Not critical — proceed
      }
      await emitEvent(runId, "SEARCH", "Search complete", `Found results matching "${query}"`, "success", { screenshot: result.screenshot });
      return { ...base, currentScreenshot: result.screenshot ?? null };
    }

    case "add_to_cart": {
      const qty = quantityForStep(step, input.goal);
      // Prefer the ACTUAL product the agent extracted (real DOM title + sku) over
      // the user's phrasing. A plan step may say "infant dress" while the
      // storefront names it "Sauce Labs Onesie" — clicking by plan text falls
      // through to the generic first-button fallback and adds the WRONG product.
      const extracted = state.currentProduct?.product;
      let productName = extracted?.description;
      const sku = extracted?.sku;
      const aliases: string[] = [];
      for (let i = stepIndex; i >= 0; i--) {
        const s = plan[i];
        const name = (s?.params?.targetName ?? s?.params?.query) as string | undefined;
        if (name) {
          aliases.push(name);
          productName ??= name;
          break;
        }
      }
      await emitEvent(runId, "FORM_FILL", "Adding items to cart", `Adding quantity: ${qty}${productName ? ` for "${productName}"` : ""}`, "pending");
      const result = await actions.addToCart(ctx, qty, productName, sku, aliases);
      await emitEvent(runId, "FORM_FILL", "Cart updated", `${productName ?? "Items"} successfully loaded into session cart`, "success", { screenshot: result.screenshot });
      return { ...base, currentScreenshot: result.screenshot ?? null };
    }

    case "apply_coupon": {
      const couponCode =
        input.discountCode ||
        (step.params?.code as string | undefined) ||
        (step.params?.couponCode as string | undefined);

      if (!couponCode) {
        // No coupon in the goal or plan — skip silently (no discount requested).
        return base;
      }

      await emitEvent(runId, "VALIDATE", "Applying discount code", `Attempting promo application: ${couponCode}`, "pending");
      const couponResult = await actions.applyCoupon(ctx, couponCode);

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
      const formFields = (step.params?.fields as Record<string, string> | undefined) ?? PLACEHOLDER_SHIPPING_FIELDS;
      const result = await actions.fillForm(ctx, formFields);
      await emitEvent(runId, "FORM_FILL", "Checkout prepared", "Shipping details filled; order staged at the final review screen", "success", { screenshot: result.screenshot });

      // Capture the order review screen explicitly so the live panel shows
      // the final staged order as visual evidence before the report is drafted.
      const reviewScreenshot = await actions.captureScreenshot(ctx);
      if (reviewScreenshot) {
        await emitEvent(
          runId,
          "FORM_FILL",
          "Order review captured",
          "Screenshot of the final order review screen taken for the reconciliation report.",
          "success",
          { screenshot: reviewScreenshot }
        );
      }

      return { ...base, currentScreenshot: reviewScreenshot ?? result.screenshot ?? null };
    }

    case "validate": {
      return { ...base, status: "VALIDATING", next: "validate" };
    }

    case "extract_product":
      return { ...base, status: "EXTRACTING", next: "extract" };

    case "check_price":
      return { ...base, status: "CHECKING", next: "validate" };

    case "draft_report":
      return { ...base, status: "DRAFT_READY", next: "report_node" };

    default:
      // Unknown step kind — skip it rather than crash.
      runLog.warn("execute", `Skipping unknown step kind: ${(step as { kind: string }).kind}`);
      return base;
    }
  } catch (error: unknown) {
    // Phase C — a thrown step error routes to REPLAN while `execute` has retry
    // budget; otherwise the run FAILS.
    // Strip ANSI escape codes (Playwright error logs) so control characters
    // never leak into the replan prompt or the failure event.
    const rawDetail = (error instanceof Error ? error.message : String(error)).replace(
      /\u001b\[[0-9;]*m/g,
      ""
    );
    // Log the full error to both terminal and SSE timeline
    runLog.error("execute", `Step ${step.kind} threw an error`, { error: rawDetail, step: step.kind });

    const detail = rawDetail;
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
        `Step ${step.kind} could not recover after ${MAX_RETRIES_PER_NODE} replans: ${detail.slice(0, 300)}`
      );
    }

    await emitEvent(
      runId,
      "RECOVER",
      "Step failed — replanning",
      `Step ${step.kind} failed (attempt ${retries + 1}/${MAX_RETRIES_PER_NODE}): ${detail.slice(0, 300)}`,
      "error",
      { step: step.kind, retry: retries + 1, fullError: detail }
    );
    return retryUpdate(state, "execute", "step_error", `${step.kind}: ${detail.slice(0, 300)}`);
  }
}
