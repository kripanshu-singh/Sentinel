import type { AgentEvent, RunStatus } from "@/types";
import {
  CheckCheck,
  Compass,
  FileText,
  Gavel,
  Search,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";

export interface ProgressPhase {
  id: string;
  label: string;
  icon: LucideIcon;
  done: boolean;
  active: boolean;
  error: boolean;
}

interface PhaseSpec {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Plan step kinds that produce this phase. */
  kinds: string[];
  /** Event types that complete (or fail) this phase. */
  eventTypes: string[];
}

const PHASE_SPECS: PhaseSpec[] = [
  { id: "open", label: "Open", icon: Compass, kinds: ["navigate"], eventTypes: ["NAVIGATE"] },
  { id: "search", label: "Search", icon: Search, kinds: ["search", "extract_product"], eventTypes: ["SEARCH", "EXTRACT"] },
  { id: "reconcile", label: "Reconcile", icon: CheckCheck, kinds: ["check_price"], eventTypes: ["CHECK"] },
  { id: "approval", label: "Approval", icon: Gavel, kinds: ["pause_for_approval"], eventTypes: ["HITL"] },
  { id: "checkout", label: "Checkout", icon: ShoppingCart, kinds: ["add_to_cart", "apply_coupon", "fill_form"], eventTypes: ["FORM_FILL"] },
  { id: "report", label: "Report", icon: FileText, kinds: ["draft_report"], eventTypes: ["DRAFT"] },
];

const LAST_PHASE_ID = "report";

/**
 * Read the LLM-generated step plan out of the "Plan generated" event evidence.
 * It is the most reliable signal for which phases a run will actually perform.
 */
function extractPlanKinds(events: AgentEvent[]): string[] {
  for (const event of [...events].reverse()) {
    const plan = event.evidence?.plan;
    if (Array.isArray(plan) && plan.length > 0) {
      return plan
        .map((step) => (step as { kind?: unknown } | null)?.kind)
        .filter((kind): kind is string => typeof kind === "string");
    }
  }
  return [];
}

function hasEvent(
  events: AgentEvent[],
  types: string[],
  status?: AgentEvent["status"],
): boolean {
  return events.some(
    (event) =>
      types.includes(event.type) && (status === undefined || event.status === status),
  );
}

/**
 * Derive the progress-stepper phases for a run from the plan, the streamed
 * events, and the current run status. Phases appear only when the plan (or the
 * events) prove they happen — so an approval gate is hidden unless the goal
 * asked for human confirmation — and every phase resolves when the run finishes.
 */
export function buildPhases(
  events: AgentEvent[],
  status?: RunStatus,
): ProgressPhase[] {
  const planKinds = extractPlanKinds(events);
  const terminalDone = status === "DONE";

  const phases: ProgressPhase[] = [];
  for (const spec of PHASE_SPECS) {
    const planned = spec.kinds.some((kind) => planKinds.includes(kind));
    const occurred = hasEvent(events, spec.eventTypes);
    const isLast = spec.id === LAST_PHASE_ID;
    if (!planned && !occurred && !isLast) continue;

    const done =
      hasEvent(events, spec.eventTypes, "success") ||
      (isLast && terminalDone) ||
      (terminalDone && planned);
    const error = !done && hasEvent(events, spec.eventTypes, "error");

    phases.push({ id: spec.id, label: spec.label, icon: spec.icon, done, active: false, error });
  }

  if (!terminalDone && phases.length > 0) {
    const latestPending = [...events].reverse().find((event) => event.status === "pending");
    const pendingSpec = latestPending
      ? PHASE_SPECS.find((spec) => spec.eventTypes.includes(latestPending.type))
      : undefined;
    const pendingPhase = pendingSpec
      ? phases.find((phase) => phase.id === pendingSpec.id)
      : undefined;
    if (pendingPhase && !pendingPhase.done) {
      pendingPhase.active = true;
    }
    if (!phases.some((phase) => phase.active)) {
      const firstIncomplete = phases.find((phase) => !phase.done && !phase.error);
      if (firstIncomplete) firstIncomplete.active = true;
    }
  }

  if (status === "FAILED" || status === "ABORTED") {
    const lastError = [...events].reverse().find((event) => event.status === "error");
    if (lastError) {
      const spec = PHASE_SPECS.find((spec) => spec.eventTypes.includes(lastError.type));
      const phase = spec ? phases.find((phase) => phase.id === spec.id) : undefined;
      if (phase) {
        phase.error = true;
        phase.done = false;
      }
    }
  }

  return phases;
}
