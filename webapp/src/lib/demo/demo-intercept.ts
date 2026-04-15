/**
 * Demo fetch interceptor.
 *
 * When enabled, monkey-patches window.fetch so that specific API routes
 * return pre-scripted data. Real React components render naturally.
 *
 * For send-email and create-event, the interceptor ALSO fires a real API
 * call via originalFetch to /api/demo so actual side-effects happen.
 */

import {
  DEMO_THREAD_ID,
  DEMO_CONTACT_ID,
  DEMO_THREADS,
  DEMO_SARAH_MESSAGES,
  DEMO_SARAH_CONTACT,
  DEMO_SARAH_THREAD_META,
  DEMO_CONTACTS,
  DEMO_ALERTS,
  DEMO_MEETINGS_BASE,
  DEMO_MEETING_SARAH,
  DEMO_LEADS_REPORT,
  DEMO_INTELLIGENCE,
  DEMO_LEAD_FINDER_LEADS,
  DRAFT_REPLY,
  RESEARCH_SUMMARY,
  AI_CHAT_RESPONSE,
  MEETING_TITLE,
  MEETING_DESCRIPTION,
  MEETING_START_ISO,
  MEETING_END_ISO,
} from "./demo-data";

// ── State ───────────────────────────────────────────────────────────────────

let originalFetch: typeof window.fetch;
let active = false;

const state = {
  draftGenerated: false,
  draftSent: false,
  automateEnabled: false,
  researchDone: false,
  meetingScheduled: false,
  leadFinderStarted: 0,
};

function resetState() {
  state.draftGenerated = false;
  state.draftSent = false;
  state.automateEnabled = false;
  state.researchDone = false;
  state.meetingScheduled = false;
  state.leadFinderStarted = 0;
}

// ── Public API ──────────────────────────────────────────────────────────────

export function enableDemoIntercept() {
  if (active) return;
  active = true;
  resetState();
  originalFetch = window.fetch.bind(window);
  window.fetch = demoFetch as typeof window.fetch;
  console.log("[DEMO] Fetch interceptor enabled");
}

export function disableDemoIntercept() {
  if (!active) return;
  active = false;
  window.fetch = originalFetch;
  console.log("[DEMO] Fetch interceptor disabled");
}

/** Access the un-patched fetch for making real API calls during demo */
export function getOriginalFetch(): typeof window.fetch {
  return originalFetch;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function pathOf(url: string): string {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url.split("?")[0];
  }
}

/** Return a Response after a realistic delay */
function delayed(ms: number, response: Response): Promise<Response> {
  return new Promise((resolve) => setTimeout(() => resolve(response), ms));
}

/** Fire a real side-effect in the background (non-blocking) */
function fireReal(body: Record<string, unknown>) {
  originalFetch("/api/demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((r) => {
      if (!r.ok) console.warn("[DEMO] Real side-effect failed:", r.status);
      else console.log("[DEMO] Real side-effect OK:", body.action);
    })
    .catch((err) => console.warn("[DEMO] Real side-effect error:", err));
}

// ── Route matching ──────────────────────────────────────────────────────────

async function demoFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const rawUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const method = (init?.method ?? "GET").toUpperCase();
  const path = pathOf(rawUrl);

  const handler = matchRoute(path, method);
  if (handler) {
    console.log(`[DEMO] Intercepted ${method} ${path}`);
    const res = await handler();
    return res;
  }

  return originalFetch(input, init);
}

type Handler = () => Response | Promise<Response>;

function matchRoute(
  path: string,
  method: string,
): Handler | null {

  // ── AI command (2.5s simulated LLM latency) ──
  if (path === "/api/ai/command" && method === "POST") {
    return () => delayed(2500, json({ response: AI_CHAT_RESPONSE }));
  }

  // ── Emails / threads list ──
  if (path === "/api/emails" && method === "GET") {
    return () => json({ threads: DEMO_THREADS });
  }

  // ── Email sync (no-op) ──
  if (path === "/api/emails/sync" && method === "POST") {
    return () => json({ synced: 0 });
  }

  // ── Email classify (no-op) ──
  if (path === "/api/emails/classify" && method === "POST") {
    return () => json({ classified: 0 });
  }

  // ── Thread detail: messages ──
  if (path === `/api/emails/${DEMO_THREAD_ID}/messages` && method === "GET") {
    return () => {
      const thread = { ...DEMO_SARAH_THREAD_META };
      const msgs = [...DEMO_SARAH_MESSAGES];

      if (state.draftSent) {
        thread.currentState = "replied";
        msgs.push({
          id: "demo-msg-sent",
          direction: "outbound",
          senderEmail: "you@yourdomain.com",
          senderName: "You",
          bodySummary: null,
          bodyFull: DRAFT_REPLY,
          sentAt: new Date().toISOString(),
          isAgentGenerated: true,
        });
      }
      if (state.automateEnabled) {
        thread.automationStatus = "active";
        thread.automationTurns = 1;
      }

      return json({
        thread,
        messages: msgs,
        contact: DEMO_SARAH_CONTACT,
        draft: state.draftGenerated && !state.draftSent ? DRAFT_REPLY : null,
      });
    };
  }

  // ── Draft reply (2s simulated LLM latency) ──
  if (path === `/api/emails/${DEMO_THREAD_ID}/draft` && method === "POST") {
    return async () => {
      state.draftGenerated = true;
      return delayed(2000, json({
        draft: DRAFT_REPLY,
        riskAssessment: { riskLevel: "low", concerns: [] },
        decision: "send",
        actionId: "demo-action-001",
      }));
    };
  }

  // ── Send reply — also fires a REAL email via /api/demo ──
  if (path === `/api/emails/${DEMO_THREAD_ID}/send` && method === "POST") {
    return () => {
      state.draftSent = true;
      fireReal({
        action: "send_email",
        to: "sarah.chen@westfieldprep.family",
        subject: "Re: SAT prep & college application help for my daughter",
        emailBody: DRAFT_REPLY,
      });
      return json({ success: true, messageId: "demo-sent-msg-id" });
    };
  }

  // ── Automate ──
  if (path === `/api/emails/${DEMO_THREAD_ID}/automate` && method === "POST") {
    return () => {
      state.automateEnabled = true;
      return json({ success: true });
    };
  }

  // ── Schedule meeting — also fires a REAL calendar event via /api/demo ──
  if (path === `/api/emails/${DEMO_THREAD_ID}/schedule` && method === "POST") {
    return () => {
      state.meetingScheduled = true;
      fireReal({
        action: "create_event",
        summary: MEETING_TITLE,
        description: MEETING_DESCRIPTION,
        startTime: MEETING_START_ISO,
        endTime: MEETING_END_ISO,
        attendees: [],
      });
      return json({ success: true, eventId: "demo-meeting-sarah" });
    };
  }

  // ── Thread actions ──
  if (path === `/api/emails/${DEMO_THREAD_ID}/actions` && method === "POST") {
    return () => json({ success: true });
  }

  // ── Contacts ──
  if ((path === "/api/contacts" || path === "/api/contacts/") && method === "GET") {
    return () => json({ contacts: DEMO_CONTACTS });
  }

  // ── Contact research GET ──
  if (path === `/api/contacts/${DEMO_CONTACT_ID}/research` && method === "GET") {
    return () => {
      if (state.researchDone) {
        return json({
          research: [
            {
              id: "demo-research-1",
              researchType: "web",
              summary: RESEARCH_SUMMARY,
              sources: [
                { title: "LinkedIn — Sarah Chen", url: "https://linkedin.com/in/sarahchen" },
                { title: "Westfield Prep — Newsletter", url: "https://westfieldprep.edu/newsletter" },
              ],
              createdAt: new Date().toISOString(),
            },
          ],
        });
      }
      return json({ research: [] });
    };
  }

  // ── Contact research POST (3s simulated web-research latency) ──
  if (path === `/api/contacts/${DEMO_CONTACT_ID}/research` && method === "POST") {
    return async () => {
      state.researchDone = true;
      return delayed(3000, json({
        summary: RESEARCH_SUMMARY,
        sources: [
          { title: "LinkedIn — Sarah Chen", url: "https://linkedin.com/in/sarahchen" },
          { title: "Westfield Prep — Newsletter", url: "https://westfieldprep.edu/newsletter" },
        ],
      }));
    };
  }

  // ── Intelligence ──
  if (path === "/api/intelligence" && method === "GET") {
    return () => json(DEMO_INTELLIGENCE);
  }

  // ── Watchtower ──
  if (path === "/api/watchtower" && method === "GET") {
    return () => json({ alerts: DEMO_ALERTS });
  }

  // ── Meetings ──
  if (path === "/api/meetings/briefs" && method === "GET") {
    return () => {
      const events = [...DEMO_MEETINGS_BASE];
      if (state.meetingScheduled) events.push(DEMO_MEETING_SARAH);
      return json({ events });
    };
  }
  if (path === "/api/meetings/briefs" && method === "DELETE") {
    return () => json({ success: true });
  }

  // ── Leads ──
  if (path === "/api/leads" && method === "GET") {
    return () => json(DEMO_LEADS_REPORT);
  }

  // ── Lead Finder ──
  if (path === "/api/lead-finder/run" && method === "POST") {
    return () => {
      state.leadFinderStarted = Date.now();
      return json({ ok: true, status: "running", logs: [], startedAt: state.leadFinderStarted });
    };
  }
  if (path === "/api/lead-finder/run" && method === "GET") {
    return () => {
      const elapsed = Date.now() - (state.leadFinderStarted || Date.now());
      if (elapsed > 14000) {
        return json({
          status: "done",
          logs: ["[Lead Finder] Process exited with code 0"],
          startedAt: state.leadFinderStarted,
          leads: DEMO_LEAD_FINDER_LEADS,
        });
      }
      return json({ status: "running", logs: [], startedAt: state.leadFinderStarted });
    };
  }

  return null;
}
