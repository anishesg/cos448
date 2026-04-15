# Frontend Tech Stack Research — Agentic Business Application (April 2026)

## Executive Summary

After deep research across 30+ sources, here is the recommended stack for building a modern, "calm executive" agentic business application:

| Layer | Choice | Reasoning |
|-------|--------|-----------|
| **Framework** | Next.js 15 (App Router) | RSC streaming, Vercel AI SDK integration, largest ecosystem |
| **UI Foundation** | shadcn/ui + Radix Primitives | Full ownership, composable, copy-paste model, 75K+ GitHub stars |
| **Dashboard Charts** | Tremor | Purpose-built for dashboards, same Radix/Tailwind stack |
| **Styling** | Tailwind CSS 4 | Already the standard, pairs with shadcn/ui and Tremor |
| **AI Streaming** | Vercel AI SDK (SSE) | `useChat`/`streamText` handles 80% of chat UIs out of the box |
| **Real-time Sync** | Supabase Realtime | Postgres Changes + Broadcast, already in your backend |
| **Server State** | TanStack Query v5 | Caching, deduplication, background refetch |
| **Client State** | Zustand | 1.2KB, no boilerplate, no providers needed |
| **Animation** | Motion (Framer Motion) + AutoAnimate | Motion for intentional polish, AutoAnimate for list transitions |
| **Design Aesthetic** | Linear-inspired calm design system | Dark neutral palette, Inter font, generous whitespace |

---

## 1. Frontend Framework: Next.js 15 (App Router)

### Why Next.js wins for this project

**Server Components are purpose-built for your use case.** The Business Feed, Meeting Prep Briefs, and Watchtower Dashboard are all read-heavy views that benefit from rendering on the server with zero client JS. Only interactive elements (thread workspace, AI chat, notification popover) need `'use client'`.

**Streaming with Suspense is native.** Your AI response streaming, feed loading, and dashboard metrics can all use `<Suspense>` boundaries to show instant loading states while data fetches in the background. Partial Pre-rendering (PPR) lets you serve a static shell with dynamic holes — perfect for a dashboard that has a fixed layout but real-time data.

**Vercel AI SDK is first-class.** The `useChat` and `streamText` primitives are designed for Next.js App Router. No adapter layer needed.

**Key production facts (2026):**
- Turbopack is now stable as default dev bundler (50-70% faster cold starts than Webpack)
- `fetch()` no longer caches by default — you must opt in with `cache: 'force-cache'`
- `params` and `searchParams` are now async Promises (requires `await`)
- 30-60% bundle size reduction vs client-side rendering with proper RSC usage
- 25.6M weekly npm downloads, 138K GitHub stars

**The one pitfall to avoid:** "Client-Side Hydration Overshoot" — marking too many components as `'use client'` negates RSC benefits. Architecture rule: default to server components, only promote to client when you need interactivity (onClick, useState, useEffect).

### Why NOT React Router v7 (Remix successor)

React Router v7 (Remix merged into it in 2024) is a solid framework but **does not support React Server Components**, which are critical for your streaming AI responses and zero-JS dashboard views. Its loader/action model is simpler but less powerful for an app that mixes static dashboards, real-time streams, and interactive workspaces.

RR7 advantages (35% smaller bundle, Vite-native, deploy-anywhere) don't outweigh the RSC streaming capabilities you need.

### Other frameworks considered

- **Astro**: Great for content sites, not for interactive agentic apps
- **SolidStart / Svelte 5**: Smaller ecosystems, less AI SDK support
- **TanStack Start**: Promising but too early for production-critical apps

---

## 2. UI Component Library: shadcn/ui + Radix Primitives

### Why shadcn/ui

**The copy-paste ownership model is ideal for a custom "calm executive" aesthetic.** Unlike npm-installed libraries where you fight the library's opinions, shadcn/ui gives you the source files. You own every line. When you want to make a Card feel like a chief-of-staff memo instead of a SaaS widget, you edit the component directly.

**Key facts (2026):**
- 75,000+ GitHub stars, used by Vercel, Linear, and OpenAI
- 48 components, 34 pass WCAG 2.2 AA out of the box
- Built on Radix Primitives (accessibility) + Tailwind CSS (styling)
- 5.0/5 rating across 198 reviews
- Extensive template ecosystem (300+ blocks available)

**Enterprise caveat:** 14 components need accessibility fixes for strict enterprise procurement audits. Most commonly: the default `focus-visible:ring-1 ring-ring/50` produces insufficient 3:1 contrast ratios. Fix: override focus rings to use a solid color with 3:1+ contrast. This is a one-time fix since you own the source.

### Radix Primitives (the foundation)

Radix is the behavioral layer under shadcn/ui. It handles:
- WAI-ARIA patterns, focus management, keyboard navigation
- 28+ headless components (Dialog, Popover, DropdownMenu, Tabs, etc.)
- `asChild` prop for applying behavior to custom elements without DOM overhead
- ~3.5M weekly downloads, 60K+ GitHub stars

You'll use Radix directly for any custom components not covered by shadcn/ui (e.g., a custom Thread panel, Meeting Brief viewer).

### Tailwind UI (supplementary)

Tailwind UI ($299 one-time) provides 500+ production-ready component designs from the Tailwind CSS creators. Useful as **design reference and starting point** for complex layouts like your Thread Workspace and Watchtower Dashboard. The Catalyst UI Kit component system includes buttons, inputs, tables, and sidebars you can adapt.

Worth the $299 as a design accelerator even if you rebuild components in shadcn/ui style.

### Rising alternatives considered

- **Nocta UI**: Ariakit-based, similar copy-paste model but much smaller ecosystem
- **SUI (Struct UI)**: 68+ source-first components, interesting but unproven at scale
- **VelocityUI**: Scoped CSS Modules approach diverges from Tailwind ecosystem

None are mature enough to bet on for a production app.

---

## 3. Dashboard Components: Tremor

### Why Tremor for the Watchtower Dashboard

Tremor is specifically built for dashboard/analytics UIs with the **exact same stack** (React + Tailwind CSS + Radix):

- 35+ components: Area Chart, Bar Chart, Line Chart, Donut Chart, Spark Charts, Tracker, Progress Circle, Data Bars
- 300+ pre-built dashboard blocks and templates
- Copy-paste implementation (same philosophy as shadcn/ui)
- Used by Vercel and Cal.com in production
- Built on Recharts (the most popular React charting library)

**For your Watchtower Dashboard specifically:**
- Use Tremor's `Tracker` for agent activity timelines
- Use `SparkChart` for inline metric previews in cards
- Use `AreaChart` / `BarChart` for detailed analytics views
- Use `Card` + `Badge` + `DataBar` for KPI summary panels

Tremor and shadcn/ui coexist naturally since they share the same Radix + Tailwind foundation.

---

## 4. AI Streaming: Vercel AI SDK with SSE

### Architecture

```
User Input → Next.js API Route → Vercel AI SDK (streamText) → LLM → SSE Stream → useChat → UI
```

### Why SSE over WebSockets

For AI response streaming, **SSE wins in 95% of cases:**

| Factor | SSE | WebSocket |
|--------|-----|-----------|
| Direction | Unidirectional (server→client) | Bidirectional |
| Complexity | Simple, HTTP-native | Complex, separate protocol |
| Reconnection | Automatic | Manual implementation |
| Proxy/firewall | Works everywhere | Often blocked |
| Server resources | Lower | Higher |
| AI streaming fit | Perfect (stream tokens to client) | Overkill |

User input goes via separate POST requests — you don't need bidirectional streaming for AI chat.

**Exception:** If you later add real-time collaborative editing (multiple users editing the same thread), consider WebSocket via Supabase Realtime's Broadcast channel for that specific feature.

### Vercel AI SDK specifics

```typescript
// Server: app/api/chat/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({
    model: openai('gpt-4o'),
    messages,
  });
  return result.toUIMessageStreamResponse();
}

// Client: components/ChatThread.tsx
'use client';
import { useChat } from '@ai-sdk/react';

export function ChatThread() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();
  // messages automatically update as tokens stream in
}
```

**Production patterns:**
- Use `onFinish` callback to persist completed messages to Supabase
- Use `initialMessages` to load prior conversation history
- Implement message truncation — by default, entire conversation history is sent with each request
- Set `maxSteps: 10` to prevent infinite agent loops

---

## 5. Real-time Data Sync: Supabase Realtime

Since you're already on Supabase, use its built-in Realtime features:

- **Postgres Changes**: Listen to database inserts/updates for the Business Feed (new emails, CRM updates, action items)
- **Broadcast**: Low-latency pub/sub for notifications and status updates
- **Presence**: Track which team members are online (future feature)

```typescript
// Listen for new feed items
const channel = supabase
  .channel('business-feed')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'feed_items',
  }, (payload) => {
    // Add to feed in real-time
  })
  .subscribe();
```

**No need for Liveblocks or PartyKit** unless you're building Google Docs-style collaborative editing. Supabase Realtime covers notifications, feed updates, and status syncing.

---

## 6. State Management

### The 2026 pattern: split server state from client state

**TanStack Query v5 (server state):**
- All data from Supabase: feed items, threads, dashboard metrics, contacts
- Automatic caching, background refetching, deduplication
- Loading/error states handled out of the box
- Optimistic updates for actions (mark as done, snooze, etc.)

**Zustand (client state):**
- UI state: which panel is open, selected thread, filter state, sidebar collapsed
- 1.2KB bundle, zero boilerplate
- No Provider wrapper needed (unlike Redux or Jotai)
- Persistence middleware for remembering user preferences

**Local component state (React useState):**
- Form inputs, hover states, animation triggers
- Anything that doesn't need to be shared across components

```typescript
// Zustand store example
import { create } from 'zustand';

interface WorkspaceStore {
  selectedThreadId: string | null;
  sidePanelView: 'context' | 'timeline' | 'contacts' | null;
  setSelectedThread: (id: string) => void;
  setSidePanelView: (view: WorkspaceStore['sidePanelView']) => void;
}

export const useWorkspace = create<WorkspaceStore>((set) => ({
  selectedThreadId: null,
  sidePanelView: null,
  setSelectedThread: (id) => set({ selectedThreadId: id }),
  setSidePanelView: (view) => set({ sidePanelView: view }),
}));
```

---

## 7. Email / Feed UI Patterns

### No off-the-shelf email UI library is worth adopting

The existing options (@sirenapp/react-inbox, @knocklabs/react, @suprsend/react) are notification-centric and opinionated about styling. They'd fight your calm executive aesthetic.

### Build the Business Feed with shadcn/ui primitives

The feed is essentially a **filtered, sortable card list** — not a traditional email inbox. Build it from:

- shadcn `Card` component (customized for the memo aesthetic)
- shadcn `Badge` for priority/source labels
- shadcn `Avatar` for contact photos
- shadcn `ScrollArea` for smooth scrolling
- TanStack Query for data fetching with infinite scroll
- Supabase Realtime for live updates

**Design reference:** shadcn.io has a "Features Email Client Inbox Block" (updated April 2026) with folder sidebar, sender avatars, unread dots, and search bar. Use it as a starting point, then strip it down to the calm aesthetic.

**Card anatomy for your Business Feed:**
```
┌─────────────────────────────────────────┐
│ [Priority dot]  Source badge   Timestamp │
│ Contact Name                             │
│ Subject / Summary (1-2 lines)            │
│ AI-generated brief (subtle, muted text)  │
│ [Action chips: Reply, Snooze, Delegate]  │
└─────────────────────────────────────────┘
```

---

## 8. Animation & Polish

### Motion (formerly Framer Motion) — for intentional transitions

Use Motion for:
- Page transitions between views (Feed → Thread → Dashboard)
- Side panel slide-in/out animations
- AI response streaming text appearance
- Notification toast enter/exit

The `LazyMotion` + `domAnimation` approach keeps bundle impact at ~15KB.

```typescript
import { motion, AnimatePresence } from 'motion/react';

// Side panel slide
<AnimatePresence>
  {sidePanelView && (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    >
      <SidePanel view={sidePanelView} />
    </motion.div>
  )}
</AnimatePresence>
```

### AutoAnimate — for effortless list transitions

Add/remove/reorder feed items with zero configuration:

```typescript
import { useAutoAnimate } from '@formkit/auto-animate/react';

function BusinessFeed({ items }) {
  const [parent] = useAutoAnimate();
  return (
    <div ref={parent}>
      {items.map(item => <FeedCard key={item.id} {...item} />)}
    </div>
  );
}
```

AutoAnimate is <3KB and handles the 90% case (list add/remove/reorder). Use Motion only where you need precise control.

### CSS-only where possible

- `transition-colors duration-150` for hover states
- `transition-all duration-200` for expanding/collapsing sections
- CSS `@starting-style` for entry animations (native, zero JS)
- Tailwind's built-in animation utilities for loading spinners

---

## 9. The "Calm Executive" Design System

### Design philosophy: Chief-of-Staff memo, not SaaS dashboard

The goal is an interface that feels like reading a well-formatted briefing document — not a typical dashboard with competing widgets and bright colors.

### Reference apps
- **Linear**: The gold standard for calm, professional tool UI (dark mode, muted palette, generous whitespace)
- **Notion**: Clean typography hierarchy, content-first layout
- **Superhuman**: Email UI that feels premium without being loud
- **Arc Browser**: Sidebar-driven navigation, minimal chrome

### Color system (Linear-inspired, light mode primary)

```css
:root {
  /* Backgrounds — warm neutrals, not cold grays */
  --bg-primary: #fafaf9;      /* stone-50 — main canvas */
  --bg-secondary: #f5f5f4;    /* stone-100 — cards, panels */
  --bg-tertiary: #e7e5e4;     /* stone-200 — hover states */

  /* Text — high contrast, warm */
  --text-primary: #1c1917;    /* stone-900 */
  --text-secondary: #57534e;  /* stone-600 */
  --text-tertiary: #a8a29e;   /* stone-400 — timestamps, metadata */

  /* Accent — single, muted accent color */
  --accent: #4f46e5;          /* indigo-600 — CTAs, links */
  --accent-subtle: #eef2ff;   /* indigo-50 — selected states */

  /* Status — muted, not alarming */
  --status-urgent: #dc2626;   /* red-600 — only for true urgency */
  --status-active: #059669;   /* emerald-600 — success, active */
  --status-pending: #d97706;  /* amber-600 — waiting, attention */

  /* Borders — barely visible */
  --border: #e7e5e4;          /* stone-200 */
  --border-subtle: #f5f5f4;   /* stone-100 */
}
```

### Typography

```css
/* Use Inter for UI, with system fonts as fallback */
--font-sans: 'Inter Variable', 'Inter', system-ui, sans-serif;
--font-mono: 'Berkeley Mono', 'JetBrains Mono', monospace;

/* Scale — restrained, not dramatic */
--text-xs: 0.75rem;    /* 12px — metadata, timestamps */
--text-sm: 0.8125rem;  /* 13px — secondary text */
--text-base: 0.875rem; /* 14px — body text (not 16px!) */
--text-lg: 1rem;       /* 16px — section headers */
--text-xl: 1.25rem;    /* 20px — page titles */
```

**Key decision: 14px base font size.** Most executive tools (Linear, Superhuman, Slack) use 13-14px base, not the web default of 16px. This creates a denser, more professional feel while remaining readable.

### Layout principles

1. **Generous whitespace between sections, tight within.** Cards should breathe, but content within cards should be scannable.
2. **Max 3 levels of visual hierarchy per view.** Title → Content → Metadata. No more.
3. **Muted borders or no borders.** Use background color changes and subtle shadows instead of visible border lines.
4. **Left-aligned, single-column primary content.** The feed and thread views should read like a document, not a grid.
5. **Side panels, not modals.** Modals interrupt flow. Side panels provide context without losing position.

### Mobile considerations

The founder-checking-on-phone use case means:
- **Feed view must work as a single column** with swipe actions (shadcn/ui + touch events)
- **Thread view collapses** to full-screen with back navigation
- **Dashboard shows KPI summary cards** that expand on tap
- **Notifications use native-feeling toast/banner** patterns
- Use `tailwindcss` responsive prefixes: design mobile-first, enhance for desktop
- Consider `@container` queries for panel-based layouts that adapt to available space

---

## 10. Complete Dependency List

```json
{
  "dependencies": {
    "next": "^15.x",
    "react": "^19.x",
    "react-dom": "^19.x",
    "@ai-sdk/react": "latest",
    "@ai-sdk/openai": "latest",
    "ai": "latest",
    "@supabase/supabase-js": "latest",
    "@supabase/ssr": "latest",
    "@tanstack/react-query": "^5.x",
    "zustand": "^5.x",
    "motion": "latest",
    "@formkit/auto-animate": "latest",
    "@radix-ui/react-dialog": "latest",
    "@radix-ui/react-popover": "latest",
    "@radix-ui/react-dropdown-menu": "latest",
    "@radix-ui/react-tabs": "latest",
    "@radix-ui/react-scroll-area": "latest",
    "@radix-ui/react-tooltip": "latest",
    "tailwindcss": "^4.x",
    "class-variance-authority": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest",
    "lucide-react": "latest",
    "recharts": "^2.x",
    "date-fns": "latest"
  }
}
```

Note: shadcn/ui and Tremor components are copied into your codebase (not npm dependencies).

---

## 11. Architecture Mapping to Your Features

| Feature | Framework Layer | UI Components | State | Real-time |
|---------|----------------|---------------|-------|-----------|
| **Business Feed** | Server Component (initial) + Client (interactions) | shadcn Card, Badge, Avatar, ScrollArea | TanStack Query + Supabase Realtime | Postgres Changes listener |
| **Thread Workspace** | Client Component (interactive) | shadcn Sheet/Panel, Tabs, custom thread UI | Zustand (selected thread, panel state) | SSE for AI streaming |
| **AI Streaming** | API Route + Client | useChat hook, custom message components | Vercel AI SDK internal state | SSE via Vercel AI SDK |
| **Watchtower Dashboard** | Server Component (metrics) + Client (charts) | Tremor charts, shadcn Card | TanStack Query (polling/refetch) | Supabase Realtime for live metrics |
| **Trust Console** | Server Component | shadcn Table, Badge, Switch, Dialog | TanStack Query | — |
| **Meeting Prep** | Server Component | Custom brief layout, shadcn Card | TanStack Query | — |
| **Notifications** | Client Component | shadcn Popover, custom toast | Zustand (unread count) | Supabase Broadcast |
| **Mobile** | Same components, responsive | Tailwind responsive classes, Sheet for panels | Same stores | Same channels |

---

## 12. What I'd Skip

- **Redux / Redux Toolkit**: Overkill for this app. Zustand + TanStack Query covers everything with 90% less boilerplate.
- **Material UI / Ant Design**: Opinionated styling fights the calm aesthetic. Too "SaaS dashboard."
- **Chakra UI**: Falling behind shadcn/ui in ecosystem momentum.
- **Socket.io**: Unnecessary abstraction when SSE handles AI streaming and Supabase Realtime handles data sync.
- **Recoil**: Dead project (Meta abandoned it). Use Jotai if you want atoms, but Zustand is simpler for your needs.
- **CSS-in-JS (styled-components, Emotion)**: Tailwind + CSS variables is the 2026 standard. CSS-in-JS adds runtime overhead.

---

*Research conducted April 15, 2026. Sources include dev.to, PkgPulse, Vercel Academy, Supabase Docs, Linear changelog, npm registry, and GitHub repositories.*
