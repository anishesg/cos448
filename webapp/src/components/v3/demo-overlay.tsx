"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";
import {
  enableDemoIntercept,
  disableDemoIntercept,
} from "@/lib/demo/demo-intercept";
import {
  AI_CHAT_QUERY,
  DEMO_THREAD_ID,
  DEMO_CONTACT_ID,
  LEAD_FINDER_QUERY,
} from "@/lib/demo/demo-data";

// ── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function waitForEl(
  selector: string,
  timeout = 8000,
): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const check = () => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) return resolve(el);
      if (Date.now() - t0 > timeout) return resolve(null);
      requestAnimationFrame(check);
    };
    check();
  });
}

function flash(el: HTMLElement | null) {
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.style.transition = "box-shadow 0.3s ease";
  el.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.35)";
  setTimeout(() => {
    el.style.boxShadow = "";
  }, 1800);
}

function setNativeValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  const nativeInputValueSetter =
    Object.getOwnPropertyDescriptor(
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      "value",
    )?.set;
  nativeInputValueSetter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

async function typeInto(
  el: HTMLInputElement | HTMLTextAreaElement,
  text: string,
  aborted: () => boolean,
  charMs = 35,
) {
  for (let i = 0; i <= text.length; i++) {
    if (aborted()) return;
    setNativeValue(el, text.slice(0, i));
    await sleep(charMs);
  }
}

function btnMatching(textMatch: string): HTMLButtonElement | null {
  const all = document.querySelectorAll<HTMLButtonElement>("button");
  return (
    Array.from(all).find((b) => b.textContent?.includes(textMatch)) ?? null
  );
}

function rowContaining(
  tableSelector: string,
  text: string,
): HTMLElement | null {
  const rows = document.querySelectorAll<HTMLElement>(
    `${tableSelector} tbody tr`,
  );
  return (
    Array.from(rows).find((r) => r.textContent?.includes(text)) ?? null
  );
}

// ── Component (renders nothing — drives UI via navigation + clicks) ─────────

interface DemoOverlayProps {
  onStop: () => void;
}

export function DemoOverlay({ onStop }: DemoOverlayProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const abortRef = useRef(false);

  const stopDemo = useCallback(() => {
    abortRef.current = true;
    disableDemoIntercept();
    qc.invalidateQueries();
    onStop();
    router.push("/v3");
    console.log("[DEMO] Demo stopped — queries invalidated, navigated home");
  }, [onStop, qc, router]);

  useEffect(() => {
    let cancelled = false;
    abortRef.current = false;
    const dead = () => abortRef.current || cancelled;

    (async () => {
      // ── PREFLIGHT: enable interceptor, flush all caches ──
      enableDemoIntercept();
      qc.clear();
      console.log("[DEMO] ============= DEMO STARTED =============");

      // ─── SCENE 1: Home — AI Chat (~15s) ────────────────────────────────
      // NARRATE: "This is Friday — an AI-powered CRM for solo service businesses.
      //   Let me ask it what to focus on today."
      console.log("[DEMO] Scene 1: Home — AI Chat");
      router.push("/v3");
      await sleep(2000);
      if (dead()) return;

      const textarea = await waitForEl(".v3-ai-chat textarea", 6000);
      if (!textarea) {
        console.error("[DEMO] FATAL: Could not find AI chat textarea");
        stopDemo();
        return;
      }
      console.log("[DEMO]   Typing query...");
      await typeInto(textarea as HTMLTextAreaElement, AI_CHAT_QUERY, dead, 45);
      await sleep(400);
      if (dead()) return;

      const sendBtn = btnMatching("Send");
      if (sendBtn && !sendBtn.disabled) {
        console.log("[DEMO]   Clicking Send...");
        sendBtn.click();
      }

      // LLM delay (~2.5s) + render
      console.log("[DEMO]   Waiting for AI response (simulated LLM delay)...");
      await sleep(4000);
      if (dead()) return;
      console.log("[DEMO]   AI response displayed ✓");

      // NARRATE: "It pulls from my inbox, calendar, and lead pipeline to
      //   give me a prioritized plan. Sarah Chen looks like the top lead."
      await sleep(7000);
      if (dead()) return;

      // ─── SCENE 2: Threads — search Sarah Chen (~10s) ──────────────────
      // NARRATE: "Let's go to my inbox and find Sarah's thread."
      console.log("[DEMO] Scene 2: Threads — search Sarah Chen");
      router.push("/v3/threads");
      await sleep(2500);
      if (dead()) return;

      const firstRow = await waitForEl("table.v3-table tbody tr", 8000);
      if (!firstRow) {
        console.error("[DEMO] FATAL: Thread table never rendered");
        stopDemo();
        return;
      }
      console.log("[DEMO]   Thread table loaded ✓");
      await sleep(1500);
      if (dead()) return;

      const searchInput = await waitForEl(
        'input[placeholder="Search threads..."]',
        3000,
      );
      if (searchInput instanceof HTMLInputElement) {
        searchInput.focus();
        await typeInto(searchInput, "Sarah Chen", dead, 50);
        console.log("[DEMO]   Search typed ✓");
      }
      await sleep(1200);
      if (dead()) return;

      const sarahRow = document.querySelector<HTMLElement>(
        "table.v3-table tbody tr",
      );
      if (sarahRow) {
        flash(sarahRow);
        await sleep(800);
      }

      console.log("[DEMO]   Navigating to Sarah Chen's thread...");
      router.push(`/v3/threads/${DEMO_THREAD_ID}`);
      await sleep(3000);
      if (dead()) return;

      // ─── SCENE 3: Thread detail — AI Draft (~15s) ─────────────────────
      // NARRATE: "Here's her email — she's a parent at Westfield Prep asking
      //   about SAT tutoring and college app packages. Let me have the AI
      //   draft a personalized reply."
      console.log("[DEMO] Scene 3: Thread detail — reading conversation");

      await waitForEl(".v3-right-panel", 6000);
      console.log("[DEMO]   Thread loaded ✓");
      await sleep(4000);
      if (dead()) return;

      const draftBtn = btnMatching("AI Draft");
      if (draftBtn && !draftBtn.disabled) {
        flash(draftBtn);
        await sleep(600);
        console.log("[DEMO]   Clicking AI Draft...");
        draftBtn.click();
      } else {
        console.warn("[DEMO]   AI Draft button not found or disabled");
      }

      // LLM delay (~2s) + render
      await sleep(3500);
      if (dead()) return;
      const draftCard = await waitForEl(
        '[style*="var(--v3-tint-purple-bg)"]',
        5000,
      );
      if (draftCard) {
        flash(draftCard);
        console.log("[DEMO]   Draft card visible ✓");
      }

      // NARRATE: "It drafted a full reply with our pricing packages, recent
      //   results, and a call-to-action to schedule an intro call. Let me
      //   send it."
      await sleep(7000);
      if (dead()) return;

      // ─── SCENE 4: Send Draft (~4s) ────────────────────────────────────
      console.log("[DEMO] Scene 4: Send Draft");
      const sendDraftBtn = btnMatching("Send Draft");
      if (sendDraftBtn && !sendDraftBtn.disabled) {
        flash(sendDraftBtn);
        await sleep(600);
        console.log("[DEMO]   Clicking Send Draft...");
        sendDraftBtn.click();
      }
      await sleep(3500);
      if (dead()) return;
      console.log("[DEMO]   Reply sent ✓");

      // ─── SCENE 5: Automate (~4s) ──────────────────────────────────────
      // NARRATE: "I can also turn on the auto-responder so if she replies,
      //   the AI handles follow-ups automatically."
      console.log("[DEMO] Scene 5: Enable Automate");
      const autoBtn = btnMatching("Automate");
      if (autoBtn && !autoBtn.disabled) {
        flash(autoBtn);
        await sleep(600);
        console.log("[DEMO]   Clicking Automate...");
        autoBtn.click();
      }
      await sleep(3500);
      if (dead()) return;
      console.log("[DEMO]   Automate enabled ✓");

      // ─── SCENE 6: Schedule meeting (~8s) ──────────────────────────────
      // NARRATE: "Now let me schedule an intro call and check the calendar."
      console.log("[DEMO] Scene 6: Schedule meeting + navigate to Meetings");
      await fetch(`/api/emails/${DEMO_THREAD_ID}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: "Intro call — Sarah Chen / College Prep",
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
        }),
      });
      console.log("[DEMO]   Meeting scheduled ✓");

      router.push("/v3/meetings");
      await sleep(3000);
      if (dead()) return;

      const meetingCards = document.querySelectorAll(".v3-card");
      const sarahMeeting = Array.from(meetingCards).find((c) =>
        c.textContent?.includes("Sarah Chen"),
      );
      if (sarahMeeting) {
        flash(sarahMeeting as HTMLElement);
        console.log("[DEMO]   Sarah Chen meeting visible ✓");
      }

      await sleep(5000);
      if (dead()) return;

      // ─── SCENE 7: People — Research (~15s) ────────────────────────────
      // NARRATE: "Before the call, let me run some research on Sarah to
      //   prepare talking points."
      console.log("[DEMO] Scene 7: People — Research on Sarah Chen");
      router.push("/v3/people");
      await sleep(2500);
      if (dead()) return;

      await waitForEl("table.v3-table tbody tr", 6000);
      const sarahContact = rowContaining("table.v3-table", "Sarah Chen");
      if (sarahContact) {
        flash(sarahContact);
        await sleep(800);
        console.log("[DEMO]   Clicking Sarah Chen contact...");
        sarahContact.click();
      } else {
        console.warn("[DEMO]   Could not find Sarah Chen row, clicking first");
        const fallbackRow = document.querySelector<HTMLElement>(
          "table.v3-table tbody tr",
        );
        if (fallbackRow) {
          flash(fallbackRow);
          await sleep(800);
          fallbackRow.click();
        }
      }

      await sleep(2000);
      if (dead()) return;

      const panel = await waitForEl('[style*="width: 480"]', 4000);
      if (panel) {
        console.log("[DEMO]   Contact panel opened ✓");
      }
      await sleep(1200);
      if (dead()) return;

      const researchBtn =
        btnMatching("Run Research") ?? btnMatching("Research this person");
      if (researchBtn && !researchBtn.disabled) {
        flash(researchBtn);
        await sleep(600);
        console.log("[DEMO]   Triggering research...");
        researchBtn.click();
      }

      // Wait for 3s research delay + render + refetch
      await sleep(4500);
      if (dead()) return;

      qc.invalidateQueries({
        queryKey: ["contact-research", DEMO_CONTACT_ID],
      });
      await sleep(2000);
      if (dead()) return;

      const researchText = document.querySelector(
        '[style*="white-space: pre-wrap"]',
      );
      if (researchText?.textContent?.includes("Westfield")) {
        console.log("[DEMO]   Research summary displayed ✓");
      }

      // NARRATE: "It found her LinkedIn, school connections, and estimated
      //   deal potential — perfect for the intro call."
      await sleep(5000);
      if (dead()) return;

      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      await sleep(600);

      // ─── SCENE 8: Tasks (~10s) ────────────────────────────────────────
      // NARRATE: "Let me add a follow-up task so nothing falls through
      //   the cracks."
      console.log("[DEMO] Scene 8: Tasks");
      router.push("/v3/tasks");
      await sleep(2500);
      if (dead()) return;

      const taskRow = await waitForEl("table.v3-table tbody tr", 6000);
      if (taskRow) {
        flash(taskRow);
        console.log("[DEMO]   Task list loaded ✓");
      }
      await sleep(1500);
      if (dead()) return;

      const newTaskBtn = btnMatching("New task");
      if (newTaskBtn) {
        newTaskBtn.click();
        console.log("[DEMO]   Create task modal opened");
        await sleep(800);

        const titleInput = await waitForEl(
          'input[placeholder*="Schedule a follow-up"]',
          3000,
        );
        if (titleInput instanceof HTMLInputElement) {
          await typeInto(
            titleInput,
            "Follow up with Sarah Chen re: SAT prep package",
            dead,
            25,
          );
          console.log("[DEMO]   Task title typed ✓");
        }
        await sleep(2500);
        if (dead()) return;

        const cancelBtn = btnMatching("Cancel");
        if (cancelBtn) cancelBtn.click();
      }
      await sleep(1500);
      if (dead()) return;

      // ─── SCENE 9: Lead Finder (~25s) ──────────────────────────────────
      // NARRATE: "Finally, the lead finder. It scans Facebook groups for
      //   parents asking about SAT prep and college admissions, then
      //   automatically sends personalized outreach messages."
      console.log("[DEMO] Scene 9: Lead Finder");
      router.push("/v3/lead-finder");
      await sleep(2500);
      if (dead()) return;

      const queryInput = await waitForEl(
        'input[placeholder*="high school juniors"]',
        4000,
      );
      if (queryInput instanceof HTMLInputElement) {
        await typeInto(queryInput, LEAD_FINDER_QUERY, dead, 25);
        console.log("[DEMO]   Lead finder query typed ✓");
      }
      await sleep(800);
      if (dead()) return;

      const findBtn = btnMatching("Find");
      if (findBtn && !findBtn.disabled) {
        flash(findBtn);
        await sleep(400);
        findBtn.click();
        console.log("[DEMO]   Lead finder started ✓");
      }

      // Wait for log lines to finish + status to become "done"
      await sleep(16000);
      if (dead()) return;
      console.log("[DEMO]   Lead finder logs playing ✓");

      // Wait for leads section to appear
      await sleep(4000);
      if (dead()) return;

      // Scroll to leads results
      const leadsHeading = document.querySelector<HTMLElement>(
        '[class*="v3-card"]:last-of-type',
      );
      if (leadsHeading) {
        leadsHeading.scrollIntoView({ behavior: "smooth", block: "start" });
        flash(leadsHeading);
        console.log("[DEMO]   Leads results visible ✓");
      }

      // NARRATE: "Five new leads contacted — each gets a personalized
      //   message based on what they posted. They'll show up in our inbox
      //   when they reply."
      await sleep(6000);
      if (dead()) return;
      console.log("[DEMO]   Lead finder complete ✓");

      // ─── SCENE 10: Reports (~8s) ──────────────────────────────────────
      // NARRATE: "And here's the reporting dashboard — pipeline value,
      //   response rates, everything in one place. That's Friday."
      console.log("[DEMO] Scene 10: Reports dashboard");
      router.push("/v3/reports");
      await sleep(3000);
      if (dead()) return;

      const statCards = document.querySelectorAll(".v3-card");
      if (statCards.length > 0) {
        console.log("[DEMO]   Reports dashboard loaded ✓");
      }

      await sleep(5000);
      if (dead()) return;

      // ── Done ──
      console.log("[DEMO] ============= DEMO COMPLETE =============");
      if (!dead()) stopDemo();
    })().catch((err) => {
      console.error("[DEMO] Unhandled error during demo:", err);
      stopDemo();
    });

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ── Discrete trigger button ─────────────────────────────────────────────────

export function DemoModeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Start 2-minute demo walkthrough"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        fontSize: 11,
        fontWeight: 500,
        color: "var(--v3-text-ghost, #94a3b8)",
        background: "transparent",
        border: "1px solid var(--v3-border, rgba(0,0,0,0.08))",
        borderRadius: 6,
        cursor: "pointer",
        transition: "all 0.15s ease",
        opacity: 0.6,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "1";
        e.currentTarget.style.borderColor =
          "var(--v3-accent-indigo, #6366f1)";
        e.currentTarget.style.color = "var(--v3-accent-indigo, #6366f1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = "0.6";
        e.currentTarget.style.borderColor =
          "var(--v3-border, rgba(0,0,0,0.08))";
        e.currentTarget.style.color = "var(--v3-text-ghost, #94a3b8)";
      }}
    >
      <Play size={10} />
      Demo
    </button>
  );
}
