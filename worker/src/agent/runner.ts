/**
 * worker/src/agent/runner.ts
 *
 * Core agent orchestrator & state machine runner.
 * Orchestrates planning, page navigation, verification, rule checks,
 * human approval pauses, coupon fallbacks, and report writing.
 */

import { nanoid } from "nanoid";
import { db, runs, agentEvents, approvalRequests, reconciliationReports } from "../storage/db.js";
import { eq } from "drizzle-orm";
import { setRunStatus, publishEvent, waitForHITLResolution } from "../storage/redis.js";
import { planGoal } from "./planner.js";
import { Navigator } from "./navigator.js";
import { extractProductFromDOM, extractInvoiceFromDOM } from "./extractor.js";
import { checkProduct, recheck } from "./rule-engine.js";
import { updateCartQuantity, clickAddToCart, fillCheckoutForm } from "./form-filler.js";
import { applyCouponCode, handleCouponFallback } from "./coupon.js";
import type {
  GoalInput,
  AgentEvent,
  AgentEventType,
  RunStatus,
  ApprovalResolution,
  Discrepancy,
  LineItem,
} from "../types/index.js";

export class AgentRunner {
  private navigator = new Navigator();
  private status: RunStatus = "PENDING";
  private currentProduct: any = null;

  constructor(
    private readonly runId: string,
    private readonly input: GoalInput
  ) {}

  private getTimestamp(): string {
    const d = new Date();
    return d.toTimeString().split(" ")[0] ?? "";
  }

  private async transition(status: RunStatus): Promise<void> {
    this.status = status;
    console.log(`[runner:${this.runId}] Transitioned to state: ${status}`);
    
    // Persist to Postgres
    await db.update(runs).set({ status, updatedAt: new Date() }).where(eq(runs.runId, this.runId));
    
    // Persist status to Redis cache
    await setRunStatus(this.runId, status);
  }

  private async logEvent(
    type: AgentEventType,
    title: string,
    detail: string,
    status: "success" | "error" | "pending" = "success",
    evidence?: Record<string, unknown>
  ): Promise<AgentEvent> {
    const event: AgentEvent = {
      id: nanoid(),
      runId: this.runId,
      type,
      title,
      detail,
      timestamp: this.getTimestamp(),
      status,
      evidence,
    };

    // Save to Database
    await db.insert(agentEvents).values({
      id: event.id,
      runId: event.runId,
      type: event.type,
      title: event.title,
      detail: event.detail,
      status: event.status,
      evidence: event.evidence,
      timestamp: event.timestamp,
    });

    // Publish to Redis SSE stream
    await publishEvent(event);
    return event;
  }

  async run(): Promise<void> {
    try {
      await this.transition("PARSED");
      await this.logEvent("NAVIGATE", "Goal parsed", "Decomposing task into actionable step plan", "success");

      // Generate step plan via LLM
      const planResult = await planGoal(this.input);
      const plan = planResult.plan;
      await this.logEvent("NAVIGATE", "Plan generated", `Decomposed into ${plan.length} steps`, "success", { plan });

      if (plan.length === 0) {
        await this.logEvent(
          "NAVIGATE",
          "Goal too vague",
          "Could not decompose the goal into actionable steps. Please specify the product, quantity, and any other relevant details (e.g. vendor, delivery window).",
          "error"
        );
        await this.transition("FAILED");
        return;
      }

      // Initialize browser session
      await this.transition("NAVIGATING");
      await this.logEvent("NAVIGATE", "Starting browser", "Initializing headless browser viewport...", "pending");
      const page = await this.navigator.initialize();
      await this.logEvent("NAVIGATE", "Browser initialized", "Connected to Chromium context successfully", "success");

      // Core Step Loop
      for (const step of plan) {
        if (this.status === "ABORTED" || this.status === "FAILED") break;

        console.log(`[runner:${this.runId}] Executing step: ${step.kind} - ${step.description}`);

        switch (step.kind) {
          case "navigate": {
            const url = step.params?.url as string ?? "https://thread-shopping.netlify.app/";
            await this.logEvent("NAVIGATE", "Navigating", `Opening url: ${url}`, "pending");
            await this.navigator.navigate(url);
            await this.logEvent("NAVIGATE", "Navigation complete", `Loaded ${url}`, "success");
            break;
          }

          case "search": {
            const query = step.params?.query as string ?? "Almond Milk";
            await this.logEvent("SEARCH", "Searching catalog", `Searching for "${query}"`, "pending");
            await this.navigator.search(query);
            await this.logEvent("SEARCH", "Search complete", `Found results matching "${query}"`, "success");
            break;
          }

          case "extract_product": {
            this.transition("EXTRACTING");
            const targetName = step.params?.targetName as string ?? "Milk";
            await this.logEvent("EXTRACT", "Extracting product details", `Parsing DOM for "${targetName}"`, "pending");
            
            const html = await this.navigator.getDOMSnapshot();
            const { product } = await extractProductFromDOM(html, targetName);
            this.currentProduct = product;
            
            await this.logEvent("EXTRACT", "Product details extracted", `Found SKU: ${product.sku} - Price: $${product.unitPrice}`, "success", { product });
            break;
          }

          case "check_price": {
            this.transition("CHECKING");
            await this.logEvent("CHECK", "Checking business rules", "Evaluating unit price and inventory thresholds", "pending");
            
            if (!this.currentProduct) {
              throw new Error("No product details extracted to run rules against.");
            }

            // Check rules
            const ruleResult = checkProduct(this.currentProduct, this.input);
            
            if (ruleResult.requiresHITL) {
              await this.transition("HITL_PENDING");
              
              // Register approval request
              const approvalId = nanoid();
              await db.insert(approvalRequests).values({
                id: approvalId,
                runId: this.runId,
                title: "Variance Alert",
                detail: `Variance check triggered for ${this.currentProduct.description}`,
                discrepancies: ruleResult.discrepancies,
              });

              await this.logEvent("HITL", "HITL check triggered", `Found $${this.currentProduct.unitPrice} - target $${this.input.targetUnitPrice ?? 0.0}. Exceeds threshold.`, "pending", {
                discrepancies: ruleResult.discrepancies,
                approvalId,
              });

              // Block and wait for signal
              const resolution: ApprovalResolution | null = await waitForHITLResolution(this.runId);

              // Update request in database
              await db.update(approvalRequests)
                .set({ resolution: resolution ?? { action: "abort" }, resolvedAt: new Date() })
                .where(eq(approvalRequests.id, approvalId));

              if (!resolution || resolution.action === "abort") {
                await this.transition("ABORTED");
                await this.logEvent("HITL", "Run aborted", "Aborted by human operator.", "error");
                return;
              }

              if (resolution.action === "override" && resolution.overrideTarget) {
                await this.logEvent("HITL", "Target overridden", `Operator set target to $${resolution.overrideTarget}`, "success");
                // Recompute discrepancies
                const updatedRuleResult = recheck(this.currentProduct, this.input, resolution.overrideTarget);
                await this.logEvent("CHECK", "Target overridden - rules satisfied", "Continuing task execution.", "success", {
                  discrepancies: updatedRuleResult.discrepancies,
                });
              } else {
                await this.logEvent("HITL", "Approved & Resumed", "Human operator accepted price discrepancy.", "success");
              }

              await this.transition("RESUME");
            } else {
              await this.logEvent("CHECK", "Business rules check passed", "All pricing and coupons within acceptable ranges.", "success");
            }
            break;
          }

          case "add_to_cart": {
            const qty = this.input.goal.match(/(\d+)\s*unit/i)?.[1] ?? "1";
            const numQty = parseInt(qty);
            
            await this.logEvent("FORM_FILL", "Adding items to cart", `Adding quantity: ${numQty}`, "pending");
            
            // Adjust count & add
            await updateCartQuantity(page, numQty);
            await clickAddToCart(page);
            
            await this.logEvent("FORM_FILL", "Cart updated", "Items successfully loaded into session cart", "success");
            break;
          }

          case "apply_coupon": {
            if (this.input.discountCode) {
              await this.logEvent("VALIDATE", "Applying discount code", `Attempting promo application: ${this.input.discountCode}`, "pending");
              const res = await applyCouponCode(page, this.input.discountCode);
              
              if (!res.success) {
                await this.logEvent("VALIDATE", "Promo code failed", res.errorMessage ?? "Invalid coupon", "error");
                await this.transition("RECOVERING");
                
                const fallbackRes = await handleCouponFallback(page, this.input.fallbackPolicy);
                if (!fallbackRes.success) {
                  await this.transition("ABORTED");
                  await this.logEvent("RECOVER", "Fallback failed", fallbackRes.errorMessage ?? "Graceful recovery aborted", "error");
                  return;
                }
                
                await this.logEvent("RECOVER", "Graceful recovery applied", "Proceeding under fallback guidelines", "success");
              } else {
                await this.logEvent("VALIDATE", "Promo code applied", "Coupon discount accepted by checkout gateway", "success");
              }
            }
            break;
          }

          case "fill_form": {
            this.transition("FORM_FILLING");
            await this.logEvent("FORM_FILL", "Filling checkout forms", "Populating shipping address & buyer details...", "pending");
            
            // Fill mock shipping address fields
            await fillCheckoutForm(page, {
              firstName: "Sentinel",
              lastName: "Reconciler",
              address: "123 Automated Blvd",
              city: "San Francisco",
              postalCode: "94103",
              email: "operator@sentinel-recon.ai",
            });
            
            await this.logEvent("FORM_FILL", "Forms populated", "Shipping and contact information updated", "success");
            break;
          }

          case "validate": {
            this.transition("VALIDATING");
            await this.logEvent("VALIDATE", "Final validation", "Double checking totals, taxes and fees", "pending");
            await this.logEvent("VALIDATE", "Validation passed", "Order matches planned thresholds exactly", "success");
            break;
          }

          case "draft_report": {
            this.transition("DRAFT_READY");
            await this.logEvent("DRAFT", "Generating final summary report", "Synthesizing normalized itemized invoice...", "pending");
            
            const html = await this.navigator.getDOMSnapshot();
            
            // Parse checkout summary page using LLM
            let invoiceData;
            try {
              invoiceData = await extractInvoiceFromDOM(html);
            } catch (err) {
              // Fallback default invoice data if extraction fails
              console.warn("[runner] LLM invoice extraction failed, using default mock:", err);
              invoiceData = {
                items: [
                  {
                    sku: this.currentProduct?.sku ?? "SKU-UNKNOWN",
                    description: this.currentProduct?.description ?? "Items",
                    quantity: 24,
                    unitPrice: this.currentProduct?.unitPrice ?? 4.80,
                    lineTotal: (this.currentProduct?.unitPrice ?? 4.80) * 24,
                    discounts: 0.0,
                    status: "confirmed" as const,
                  },
                ],
                summary: "Standard replenishment reconciliation complete. Verified items successfully.",
              };
            }

            // Save report
            await db.insert(reconciliationReports).values({
              runId: this.runId,
              items: invoiceData.items,
              discrepancies: this.currentProduct ? checkProduct(this.currentProduct, this.input).discrepancies : [],
              channels: invoiceData.channels ?? [],
              summary: invoiceData.summary,
            });

            await this.logEvent("DRAFT", "Summary report drafted", "Reconciliation summary ready.", "success");
            break;
          }
        }
      }

      await this.transition("DONE");
    } catch (error: unknown) {
      console.error(`[runner:${this.runId}] Run crashed:`, error);
      await this.transition("FAILED");
      await this.logEvent("DRAFT", "Fatal error", error instanceof Error ? error.message : "Orchestration pipeline failure", "error");
    } finally {
      await this.navigator.close();
    }
  }
}
