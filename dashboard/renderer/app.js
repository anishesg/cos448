/* ===== Helpers ===== */

function fmt(n) {
  return n == null ? "0" : Number(n).toLocaleString();
}
function fmtCurrency(n) {
  return "$" + (n || 0).toFixed(4);
}
function fmtPct(n) {
  return (n * 100).toFixed(1) + "%";
}
function fmtConf(n) {
  const v = (n || 0).toFixed(2);
  const cls = n >= 0.85 ? "high" : n >= 0.7 ? "mid" : "low";
  return `<span class="conf-dot ${cls}">${v}</span>`;
}
function timeAgo(dateStr) {
  if (!dateStr) return "-";
  const now = Date.now();
  const d = dateStr.endsWith("Z") ? new Date(dateStr) : new Date(dateStr + "Z");
  const sec = Math.floor((now - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return Math.floor(sec / 60) + "m ago";
  if (sec < 86400) return Math.floor(sec / 3600) + "h ago";
  if (sec < 604800) return Math.floor(sec / 86400) + "d ago";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function shortDay(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}
function badgeHtml(status) {
  const s = (status || "unknown").toLowerCase().replace(/_/g, " ");
  let cls = s.replace(/\s/g, "");
  if (cls === "exportedcsv" || cls === "exported_csv") cls = "exported";
  return `<span class="badge ${cls}">${s}</span>`;
}
function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s || "";
  return div.innerHTML;
}

/* ===== Toast ===== */

function toast(msg, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/* ===== State ===== */

let currentView = "overview";
let leadsPage = 0;
let leadsFilter = { status: "all", search: "" };
const LEADS_PER_PAGE = 30;
let refreshTimer = null;
const jobConsoleOutput = { scrape: "", discover: "", export: "" };

/* ===== Navigation ===== */

document.getElementById("nav").addEventListener("click", (e) => {
  const item = e.target.closest(".nav-item");
  if (!item) return;
  e.preventDefault();
  const view = item.dataset.view;
  if (view === currentView) return;
  document.querySelectorAll(".nav-item").forEach((el) => el.classList.remove("active"));
  item.classList.add("active");
  currentView = view;
  loadView(view);
});

/* ===== View Router ===== */

async function loadView(view) {
  const container = document.getElementById("view-container");
  container.innerHTML = `<div class="view-loading"><div class="spinner"></div></div>`;

  try {
    switch (view) {
      case "overview":  await renderOverview(container); break;
      case "leads":     await renderLeads(container); break;
      case "groups":    await renderGroups(container); break;
      case "activity":  await renderActivity(container); break;
      case "campaign":  await renderCampaign(container); break;
      case "keywords":  await renderKeywords(container); break;
      case "autopilot": await renderAutopilot(container); break;
      case "pipeline":  await renderPipelineLeads(container); break;
      case "settings":  await renderSettings(container); break;
    }
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h3>Error loading view</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

/* ===== Overview ===== */

async function renderOverview(container) {
  const data = await window.api.getOverview();
  if (!data) {
    container.innerHTML = `<div class="empty-state"><h3>No data yet</h3><p>Run the pipeline to start collecting leads.</p></div>`;
    return;
  }

  // Daily chart data — fill in missing days
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const found = (data.dailyLeads || []).find((r) => r.day === key);
    days.push({ day: key, count: found?.count || 0 });
  }
  const maxCount = Math.max(1, ...days.map((d) => d.count));

  container.innerHTML = `
    <h1 class="view-title">Overview</h1>

    <!-- Stat cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon indigo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div class="stat-value">${fmt(data.totalLeads)}</div>
        <div class="stat-label">Total Leads</div>
        <div class="stat-sub">${fmt(data.queued)} queued &middot; ${fmt(data.exported)} exported</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon emerald">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
        </div>
        <div class="stat-value">${fmt(data.weekLeads)}</div>
        <div class="stat-label">Leads This Week</div>
        <div class="stat-sub">${fmt(data.todayLeads)} today</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon amber">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div class="stat-value">${fmt(data.activeGroups)}</div>
        <div class="stat-label">Active Groups</div>
        <div class="stat-sub">${fmt(data.cooldownGroups)} in cooldown &middot; ${fmt(data.retiredGroups)} retired</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon sky">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        </div>
        <div class="stat-value">${fmtCurrency(data.todaySpend)}</div>
        <div class="stat-label">LLM Spend Today</div>
        <div class="stat-sub">${fmt(data.todayCalls)} classifications</div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions" id="quick-actions">
      <button class="quick-action-btn" data-job="scrape">
        <div class="qa-icon" style="background:var(--indigo-light);color:var(--indigo)">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </div>
        <div>
          <div style="font-size:13px">Run Scrape</div>
          <div style="font-size:11px;color:var(--text-muted);font-weight:400">Scrape selected groups now</div>
        </div>
      </button>
      <button class="quick-action-btn" data-job="discover">
        <div class="qa-icon" style="background:var(--emerald-light);color:var(--emerald)">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
        <div>
          <div style="font-size:13px">Discover Groups</div>
          <div style="font-size:11px;color:var(--text-muted);font-weight:400">Search for new FB groups</div>
        </div>
      </button>
      <button class="quick-action-btn" data-job="export">
        <div class="qa-icon" style="background:var(--amber-light);color:var(--amber)">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </div>
        <div>
          <div style="font-size:13px">Export Leads</div>
          <div style="font-size:11px;color:var(--text-muted);font-weight:400">Export queued leads to CSV</div>
        </div>
      </button>
    </div>

    <!-- Charts & Recent -->
    <div class="split-row-wide mb-28">
      <!-- Recent Leads -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Recent Leads</span>
          <span class="card-link" id="link-all-leads">View all</span>
        </div>
        <div class="card-body">
          ${data.recentLeads.length === 0
            ? `<div class="empty-state" style="padding:32px"><h3>No leads yet</h3><p>Run a scrape to find leads</p></div>`
            : `<div class="table-wrap"><table>
              <thead><tr><th>Name</th><th>Group</th><th>Confidence</th><th>Found</th></tr></thead>
              <tbody>${data.recentLeads.map((l) => `
                <tr>
                  <td class="td-name">${escapeHtml(l.name)}</td>
                  <td class="td-secondary td-truncate">${escapeHtml(l.group_name || "-")}</td>
                  <td>${fmtConf(l.classification_confidence)}</td>
                  <td class="td-muted">${timeAgo(l.created_at)}</td>
                </tr>
              `).join("")}</tbody>
            </table></div>`
          }
        </div>
      </div>

      <!-- Daily Activity Chart -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Daily Leads</span>
          <span class="td-muted" style="font-size:11.5px">Last 7 days</span>
        </div>
        <div class="card-body">
          <div class="mini-chart">
            ${days.map((d) => `
              <div class="mini-bar-wrap">
                <div class="bar-value">${d.count || ""}</div>
                <div style="flex:1;display:flex;align-items:flex-end;width:100%">
                  <div class="mini-bar" style="height:${Math.max(4, (d.count / maxCount) * 100)}%;width:100%"></div>
                </div>
                <div class="bar-label">${shortDay(d.day)}</div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    </div>

    <!-- Top Groups -->
    <div class="card mb-28">
      <div class="card-header">
        <span class="card-title">Top Groups by Yield</span>
        <span class="card-link" id="link-all-groups">Manage groups</span>
      </div>
      <div class="card-body">
        ${data.topGroups.length === 0
          ? `<div class="empty-state" style="padding:32px"><h3>No groups yet</h3><p>Add groups in the Groups tab</p></div>`
          : `<div class="table-wrap"><table>
            <thead><tr><th>Group</th><th>Yield</th><th>Leads</th><th>Comments</th><th>Last Scraped</th></tr></thead>
            <tbody>${data.topGroups.map((g) => `
              <tr>
                <td class="td-name td-truncate">${escapeHtml(g.group_name || g.group_url)}</td>
                <td>
                  <span class="yield-bar"><span class="yield-bar-fill" style="width:${Math.min(100, g.lead_yield_rate * 1000)}%"></span></span>
                  <span class="td-mono">${fmtPct(g.lead_yield_rate)}</span>
                </td>
                <td>${fmt(g.total_leads_found)}</td>
                <td class="td-muted">${fmt(g.total_comments_scanned)}</td>
                <td class="td-muted">${timeAgo(g.last_scraped_at)}</td>
              </tr>
            `).join("")}</tbody>
          </table></div>`
        }
      </div>
    </div>
  `;

  // Wire up quick actions
  container.querySelectorAll(".quick-action-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const job = btn.dataset.job;
      btn.disabled = true;
      btn.querySelector("div > div:first-child").textContent = "Running...";
      const result = await window.api.runJob({ jobName: job });
      if (result?.error) {
        toast(result.error, "error");
        btn.disabled = false;
        btn.querySelector("div > div:first-child").textContent =
          job === "scrape" ? "Run Scrape" : job === "discover" ? "Discover Groups" : "Export Leads";
      } else {
        toast(`${job} job started`, "success");
      }
    });
  });

  // Wire view-all links
  container.querySelector("#link-all-leads")?.addEventListener("click", () => {
    document.querySelector('[data-view="leads"]').click();
  });
  container.querySelector("#link-all-groups")?.addEventListener("click", () => {
    document.querySelector('[data-view="groups"]').click();
  });
}

/* ===== Leads ===== */

async function renderLeads(container) {
  const { leads, total } = await window.api.getLeads({
    offset: leadsPage * LEADS_PER_PAGE,
    limit: LEADS_PER_PAGE,
    status: leadsFilter.status,
    search: leadsFilter.search,
  }) || { leads: [], total: 0 };

  const totalPages = Math.ceil(total / LEADS_PER_PAGE);

  container.innerHTML = `
    <h1 class="view-title">Leads <span class="view-subtitle">${fmt(total)} total</span></h1>

    <div class="action-bar">
      <div class="form-group" style="margin:0;width:220px">
        <input id="leads-search" type="text" class="form-input" placeholder="Search leads..." value="${escapeHtml(leadsFilter.search)}">
      </div>
      <div class="form-group" style="margin:0;width:160px">
        <select id="leads-status-filter" class="form-input">
          <option value="all" ${leadsFilter.status === "all" ? "selected" : ""}>All Statuses</option>
          <option value="QUEUED" ${leadsFilter.status === "QUEUED" ? "selected" : ""}>Queued</option>
          <option value="EXPORTED_CSV" ${leadsFilter.status === "EXPORTED_CSV" ? "selected" : ""}>Exported</option>
          <option value="MESSAGED" ${leadsFilter.status === "MESSAGED" ? "selected" : ""}>Messaged</option>
        </select>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        ${leads.length === 0
          ? `<div class="empty-state"><h3>No leads found</h3><p>Try adjusting your filters or run a scrape</p></div>`
          : `<div class="table-wrap"><table>
            <thead><tr>
              <th>Name</th>
              <th>Source Group</th>
              <th>Comment</th>
              <th>Confidence</th>
              <th>Status</th>
              <th>Found</th>
              <th></th>
            </tr></thead>
            <tbody>${leads.map((l) => `
              <tr data-lead-id="${l.id}">
                <td class="td-name">${escapeHtml(l.name)}</td>
                <td class="td-secondary td-truncate" style="max-width:140px">${escapeHtml(l.group_name || "-")}</td>
                <td class="td-muted td-truncate" style="max-width:200px" title="${escapeHtml(l.source_comment_text || "")}">${escapeHtml((l.source_comment_text || "").slice(0, 80))}</td>
                <td>${fmtConf(l.classification_confidence)}</td>
                <td>${badgeHtml(l.outreach_state)}</td>
                <td class="td-muted">${timeAgo(l.created_at)}</td>
                <td>
                  <button class="btn-icon lead-profile-btn" title="Open profile" data-url="${escapeHtml(l.profile_url)}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </button>
                </td>
              </tr>
            `).join("")}</tbody>
          </table></div>
          <div class="pagination">
            <span class="pagination-info">Page ${leadsPage + 1} of ${Math.max(1, totalPages)}</span>
            <div class="pagination-btns">
              <button class="btn btn-secondary btn-sm" id="leads-prev" ${leadsPage === 0 ? "disabled" : ""}>Prev</button>
              <button class="btn btn-secondary btn-sm" id="leads-next" ${leadsPage >= totalPages - 1 ? "disabled" : ""}>Next</button>
            </div>
          </div>`
        }
      </div>
    </div>
  `;

  // Wire up
  let searchTimeout;
  container.querySelector("#leads-search")?.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      leadsFilter.search = e.target.value;
      leadsPage = 0;
      renderLeads(container);
    }, 350);
  });

  container.querySelector("#leads-status-filter")?.addEventListener("change", (e) => {
    leadsFilter.status = e.target.value;
    leadsPage = 0;
    renderLeads(container);
  });

  container.querySelector("#leads-prev")?.addEventListener("click", () => {
    leadsPage = Math.max(0, leadsPage - 1);
    renderLeads(container);
  });
  container.querySelector("#leads-next")?.addEventListener("click", () => {
    leadsPage++;
    renderLeads(container);
  });

  container.querySelectorAll(".lead-profile-btn").forEach((btn) => {
    btn.addEventListener("click", () => window.api.openExternal(btn.dataset.url));
  });
}

/* ===== Groups ===== */

async function renderGroups(container) {
  const groups = (await window.api.getGroups()) || [];

  container.innerHTML = `
    <h1 class="view-title">Groups <span class="view-subtitle">${groups.length} total</span></h1>

    <!-- Add group -->
    <div class="card mb-20">
      <div class="card-body padded">
        <div class="form-inline" id="add-group-form">
          <div class="form-group" style="flex:2">
            <label class="form-label">Add Group</label>
            <input id="new-group-url" type="text" class="form-input" placeholder="https://www.facebook.com/groups/...">
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">Name (optional)</label>
            <input id="new-group-name" type="text" class="form-input" placeholder="Group name">
          </div>
          <button class="btn btn-primary" id="add-group-btn" style="margin-top:4px">Add Group</button>
        </div>
      </div>
    </div>

    <!-- Groups table -->
    <div class="card">
      <div class="card-body">
        ${groups.length === 0
          ? `<div class="empty-state"><h3>No groups added</h3><p>Add a Facebook group URL above to start</p></div>`
          : `<div class="table-wrap"><table>
            <thead><tr>
              <th>Group</th>
              <th>Members</th>
              <th>Yield</th>
              <th>Leads</th>
              <th>Comments</th>
              <th>Status</th>
              <th>Last Scraped</th>
              <th></th>
            </tr></thead>
            <tbody>${groups.map((g) => `
              <tr data-group-id="${g.id}">
                <td class="td-name td-truncate" style="max-width:200px" title="${escapeHtml(g.group_url)}">${escapeHtml(g.group_name || g.group_url)}</td>
                <td class="td-secondary">${g.member_count ? fmt(g.member_count) : "-"}</td>
                <td>
                  <span class="yield-bar"><span class="yield-bar-fill" style="width:${Math.min(100, g.lead_yield_rate * 1000)}%"></span></span>
                  <span class="td-mono">${fmtPct(g.lead_yield_rate)}</span>
                </td>
                <td>${fmt(g.total_leads_found)}</td>
                <td class="td-muted">${fmt(g.total_comments_scanned)}</td>
                <td>${badgeHtml(g.status)}</td>
                <td class="td-muted">${timeAgo(g.last_scraped_at)}</td>
                <td>
                  <div style="display:flex;gap:2px">
                    ${g.status === "ACTIVE"
                      ? `<button class="btn-icon group-status-btn" data-id="${g.id}" data-status="PAUSED" title="Pause">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                         </button>`
                      : `<button class="btn-icon group-status-btn" data-id="${g.id}" data-status="ACTIVE" title="Activate">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                         </button>`
                    }
                    <button class="btn-icon btn-danger group-delete-btn" data-id="${g.id}" title="Remove">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            `).join("")}</tbody>
          </table></div>`
        }
      </div>
    </div>
  `;

  // Wire add group
  container.querySelector("#add-group-btn")?.addEventListener("click", async () => {
    const url = container.querySelector("#new-group-url").value.trim();
    const name = container.querySelector("#new-group-name").value.trim();
    if (!url) return toast("Enter a group URL", "error");
    if (!url.includes("facebook.com/groups/")) return toast("Must be a Facebook group URL", "error");
    await window.api.addGroup({ url, name });
    toast("Group added", "success");
    renderGroups(container);
  });

  // Wire status toggles
  container.querySelectorAll(".group-status-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await window.api.updateGroupStatus({ id: parseInt(btn.dataset.id), status: btn.dataset.status });
      toast(`Group ${btn.dataset.status.toLowerCase()}`, "success");
      renderGroups(container);
    });
  });

  // Wire delete
  container.querySelectorAll(".group-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await window.api.deleteGroup({ id: parseInt(btn.dataset.id) });
      toast("Group removed", "success");
      renderGroups(container);
    });
  });
}

/* ===== Activity ===== */

async function renderActivity(container) {
  const [scrapeLog, budgetHistory, runningJobs] = await Promise.all([
    window.api.getScrapeLog({ limit: 30 }),
    window.api.getBudgetHistory(),
    window.api.getRunningJobs(),
  ]);

  const log = scrapeLog || [];
  const budget = budgetHistory || [];

  container.innerHTML = `
    <h1 class="view-title">Activity</h1>

    <!-- Job Controls -->
    <div class="card mb-20">
      <div class="card-header">
        <span class="card-title">Job Console</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm job-run-btn" data-job="scrape" ${runningJobs.includes("scrape") ? "disabled" : ""}>
            ${runningJobs.includes("scrape") ? "Scraping..." : "Run Scrape"}
          </button>
          <button class="btn btn-secondary btn-sm job-run-btn" data-job="discover" ${runningJobs.includes("discover") ? "disabled" : ""}>
            ${runningJobs.includes("discover") ? "Discovering..." : "Discover"}
          </button>
          <button class="btn btn-secondary btn-sm job-run-btn" data-job="export" ${runningJobs.includes("export") ? "disabled" : ""}>
            ${runningJobs.includes("export") ? "Exporting..." : "Export"}
          </button>
        </div>
      </div>
      <div class="card-body">
        <div class="console" id="job-console">${escapeHtml(jobConsoleOutput.scrape + jobConsoleOutput.discover + jobConsoleOutput.export) || "No output yet. Run a job to see output here."}</div>
      </div>
    </div>

    <!-- Budget History -->
    <div class="card mb-20">
      <div class="card-header">
        <span class="card-title">LLM Budget History</span>
      </div>
      <div class="card-body">
        ${budget.length === 0
          ? `<div class="empty-state" style="padding:24px"><p>No LLM usage recorded yet</p></div>`
          : `<div class="table-wrap"><table>
            <thead><tr><th>Date</th><th>Calls</th><th>Input Tokens</th><th>Output Tokens</th><th>Cost</th></tr></thead>
            <tbody>${budget.map((b) => `
              <tr>
                <td class="td-name">${b.date}</td>
                <td>${fmt(b.total_calls)}</td>
                <td class="td-mono">${fmt(b.total_input_tokens)}</td>
                <td class="td-mono">${fmt(b.total_output_tokens)}</td>
                <td class="td-mono">${fmtCurrency(b.estimated_cost_usd)}</td>
              </tr>
            `).join("")}</tbody>
          </table></div>`
        }
      </div>
    </div>

    <!-- Scrape Log -->
    <div class="card mb-20">
      <div class="card-header">
        <span class="card-title">Scrape Log</span>
        <span class="td-muted" style="font-size:11.5px">${log.length} sessions</span>
      </div>
      <div class="card-body">
        ${log.length === 0
          ? `<div class="empty-state" style="padding:24px"><p>No scrape sessions recorded</p></div>`
          : `<div class="table-wrap"><table>
            <thead><tr><th>Group</th><th>Started</th><th>Posts</th><th>Comments</th><th>Leads</th><th>LLM Cost</th><th>Status</th></tr></thead>
            <tbody>${log.map((s) => `
              <tr>
                <td class="td-name td-truncate" style="max-width:180px">${escapeHtml(s.group_name || "-")}</td>
                <td class="td-muted">${timeAgo(s.started_at)}</td>
                <td>${fmt(s.posts_scanned)}</td>
                <td>${fmt(s.comments_scanned)}</td>
                <td style="font-weight:600">${fmt(s.leads_found)}</td>
                <td class="td-mono">${fmtCurrency(s.llm_cost_usd)}</td>
                <td>${badgeHtml(s.status)}</td>
              </tr>
            `).join("")}</tbody>
          </table></div>`
        }
      </div>
    </div>
  `;

  // Wire job buttons
  container.querySelectorAll(".job-run-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const job = btn.dataset.job;
      btn.disabled = true;
      btn.textContent = "Running...";
      const result = await window.api.runJob({ jobName: job });
      if (result?.error) toast(result.error, "error");
      else toast(`${job} job started`, "success");
    });
  });
}

/* ===== Autopilot ===== */

async function renderAutopilot(container) {
  const [status, cycles, keywords] = await Promise.all([
    window.api.getAutopilotStatus(),
    window.api.getAutopilotCycles({ limit: 15 }),
    window.api.getAutopilotKeywords(),
  ]);

  const isRunning = status?.is_running === 1;
  const recentCycles = cycles || [];
  const activeKeywords = keywords || [];

  // Calculate stats
  const totalCycles = status?.current_cycle || 0;
  const totalLeads = status?.total_leads_found || 0;
  const totalMessages = status?.total_messages_sent || 0;
  const totalRetired = status?.total_groups_retired || 0;

  // Recent performance (last 5 cycles)
  const recentPerf = recentCycles.slice(0, 5).reduce((acc, c) => {
    acc.leads += c.leads_found || 0;
    acc.messages += c.messages_sent || 0;
    return acc;
  }, { leads: 0, messages: 0 });

  container.innerHTML = `
    <h1 class="view-title">🤖 Autopilot <span class="view-subtitle">Self-Improving Lead Generation</span></h1>

    <!-- Status Banner -->
    <div class="card mb-20" style="background: ${isRunning ? 'linear-gradient(135deg, #eef2ff 0%, #f0f9ff 100%)' : 'var(--surface)'}">
      <div class="card-body padded">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:16px">
            <div style="width:48px;height:48px;border-radius:12px;background:${isRunning ? 'var(--indigo)' : 'var(--border)'};display:flex;align-items:center;justify-content:center;color:white;font-size:24px">
              ${isRunning ? '🚀' : '⏸'}
            </div>
            <div>
              <div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:4px">
                ${isRunning ? 'Autopilot Running' : 'Autopilot Stopped'}
              </div>
              <div style="font-size:13px;color:var(--text-secondary)">
                ${isRunning
                  ? `Cycle #${totalCycles} • ${status.unmessaged_leads || 0} leads pending`
                  : `Last run: ${status.last_cycle_at ? timeAgo(status.last_cycle_at) : 'never'}`
                }
              </div>
            </div>
          </div>
          <div style="display:flex;gap:10px">
            ${isRunning
              ? `<button class="btn btn-secondary" id="autopilot-stop">Stop Autopilot</button>`
              : `<button class="btn btn-primary" id="autopilot-start">Start Autopilot</button>`
            }
          </div>
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid mb-28">
      <div class="stat-card">
        <div class="stat-icon indigo">🔄</div>
        <div class="stat-value">${fmt(totalCycles)}</div>
        <div class="stat-label">Total Cycles</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon emerald">🎯</div>
        <div class="stat-value">${fmt(totalLeads)}</div>
        <div class="stat-label">Leads Found</div>
        <div class="stat-sub">${fmt(recentPerf.leads)} in last 5 cycles</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon sky">📨</div>
        <div class="stat-value">${fmt(totalMessages)}</div>
        <div class="stat-label">Messages Sent</div>
        <div class="stat-sub">${fmt(recentPerf.messages)} in last 5 cycles</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon rose">🗑️</div>
        <div class="stat-value">${fmt(totalRetired)}</div>
        <div class="stat-label">Groups Retired</div>
      </div>
    </div>

    <!-- Cycle History -->
    <div class="card mb-20">
      <div class="card-header">
        <span class="card-title">Recent Cycles</span>
        <span class="td-muted" style="font-size:11.5px">${recentCycles.length} cycles</span>
      </div>
      <div class="card-body">
        ${recentCycles.length === 0
          ? `<div class="empty-state" style="padding:32px"><p>No cycles yet. Start autopilot to begin.</p></div>`
          : `<div class="table-wrap"><table>
            <thead><tr>
              <th>Cycle</th>
              <th>Started</th>
              <th>Groups</th>
              <th>Leads</th>
              <th>Messages</th>
              <th>Retired</th>
              <th>LLM Cost</th>
              <th>Status</th>
            </tr></thead>
            <tbody>${recentCycles.map((c) => `
              <tr>
                <td class="td-name">#${c.cycle_number}</td>
                <td class="td-muted">${timeAgo(c.started_at)}</td>
                <td>${fmt(c.groups_scraped)}</td>
                <td style="font-weight:600">${fmt(c.leads_found)}</td>
                <td>${fmt(c.messages_sent)}</td>
                <td>${fmt(c.groups_retired)}</td>
                <td class="td-mono">${fmtCurrency(c.llm_cost_usd)}</td>
                <td>${badgeHtml(c.status)}</td>
              </tr>
            `).join("")}</tbody>
          </table></div>`
        }
      </div>
    </div>

    <!-- Keywords -->
    <div class="card mb-20">
      <div class="card-header">
        <span class="card-title">Generated Keywords</span>
        <span class="td-muted" style="font-size:11.5px">LLM-powered discovery</span>
      </div>
      <div class="card-body">
        ${activeKeywords.length === 0
          ? `<div class="empty-state" style="padding:32px"><p>No keywords generated yet. Will generate after first few cycles.</p></div>`
          : `<div class="table-wrap"><table>
            <thead><tr>
              <th>Keyword</th>
              <th>Generated</th>
              <th>Groups Found</th>
              <th>Leads from Groups</th>
              <th>Effectiveness</th>
            </tr></thead>
            <tbody>${activeKeywords.slice(0, 20).map((k) => `
              <tr>
                <td class="td-name">${escapeHtml(k.keyword)}</td>
                <td class="td-muted">${timeAgo(k.generated_at)}</td>
                <td>${fmt(k.groups_found)}</td>
                <td style="font-weight:600">${fmt(k.leads_from_groups)}</td>
                <td>${k.effectiveness > 0 ? fmtPct(k.effectiveness) : '-'}</td>
              </tr>
            `).join("")}</tbody>
          </table></div>`
        }
      </div>
    </div>

    <!-- Console -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">Autopilot Console</span>
      </div>
      <div class="card-body">
        <div class="console" id="autopilot-console" style="min-height:200px;max-height:400px">${isRunning ? 'Autopilot output will appear here...' : 'Start autopilot to see live output'}</div>
      </div>
    </div>
  `;

  // Wire start/stop
  container.querySelector("#autopilot-start")?.addEventListener("click", async () => {
    const result = await window.api.startAutopilot();
    if (result?.error) toast(result.error, "error");
    else toast("Autopilot started!", "success");
    setTimeout(() => renderAutopilot(container), 500);
  });

  container.querySelector("#autopilot-stop")?.addEventListener("click", async () => {
    await window.api.stopAutopilot();
    toast("Autopilot stopped", "info");
    setTimeout(() => renderAutopilot(container), 500);
  });
}

/* ===== Settings ===== */

async function renderSettings(container) {
  const cfg = (await window.api.getConfig()) || {};
  const pipelineRunning = await window.api.getPipelineStatus();

  container.innerHTML = `
    <h1 class="view-title">Settings</h1>

    <!-- Test Mode Banner -->
    ${cfg.testMode ? `
      <div style="background:#fffbeb;border:2px solid #f59e0b;border-radius:var(--radius);padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:12px">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div style="flex:1">
          <div style="font-weight:600;color:#92400e;margin-bottom:2px">🧪 Test Mode Active</div>
          <div style="font-size:12px;color:#92400e">All restrictions bypassed (quiet hours, cooldowns, browser lock). Use only for testing!</div>
        </div>
      </div>
    ` : ''}

    <!-- Pipeline Control -->
    <div class="card mb-28">
      <div class="card-header">
        <div>
          <span class="card-title">Pipeline Daemon</span>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <span class="pipeline-status">
            <span class="status-dot ${pipelineRunning ? "online" : "offline"}"></span>
            <span>${pipelineRunning ? "Running" : "Stopped"}</span>
          </span>
          ${pipelineRunning
            ? `<button class="btn btn-secondary btn-sm" id="pipeline-toggle">Stop Pipeline</button>`
            : `<button class="btn btn-primary btn-sm" id="pipeline-toggle">Start Pipeline</button>`
          }
        </div>
      </div>
      <div class="card-body">
        <div class="console" id="pipeline-console" style="min-height:100px;max-height:200px">Pipeline output will appear here...</div>
      </div>
    </div>

    <!-- Config -->
    <form id="settings-form">
      <!-- Test Mode Toggle -->
      <div style="background:var(--amber-light);border:1px solid #fcd34d;border-radius:var(--radius);padding:20px;margin-bottom:24px">
        <div style="display:flex;align-items:flex-start;gap:16px">
          <div style="flex:1">
            <div style="font-size:15px;font-weight:650;color:var(--text);margin-bottom:6px">🧪 Test Mode</div>
            <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Bypass all restrictions for immediate testing (quiet hours, cooldowns, browser lock)</div>
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13.5px;font-weight:600">
              <input type="checkbox" id="test-mode-toggle" name="testMode" ${cfg.testMode ? "checked" : ""} style="width:18px;height:18px;cursor:pointer">
              <span>Enable Test Mode</span>
            </label>
          </div>
          <div style="padding:10px 14px;background:#fef3c7;border-radius:8px;font-size:11px;color:#92400e;white-space:nowrap">
            ⚠️ Testing Only
          </div>
        </div>
      </div>

      <div class="settings-grid mb-28">
        <div class="settings-section">
          <div class="settings-section-title">Scraping</div>
          <div class="form-group">
            <label class="form-label">Groups Per Scrape</label>
            <input type="number" class="form-input" name="groupsPerScrape" value="${cfg.groupsPerScrape}" min="1" max="20">
            <div class="form-hint">How many groups to scrape per cycle</div>
          </div>
          <div class="form-group">
            <label class="form-label">Explore Ratio</label>
            <input type="number" class="form-input" name="exploreRatio" value="${cfg.exploreRatio}" min="0" max="1" step="0.05">
            <div class="form-hint">Fraction of slots for unproven groups (0-1)</div>
          </div>
          <div class="form-group">
            <label class="form-label">Keywords Per Group</label>
            <input type="number" class="form-input" name="keywordsPerGroup" value="${cfg.keywordsPerGroup}" min="1" max="15">
            <div class="form-hint">How many keywords to search per group</div>
          </div>
          <div class="form-group">
            <label class="form-label">Max Scrolls Per Keyword</label>
            <input type="number" class="form-input" name="maxScrollsPerKeyword" value="${cfg.maxScrollsPerKeyword}" min="1" max="20">
            <div class="form-hint">Scrolls per keyword search within a group</div>
          </div>
          <div class="form-group">
            <label class="form-label">Max Scrolls Per Group (fallback)</label>
            <input type="number" class="form-input" name="maxScrollsPerGroup" value="${cfg.maxScrollsPerGroup}" min="1" max="50">
            <div class="form-hint">Feed scroll fallback if keyword search finds little</div>
          </div>
          <div class="form-group">
            <label class="form-label">Max Post Age (days)</label>
            <input type="number" class="form-input" name="maxPostAgeDays" value="${cfg.maxPostAgeDays}" min="1" max="30">
          </div>
          <div class="form-group">
            <label class="form-label">Cooldown (minutes)</label>
            <input type="number" class="form-input" name="cooldownMinutes" value="${cfg.cooldownMinutes}" min="30" max="1440">
            <div class="form-hint">Wait time between scrapes of same group</div>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Classification</div>
          <div class="form-group">
            <label class="form-label">Daily LLM Budget ($)</label>
            <input type="number" class="form-input" name="dailyBudget" value="${cfg.dailyBudget}" min="1" max="100" step="1">
            <div class="form-hint">Stop classifying when daily spend exceeds this</div>
          </div>
          <div class="form-group">
            <label class="form-label">Min Confidence Threshold</label>
            <input type="number" class="form-input" name="minConfidence" value="${cfg.minConfidence}" min="0.5" max="1" step="0.05">
            <div class="form-hint">Only save leads above this confidence score</div>
          </div>
          <div class="form-group">
            <label class="form-label">Classifier Model</label>
            <input type="text" class="form-input" name="classifierModel" value="${escapeHtml(cfg.classifierModel)}" readonly>
            <div class="form-hint">Amazon Nova Micro (read-only)</div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Quiet Hours Start</label>
              <input type="number" class="form-input" name="quietHoursStart" value="${cfg.quietHoursStart}" min="0" max="23">
            </div>
            <div class="form-group">
              <label class="form-label">Quiet Hours End</label>
              <input type="number" class="form-input" name="quietHoursEnd" value="${cfg.quietHoursEnd}" min="0" max="23">
            </div>
          </div>
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="skip-quiet-hours" name="skipQuietHours" ${cfg.skipQuietHours ? "checked" : ""} style="width:16px;height:16px;cursor:pointer">
              <span class="form-label" style="margin:0">Skip Quiet Hours</span>
            </label>
            <div class="form-hint">Allow scraping anytime (ignores quiet hours, may increase detection risk)</div>
          </div>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:10px">
        <button type="submit" class="btn btn-primary" id="save-settings-btn">Save Settings</button>
      </div>
    </form>
  `;

  // Wire pipeline toggle
  container.querySelector("#pipeline-toggle")?.addEventListener("click", async () => {
    if (pipelineRunning) {
      await window.api.stopPipeline();
      toast("Pipeline stopped", "info");
    } else {
      const result = await window.api.startPipeline();
      if (result?.error) toast(result.error, "error");
      else toast("Pipeline started", "success");
    }
    setTimeout(() => renderSettings(container), 500);
  });

  // Wire save
  container.querySelector("#settings-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const cfg = {};
    for (const [key, val] of fd.entries()) {
      if (key === "classifierModel") continue;
      if (key === "skipQuietHours" || key === "testMode") continue; // Handle checkboxes separately
      cfg[key] = isNaN(Number(val)) ? val : Number(val);
    }
    // Handle checkboxes (not included in FormData if unchecked)
    cfg.skipQuietHours = document.getElementById("skip-quiet-hours")?.checked || false;
    cfg.testMode = document.getElementById("test-mode-toggle")?.checked || false;
    await window.api.saveConfig(cfg);
    toast("Settings saved. Changes take effect immediately.", "success");
    // Reload settings to show test mode banner
    setTimeout(() => renderSettings(container), 500);
  });
}

/* ===== Campaign ===== */

async function renderCampaign(container) {
  const data = await window.api.getCampaignStatus();
  if (!data) {
    container.innerHTML = `<div class="empty-state"><h3>Campaign data unavailable</h3><p>Make sure the pipeline database exists.</p></div>`;
    return;
  }

  container.innerHTML = `
    <h1 class="view-title">Campaign <span class="view-subtitle">Messaging & Outreach</span></h1>

    <!-- Stats -->
    <div class="stats-grid mb-28">
      <div class="stat-card">
        <div class="stat-icon emerald">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div class="stat-value">${fmt(data.messaged)}</div>
        <div class="stat-label">Messaged</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon amber">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </div>
        <div class="stat-value">${fmt(data.exported)}</div>
        <div class="stat-label">Exported (pending)</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon indigo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        </div>
        <div class="stat-value">${fmt(data.queued)}</div>
        <div class="stat-label">Queued</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon sky">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div class="stat-value">${fmt(data.csvRows)}</div>
        <div class="stat-label">CSV Rows</div>
        <div class="stat-sub">${fmt(data.completedRows)} sent</div>
      </div>
    </div>

    <!-- Message Template -->
    <div class="card mb-20">
      <div class="card-header">
        <span class="card-title">Message Template</span>
        <button class="btn btn-primary btn-sm" id="save-template-btn">Save Template</button>
      </div>
      <div class="card-body padded">
        <textarea id="template-editor" class="form-input" style="min-height:220px;font-family:var(--font-mono);font-size:12.5px;line-height:1.7;resize:vertical">${escapeHtml(data.template)}</textarea>
        <div class="form-hint" style="margin-top:8px">Use {{firstName}} for personalization. Changes apply to next send cycle.</div>
      </div>
    </div>

    <!-- Recent Messaged Leads -->
    <div class="card mb-20">
      <div class="card-header">
        <span class="card-title">Recently Messaged</span>
        <span class="td-muted" style="font-size:11.5px">${data.recentMessaged?.length || 0} shown</span>
      </div>
      <div class="card-body">
        ${(data.recentMessaged || []).length === 0
          ? `<div class="empty-state" style="padding:32px"><p>No messages sent yet</p></div>`
          : `<div class="table-wrap"><table>
            <thead><tr><th>Name</th><th>Group</th><th>Confidence</th><th>Messaged</th></tr></thead>
            <tbody>${data.recentMessaged.map((l) => `
              <tr>
                <td class="td-name">${escapeHtml(l.name)}</td>
                <td class="td-secondary td-truncate">${escapeHtml(l.group_name || "-")}</td>
                <td>${fmtConf(l.classification_confidence)}</td>
                <td class="td-muted">${timeAgo(l.messaged_at)}</td>
              </tr>
            `).join("")}</tbody>
          </table></div>`
        }
      </div>
    </div>
  `;

  container.querySelector("#save-template-btn")?.addEventListener("click", async () => {
    const text = container.querySelector("#template-editor").value;
    await window.api.saveMessageTemplate({ text });
    toast("Template saved", "success");
  });
}

/* ===== Keywords ===== */

async function renderKeywords(container) {
  const [searchStats, searchKeywords, autopilotKeywords] = await Promise.all([
    window.api.getKeywordSearchStats(),
    window.api.getSearchKeywords(),
    window.api.getAutopilotKeywords(),
  ]);

  const stats = searchStats || [];
  const keywords = searchKeywords || [];
  const apKw = autopilotKeywords || [];

  container.innerHTML = `
    <h1 class="view-title">Keywords <span class="view-subtitle">Search Strategy & Performance</span></h1>

    <!-- In-Group Search Keywords Performance -->
    <div class="card mb-20">
      <div class="card-header">
        <span class="card-title">In-Group Search Performance</span>
        <span class="td-muted" style="font-size:11.5px">Keywords searched within groups</span>
      </div>
      <div class="card-body">
        ${stats.length === 0
          ? `<div class="empty-state" style="padding:32px"><p>No keyword searches yet. Run a scrape to start collecting data.</p></div>`
          : `<div class="table-wrap"><table>
            <thead><tr>
              <th>Keyword</th>
              <th>Searches</th>
              <th>Posts Found</th>
              <th>Leads Found</th>
              <th>Hit Rate</th>
              <th>Last Searched</th>
            </tr></thead>
            <tbody>${stats.map((k) => {
              const hitRate = k.total_posts > 0 ? (k.total_leads / k.total_posts * 100).toFixed(1) : "0.0";
              return `
              <tr>
                <td class="td-name">${escapeHtml(k.keyword)}</td>
                <td>${fmt(k.search_count)}</td>
                <td>${fmt(k.total_posts)}</td>
                <td style="font-weight:600">${fmt(k.total_leads)}</td>
                <td>
                  <span class="yield-bar"><span class="yield-bar-fill" style="width:${Math.min(100, parseFloat(hitRate) * 10)}%"></span></span>
                  <span class="td-mono">${hitRate}%</span>
                </td>
                <td class="td-muted">${timeAgo(k.last_searched)}</td>
              </tr>`;
            }).join("")}</tbody>
          </table></div>`
        }
      </div>
    </div>

    <!-- Active Search Keywords -->
    <div class="card mb-20">
      <div class="card-header">
        <span class="card-title">Active Search Keywords</span>
        <span class="td-muted" style="font-size:11.5px">Seed + LLM-generated</span>
      </div>
      <div class="card-body">
        ${keywords.length === 0
          ? `<div class="empty-state" style="padding:32px"><p>Search keywords will populate as you run scrapes.</p></div>`
          : `<div class="table-wrap"><table>
            <thead><tr>
              <th>Keyword</th>
              <th>Source</th>
              <th>Total Searches</th>
              <th>Total Posts</th>
              <th>Total Leads</th>
              <th>Effectiveness</th>
            </tr></thead>
            <tbody>${keywords.map((k) => `
              <tr>
                <td class="td-name">${escapeHtml(k.keyword)}</td>
                <td>${badgeHtml(k.source)}</td>
                <td>${fmt(k.total_searches)}</td>
                <td>${fmt(k.total_posts)}</td>
                <td style="font-weight:600">${fmt(k.total_leads)}</td>
                <td>${k.effectiveness > 0 ? fmtPct(k.effectiveness) : '-'}</td>
              </tr>
            `).join("")}</tbody>
          </table></div>`
        }
      </div>
    </div>

    <!-- Group Discovery Keywords (from autopilot) -->
    <div class="card mb-20">
      <div class="card-header">
        <span class="card-title">Group Discovery Keywords</span>
        <span class="td-muted" style="font-size:11.5px">For finding new groups</span>
      </div>
      <div class="card-body">
        ${apKw.length === 0
          ? `<div class="empty-state" style="padding:32px"><p>Keywords will be generated by the autopilot after a few cycles.</p></div>`
          : `<div class="table-wrap"><table>
            <thead><tr>
              <th>Keyword</th>
              <th>Generated</th>
              <th>Groups Found</th>
              <th>Leads from Groups</th>
              <th>Effectiveness</th>
            </tr></thead>
            <tbody>${apKw.slice(0, 20).map((k) => `
              <tr>
                <td class="td-name">${escapeHtml(k.keyword)}</td>
                <td class="td-muted">${timeAgo(k.generated_at)}</td>
                <td>${fmt(k.groups_found)}</td>
                <td style="font-weight:600">${fmt(k.leads_from_groups)}</td>
                <td>${k.effectiveness > 0 ? fmtPct(k.effectiveness) : '-'}</td>
              </tr>
            `).join("")}</tbody>
          </table></div>`
        }
      </div>
    </div>
  `;
}

/* ===== Form Pipeline Leads ===== */

let pipelineLeadsPage = 0;
const PIPELINE_LEADS_PER_PAGE = 30;

async function renderPipelineLeads(container) {
  const [leadsData, emailLog] = await Promise.all([
    window.api.getPipelineLeads({ offset: pipelineLeadsPage * PIPELINE_LEADS_PER_PAGE, limit: PIPELINE_LEADS_PER_PAGE }),
    window.api.getEmailLog({}),
  ]);

  const { leads, total } = leadsData || { leads: [], total: 0 };
  const emails = emailLog || [];
  const totalPages = Math.ceil(total / PIPELINE_LEADS_PER_PAGE);

  // Group email counts by lead
  const emailCounts = {};
  for (const e of emails) {
    emailCounts[e.lead_id] = (emailCounts[e.lead_id] || 0) + 1;
  }

  container.innerHTML = `
    <h1 class="view-title">Form Leads <span class="view-subtitle">${fmt(total)} from Google Forms</span></h1>

    <!-- Leads Table -->
    <div class="card mb-20">
      <div class="card-body">
        ${leads.length === 0
          ? `<div class="empty-state"><h3>No form leads yet</h3><p>Leads from the Google Form will appear here when the pipeline daemon detects them.</p></div>`
          : `<div class="table-wrap"><table>
            <thead><tr>
              <th>Name</th>
              <th>Email</th>
              <th>Child</th>
              <th>State</th>
              <th>Meeting</th>
              <th>Emails Sent</th>
              <th>Detected</th>
            </tr></thead>
            <tbody>${leads.map((l) => `
              <tr>
                <td class="td-name">${escapeHtml(l.name)}</td>
                <td class="td-secondary">${escapeHtml(l.email)}</td>
                <td class="td-muted">${escapeHtml(l.child_name || "-")} ${l.child_grade ? `(${escapeHtml(l.child_grade)})` : ""}</td>
                <td>${badgeHtml(l.state)}</td>
                <td class="td-muted">${l.meeting_time ? new Date(l.meeting_time).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "-"}</td>
                <td>${fmt(emailCounts[l.id] || 0)}</td>
                <td class="td-muted">${timeAgo(l.detected_at)}</td>
              </tr>
            `).join("")}</tbody>
          </table></div>
          <div class="pagination">
            <span class="pagination-info">Page ${pipelineLeadsPage + 1} of ${Math.max(1, totalPages)}</span>
            <div class="pagination-btns">
              <button class="btn btn-secondary btn-sm" id="pl-prev" ${pipelineLeadsPage === 0 ? "disabled" : ""}>Prev</button>
              <button class="btn btn-secondary btn-sm" id="pl-next" ${pipelineLeadsPage >= totalPages - 1 ? "disabled" : ""}>Next</button>
            </div>
          </div>`
        }
      </div>
    </div>

    <!-- Recent Emails -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">Recent Emails Sent</span>
        <span class="td-muted" style="font-size:11.5px">${emails.length} shown</span>
      </div>
      <div class="card-body">
        ${emails.length === 0
          ? `<div class="empty-state" style="padding:24px"><p>No emails sent yet</p></div>`
          : `<div class="table-wrap"><table>
            <thead><tr><th>Lead</th><th>Type</th><th>Subject</th><th>Sent</th></tr></thead>
            <tbody>${emails.slice(0, 20).map((e) => `
              <tr>
                <td class="td-muted">#${e.lead_id}</td>
                <td>${badgeHtml(e.type)}</td>
                <td class="td-name td-truncate" style="max-width:300px">${escapeHtml(e.subject || "-")}</td>
                <td class="td-muted">${timeAgo(e.sent_at)}</td>
              </tr>
            `).join("")}</tbody>
          </table></div>`
        }
      </div>
    </div>
  `;

  container.querySelector("#pl-prev")?.addEventListener("click", () => {
    pipelineLeadsPage = Math.max(0, pipelineLeadsPage - 1);
    renderPipelineLeads(container);
  });
  container.querySelector("#pl-next")?.addEventListener("click", () => {
    pipelineLeadsPage++;
    renderPipelineLeads(container);
  });
}

/* ===== Auto-refresh ===== */

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (currentView === "overview") loadView("overview");
    updatePipelineStatus();
  }, 10000);
}

async function updatePipelineStatus() {
  const running = await window.api.getPipelineStatus();
  const el = document.getElementById("pipeline-status");
  if (el) {
    el.querySelector(".status-dot").className = `status-dot ${running ? "online" : "offline"}`;
    el.querySelector("span:last-child").textContent = running ? "Pipeline running" : "Pipeline offline";
  }
}

/* ===== Job output streaming ===== */

window.api.onJobOutput(({ jobName, data }) => {
  jobConsoleOutput[jobName] = (jobConsoleOutput[jobName] || "") + data;
  const consoleEl = document.getElementById("job-console");
  if (consoleEl) {
    consoleEl.textContent += data;
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }
});

window.api.onJobFinished(({ jobName, code }) => {
  const msg = `\n--- ${jobName} finished (code ${code}) ---\n`;
  jobConsoleOutput[jobName] = (jobConsoleOutput[jobName] || "") + msg;
  const consoleEl = document.getElementById("job-console");
  if (consoleEl) {
    consoleEl.textContent += msg;
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }
  toast(`${jobName} job ${code === 0 ? "completed" : "failed"}`, code === 0 ? "success" : "error");

  // Re-render if we're on a relevant view
  if (currentView === "overview" || currentView === "activity") {
    loadView(currentView);
  }
});

window.api.onPipelineLog((data) => {
  const consoleEl = document.getElementById("pipeline-console");
  if (consoleEl) {
    consoleEl.textContent += data;
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }
});

window.api.onPipelineStopped(() => {
  updatePipelineStatus();
  toast("Pipeline stopped", "info");
});

/* ===== Init ===== */

loadView("overview");
startAutoRefresh();
updatePipelineStatus();
