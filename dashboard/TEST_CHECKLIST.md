# Dashboard Test Checklist

Run through these tests to verify all features work correctly.

## Pre-Launch Checks

- [x] Dependencies installed (`npm install`)
- [x] better-sqlite3 rebuilt for Electron (`npm run rebuild`)
- [x] Database exists at `../pipeline/pipeline.db`
- [x] All JS files have valid syntax
- [x] Frontend files exist (HTML/CSS/JS)

## Launch Test

```bash
cd "/Users/anish/Desktop/Lattice Research/fb_outreach/dashboard"
npm start
```

Expected: Window opens with sidebar navigation and Overview page

## View Tests

### Overview Page
- [ ] 4 stat cards display (Leads, Weekly Growth, Groups, LLM Spend)
- [ ] Quick action buttons visible (Run Scrape, Discover Groups, Export Leads)
- [ ] Daily chart shows last 7 days
- [ ] Recent leads table (or empty state if no leads)
- [ ] Top groups table (or empty state if no groups)
- [ ] Stats auto-refresh every 10 seconds

**Actions to Test:**
- [ ] Click "Run Scrape" → toast appears, button becomes disabled
- [ ] Click "Discover Groups" → toast appears  
- [ ] Click "Export Leads" → toast appears
- [ ] Click "View all" links → navigates to correct page

### Leads Page
- [ ] Leads table displays (or empty state)
- [ ] Search box works (filters as you type)
- [ ] Status filter dropdown works (All, Queued, Exported, Messaged)
- [ ] Pagination buttons work (Prev/Next)
- [ ] Page counter shows correct page numbers
- [ ] Confidence scores show with colored dots
- [ ] Profile icon button opens Facebook profile in browser

**Actions to Test:**
- [ ] Type in search → table filters after ~350ms
- [ ] Change status filter → table updates immediately
- [ ] Click Next → loads next page
- [ ] Click profile icon → browser opens to FB profile

### Groups Page
- [ ] Groups table displays (or empty state)
- [ ] Yield bars visualize performance
- [ ] Status badges show correct colors
- [ ] Add Group form visible at top

**Actions to Test:**
- [ ] Enter group URL + name → click Add → toast confirms, table updates
- [ ] Click pause button → group status changes to PAUSED
- [ ] Click activate button → group status changes to ACTIVE
- [ ] Click delete button → group removed from table
- [ ] Try invalid URL → error toast appears

### Activity Page
- [ ] Job Console visible with dark background
- [ ] "Run Scrape" / "Discover" / "Export" buttons at top
- [ ] Budget History table displays
- [ ] Scrape Log table displays (or empty state)

**Actions to Test:**
- [ ] Click "Run Scrape" → console shows live output
- [ ] Watch job run → console auto-scrolls
- [ ] Job finishes → toast notification appears
- [ ] Click "Discover" → separate output streams
- [ ] Click "Export" → runs independently

### Settings Page
- [ ] Pipeline status shows "Running" or "Stopped"
- [ ] Pipeline console visible
- [ ] All config fields populated with current values
- [ ] Two config sections: Scraping + Classification

**Actions to Test:**
- [ ] Click "Start Pipeline" → status changes to Running, console shows output
- [ ] Pipeline logs appear in console
- [ ] Click "Stop Pipeline" → status changes to Stopped
- [ ] Change a config value → click Save → toast confirms
- [ ] Verify changes persist (reload settings page)

## UI/UX Tests

### Navigation
- [ ] Click each nav item → correct view loads
- [ ] Active nav item has indigo background
- [ ] Smooth transitions between views

### Design
- [ ] Pastel colors throughout (indigo, emerald, amber, sky)
- [ ] White cards with subtle shadows
- [ ] Clean spacing and typography
- [ ] Animations smooth (150-400ms)
- [ ] No layout shifts or flickers

### Responsiveness
- [ ] Resize window → layout adapts
- [ ] Minimum size enforced (1000x650)
- [ ] Scrolling works smoothly
- [ ] Tables don't overflow

## Real-Time Features
- [ ] Pipeline status updates automatically
- [ ] Job output streams live
- [ ] Stats refresh every 10 seconds (watch lead count)
- [ ] Toast notifications appear for all actions
- [ ] No memory leaks after 5+ minutes of use

## Error Handling
- [ ] Invalid group URL → error toast
- [ ] Job already running → disabled button
- [ ] Empty states show helpful messages
- [ ] Database errors don't crash app
- [ ] Missing data handled gracefully

## Performance
- [ ] Views load instantly (<100ms perceived)
- [ ] Large tables (100+ rows) scroll smoothly
- [ ] No lag when typing in search
- [ ] Job console handles long output without lag
- [ ] Memory usage stable over time

## Integration Tests
- [ ] Add group → run scrape → see leads appear
- [ ] Export leads → verify CSV file created
- [ ] Start pipeline → see automated jobs run
- [ ] Config changes → restart pipeline → changes applied
- [ ] Multiple jobs run concurrently without conflict

## Known Limitations
- Jobs run in separate Node processes (can't debug in DevTools)
- better-sqlite3 only works inside Electron (not regular Node)
- Pipeline daemon and dashboard share same DB (read-only from dashboard perspective)

## Debugging

If something breaks:
1. Open DevTools: View → Toggle Developer Tools
2. Check Console tab for errors
3. Check Network tab for failed requests
4. Restart the app to reset state
5. Check main process logs in terminal

## Success Criteria

✓ All 5 views render without errors  
✓ Navigation works smoothly  
✓ Database queries return data  
✓ Jobs can be triggered manually  
✓ Real-time updates work  
✓ UI looks polished and modern  
✓ No crashes or freezes  
✓ Toast notifications appear for all actions
