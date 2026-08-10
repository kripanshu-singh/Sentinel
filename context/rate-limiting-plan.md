# Execution Limits & Anonymous Trial Plan

## Purpose

Protect Sentinel's costly automation capacity while keeping the first experience easy for people
who have not created an account.

> **Status:** The anonymous slice is **implemented** (ADR-016, 2026-08-10): the worker owns
> atomic Redis quotas (`worker/src/quota.ts`), the Next.js proxy issues a long-lived anonymous-ID
> cookie, and `GET /api/quota` + the 429-with-snapshot refusal drive the UI. User/org tiers and
> sign-in remain on the migration path below. Thresholds are env-tunable
> (`SENTINEL_ANON_DAILY_LIMIT`, `SENTINEL_IP_DAILY_LIMIT`, `SENTINEL_ANON_ACTIVE_LIMIT`,
> `SENTINEL_IP_ACTIVE_LIMIT`, `SENTINEL_GLOBAL_ACTIVE_LIMIT`); `SENTINEL_QUOTA_ENABLED=false`
> disables enforcement for local development.

## Recommended policy

Use a tiered allowance rather than a single IP-based limit:

| Audience | Allowance | Identity used for the allowance |
| --- | --- | --- |
| Anonymous visitor | 1 trial execution | Anonymous browser ID |
| Signed-in user | 5 executions per day | Authenticated user ID |
| Organization/workspace (when available) | Configurable shared daily allowance | Organization ID |

An execution is consumed only when Sentinel successfully dispatches a run to the automation
worker. Saving a draft, opening the goal form, and requests rejected by validation do not consume
an execution. A dispatched run continues to count if the worker later fails, is cancelled, or
requires human approval; otherwise repeated retries could bypass the limit.

Use a rolling 24-hour window or a clearly defined daily reset. For the first release, a daily
reset at a stated timezone is easier to explain in the UI and support. The product should pick one
timezone consistently (for example, UTC) and display the user-local equivalent.

## Why an anonymous browser ID is needed

Sentinel does not currently have accounts, user IDs, or passwords. On a visitor's first request,
the server can issue a cryptographically random anonymous browser ID and retain it in a secure,
long-lived, HTTP-only cookie. The backend stores the allowance and usage against that ID.

This gives normal visitors a stable trial counter and lets the UI accurately say how many runs
remain. It must not be stored only in `localStorage`, because a visitor could modify it through
browser developer tools.

Deleting browser cookies creates a new anonymous identity. This is an unavoidable limitation
without authentication, so the anonymous allowance is deliberately limited to one trial run.

## IP address: abuse backstop, not identity

Do not treat an IP address as a user identity or use it for the normal "executions left" counter.
Employees in one office, users behind a VPN, and mobile-network users can legitimately share or
change IP addresses.

Instead, use an IP-based limit as a deliberately higher server-side abuse backstop. It should
detect obvious repeated cookie resets and protect worker capacity, while allowing several real
people on the same network to use Sentinel. Tune the threshold after observing legitimate traffic;
an initial range of 25-50 dispatched runs per IP per day is a reasonable starting hypothesis, not
a fixed product commitment.

Apply additional operational protections independently of identity:

- Limit concurrent runs per anonymous ID, user, organization, and IP.
- Cap total queued and active worker jobs to protect the automation service.
- Log denied attempts with a privacy-conscious, minimized representation of the IP address.
- Add short request-rate limits to run-start endpoints so clients cannot burst requests.

Avoid hard device fingerprinting as an entitlement mechanism. It is privacy-unfriendly, fragile,
and likely to block valid users. At most, coarse signals may inform an abuse-risk decision, never
the primary quota identity.

## Enforcement design

The server-side run-creation path is the enforcement point. The UI may read and display quota
information, but it must never be the authority.

Before enqueuing a run, the server should atomically:

1. Resolve the current entitlement key: anonymous browser ID, then user ID when authentication
   exists, plus organization ID where applicable.
2. Check the applicable execution allowance, IP safety limit, and concurrency limits.
3. Reserve or consume one execution only if every check passes.
4. Create/enqueue the worker run as part of a failure-safe flow; if dispatch fails before a run is
   created, release the reservation so the user is not charged for a non-run.

Atomic storage logic is essential. A simple read-then-write counter can be raced from multiple
tabs, allowing more than the stated allowance. Redis counters/scripts or transactional database
updates can provide the required atomicity. The worker should also receive an immutable record
that the run was quota-authorized, rather than independently deciding the allowance.

## UI behavior and copy

Show the allowance near the primary run action, before the visitor spends it:

> Trial execution available: 1 of 1 remaining

After sign-in:

> 3 of 5 executions remaining today. Resets at 12:00 AM local time.

When an allowance is unavailable, disable the start action and clearly state the reason. Examples:

- **Anonymous trial used:** "Your trial execution has been used. Create an account to receive 5
  executions per day."
- **Daily user allowance used:** "You have used today's execution allowance. Try again after
  [reset time], or contact your workspace admin."
- **Temporary capacity protection:** "Sentinel is at its current execution capacity. Please try
  again shortly."

The UI should handle a server-side refusal gracefully, because the displayed count can become
stale when two tabs are open or an administrator changes limits. Re-fetch the quota after a start
attempt and render the API's authoritative message.

## Migration path

1. Launch anonymous trial: one server-issued browser ID, one trial execution, IP backstop, and
   capacity/concurrency limits.
2. Add account creation/sign-in: issue 5 daily executions per verified user, while retaining
   anonymous trial history only as an abuse signal.
3. Add organizations/workspaces: move the main entitlement to organization budgets and allow
   administrators to view usage, set limits, and request exceptions.
4. Consider paid or approved tiers only after usage data justifies them. Urgent procurement
   requests may enter a manual-review/exception path rather than silently bypassing safeguards.

## Decisions to confirm before implementation

- Reset model: rolling 24 hours vs. fixed daily reset, and the authoritative timezone.
- Exact IP backstop and concurrent-run thresholds, based on worker capacity and expected shared
  networks.
- Whether an aborted run should remain charged (recommended once dispatched) or be refunded
  under narrowly defined conditions.
- Account mechanism: email verification, SSO, or workspace invitation.
- Storage ownership: the worker/backend should own quota records because it owns job dispatch and
  durable run data; the Next.js API should validate and proxy the result.

## Success criteria

- A new visitor can run Sentinel once without creating an account.
- A repeat anonymous visitor sees a clear account prompt, not an unexplained block.
- A signed-in person cannot dispatch more than five runs in the configured daily window, including
  simultaneous attempts from multiple tabs.
- Deleting cookies alone cannot produce unbounded automation from one network due to the IP and
  capacity backstops.
- Legitimate users on shared corporate networks are not identified or billed as the same person.
- The displayed remaining count always defers to the server's decision at run creation.
