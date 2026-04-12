# Lead Finder Dashboard

Beautiful Electron app for managing and monitoring your Facebook lead finder pipeline.

## Features

- **Overview**: Real-time stats, daily charts, recent leads, top-performing groups
- **Leads**: Browse, search, filter all discovered leads with pagination
- **Groups**: Add/remove/pause groups, view yield rates and performance
- **Activity**: Job console, scrape logs, LLM budget tracking
- **Settings**: Configure all pipeline parameters, start/stop daemon

## Quick Start

```bash
# First time setup
npm run setup

# Launch the app
npm start
```

## Architecture

- **Main Process** (`main.js`): IPC handlers for DB queries, job runner, config management
- **Preload** (`preload.js`): Context bridge API for secure renderer communication
- **Renderer** (`renderer/`): HTML/CSS/JS frontend with 5 views

## Views

### Overview
- 4 stat cards: Total Leads, Weekly Growth, Active Groups, LLM Spend
- Quick action buttons to trigger jobs instantly
- Daily lead chart (last 7 days)
- Recent leads table + top groups by yield

### Leads
- Full leads table with search and status filtering
- Pagination (30 per page)
- Click profile icon to open FB profile
- View comment excerpts, confidence scores, timestamps

### Groups
- Add new groups via URL
- Manage all groups: pause/activate/remove
- View yield rates, lead counts, last scrape time
- Visualized yield bars

### Activity
- Job console with live output streaming
- Run jobs manually: Scrape / Discover / Export
- LLM budget history (tokens, costs per day)
- Full scrape log with session details

### Settings
- Pipeline daemon control (start/stop)
- Live pipeline output console
- Configure all scraping parameters
- Classification thresholds and budget limits
- Quiet hours scheduling

## Design

- **Colors**: Pastel indigo/emerald/amber/sky with white surfaces
- **Typography**: SF Pro Display system font stack
- **Shadows**: Subtle layered shadows for depth
- **Animations**: Smooth 150-400ms transitions, fade-in cards
- **Icons**: Lucide icon set (inline SVG)
- **Charts**: Custom mini bar charts with hover states

## Data Flow

```
Dashboard (Electron)
  ├─ IPC → main.js
  │   ├─ better-sqlite3 → pipeline.db
  │   ├─ spawn Node.js jobs → pipeline/jobs/*.js
  │   └─ read/write → pipeline/.env
  └─ Real-time updates via IPC events
```

All jobs run in separate Node processes and stream output back to the dashboard via IPC events.

## Database

Reads from `../pipeline/pipeline.db` (shared with pipeline daemon):
- `leads` + `fb_leads`: Form signups and scraped leads
- `fb_groups`: Group metadata and performance stats
- `fb_scrape_log`: Per-session scraping history
- `fb_llm_budget`: Daily classification costs
- `email_log`: Sent emails tracking

## Development

The app uses:
- **Electron 35**: Native macOS window chrome with traffic lights
- **better-sqlite3**: Direct DB access (no server needed)
- **Vanilla JS**: No framework overhead, fast rendering
- **CSS Grid/Flexbox**: Modern responsive layout

Window config:
- `hiddenInset` title bar for native macOS look
- Traffic light buttons positioned at (16, 18)
- Drag region in sidebar header
- Min size: 1000×650, default: 1340×860
