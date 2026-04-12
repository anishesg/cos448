import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "pipeline.db");

let _db = null;

export function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      email           TEXT NOT NULL,
      phone           TEXT,
      child_name      TEXT,
      child_grade     TEXT,
      form_row        INTEGER UNIQUE NOT NULL,
      state           TEXT NOT NULL DEFAULT 'DETECTED',
      meeting_time    TEXT,
      meet_link       TEXT,
      calendar_event_id TEXT,
      gmail_thread_id TEXT,
      detected_at     TEXT NOT NULL,
      scheduled_at    TEXT,
      confirmed_at    TEXT,
      reminded_24h_at TEXT,
      reminded_1h_at  TEXT,
      meeting_done_at TEXT,
      followup_at     TEXT,
      notes           TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS email_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id      INTEGER REFERENCES leads(id),
      type         TEXT NOT NULL,
      subject      TEXT,
      body         TEXT,
      sent_at      TEXT DEFAULT (datetime('now')),
      gmail_msg_id TEXT
    );

    -- Facebook group lead finder tables

    CREATE TABLE IF NOT EXISTS fb_groups (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      group_url              TEXT NOT NULL UNIQUE,
      group_name             TEXT,
      member_count           INTEGER,
      discovery_source       TEXT,
      search_keywords        TEXT,
      status                 TEXT NOT NULL DEFAULT 'ACTIVE',
      total_posts_scanned    INTEGER DEFAULT 0,
      total_comments_scanned INTEGER DEFAULT 0,
      total_leads_found      INTEGER DEFAULT 0,
      lead_yield_rate        REAL DEFAULT 0.0,
      last_scraped_at        TEXT,
      cooldown_until         TEXT,
      consecutive_zeros      INTEGER DEFAULT 0,
      created_at             TEXT DEFAULT (datetime('now')),
      updated_at             TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fb_scraped_posts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id        INTEGER REFERENCES fb_groups(id),
      post_url        TEXT,
      post_author     TEXT,
      post_text_hash  TEXT,
      post_timestamp  TEXT,
      scraped_at      TEXT DEFAULT (datetime('now')),
      UNIQUE(group_id, post_text_hash)
    );

    CREATE TABLE IF NOT EXISTS fb_leads (
      id                        INTEGER PRIMARY KEY AUTOINCREMENT,
      fb_user_id                TEXT UNIQUE,
      name                      TEXT NOT NULL,
      profile_url               TEXT NOT NULL,
      message_url               TEXT,
      source_group_id           INTEGER REFERENCES fb_groups(id),
      source_comment_text       TEXT,
      classification_reason     TEXT,
      classification_confidence REAL,
      outreach_state            TEXT NOT NULL DEFAULT 'QUEUED',
      exported_at               TEXT,
      messaged_at               TEXT,
      created_at                TEXT DEFAULT (datetime('now')),
      updated_at                TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fb_scrape_log (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id          INTEGER REFERENCES fb_groups(id),
      started_at        TEXT NOT NULL,
      finished_at       TEXT,
      posts_scanned     INTEGER DEFAULT 0,
      comments_scanned  INTEGER DEFAULT 0,
      leads_found       INTEGER DEFAULT 0,
      llm_calls         INTEGER DEFAULT 0,
      llm_cost_usd      REAL DEFAULT 0.0,
      error             TEXT,
      status            TEXT DEFAULT 'RUNNING'
    );

    CREATE TABLE IF NOT EXISTS fb_llm_budget (
      date                TEXT PRIMARY KEY,
      total_calls         INTEGER DEFAULT 0,
      total_input_tokens  INTEGER DEFAULT 0,
      total_output_tokens INTEGER DEFAULT 0,
      estimated_cost_usd  REAL DEFAULT 0.0
    );

    -- Autopilot system tables

    CREATE TABLE IF NOT EXISTS autopilot_state (
      id                    INTEGER PRIMARY KEY CHECK (id = 1),
      is_running            INTEGER DEFAULT 0,
      current_cycle         INTEGER DEFAULT 0,
      last_cycle_at         TEXT,
      last_keyword_gen_at   TEXT,
      total_leads_found     INTEGER DEFAULT 0,
      total_messages_sent   INTEGER DEFAULT 0,
      total_groups_retired  INTEGER DEFAULT 0,
      generated_keywords    TEXT,
      error_message         TEXT,
      started_at            TEXT,
      stopped_at            TEXT,
      updated_at            TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS autopilot_cycles (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_number        INTEGER NOT NULL,
      started_at          TEXT NOT NULL,
      finished_at         TEXT,
      groups_scraped      INTEGER DEFAULT 0,
      leads_found         INTEGER DEFAULT 0,
      leads_exported      INTEGER DEFAULT 0,
      messages_sent       INTEGER DEFAULT 0,
      keywords_generated  TEXT,
      groups_retired      INTEGER DEFAULT 0,
      llm_cost_usd        REAL DEFAULT 0.0,
      status              TEXT DEFAULT 'RUNNING',
      error               TEXT
    );

    CREATE TABLE IF NOT EXISTS autopilot_keywords (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword           TEXT NOT NULL,
      generated_at      TEXT DEFAULT (datetime('now')),
      generated_by      TEXT,
      groups_found      INTEGER DEFAULT 0,
      leads_from_groups INTEGER DEFAULT 0,
      effectiveness     REAL DEFAULT 0.0,
      status            TEXT DEFAULT 'ACTIVE'
    );

    -- In-group keyword search tracking
    CREATE TABLE IF NOT EXISTS fb_keyword_searches (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id        INTEGER REFERENCES fb_groups(id),
      keyword         TEXT NOT NULL,
      posts_found     INTEGER DEFAULT 0,
      leads_found     INTEGER DEFAULT 0,
      searched_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_keyword_searches_group
      ON fb_keyword_searches(group_id, searched_at);

    -- In-group search keywords (separate from group-discovery keywords)
    CREATE TABLE IF NOT EXISTS fb_search_keywords (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword         TEXT NOT NULL UNIQUE,
      source          TEXT DEFAULT 'seed',
      total_searches  INTEGER DEFAULT 0,
      total_posts     INTEGER DEFAULT 0,
      total_leads     INTEGER DEFAULT 0,
      effectiveness   REAL DEFAULT 0.0,
      status          TEXT DEFAULT 'ACTIVE',
      created_at      TEXT DEFAULT (datetime('now'))
    );

    -- Insert default autopilot state row
    INSERT OR IGNORE INTO autopilot_state (id, is_running) VALUES (1, 0);
  `);
}

// --- Lead queries ---

export function insertLead({ name, email, phone, childName, childGrade, formRow }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO leads (name, email, phone, child_name, child_grade, form_row, state, detected_at)
    VALUES (?, ?, ?, ?, ?, ?, 'DETECTED', datetime('now'))
  `);
  return stmt.run(name, email, phone || null, childName || null, childGrade || null, formRow);
}

export function getLeadsByState(state) {
  const db = getDb();
  return db.prepare("SELECT * FROM leads WHERE state = ?").all(state);
}

export function getLeadById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM leads WHERE id = ?").get(id);
}

export function updateLeadState(id, state, extraFields = {}) {
  const db = getDb();
  const sets = ["state = ?", "updated_at = datetime('now')"];
  const values = [state];

  for (const [key, val] of Object.entries(extraFields)) {
    sets.push(`${key} = ?`);
    values.push(val);
  }

  values.push(id);
  db.prepare(`UPDATE leads SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function getMaxFormRow() {
  const db = getDb();
  const row = db.prepare("SELECT MAX(form_row) as max_row FROM leads").get();
  return row?.max_row || 0;
}

export function getLeadsForReminder(type) {
  const db = getDb();
  const now = new Date().toISOString();

  if (type === "24h") {
    // Leads in CONFIRMED state with meeting 23-25 hours away, not yet reminded at 24h
    return db.prepare(`
      SELECT * FROM leads
      WHERE state IN ('CONFIRMED', 'SCHEDULED')
        AND reminded_24h_at IS NULL
        AND meeting_time IS NOT NULL
        AND (julianday(meeting_time) - julianday(?)) * 24 BETWEEN 23 AND 25
    `).all(now);
  }

  if (type === "1h") {
    // Leads with meeting 50-70 minutes away, not yet reminded at 1h
    return db.prepare(`
      SELECT * FROM leads
      WHERE state IN ('CONFIRMED', 'SCHEDULED', 'REMINDED_24H')
        AND reminded_1h_at IS NULL
        AND meeting_time IS NOT NULL
        AND (julianday(meeting_time) - julianday(?)) * 24 * 60 BETWEEN 50 AND 70
    `).all(now);
  }

  return [];
}

export function getLeadsForFollowup() {
  const db = getDb();
  const now = new Date().toISOString();
  // Meeting is at least 2 hours past, state is REMINDED or similar
  return db.prepare(`
    SELECT * FROM leads
    WHERE state IN ('REMINDED', 'REMINDED_24H')
      AND meeting_time IS NOT NULL
      AND meeting_done_at IS NULL
      AND (julianday(?) - julianday(meeting_time)) * 24 >= 2
  `).all(now);
}

// --- Email log ---

export function logEmail({ leadId, type, subject, body, gmailMsgId }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO email_log (lead_id, type, subject, body, gmail_msg_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(leadId, type, subject, body, gmailMsgId || null);
}

// --- Facebook Groups ---

export function insertFbGroup({ groupUrl, groupName, memberCount, discoverySource, searchKeywords }) {
  const db = getDb();
  return db.prepare(`
    INSERT OR IGNORE INTO fb_groups (group_url, group_name, member_count, discovery_source, search_keywords)
    VALUES (?, ?, ?, ?, ?)
  `).run(groupUrl, groupName || null, memberCount || null, discoverySource || 'seed', searchKeywords || null);
}

export function getActiveGroups() {
  const db = getDb();
  return db.prepare("SELECT * FROM fb_groups WHERE status = 'ACTIVE'").all();
}

export function getGroupsSortedByYield() {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM fb_groups
    WHERE status = 'ACTIVE'
    ORDER BY lead_yield_rate DESC
  `).all();
}

export function getGroupById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM fb_groups WHERE id = ?").get(id);
}

export function updateGroupStats(id, { postsScanned, commentsScanned, leadsFound }) {
  const db = getDb();
  const group = db.prepare("SELECT * FROM fb_groups WHERE id = ?").get(id);
  if (!group) return;

  const newPosts = group.total_posts_scanned + postsScanned;
  const newComments = group.total_comments_scanned + commentsScanned;
  const newLeads = group.total_leads_found + leadsFound;
  const yieldRate = newComments > 0 ? newLeads / newComments : 0;
  const consecutiveZeros = leadsFound === 0 ? group.consecutive_zeros + 1 : 0;

  db.prepare(`
    UPDATE fb_groups
    SET total_posts_scanned = ?,
        total_comments_scanned = ?,
        total_leads_found = ?,
        lead_yield_rate = ?,
        consecutive_zeros = ?,
        last_scraped_at = datetime('now'),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(newPosts, newComments, newLeads, yieldRate, consecutiveZeros, id);
}

export function retireGroup(id) {
  const db = getDb();
  db.prepare(`
    UPDATE fb_groups SET status = 'RETIRED', updated_at = datetime('now') WHERE id = ?
  `).run(id);
}

export function setGroupCooldown(id, cooldownMinutes) {
  const db = getDb();
  db.prepare(`
    UPDATE fb_groups
    SET cooldown_until = datetime('now', '+' || ? || ' minutes'),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(cooldownMinutes, id);
}

// --- Facebook Scraped Posts ---

export function isPostAlreadyScraped(groupId, textHash) {
  const db = getDb();
  const row = db.prepare(
    "SELECT 1 FROM fb_scraped_posts WHERE group_id = ? AND post_text_hash = ?"
  ).get(groupId, textHash);
  return !!row;
}

export function insertScrapedPost({ groupId, postUrl, postAuthor, postTextHash, postTimestamp }) {
  const db = getDb();
  return db.prepare(`
    INSERT OR IGNORE INTO fb_scraped_posts (group_id, post_url, post_author, post_text_hash, post_timestamp)
    VALUES (?, ?, ?, ?, ?)
  `).run(groupId, postUrl || null, postAuthor || null, postTextHash, postTimestamp || null);
}

// --- Facebook Leads ---

export function isUserAlreadyLead(fbUserId) {
  const db = getDb();
  const row = db.prepare("SELECT 1 FROM fb_leads WHERE fb_user_id = ?").get(fbUserId);
  return !!row;
}

export function insertFbLead({ fbUserId, name, profileUrl, messageUrl, sourceGroupId, sourceCommentText, classificationReason, classificationConfidence }) {
  const db = getDb();
  return db.prepare(`
    INSERT OR IGNORE INTO fb_leads (fb_user_id, name, profile_url, message_url, source_group_id, source_comment_text, classification_reason, classification_confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(fbUserId, name, profileUrl, messageUrl || null, sourceGroupId || null, sourceCommentText || null, classificationReason || null, classificationConfidence || null);
}

export function getQueuedFbLeads() {
  const db = getDb();
  return db.prepare("SELECT * FROM fb_leads WHERE outreach_state = 'QUEUED'").all();
}

export function updateFbLeadState(id, state, extraFields = {}) {
  const db = getDb();
  const sets = ["outreach_state = ?", "updated_at = datetime('now')"];
  const values = [state];
  for (const [key, val] of Object.entries(extraFields)) {
    sets.push(`${key} = ?`);
    values.push(val);
  }
  values.push(id);
  db.prepare(`UPDATE fb_leads SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function getAllFbUserIds() {
  const db = getDb();
  return db.prepare("SELECT fb_user_id FROM fb_leads").all().map((r) => r.fb_user_id);
}

// --- Scrape Log ---

export function startScrapeSession(groupId) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO fb_scrape_log (group_id, started_at, status)
    VALUES (?, datetime('now'), 'RUNNING')
  `).run(groupId);
  return result.lastInsertRowid;
}

export function finishScrapeSession(sessionId, { postsScanned, commentsScanned, leadsFound, llmCalls, llmCostUsd, error, status }) {
  const db = getDb();
  db.prepare(`
    UPDATE fb_scrape_log
    SET finished_at = datetime('now'),
        posts_scanned = ?,
        comments_scanned = ?,
        leads_found = ?,
        llm_calls = ?,
        llm_cost_usd = ?,
        error = ?,
        status = ?
    WHERE id = ?
  `).run(postsScanned || 0, commentsScanned || 0, leadsFound || 0, llmCalls || 0, llmCostUsd || 0, error || null, status || 'COMPLETED', sessionId);
}

// --- LLM Budget ---

export function getTodayBudget() {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  return db.prepare("SELECT * FROM fb_llm_budget WHERE date = ?").get(today) || {
    date: today,
    total_calls: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    estimated_cost_usd: 0,
  };
}

export function incrementBudget({ inputTokens, outputTokens, costUsd }) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(`
    INSERT INTO fb_llm_budget (date, total_calls, total_input_tokens, total_output_tokens, estimated_cost_usd)
    VALUES (?, 1, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      total_calls = total_calls + 1,
      total_input_tokens = total_input_tokens + ?,
      total_output_tokens = total_output_tokens + ?,
      estimated_cost_usd = estimated_cost_usd + ?
  `).run(today, inputTokens, outputTokens, costUsd, inputTokens, outputTokens, costUsd);
}

// --- Autopilot State ---

export function getAutopilotState() {
  const db = getDb();
  return db.prepare("SELECT * FROM autopilot_state WHERE id = 1").get();
}

export function updateAutopilotState(updates) {
  const db = getDb();
  const sets = ["updated_at = datetime('now')"];
  const values = [];

  for (const [key, val] of Object.entries(updates)) {
    sets.push(`${key} = ?`);
    values.push(val);
  }

  db.prepare(`UPDATE autopilot_state SET ${sets.join(", ")} WHERE id = 1`).run(...values);
}

export function startAutopilot() {
  const db = getDb();
  db.prepare(`
    UPDATE autopilot_state
    SET is_running = 1,
        started_at = datetime('now'),
        stopped_at = NULL,
        error_message = NULL,
        updated_at = datetime('now')
    WHERE id = 1
  `).run();
}

export function stopAutopilot() {
  const db = getDb();
  db.prepare(`
    UPDATE autopilot_state
    SET is_running = 0,
        stopped_at = datetime('now'),
        updated_at = datetime('now')
    WHERE id = 1
  `).run();
}

export function startAutopilotCycle(cycleNumber) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO autopilot_cycles (cycle_number, started_at, status)
    VALUES (?, datetime('now'), 'RUNNING')
  `).run(cycleNumber);
  return result.lastInsertRowid;
}

export function finishAutopilotCycle(cycleId, stats) {
  const db = getDb();
  db.prepare(`
    UPDATE autopilot_cycles
    SET finished_at = datetime('now'),
        groups_scraped = ?,
        leads_found = ?,
        leads_exported = ?,
        messages_sent = ?,
        keywords_generated = ?,
        groups_retired = ?,
        llm_cost_usd = ?,
        status = ?,
        error = ?
    WHERE id = ?
  `).run(
    stats.groupsScraped || 0,
    stats.leadsFound || 0,
    stats.leadsExported || 0,
    stats.messagesSent || 0,
    stats.keywordsGenerated || null,
    stats.groupsRetired || 0,
    stats.llmCostUsd || 0,
    stats.status || 'COMPLETED',
    stats.error || null,
    cycleId
  );
}

export function getRecentAutopilotCycles(limit = 10) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM autopilot_cycles
    ORDER BY started_at DESC
    LIMIT ?
  `).all(limit);
}

export function insertKeyword({ keyword, generatedBy }) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO autopilot_keywords (keyword, generated_by)
    VALUES (?, ?)
  `).run(keyword, generatedBy || 'autopilot');
}

export function getActiveKeywords() {
  const db = getDb();
  return db.prepare("SELECT * FROM autopilot_keywords WHERE status = 'ACTIVE' ORDER BY effectiveness DESC").all();
}

export function updateKeywordStats(keywordId, { groupsFound, leadsFromGroups }) {
  const db = getDb();
  const keyword = db.prepare("SELECT * FROM autopilot_keywords WHERE id = ?").get(keywordId);
  if (!keyword) return;

  const newGroupsFound = keyword.groups_found + (groupsFound || 0);
  const newLeadsFromGroups = keyword.leads_from_groups + (leadsFromGroups || 0);
  const effectiveness = newGroupsFound > 0 ? newLeadsFromGroups / newGroupsFound : 0;

  db.prepare(`
    UPDATE autopilot_keywords
    SET groups_found = ?,
        leads_from_groups = ?,
        effectiveness = ?
    WHERE id = ?
  `).run(newGroupsFound, newLeadsFromGroups, effectiveness, keywordId);
}

// --- In-group keyword search tracking ---

export function getRecentKeywordSearches(groupId, withinHours = 48) {
  const db = getDb();
  return db.prepare(`
    SELECT keyword, posts_found, leads_found, searched_at
    FROM fb_keyword_searches
    WHERE group_id = ?
      AND searched_at >= datetime('now', '-' || ? || ' hours')
    ORDER BY searched_at DESC
  `).all(groupId, withinHours);
}

export function recordKeywordSearch(groupId, keyword, postsFound, leadsFound) {
  const db = getDb();
  db.prepare(`
    INSERT INTO fb_keyword_searches (group_id, keyword, posts_found, leads_found)
    VALUES (?, ?, ?, ?)
  `).run(groupId, keyword, postsFound || 0, leadsFound || 0);

  // Upsert into the aggregate search keyword stats
  db.prepare(`
    INSERT INTO fb_search_keywords (keyword, source, total_searches, total_posts, total_leads, effectiveness)
    VALUES (?, 'seed', 1, ?, ?, ?)
    ON CONFLICT(keyword) DO UPDATE SET
      total_searches = total_searches + 1,
      total_posts = total_posts + ?,
      total_leads = total_leads + ?,
      effectiveness = CASE WHEN (total_posts + ?) > 0
        THEN CAST((total_leads + ?) AS REAL) / (total_posts + ?)
        ELSE 0 END
  `).run(
    keyword, postsFound || 0, leadsFound || 0,
    (postsFound || 0) > 0 ? (leadsFound || 0) / (postsFound || 1) : 0,
    postsFound || 0, leadsFound || 0,
    postsFound || 0, leadsFound || 0, postsFound || 0
  );
}

export function getTopSearchKeywords(limit = 20) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM fb_search_keywords
    WHERE status = 'ACTIVE'
    ORDER BY effectiveness DESC, total_leads DESC
    LIMIT ?
  `).all(limit);
}

export function getKeywordSearchStats() {
  const db = getDb();
  return db.prepare(`
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
}
