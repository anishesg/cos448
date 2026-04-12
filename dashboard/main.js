const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const DB_PATH = path.join(__dirname, "..", "pipeline", "pipeline.db");
const PIPELINE_DIR = path.join(__dirname, "..", "pipeline");
const ENV_PATH = path.join(PIPELINE_DIR, ".env");

let mainWindow;
let db;
const runningJobs = new Map();

// ---------- Database ----------

function getDb() {
  if (!db) {
    const Database = require("better-sqlite3");
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

function safeQuery(fn) {
  try {
    return fn(getDb());
  } catch (err) {
    console.error("DB error:", err.message);
    return null;
  }
}

// ---------- Window ----------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1340,
    height: 860,
    minWidth: 1000,
    minHeight: 650,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: "#f7f8fc",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  for (const [, job] of runningJobs) job.process.kill();
  if (db) db.close();
  app.quit();
});

// ---------- IPC: Overview ----------

ipcMain.handle("get-overview", () =>
  safeQuery((d) => {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const totalLeads = d.prepare("SELECT COUNT(*) as c FROM fb_leads").get().c;
    const todayLeads = d.prepare("SELECT COUNT(*) as c FROM fb_leads WHERE date(created_at) = ?").get(today).c;
    const weekLeads = d.prepare("SELECT COUNT(*) as c FROM fb_leads WHERE created_at >= ?").get(weekAgo).c;
    const activeGroups = d.prepare("SELECT COUNT(*) as c FROM fb_groups WHERE status = 'ACTIVE'").get().c;
    const totalGroups = d.prepare("SELECT COUNT(*) as c FROM fb_groups").get().c;
    const cooldownGroups = d.prepare("SELECT COUNT(*) as c FROM fb_groups WHERE status = 'ACTIVE' AND cooldown_until > datetime('now')").get().c;
    const retiredGroups = d.prepare("SELECT COUNT(*) as c FROM fb_groups WHERE status = 'RETIRED'").get().c;
    const budget = d.prepare("SELECT * FROM fb_llm_budget WHERE date = ?").get(today);
    const avgConf = d.prepare("SELECT AVG(classification_confidence) as v FROM fb_leads WHERE classification_confidence IS NOT NULL").get().v || 0;
    const exported = d.prepare("SELECT COUNT(*) as c FROM fb_leads WHERE outreach_state != 'QUEUED'").get().c;
    const queued = d.prepare("SELECT COUNT(*) as c FROM fb_leads WHERE outreach_state = 'QUEUED'").get().c;

    // Recent leads
    const recentLeads = d.prepare(`
      SELECT l.*, g.group_name FROM fb_leads l
      LEFT JOIN fb_groups g ON l.source_group_id = g.id
      ORDER BY l.created_at DESC LIMIT 8
    `).all();

    // Daily leads for last 7 days
    const dailyLeads = d.prepare(`
      SELECT date(created_at) as day, COUNT(*) as count
      FROM fb_leads WHERE created_at >= date('now', '-7 days')
      GROUP BY date(created_at) ORDER BY day
    `).all();

    // Top groups
    const topGroups = d.prepare(`
      SELECT * FROM fb_groups WHERE status = 'ACTIVE'
      ORDER BY lead_yield_rate DESC LIMIT 5
    `).all();

    // Recent scrape sessions
    const recentScrapes = d.prepare(`
      SELECT s.*, g.group_name FROM fb_scrape_log s
      LEFT JOIN fb_groups g ON s.group_id = g.id
      ORDER BY s.started_at DESC LIMIT 5
    `).all();

    return {
      totalLeads, todayLeads, weekLeads,
      activeGroups, totalGroups, cooldownGroups, retiredGroups,
      todaySpend: budget?.estimated_cost_usd || 0,
      todayCalls: budget?.total_calls || 0,
      avgConfidence: avgConf,
      exported, queued,
      recentLeads, dailyLeads, topGroups, recentScrapes,
    };
  })
);

// ---------- IPC: Leads ----------

ipcMain.handle("get-leads", (_, { offset = 0, limit = 50, status, search }) => {
  return safeQuery((d) => {
    let where = "1=1";
    const params = [];
    if (status && status !== "all") {
      where += " AND l.outreach_state = ?";
      params.push(status);
    }
    if (search) {
      where += " AND (l.name LIKE ? OR l.source_comment_text LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    const total = d.prepare(`SELECT COUNT(*) as c FROM fb_leads l WHERE ${where}`).get(...params).c;
    const leads = d.prepare(`
      SELECT l.*, g.group_name FROM fb_leads l
      LEFT JOIN fb_groups g ON l.source_group_id = g.id
      WHERE ${where}
      ORDER BY l.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    return { leads, total };
  });
});

ipcMain.handle("update-lead-status", (_, { id, status }) => {
  return safeQuery((d) => {
    d.prepare("UPDATE fb_leads SET outreach_state = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
    return true;
  });
});

// ---------- IPC: Groups ----------

ipcMain.handle("get-groups", () =>
  safeQuery((d) => d.prepare("SELECT * FROM fb_groups ORDER BY lead_yield_rate DESC").all())
);

ipcMain.handle("add-group", (_, { url, name }) => {
  return safeQuery((d) => {
    d.prepare(`
      INSERT OR IGNORE INTO fb_groups (group_url, group_name, discovery_source)
      VALUES (?, ?, 'manual')
    `).run(url, name || null);
    return true;
  });
});

ipcMain.handle("update-group-status", (_, { id, status }) => {
  return safeQuery((d) => {
    d.prepare("UPDATE fb_groups SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
    return true;
  });
});

ipcMain.handle("delete-group", (_, { id }) => {
  return safeQuery((d) => {
    d.prepare("DELETE FROM fb_groups WHERE id = ?").run(id);
    return true;
  });
});

// ---------- IPC: Activity / Scrape Log ----------

ipcMain.handle("get-scrape-log", (_, { limit = 50 } = {}) =>
  safeQuery((d) =>
    d.prepare(`
      SELECT s.*, g.group_name FROM fb_scrape_log s
      LEFT JOIN fb_groups g ON s.group_id = g.id
      ORDER BY s.started_at DESC LIMIT ?
    `).all(limit)
  )
);

ipcMain.handle("get-budget-history", () =>
  safeQuery((d) =>
    d.prepare("SELECT * FROM fb_llm_budget ORDER BY date DESC LIMIT 14").all()
  )
);

// ---------- IPC: Config / Settings ----------

function parseEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const content = fs.readFileSync(ENV_PATH, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return env;
}

function writeEnv(envObj) {
  // Read original to preserve comments and order
  const original = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const lines = original.split("\n");
  const written = new Set();
  const result = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      result.push(line);
      continue;
    }
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) { result.push(line); continue; }
    const key = trimmed.slice(0, eqIdx).trim();
    if (key in envObj) {
      result.push(`${key}=${envObj[key]}`);
      written.add(key);
    } else {
      result.push(line);
    }
  }

  // Append any new keys
  for (const [key, val] of Object.entries(envObj)) {
    if (!written.has(key)) result.push(`${key}=${val}`);
  }

  fs.writeFileSync(ENV_PATH, result.join("\n"));
}

ipcMain.handle("get-config", () => {
  const env = parseEnv();
  return {
    dailyBudget: parseFloat(env.FB_FINDER_DAILY_BUDGET || "15"),
    minConfidence: parseFloat(env.FB_FINDER_MIN_CONFIDENCE || "0.7"),
    groupsPerScrape: parseInt(env.FB_FINDER_GROUPS_PER_SCRAPE || "4", 10),
    exploreRatio: parseFloat(env.FB_FINDER_EXPLORE_RATIO || "0.25"),
    cooldownMinutes: parseInt(env.FB_FINDER_COOLDOWN_MINUTES || "240", 10),
    maxScrollsPerGroup: parseInt(env.FB_FINDER_MAX_SCROLLS || "10", 10),
    maxScrollsPerKeyword: parseInt(env.FB_FINDER_MAX_SCROLLS_PER_KEYWORD || "4", 10),
    keywordsPerGroup: parseInt(env.FB_FINDER_KEYWORDS_PER_GROUP || "5", 10),
    maxPostAgeDays: parseInt(env.FB_FINDER_MAX_POST_AGE || "7", 10),
    quietHoursStart: parseInt(env.QUIET_HOURS_START || "2", 10),
    quietHoursEnd: parseInt(env.QUIET_HOURS_END || "6", 10),
    skipQuietHours: env.SKIP_QUIET_HOURS === "true",
    testMode: env.TEST_MODE === "true",
    classifierModel: env.FB_FINDER_CLASSIFIER_MODEL || "us.amazon.nova-micro-v1:0",
    meetingWindowStart: parseInt(env.WINDOW_START_HOUR || "17", 10),
    meetingWindowEnd: parseInt(env.WINDOW_END_HOUR || "22", 10),
    maxBrowsingMinutes: parseInt(env.FB_FINDER_MAX_BROWSING_MINUTES || "15", 10),
  };
});

ipcMain.handle("save-config", (_, cfg) => {
  const mapped = {};
  if (cfg.dailyBudget != null) mapped.FB_FINDER_DAILY_BUDGET = String(cfg.dailyBudget);
  if (cfg.minConfidence != null) mapped.FB_FINDER_MIN_CONFIDENCE = String(cfg.minConfidence);
  if (cfg.groupsPerScrape != null) mapped.FB_FINDER_GROUPS_PER_SCRAPE = String(cfg.groupsPerScrape);
  if (cfg.exploreRatio != null) mapped.FB_FINDER_EXPLORE_RATIO = String(cfg.exploreRatio);
  if (cfg.cooldownMinutes != null) mapped.FB_FINDER_COOLDOWN_MINUTES = String(cfg.cooldownMinutes);
  if (cfg.maxScrollsPerGroup != null) mapped.FB_FINDER_MAX_SCROLLS = String(cfg.maxScrollsPerGroup);
  if (cfg.maxScrollsPerKeyword != null) mapped.FB_FINDER_MAX_SCROLLS_PER_KEYWORD = String(cfg.maxScrollsPerKeyword);
  if (cfg.keywordsPerGroup != null) mapped.FB_FINDER_KEYWORDS_PER_GROUP = String(cfg.keywordsPerGroup);
  if (cfg.maxPostAgeDays != null) mapped.FB_FINDER_MAX_POST_AGE = String(cfg.maxPostAgeDays);
  if (cfg.quietHoursStart != null) mapped.QUIET_HOURS_START = String(cfg.quietHoursStart);
  if (cfg.quietHoursEnd != null) mapped.QUIET_HOURS_END = String(cfg.quietHoursEnd);
  if (cfg.skipQuietHours != null) mapped.SKIP_QUIET_HOURS = String(cfg.skipQuietHours);
  if (cfg.testMode != null) mapped.TEST_MODE = String(cfg.testMode);
  if (cfg.maxBrowsingMinutes != null) mapped.FB_FINDER_MAX_BROWSING_MINUTES = String(cfg.maxBrowsingMinutes);
  writeEnv(mapped);
  return true;
});

// ---------- IPC: Job Runner ----------

const JOB_COMMANDS = {
  scrape: `import('./jobs/scrape-groups.js').then(m=>m.runScrapeGroups()).then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})`,
  discover: `import('./jobs/discover-groups.js').then(m=>m.runDiscoverGroups()).then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})`,
  export: `import('./jobs/export-leads.js').then(m=>m.runExportLeads()).then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})`,
};

ipcMain.handle("run-job", (_, { jobName }) => {
  if (runningJobs.has(jobName)) return { error: "Already running" };
  const command = JOB_COMMANDS[jobName];
  if (!command) return { error: "Unknown job" };

  const child = spawn("node", ["--input-type=module", "-e", command], {
    cwd: PIPELINE_DIR,
    env: { ...process.env, FORCE_COLOR: "0" },
  });

  let output = "";
  child.stdout.on("data", (data) => {
    output += data.toString();
    mainWindow?.webContents.send("job-output", { jobName, data: data.toString() });
  });
  child.stderr.on("data", (data) => {
    output += data.toString();
    mainWindow?.webContents.send("job-output", { jobName, data: data.toString() });
  });
  child.on("close", (code) => {
    runningJobs.delete(jobName);
    mainWindow?.webContents.send("job-finished", { jobName, code, output });
  });

  runningJobs.set(jobName, { process: child, output });
  return { pid: child.pid };
});

ipcMain.handle("kill-job", (_, { jobName }) => {
  const job = runningJobs.get(jobName);
  if (job) {
    job.process.kill();
    runningJobs.delete(jobName);
  }
  return true;
});

ipcMain.handle("get-running-jobs", () => [...runningJobs.keys()]);

// ---------- IPC: Pipeline daemon ----------

let pipelineProcess = null;

ipcMain.handle("start-pipeline", () => {
  if (pipelineProcess) return { error: "Already running" };
  pipelineProcess = spawn("node", ["index.js"], {
    cwd: PIPELINE_DIR,
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  pipelineProcess.stdout.on("data", (d) =>
    mainWindow?.webContents.send("pipeline-log", d.toString())
  );
  pipelineProcess.stderr.on("data", (d) =>
    mainWindow?.webContents.send("pipeline-log", d.toString())
  );
  pipelineProcess.on("close", () => {
    pipelineProcess = null;
    mainWindow?.webContents.send("pipeline-stopped");
  });
  return { pid: pipelineProcess.pid };
});

ipcMain.handle("stop-pipeline", () => {
  if (pipelineProcess) {
    pipelineProcess.kill();
    pipelineProcess = null;
  }
  return true;
});

ipcMain.handle("get-pipeline-status", () => !!pipelineProcess);

// ---------- IPC: Autopilot ----------

let autopilotProcess = null;

function loadEnvAsObject() {
  const envObj = {};
  try {
    if (fs.existsSync(ENV_PATH)) {
      const lines = fs.readFileSync(ENV_PATH, "utf8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        envObj[key] = val;
      }
    }
  } catch (err) {
    console.error("Failed to load .env for autopilot:", err.message);
  }
  return envObj;
}

ipcMain.handle("start-autopilot", () => {
  if (autopilotProcess) return { error: "Already running" };

  const dotenvVars = loadEnvAsObject();

  autopilotProcess = spawn("node", ["autopilot.js"], {
    cwd: PIPELINE_DIR,
    env: { ...process.env, ...dotenvVars, FORCE_COLOR: "0" },
  });

  autopilotProcess.stdout.on("data", (d) =>
    mainWindow?.webContents.send("autopilot-log", d.toString())
  );
  autopilotProcess.stderr.on("data", (d) =>
    mainWindow?.webContents.send("autopilot-log", d.toString())
  );
  autopilotProcess.on("close", (code) => {
    console.log(`Autopilot process exited with code ${code}`);
    autopilotProcess = null;
    mainWindow?.webContents.send("autopilot-stopped");
  });

  autopilotProcess.on("error", (err) => {
    console.error("Autopilot spawn error:", err.message);
    autopilotProcess = null;
    mainWindow?.webContents.send("autopilot-stopped");
  });

  return { pid: autopilotProcess.pid };
});

ipcMain.handle("stop-autopilot", () => {
  if (!autopilotProcess) return true;

  try {
    autopilotProcess.kill("SIGTERM");
  } catch (err) {
    console.error("Error killing autopilot:", err.message);
    try { autopilotProcess.kill("SIGKILL"); } catch { /* last resort */ }
  }

  // Give it 15 seconds then force kill
  const pid = autopilotProcess?.pid;
  setTimeout(() => {
    if (autopilotProcess && autopilotProcess.pid === pid) {
      console.log("Autopilot did not exit gracefully, force killing");
      try { autopilotProcess.kill("SIGKILL"); } catch { /* ignore */ }
      autopilotProcess = null;
    }
  }, 15000);

  return true;
});

ipcMain.handle("get-autopilot-status", () =>
  safeQuery((d) => {
    const state = d.prepare("SELECT * FROM autopilot_state WHERE id = 1").get();
    const unmessaged = d.prepare("SELECT COUNT(*) as c FROM fb_leads WHERE outreach_state = 'EXPORTED_CSV'").get().c;
    return { ...state, unmessaged_leads: unmessaged };
  })
);

ipcMain.handle("get-autopilot-cycles", (_, { limit = 20 } = {}) =>
  safeQuery((d) =>
    d.prepare("SELECT * FROM autopilot_cycles ORDER BY started_at DESC LIMIT ?").all(limit)
  )
);

ipcMain.handle("get-autopilot-keywords", () =>
  safeQuery((d) =>
    d.prepare("SELECT * FROM autopilot_keywords ORDER BY effectiveness DESC, generated_at DESC LIMIT 50").all()
  )
);

// ---------- IPC: Campaign / Messaging ----------

const MESSAGE_TEMPLATE_PATH = path.join(__dirname, "..", "message-template-autopilot.txt");
const COLLEGE_CAMPAIGN_TEMPLATE = path.join(__dirname, "..", "College Consulting Campaign", "message-template.txt");
const LEADS_CSV_PATH = path.join(__dirname, "..", "fb-group-leads.csv");

ipcMain.handle("get-campaign-status", () => {
  const templatePath = fs.existsSync(MESSAGE_TEMPLATE_PATH) ? MESSAGE_TEMPLATE_PATH : COLLEGE_CAMPAIGN_TEMPLATE;
  const template = fs.existsSync(templatePath) ? fs.readFileSync(templatePath, "utf8") : "";
  const csvExists = fs.existsSync(LEADS_CSV_PATH);
  let csvRows = 0;
  let completedRows = 0;
  if (csvExists) {
    const lines = fs.readFileSync(LEADS_CSV_PATH, "utf8").split("\n").filter((l) => l.trim());
    csvRows = Math.max(0, lines.length - 1);
    completedRows = lines.filter((l) => l.toLowerCase().includes(",true")).length;
  }

  return safeQuery((d) => {
    const queued = d.prepare("SELECT COUNT(*) as c FROM fb_leads WHERE outreach_state = 'QUEUED'").get().c;
    const exported = d.prepare("SELECT COUNT(*) as c FROM fb_leads WHERE outreach_state = 'EXPORTED_CSV'").get().c;
    const messaged = d.prepare("SELECT COUNT(*) as c FROM fb_leads WHERE outreach_state = 'MESSAGED'").get().c;
    const recentMessaged = d.prepare(`
      SELECT l.*, g.group_name FROM fb_leads l
      LEFT JOIN fb_groups g ON l.source_group_id = g.id
      WHERE l.outreach_state = 'MESSAGED'
      ORDER BY l.messaged_at DESC LIMIT 10
    `).all();
    return {
      template,
      templatePath: templatePath,
      csvRows,
      completedRows,
      queued,
      exported,
      messaged,
      recentMessaged,
    };
  });
});

ipcMain.handle("save-message-template", (_, { text }) => {
  const templatePath = fs.existsSync(MESSAGE_TEMPLATE_PATH) ? MESSAGE_TEMPLATE_PATH : COLLEGE_CAMPAIGN_TEMPLATE;
  fs.writeFileSync(templatePath, text);
  return true;
});

// ---------- IPC: Form Pipeline Leads ----------

ipcMain.handle("get-pipeline-leads", (_, { offset = 0, limit = 50 } = {}) =>
  safeQuery((d) => {
    const total = d.prepare("SELECT COUNT(*) as c FROM leads").get().c;
    const leads = d.prepare(`
      SELECT * FROM leads ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(limit, offset);
    return { leads, total };
  })
);

ipcMain.handle("get-email-log", (_, { leadId } = {}) =>
  safeQuery((d) => {
    if (leadId) {
      return d.prepare("SELECT * FROM email_log WHERE lead_id = ? ORDER BY sent_at DESC").all(leadId);
    }
    return d.prepare("SELECT * FROM email_log ORDER BY sent_at DESC LIMIT 50").all();
  })
);

// ---------- IPC: Keyword Search Stats ----------

ipcMain.handle("get-keyword-search-stats", () =>
  safeQuery((d) => {
    try {
      return d.prepare(`
        SELECT keyword,
               COUNT(*) as search_count,
               SUM(posts_found) as total_posts,
               SUM(leads_found) as total_leads,
               MAX(searched_at) as last_searched
        FROM fb_keyword_searches
        GROUP BY keyword
        ORDER BY total_leads DESC, total_posts DESC
        LIMIT 30
      `).all();
    } catch {
      return [];
    }
  })
);

ipcMain.handle("get-search-keywords", () =>
  safeQuery((d) => {
    try {
      return d.prepare(`
        SELECT * FROM fb_search_keywords
        WHERE status = 'ACTIVE'
        ORDER BY effectiveness DESC, total_leads DESC
        LIMIT 30
      `).all();
    } catch {
      return [];
    }
  })
);

// ---------- IPC: Utility ----------

ipcMain.handle("open-external", (_, url) => shell.openExternal(url));
