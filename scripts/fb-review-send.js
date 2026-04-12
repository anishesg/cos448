#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const { chromium } = require("playwright");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

const isMac = process.platform === "darwin";
const selectAllShortcut = isMac ? "Meta+A" : "Control+A";

/** Default pause between finishing one lead and starting the next (ms). */
const DEFAULT_BETWEEN_MESSAGES_MIN_MS = 30 * 1000;
const DEFAULT_BETWEEN_MESSAGES_MAX_MS = 5 * 60 * 1000;
const DEFAULT_BATCH_SIZE_MIN = 0;
const DEFAULT_BATCH_SIZE_MAX = 0;
const DEFAULT_BATCH_BREAK_MIN_MS = 0;
const DEFAULT_BATCH_BREAK_MAX_MS = 0;

const MESSENGER_HOME_URL = "https://www.facebook.com/messages/";
/** How often to re-check login / Messenger UI while waiting. */
const SESSION_POLL_MS = 2500;
/** Stop polling after this long and throw (ms). */
const SESSION_MAX_WAIT_MS = 2 * 60 * 60 * 1000;
/** How long to keep resolving thread UI before treating it as a failure. */
const THREAD_READY_MAX_WAIT_MS = 25 * 1000;
const THREAD_READY_POLL_MS = 900;
const FILE_CHOOSER_WAIT_MS = 4000;
const FILE_INPUT_SETTLE_MS = 250;
const COMPOSER_CONTROL_ROW_MAX_Y_DELTA = 44;
const COMPOSER_CONTROL_MAX_LEFT_GAP = 72;
const COMPOSER_CONTROL_MAX_SIZE = 64;
const SAFE_CLICK_MIN_ACTIONS = 1;
const SAFE_CLICK_MAX_ACTIONS = 3;
const COMPOSER_SELECTOR = [
  'div[role="textbox"][contenteditable="true"]',
  '[contenteditable="true"][role="textbox"]',
  '[aria-label*="message" i][contenteditable="true"]',
  '[aria-label*="Message" i][contenteditable="true"]'
].join(", ");

class StopRequestedError extends Error {}

function randomInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function shuffleArray(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

/**
 * Clicks with randomized position inside the element and variable press duration,
 * then a short random pause (overall “speed” jitter between actions).
 */
async function jitteredClick(locator, { timeout = 10000, marginRatio = 0.12 } = {}) {
  const box = await locator.boundingBox();
  if (!box || box.width < 4 || box.height < 4) {
    await locator.click({ delay: randomInt(12, 180), timeout });
    await sleep(randomInt(60, 520));
    return;
  }

  const padX = Math.max(2, box.width * marginRatio);
  const padY = Math.max(2, box.height * marginRatio);
  const x = randomFloat(padX, Math.max(padX, box.width - padX));
  const y = randomFloat(padY, Math.max(padY, box.height - padY));

  await locator.click({
    position: { x, y },
    delay: randomInt(10, 170),
    timeout
  });
  await sleep(randomInt(70, 480));
}

function normalizeForCompare(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "")
    .replace(/[\u200c\u200d\ufeff]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripEmojiForCompare(text) {
  return normalizeForCompare(text)
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .replace(/\uFE0F/g, "")
    .replace(/:\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeParagraphFlow(text) {
  const normalized = normalizeForCompare(text);
  if (!normalized) {
    return "";
  }

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n+/g, " ").replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

function protectLiteralEmoticons(text) {
  return String(text || "").replace(/:\)/g, ":\u200c)");
}

async function readComposerText(composer) {
  return composer.evaluate((el) => {
    if (!el) {
      return "";
    }
    return (el.innerText !== undefined ? el.innerText : el.textContent) || "";
  });
}

async function composerMatchesExpected(composer, expected) {
  const actual = normalizeForCompare(await readComposerText(composer));
  const exp = normalizeForCompare(expected);
  if (actual === exp) {
    return true;
  }
  if (actual.replace(/\n+$/u, "") === exp.replace(/\n+$/u, "")) {
    return true;
  }
  if (normalizeParagraphFlow(actual) === normalizeParagraphFlow(exp)) {
    return true;
  }

  const actualTextContent = normalizeParagraphFlow(
    await composer.evaluate((el) => (el?.textContent !== undefined ? el.textContent : "") || "")
  );
  if (actualTextContent === normalizeParagraphFlow(exp)) {
    return true;
  }

  if (stripEmojiForCompare(actual) === stripEmojiForCompare(exp)) {
    return true;
  }

  return false;
}

function splitMessageIntoRandomChunks(message, { minChars = 4, maxChars = 14 } = {}) {
  const chars = Array.from(String(message || ""));
  const chunks = [];

  for (let index = 0; index < chars.length;) {
    let size = Math.min(randomInt(minChars, maxChars), chars.length - index);
    if (chars[index] === "\n") {
      size = 1;
    } else {
      const newlineOffset = chars.slice(index, index + size).indexOf("\n");
      if (newlineOffset >= 0) {
        size = newlineOffset + 1;
      }
    }

    chunks.push(chars.slice(index, index + size).join(""));
    index += size;
  }

  return chunks;
}

function splitMessageIntoTypedParagraphs(message) {
  return String(message || "")
    .replace(/\r\n/g, "\n")
    .trimEnd()
    .split(/\n\n+/)
    .map((paragraph) => paragraph.replace(/[ \t]+$/gm, ""));
}

async function insertMessageWithVariablePauses(page, message) {
  const paragraphs = splitMessageIntoTypedParagraphs(protectLiteralEmoticons(message));

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    await page.keyboard.insertText(paragraph);

    if (index === paragraphs.length - 1) {
      break;
    }

    await sleep(randomInt(260, 900));
    await page.keyboard.press("Shift+Enter");
    await sleep(randomInt(120, 360));
    await page.keyboard.press("Shift+Enter");

    let pauseMs = randomInt(700, 2200);
    if (paragraph.length > 180) {
      pauseMs += randomInt(250, 1200);
    }
    if (Math.random() < 0.2) {
      pauseMs += randomInt(1200, 3200);
    }
    await sleep(pauseMs);
  }
}

async function clearComposerText(page, composer) {
  await jitteredClick(composer, { timeout: 10000 });
  await sleep(randomInt(260, 900));
  await page.keyboard.press(selectAllShortcut).catch(() => {});
  await sleep(randomInt(140, 420));
  await page.keyboard.press("Backspace").catch(() => {});
  await sleep(randomInt(320, 900));
}

async function insertExactMessageFallback(page, composer, message) {
  await clearComposerText(page, composer);
  const protectedMessage = protectLiteralEmoticons(message);

  const pasted = await page
    .evaluate(async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        return false;
      }
    }, protectedMessage)
    .catch(() => false);

  if (pasted) {
    await page.keyboard.press(isMac ? "Meta+V" : "Control+V").catch(() => {});
    await sleep(randomInt(900, 2200));
    return;
  }

  const inserted = await composer
    .evaluate((el, text) => {
      if (!el) {
        return false;
      }

      el.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      selection?.removeAllRanges();
      selection?.addRange(range);
      return document.execCommand("insertText", false, text);
    }, protectedMessage)
    .catch(() => false);

  if (!inserted) {
    throw new Error("Could not insert the exact message fallback text.");
  }

  await sleep(randomInt(900, 2200));
}

/**
 * Inserts the message paragraph by paragraph, using Shift+Enter for blank lines.
 * Newlines must NOT use keyboard Enter — in Messenger, Enter sends the message.
 */
async function insertWholeMessageAndVerify(page, composer, message) {
  const strategies = [
    {
      label: "typed insert",
      run: async () => {
        await clearComposerText(page, composer);
        await insertMessageWithVariablePauses(page, message);
        await sleep(randomInt(1200, 3000));
      }
    },
    {
      label: "exact-text fallback",
      run: async () => {
        await insertExactMessageFallback(page, composer, message);
      }
    }
  ];

  for (let index = 0; index < strategies.length; index += 1) {
    const strategy = strategies[index];
    await strategy.run();

    if (await composerMatchesExpected(composer, message)) {
      return;
    }

    if (index < strategies.length - 1) {
      console.warn(
        `Composer text did not match template after ${strategy.label}. Trying ${strategies[index + 1].label}…`
      );
    }
  }

  const preview = normalizeForCompare(await readComposerText(composer)).slice(0, 240);
  throw new Error(
    `Composer text still does not match the template after insert. Preview: ${JSON.stringify(
      preview
    )}…`
  );
}

async function repairComposerTextIfNeeded(page, composer, message, contextLabel = "Composer") {
  if (await composerMatchesExpected(composer, message)) {
    return false;
  }

  const preview = normalizeForCompare(await readComposerText(composer)).slice(0, 240);
  console.warn(
    `${contextLabel} drifted from the template. Re-inserting the full message before send. Preview: ${JSON.stringify(
      preview
    )}…`
  );
  await insertWholeMessageAndVerify(page, composer, message);

  if (!(await composerMatchesExpected(composer, message))) {
    throw new Error(`${contextLabel} still does not match the template after repair.`);
  }

  return true;
}

function orderCsvColumns(keys) {
  const preferred = ["Name", "Profile URL", "Message URL", "Completed"];
  const have = new Set(keys);
  const head = preferred.filter((k) => have.has(k));
  const tail = [...keys].filter((k) => !preferred.includes(k)).sort();
  if (!have.has("Completed")) {
    head.push("Completed");
  }
  return [...new Set([...head, ...tail])];
}

function markLeadCompletedInCsv(csvPath, messageId) {
  const absolute = path.resolve(csvPath);
  const raw = fs.readFileSync(absolute, "utf8");
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });

  let found = false;
  for (const row of records) {
    const rawId = firstDefinedValue(row, ["messageId", "Message ID"]);
    const rawUrl = firstDefinedValue(row, ["messageUrl", "Message URL"]);
    const id = extractMessageId(rawId || rawUrl);
    if (id === messageId) {
      row.Completed = "yes";
      found = true;
      break;
    }
  }

  if (!found) {
    console.warn(`Could not find messageId ${messageId} in CSV to mark Completed.`);
    return;
  }

  const allKeys = [...new Set(records.flatMap((r) => Object.keys(r)))];
  if (!allKeys.includes("Completed")) {
    allKeys.push("Completed");
  }
  const columns = orderCsvColumns(allKeys);
  for (const row of records) {
    if (row.Completed === undefined || row.Completed === null) {
      row.Completed = "";
    }
  }

  fs.writeFileSync(absolute, stringify(records, { header: true, columns }), "utf8");
  console.log(`Marked messageId ${messageId} as Completed in CSV.`);
}

function isLeadCompleted(record) {
  const v = firstDefinedValue(record, ["Completed", "completed", "Done", "done"]).toLowerCase();
  return v === "yes" || v === "true" || v === "1" || v === "y";
}

function isLoginOrCheckpointUrl(url) {
  const u = String(url || "").toLowerCase();
  return (
    u.includes("/login") ||
    u.includes("checkpoint") ||
    u.includes("two_factor") ||
    u.includes("two-factor") ||
    (u.includes("facebook.com") && u.includes("/recover"))
  );
}

function isMessengerSectionUrl(url) {
  return /facebook\.com\/messages|messenger\.com/i.test(String(url || ""));
}

async function loginFormLooksVisible(page) {
  const email = page.locator('input[name="email"], input#email, input[type="email"]').first();
  const pass = page.locator('input[name="pass"], input#pass, input[type="password"]').first();
  const emailOk = await email.isVisible({ timeout: 800 }).catch(() => false);
  const passOk = await pass.isVisible({ timeout: 800 }).catch(() => false);
  return emailOk && passOk;
}

/**
 * True when Messenger looks usable: thread list, composer, or “New message” (logged-in shell).
 */
async function isMessengerShellReady(page) {
  const threadLink = page.locator('a[href*="/messages/t/"]').first();
  const composer = page.locator('div[role="textbox"][contenteditable="true"]').first();
  const newMessage = page.locator('[aria-label="New message" i], [aria-label="New Message" i]').first();

  for (const locator of [threadLink, composer, newMessage]) {
    if (await locator.isVisible({ timeout: 3500 }).catch(() => false)) {
      return true;
    }
  }

  return false;
}

/**
 * Opens Messenger and polls until the user is logged in and the inbox UI is visible,
 * or until SESSION_MAX_WAIT_MS. No manual Enter required.
 */
async function waitUntilMessengerReady(page) {
  const started = Date.now();
  let iteration = 0;
  let lastLoginHint = 0;

  while (Date.now() - started < SESSION_MAX_WAIT_MS) {
    iteration += 1;
    await page.waitForLoadState("domcontentloaded", { timeout: 20000 }).catch(() => {});

    const url = page.url();

    if (isMessengerSectionUrl(url) && (await isMessengerShellReady(page))) {
      console.log("Messenger is ready — starting leads.");
      return;
    }

    if (isLoginOrCheckpointUrl(url) || (await loginFormLooksVisible(page))) {
      const now = Date.now();
      if (now - lastLoginHint > 12000) {
        console.log("Log in or finish verification in the browser. Waiting for Messenger…");
        lastLoginHint = now;
      }
      await sleep(SESSION_POLL_MS);
      await page.goto(MESSENGER_HOME_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60000
      }).catch(() => {});
      continue;
    }

    if (/facebook\.com/i.test(url) && !isMessengerSectionUrl(url)) {
      await page.goto(MESSENGER_HOME_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60000
      }).catch(() => {});
      await sleep(800);
      continue;
    }

    if (iteration % 6 === 0) {
      console.log("Waiting for Messenger to finish loading…");
    }

    await sleep(SESSION_POLL_MS);

    if (iteration % 10 === 0) {
      await page.goto(MESSENGER_HOME_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60000
      }).catch(() => {});
    }
  }

  throw new Error(
    `Messenger did not become ready within ${Math.round(SESSION_MAX_WAIT_MS / 60000)} minutes.`
  );
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--print-message")) {
    await printMessagePreview(argv);
    return;
  }

  const configPath = getConfigPath(argv);
  const config = loadConfig(configPath, {
    sendMode: parseSendMode(argv),
    readyScreenshotDir: parseReadyScreenshotDir(argv)
  });
  const limit = parseLimit(argv);
  const template = fs.readFileSync(config.messageTemplatePath, "utf8");
  let leads = loadLeads(config.leadsCsvPath, config);
  if (limit !== null) {
    leads = leads.slice(0, limit);
  }
  const rl = readline.createInterface({ input: stdin, output: stdout });

  if (leads.length === 0) {
    throw new Error("No leads found after applying startAtRow.");
  }

  fs.mkdirSync(path.resolve("artifacts"), { recursive: true });
  fs.mkdirSync(config.userDataDir, { recursive: true });

  const runState = createRunState(config);
  const context = await launchContext(config);
  const page = context.pages()[0] || (await context.newPage());

  try {
    console.log("Opening Messenger...");
    await page.goto(MESSENGER_HOME_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await waitUntilMessengerReady(page);

    for (let index = 0; index < leads.length; index += 1) {
      const lead = leads[index];
      const leadNumber = lead.sheetRow;

      console.log(
        `\n[${index + 1}/${leads.length}] Preparing thread for ${lead.firstName} (${lead.messageId}) (sheet row ${leadNumber})`
      );

      try {
        await processLead({ page, rl, config, template, lead, leadNumber, runState });
      } catch (error) {
        if (error instanceof StopRequestedError) {
          console.log("Stopping at your request.");
          break;
        }

        const safeName = slugify(`${leadNumber}-${lead.firstName}-${lead.messageId}`);
        const screenshotPath = path.resolve("artifacts", `${safeName}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
        console.error(`Failed on ${lead.firstName}: ${error.message}`);
        console.error(`Saved screenshot to ${screenshotPath}`);

        if (config.sendMode === "auto") {
          console.log(
            "Continuing automatically to the next lead because sendMode is auto. This lead was left incomplete for review."
          );
          await pauseBetweenLeads(config, leadNumber, "failed", { runState, shortPause: true });
          continue;
        }

        const action = (
          await rl.question("Type 'c' to continue to the next lead, or anything else to stop: ")
        )
          .trim()
          .toLowerCase();

        if (action !== "c") {
          break;
        }
      }
    }
  } finally {
    await rl.close();
    await context.close();
  }
}

/**
 * Checks if the thread/page already contains a message we previously sent.
 * Walks all text on the page EXCLUDING contenteditable composers, looking
 * for distinctive phrases from our message templates.
 */
async function threadAlreadyContainsOurMessage(page, composer) {
  await sleep(500);

  const result = await page.evaluate(() => {
    const signatures = [
      "I\u2019m Anish Kataria",
      "I'm Anish Kataria",
      "Anish Kataria, current junior at Princeton",
      "Microsoft AI this summer",
      "mentored 30+ students",
      "Attaching a flyer for your reference",
      "cutting-edge technologies in AI",
      "tinyurl.com/anishconsulting",
      "I'll help your child find research opportunities"
    ];

    const chunks = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      let inComposer = false;
      for (let el = node.parentElement; el; el = el.parentElement) {
        if (el.getAttribute("contenteditable") === "true") {
          inComposer = true;
          break;
        }
      }
      if (!inComposer) {
        chunks.push(node.textContent);
      }
    }

    const pageText = chunks.join(" ");
    for (const sig of signatures) {
      if (pageText.includes(sig)) {
        return sig;
      }
    }
    return null;
  });

  if (result) {
    console.log(`Duplicate detection matched: "${result}"`);
  }
  return result !== null;
}

async function processLead({ page, rl, config, template, lead, leadNumber, runState }) {
  const threadUrl = resolveLeadThreadUrl(config, lead);
  const message = renderTemplate(template, lead);

  const { threadState, routeLabel } = await openLeadThread(page, config, lead, threadUrl);
  if (threadState.status === "cannotMessage") {
    console.log(
      `Skipping ${lead.firstName}: Facebook does not allow messaging this account (or thread is blocked).`
    );
    markLeadCompletedInCsv(config.leadsCsvPath, lead.messageId);
    await pauseBetweenLeads(config, leadNumber, "skipped — cannot message", { runState, shortPause: true });
    return;
  }

  const composer = threadState.composer;
  const allowHarmlessJitter = isMessengerSectionUrl(page.url());
  let activeComposer = composer;

  if (await threadAlreadyContainsOurMessage(page, activeComposer)) {
    console.log(
      `Skipping ${lead.firstName}: already messaged (found existing sent message in thread).`
    );
    markLeadCompletedInCsv(config.leadsCsvPath, lead.messageId);
    await pauseBetweenLeads(config, leadNumber, "skipped — already messaged", { runState, shortPause: true });
    return;
  }

  if (allowHarmlessJitter) {
    await performHarmlessInteractionJitter(page, activeComposer);
  }
  await clearExistingDraftAttachments(page, activeComposer);
  await insertWholeMessageAndVerify(page, activeComposer, message);

  if (config.imagePath) {
    await clearExistingDraftAttachments(page, activeComposer);
    await uploadImage(page, config.imagePath, activeComposer);
    await sleep(randomInt(1200, 2800));
    activeComposer = await refreshActiveComposer(page, routeLabel);
    await repairComposerTextIfNeeded(page, activeComposer, message, "Composer after image upload");
    await ensureSingleDraftAttachment(page, activeComposer, config.imagePath);
  }

  if (allowHarmlessJitter) {
    await performHarmlessInteractionJitter(page, activeComposer);
  }
  await repairComposerTextIfNeeded(page, activeComposer, message, "Final pre-send composer");
  await assertActiveThreadLooksExpected(page, lead);
  await saveReadyScreenshotIfConfigured(page, config, leadNumber, lead);

  console.log(`Thread is ready for ${lead.firstName}.`);
  console.log(`Open route: ${routeLabel}`);
  console.log(`URL: ${threadUrl}`);

  if (config.sendMode === "auto") {
    if (allowHarmlessJitter) {
      await performHarmlessInteractionJitter(page, activeComposer);
    }
    await repairComposerTextIfNeeded(
      page,
      activeComposer,
      message,
      "Composer immediately before auto-send"
    );
    await clickSend(page, activeComposer);
    await verifyDraftClearedAfterSend(page, activeComposer, message);
    console.log(`Sent message for ${lead.firstName}.`);
    markLeadCompletedInCsv(config.leadsCsvPath, lead.messageId);
  } else if (config.sendMode === "terminalConfirm") {
    const decision = await askDecision(
      rl,
      "Press Enter to send, type 's' to skip this lead, or 'q' to stop: "
    );

    if (decision === "q") {
      throw new StopRequestedError();
    }

    if (decision === "s") {
      return;
    }

    if (allowHarmlessJitter) {
      await performHarmlessInteractionJitter(page, activeComposer);
    }
    await repairComposerTextIfNeeded(page, activeComposer, message, "Composer immediately before send");
    await clickSend(page, activeComposer);
    await verifyDraftClearedAfterSend(page, activeComposer, message);
    console.log(`Sent message for ${lead.firstName}.`);
    markLeadCompletedInCsv(config.leadsCsvPath, lead.messageId);
  } else {
    const decision = await askDecision(
      rl,
      "Review the thread in the browser. Press Enter after you send manually, type 's' to skip, or 'q' to stop: "
    );

    if (decision === "q") {
      throw new StopRequestedError();
    }

    if (decision === "s") {
      return;
    }

    markLeadCompletedInCsv(config.leadsCsvPath, lead.messageId);
  }

  await pauseBetweenLeads(config, leadNumber, "", {
    runState,
    countTowardsBatch: true
  });
}

function isBatchBreakEnabled(config) {
  return config.batchSizeMin > 0 && config.batchBreakMinMs > 0;
}

function resolveNextBatchSize(config) {
  return randomInt(config.batchSizeMin, config.batchSizeMax);
}

function resolveBatchBreakMs(config) {
  return randomInt(config.batchBreakMinMs, config.batchBreakMaxMs);
}

function createRunState(config) {
  if (!isBatchBreakEnabled(config)) {
    return null;
  }

  return {
    sentSinceBreak: 0,
    nextBreakAfter: resolveNextBatchSize(config)
  };
}

function formatDuration(ms) {
  const totalSeconds = Math.max(1, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

function resolveLeadPause(config, runState, { countTowardsBatch = false } = {}) {
  if (countTowardsBatch && runState) {
    runState.sentSinceBreak += 1;

    if (runState.sentSinceBreak >= runState.nextBreakAfter) {
      const batchSize = runState.sentSinceBreak;
      const waitMs = resolveBatchBreakMs(config);
      runState.sentSinceBreak = 0;
      runState.nextBreakAfter = resolveNextBatchSize(config);

      return {
        waitMs,
        label: `Taking a longer batch break for ${formatDuration(waitMs)} after ${batchSize} sent messages. Next long break after about ${runState.nextBreakAfter} more sends.`
      };
    }
  }

  const waitMs = resolveBetweenLeadsWaitMs(config);
  return {
    waitMs,
    label: waitMs > 0 ? `Waiting ${formatDuration(waitMs)} before the next lead...` : ""
  };
}

async function pauseBetweenLeads(config, leadNumber, statusNote = "", options = {}) {
  const { runState = null, countTowardsBatch = false, shortPause = false } = options;

  if (shortPause) {
    const waitMs = randomInt(2000, 5000);
    console.log(`Quick pause ${formatDuration(waitMs)}...`);
    await sleep(waitMs);
  } else {
    const pausePlan = resolveLeadPause(config, runState, { countTowardsBatch });
    if (pausePlan.waitMs > 0) {
      console.log(pausePlan.label);
      await sleep(pausePlan.waitMs);
    }
  }

  const extra = statusNote ? ` (${statusNote})` : "";
  console.log(`Finished lead row ${leadNumber}${extra}.`);
}

function getConfigPath(args) {
  const configFlagIndex = args.indexOf("--config");
  const configPath =
    configFlagIndex >= 0 && args[configFlagIndex + 1]
      ? args[configFlagIndex + 1]
      : "campaign.config.json";

  return path.resolve(configPath);
}

/** Optional: `--limit N` processes only the first N leads (after startAtRow). */
function parseLimit(args) {
  const i = args.indexOf("--limit");
  if (i < 0 || !args[i + 1]) {
    return null;
  }

  const n = Number.parseInt(args[i + 1], 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error("--limit must be a positive integer.");
  }

  return n;
}

function parseSendMode(args) {
  const i = args.indexOf("--send-mode");
  if (i < 0 || !args[i + 1]) {
    return null;
  }

  return String(args[i + 1]).trim();
}

function parseReadyScreenshotDir(args) {
  const i = args.indexOf("--ready-screenshot-dir");
  if (i < 0 || !args[i + 1]) {
    return "";
  }

  return String(args[i + 1]).trim();
}

function loadConfig(configPath, overrides = {}) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing config file: ${configPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const config = {
    leadsCsvPath: resolveFrom(configPath, raw.leadsCsvPath || "./leads.csv"),
    messageTemplatePath: resolveFrom(configPath, raw.messageTemplatePath || "./message-template.txt"),
    imagePath: raw.imagePath ? resolveFrom(configPath, raw.imagePath) : "",
    userDataDir: resolveFrom(configPath, raw.userDataDir || "./.session/facebook"),
    threadUrlTemplate: raw.threadUrlTemplate || "https://www.facebook.com/messages/t/{messageId}",
    browserChannel: raw.browserChannel || "chrome",
    headless: Boolean(raw.headless),
    sendMode: overrides.sendMode || raw.sendMode || "manual",
    postActionDelayMs: Number(raw.postActionDelayMs || 0),
    betweenMessagesMinMs: Number(
      raw.betweenMessagesMinMs ?? DEFAULT_BETWEEN_MESSAGES_MIN_MS
    ),
    betweenMessagesMaxMs: Number(
      raw.betweenMessagesMaxMs ?? DEFAULT_BETWEEN_MESSAGES_MAX_MS
    ),
    batchSizeMin: Number(raw.batchSizeMin ?? DEFAULT_BATCH_SIZE_MIN),
    batchSizeMax: Number(raw.batchSizeMax ?? raw.batchSizeMin ?? DEFAULT_BATCH_SIZE_MAX),
    batchBreakMinMs: Number(raw.batchBreakMinMs ?? DEFAULT_BATCH_BREAK_MIN_MS),
    batchBreakMaxMs: Number(
      raw.batchBreakMaxMs ?? raw.batchBreakMinMs ?? DEFAULT_BATCH_BREAK_MAX_MS
    ),
    startAtRow: Number(raw.startAtRow || 1),
    readyScreenshotDir: overrides.readyScreenshotDir
      ? resolveFrom(configPath, overrides.readyScreenshotDir)
      : raw.readyScreenshotDir
        ? resolveFrom(configPath, raw.readyScreenshotDir)
        : ""
  };

  if (!config.threadUrlTemplate.includes("{messageId}")) {
    throw new Error("threadUrlTemplate must include {messageId}.");
  }

  if (!["manual", "terminalConfirm", "auto"].includes(config.sendMode)) {
    throw new Error("sendMode must be 'manual', 'terminalConfirm', or 'auto'.");
  }

  if (config.startAtRow < 1) {
    throw new Error("startAtRow must be 1 or greater.");
  }

  if (config.betweenMessagesMinMs > config.betweenMessagesMaxMs) {
    throw new Error("betweenMessagesMinMs must be <= betweenMessagesMaxMs.");
  }

  if (config.batchSizeMin > config.batchSizeMax) {
    throw new Error("batchSizeMin must be <= batchSizeMax.");
  }

  if (config.batchBreakMinMs > config.batchBreakMaxMs) {
    throw new Error("batchBreakMinMs must be <= batchBreakMaxMs.");
  }

  return config;
}

/**
 * Pause after each lead: random between min/max (default 30s–5m).
 * If `postActionDelayMs` > 0, uses that fixed delay instead (legacy).
 */
function resolveBetweenLeadsWaitMs(config) {
  if (config.postActionDelayMs > 0) {
    return config.postActionDelayMs;
  }

  return randomInt(config.betweenMessagesMinMs, config.betweenMessagesMaxMs);
}

function loadLeads(csvPath, config) {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Missing leads CSV: ${csvPath}`);
  }

  const records = parse(fs.readFileSync(csvPath, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });

  const leads = [];
  let sourceRow = 1;

  for (const record of records) {
    sourceRow += 1;

    if (isLeadCompleted(record)) {
      continue;
    }

    const rawName = firstDefinedValue(record, ["firstName", "First Name", "Name"]);
    const rawMessageId = firstDefinedValue(record, ["messageId", "Message ID"]);
    const rawMessageUrl = firstDefinedValue(record, ["messageUrl", "Message URL"]);
    const rawProfileUrl = firstDefinedValue(record, ["profileUrl", "Profile URL"]);

    if (
      !String(rawName).trim() &&
      !String(rawMessageId).trim() &&
      !String(rawMessageUrl).trim() &&
      !String(rawProfileUrl).trim()
    ) {
      continue;
    }

    const fullName = String(rawName || "").trim();
    const firstName = extractFirstName(fullName);
    const messageId = extractMessageId(rawMessageId || rawMessageUrl);

    if (!firstName || !messageId) {
      throw new Error(
        `Invalid CSV row ${sourceRow} (sheet row). Expected a usable name and message ID or Message URL column.`
      );
    }

    leads.push({
      firstName,
      fullName,
      messageId,
      messageUrl: String(rawMessageUrl || "").trim(),
      profileUrl: String(rawProfileUrl || "").trim(),
      sheetRow: sourceRow
    });
  }

  return leads.slice(config.startAtRow - 1);
}

async function printMessagePreview(argv) {
  const configPath = getConfigPath(argv);
  const config = loadConfig(configPath);
  const template = fs.readFileSync(config.messageTemplatePath, "utf8");
  const leads = loadLeads(config.leadsCsvPath, config);

  if (leads.length === 0) {
    console.error("No eligible leads (check Completed column and startAtRow).");
    process.exitCode = 1;
    return;
  }

  const sample = leads[0];
  const rendered = renderTemplate(template, sample);

  console.log(
    `--- Rendered message (first eligible lead: ${sample.firstName}, sheet row ${sample.sheetRow}) ---\n`
  );
  console.log(rendered);
  console.log(`\n--- End (${rendered.length} characters) ---`);
}

function renderTemplate(template, lead) {
  return template
    .replace(/\{\{\s*firstName\s*\}\}/g, lead.firstName)
    .replace(/\[\s*first\s+name\s*\]/gi, lead.firstName);
}

async function launchContext(config) {
  const options = {
    headless: config.headless,
    viewport: null
  };

  try {
    if (config.browserChannel) {
      return await chromium.launchPersistentContext(config.userDataDir, {
        ...options,
        channel: config.browserChannel
      });
    }

    return await chromium.launchPersistentContext(config.userDataDir, options);
  } catch (error) {
    if (!config.browserChannel) {
      throw error;
    }

    console.warn(
      `Chrome channel launch failed (${error.message}). Falling back to Playwright Chromium.`
    );

    return chromium.launchPersistentContext(config.userDataDir, options);
  }
}

/**
 * Facebook hides the composer and shows copy like "You can't message this account."
 * Polls briefly in case the banner renders late.
 */
async function cannotMessageThread(
  page,
  { attempts = 5, intervalMs = 650, visibleTimeoutMs = 500 } = {}
) {
  const patterns = [
    /You can['\u2019]t message this account/i,
    /can['\u2019]t message this account/i,
    /You can['\u2019]t reply to this conversation/i,
    /You can['\u2019]t send messages? to this account/i,
    /This person isn['\u2019]t available right now/i,
    /Messaging is unavailable/i,
    /can['\u2019]t continue this chat/i,
    /You can no longer reply to this conversation/i,
    /This chat is unavailable/i,
    /Unable to send message/i
  ];

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    for (const re of patterns) {
      const loc = page.getByText(re).first();
      if (await loc.isVisible({ timeout: visibleTimeoutMs }).catch(() => false)) {
        return true;
      }
    }
    if (attempt < attempts - 1) {
      await sleep(intervalMs);
    }
  }

  return false;
}

async function dismissContinueIfPresent(page) {
  for (const candidate of getContinueLocators(page)) {
    if (await candidate.isVisible().catch(() => false)) {
      await jitteredClick(candidate, { timeout: 3000 });
      await sleep(randomInt(1000, 2600));
      return true;
    }
  }

  return false;
}

async function findComposer(page, { waitMs = 15000 } = {}) {
  for (const locator of getComposerLocators(page)) {
    if (await locator.isVisible().catch(() => false)) {
      return locator;
    }
  }

  if (waitMs <= 0) {
    throw new Error("Could not find the message composer.");
  }

  for (const locator of getComposerLocators(page)) {
    await locator.waitFor({ state: "visible", timeout: waitMs }).catch(() => {});
    if (await locator.isVisible().catch(() => false)) {
      return locator;
    }
  }

  throw new Error("Could not find the message composer.");
}

async function resolveThreadMessagingState(
  page,
  { timeoutMs = THREAD_READY_MAX_WAIT_MS, allowContinueClick = true } = {}
) {
  const started = Date.now();
  let continueClicks = 0;

  while (Date.now() - started < timeoutMs) {
    if (await pageShowsUnavailableContent(page)) {
      return { status: "unavailable" };
    }

    if (
      await cannotMessageThread(page, {
        attempts: 1,
        intervalMs: 0,
        visibleTimeoutMs: 250
      })
    ) {
      return { status: "cannotMessage" };
    }

    const composer = await findComposer(page, { waitMs: 0 }).catch(() => null);
    if (composer) {
      return { status: "ready", composer };
    }

    if (!allowContinueClick && (await continueLooksVisible(page))) {
      return { status: "needsContinue" };
    }

    if (allowContinueClick && (await dismissContinueIfPresent(page))) {
      continueClicks += 1;
      console.log(`Clicked Continue (${continueClicks}) while preparing the thread.`);
      await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
      continue;
    }

    await sleep(THREAD_READY_POLL_MS);
  }

  throw new Error(
    "Could not reach a message-ready thread state. Messenger never showed a composer, a Continue button, a blocked-thread banner, or an unavailable-page signal."
  );
}

function resolveLeadThreadUrl(config, lead) {
  return lead.messageUrl || config.threadUrlTemplate.replace("{messageId}", lead.messageId);
}

async function openLeadThread(page, config, lead, threadUrl) {
  await page.goto(threadUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

  const directState = await resolveThreadMessagingState(page, { allowContinueClick: false });
  if (directState.status === "ready" || directState.status === "cannotMessage") {
    return {
      threadState: directState,
      routeLabel: "direct thread URL"
    };
  }

  if (directState.status === "needsContinue") {
    console.log(
      `Thread for ${lead.firstName} requires Continue. Attempting Continue flow first...`
    );
    try {
      const continueState = await resolveThreadMessagingState(page);
      if (continueState.status === "ready") {
        return {
          threadState: continueState,
          routeLabel: "direct thread URL + Continue"
        };
      }
      if (continueState.status === "cannotMessage") {
        return {
          threadState: continueState,
          routeLabel: "direct thread URL + Continue"
        };
      }
      console.log(
        `Continue flow for ${lead.firstName} did not produce a usable thread (status: ${continueState.status}).`
      );
    } catch (err) {
      console.log(
        `Continue flow failed for ${lead.firstName}: ${err.message}`
      );
    }
  }

  if (!lead.profileUrl) {
    throw new Error(
      `Direct thread for ${lead.firstName} is not usable and no profile URL is available for fallback.`
    );
  }

  console.log(
    `Falling back to profile Message button for ${lead.firstName}.`
  );
  return {
    threadState: await openLeadThreadViaProfile(page, lead),
    routeLabel: "profile Message fallback"
  };
}

async function openLeadThreadViaProfile(page, lead) {
  await page.goto(lead.profileUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await sleep(randomInt(1200, 2600));

  await clickProfileMessageButton(page);
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await sleep(randomInt(1800, 3600));

  if (isMessengerSectionUrl(page.url())) {
    const state = await resolveThreadMessagingState(page, { allowContinueClick: false });
    if (state.status === "needsContinue") {
      throw new Error(
        `Profile Message button for ${lead.firstName} still surfaced a Continue gate instead of a composer.`
      );
    }
    if (state.status === "unavailable") {
      throw new Error(`Profile Message button for ${lead.firstName} opened an unavailable page.`);
    }
    return state;
  }

  const composer = await findProfilePopupComposer(page);
  if (!composer) {
    throw new Error(`Profile Message button for ${lead.firstName} did not open a message composer popover.`);
  }

  return { status: "ready", composer };
}

async function clickProfileMessageButton(page) {
  for (const candidate of getProfileMessageButtonLocators(page)) {
    if (await candidate.isVisible().catch(() => false)) {
      await jitteredClick(candidate, { timeout: 4000 });
      return;
    }
  }

  throw new Error("Could not find the profile Message button.");
}

async function continueLooksVisible(page) {
  for (const candidate of getContinueLocators(page)) {
    if (await candidate.isVisible().catch(() => false)) {
      return true;
    }
  }

  return false;
}

async function pageShowsUnavailableContent(page) {
  const unavailableText = page
    .getByText("This content isn't available right now", { exact: false })
    .first();
  if (await unavailableText.isVisible({ timeout: 250 }).catch(() => false)) {
    return true;
  }

  const bodyText = await page.locator("body").innerText().catch(() => "");
  return /This content isn't available right now/i.test(bodyText);
}

/**
 * When the composer is inside a fixed-position popup (e.g. profile page chat),
 * find attachment controls and file inputs only within that popup container.
 * Returns true if the file was set successfully.
 */
async function setFilesViaPopupContainer(page, composer, absolutePath) {
  const popupMarker = await composer.evaluate((el) => {
    for (let node = el.parentElement; node; node = node.parentElement) {
      if (window.getComputedStyle(node).position === "fixed") {
        const m = `ps-${Date.now()}`;
        node.setAttribute("data-popup-scope", m);
        return m;
      }
    }
    return null;
  });

  if (!popupMarker) {
    return false;
  }

  const popup = page.locator(`[data-popup-scope="${popupMarker}"]`);

  // Try clicking attachment buttons scoped to the popup
  const attachSelectors = [
    '[aria-label*="photo" i]',
    '[aria-label*="attach" i]',
    '[aria-label*="image" i]',
    '[aria-label*="file" i]',
    '[aria-label*="upload" i]',
    '[aria-label*="media" i]'
  ];

  for (const sel of attachSelectors) {
    const btn = popup.locator(sel).first();
    if (await btn.isVisible().catch(() => false)) {
      if (await clickAttachmentControlAndSetFile(page, btn, absolutePath)) {
        return true;
      }
    }
  }

  // Try file inputs directly within the popup
  const inputs = popup.locator('input[type="file"]');
  const count = await inputs.count();
  for (let i = count - 1; i >= 0; i--) {
    const ok = await inputs.nth(i).setInputFiles(absolutePath).then(() => true).catch(() => false);
    if (ok) {
      await sleep(1500);
      return true;
    }
  }

  return false;
}

async function uploadImage(page, imagePath, composer = null) {
  const absolutePath = path.resolve(imagePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Image not found: ${absolutePath}`);
  }

  // If the composer lives inside a fixed-position popup (profile page),
  // scope the search to that popup to avoid clicking comment-section controls.
  if (composer && (await setFilesViaPopupContainer(page, composer, absolutePath))) {
    return;
  }

  if (composer) {
    if (
      await tryAttachmentControls(page, await getAttachmentControlsNearComposer(page, composer), absolutePath)
    ) {
      return;
    }
  }

  if (await setFilesOnBestAvailableInput(page, absolutePath)) {
    return;
  }

  if (await tryAttachmentControls(page, getAttachmentControlLocators(page), absolutePath)) {
    return;
  }

  if (await tryCompactComposerAttachmentFlow(page, absolutePath, composer)) {
    return;
  }

  if (await tryAttachmentControls(page, getAttachmentControlLocators(page), absolutePath)) {
    return;
  }

  await dumpUploadDebugInfo(page, absolutePath);
  throw new Error("Could not find an image upload control.");
}

async function clearExistingDraftAttachments(page, composer) {
  const composerBox = await composer.boundingBox();
  if (!composerBox) {
    return 0;
  }

  let clearedTotal = 0;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const points = await page.locator("body *").evaluateAll((els, box) => {
    const negativePattern = /(send|emoji|more actions|message|search|details|info|upload another file|thread composer|attachments)/i;

    return els
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const visible =
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none";
        if (!visible) {
          return null;
        }

        const label = [
          el.getAttribute("aria-label"),
          el.getAttribute("title"),
          el.getAttribute("alt"),
          el.innerText,
          el.textContent
        ]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        if (negativePattern.test(label)) {
          return null;
        }

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const bandTop = Math.max(window.innerHeight - 340, box.y - 120);
        const bandBottom = Math.min(window.innerHeight - 110, box.y + 140);
        const inTopStrip =
          centerX > box.x - 80 &&
          centerX < box.x + box.width - 20 &&
          centerY > bandTop &&
          centerY < bandBottom;
        const looksLikeRemoveButton = rect.width <= 32 && rect.height <= 32;
        const ariaLabel = el.getAttribute("aria-label") || "";
        const role = el.getAttribute("role") || "";
        const looksLikeAttachmentTile =
          rect.width >= 28 &&
          rect.width <= 64 &&
          rect.height >= 28 &&
          rect.height <= 64 &&
          (role === "listitem" || /^.+\.(png|jpe?g|webp|gif)$/i.test(ariaLabel) || el.tagName === "IMG");

        if (!inTopStrip || (!looksLikeRemoveButton && !looksLikeAttachmentTile)) {
          return null;
        }

        const clickX = looksLikeAttachmentTile ? rect.right - 8 : centerX;
        const clickY = looksLikeAttachmentTile ? rect.top + 8 : centerY;

        return {
          x: Math.round(clickX),
          y: Math.round(clickY),
          sortX: rect.left,
          priority: looksLikeRemoveButton ? 2 : 1,
          hoverX: Math.round(centerX),
          hoverY: Math.round(centerY),
          isTile: looksLikeAttachmentTile
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.priority - a.priority || b.sortX - a.sortX);
    }, {
      x: composerBox.x,
      y: composerBox.y,
      width: composerBox.width
    });

    const deduped = [];
    for (const point of points) {
      if (
        deduped.some(
          (existing) => Math.abs(existing.x - point.x) < 8 && Math.abs(existing.y - point.y) < 8
        )
      ) {
        continue;
      }
      deduped.push(point);
    }

    if (deduped.length === 0) {
      if (attempt === 0) {
        await sleep(350);
        continue;
      }
      break;
    }

    const point = deduped[0];
    if (point.isTile) {
      await page.mouse.move(point.hoverX, point.hoverY).catch(() => {});
      await sleep(120);
    }
    await page.mouse.click(point.x, point.y, { delay: randomInt(18, 140) }).catch(() => {});
    clearedTotal += 1;
    await sleep(350);
  }

  return clearedTotal;
}

async function countDraftAttachmentTiles(page, composer) {
  const composerBox = await composer.boundingBox();
  if (!composerBox) {
    return 0;
  }

  const tiles = await page.locator("body *").evaluateAll((els, box) => {
    return els
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const visible =
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none";
        if (!visible) {
          return null;
        }

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const bandTop = Math.max(window.innerHeight - 340, box.y - 120);
        const bandBottom = Math.min(window.innerHeight - 110, box.y + 140);
        const ariaLabel = el.getAttribute("aria-label") || "";
        const role = el.getAttribute("role") || "";
        const inTopStrip =
          centerX > box.x - 80 &&
          centerX < box.x + box.width - 20 &&
          centerY > bandTop &&
          centerY < bandBottom;
        const looksLikeAttachmentTile =
          rect.width >= 28 &&
          rect.width <= 64 &&
          rect.height >= 28 &&
          rect.height <= 64 &&
          (role === "listitem" || /^.+\.(png|jpe?g|webp|gif)$/i.test(ariaLabel) || el.tagName === "IMG");

        if (!inTopStrip || !looksLikeAttachmentTile) {
          return null;
        }

        return {
          x: Math.round(rect.left),
          y: Math.round(rect.top)
        };
      })
      .filter(Boolean);
  }, {
    x: composerBox.x,
    y: composerBox.y,
    width: composerBox.width
  });

  const deduped = [];
  for (const tile of tiles) {
    if (deduped.some((existing) => Math.abs(existing.x - tile.x) < 10 && Math.abs(existing.y - tile.y) < 10)) {
      continue;
    }
    deduped.push(tile);
  }

  return deduped.length;
}

async function ensureSingleDraftAttachment(page, composer, imagePath) {
  let count = await countDraftAttachmentTiles(page, composer);
  if (count === 1) {
    return;
  }

  console.warn(`Expected 1 draft attachment, found ${count}. Clearing and retrying upload once.`);
  await clearExistingDraftAttachments(page, composer);
  await uploadImage(page, imagePath);
  await sleep(randomInt(1200, 2800));

  count = await countDraftAttachmentTiles(page, composer);
  if (count === 1) {
    return;
  }

  if (count === 0) {
    console.warn(
      "No draft attachment tile detected after retry. The image may have been uploaded but the tile is not detectable in the current view. Proceeding without tile verification."
    );
    return;
  }

  await dumpDraftAttachmentDebugInfo(page, composer, count);
  throw new Error(`Expected 1 draft attachment after retry, found ${count}.`);
}

async function getSafeBackgroundPoints(page, composer) {
  const composerBox = await composer.boundingBox();
  if (!composerBox) {
    return [];
  }

  return page.evaluate((box) => {
    const interactiveSelector = [
      "button",
      "a",
      "input",
      "textarea",
      "select",
      '[contenteditable="true"]',
      '[role="button"]',
      '[role="textbox"]',
      '[role="link"]',
      '[role="menuitem"]',
      '[role="option"]'
    ].join(",");

    const minX = Math.max(320, Math.round(box.x + 30));
    const maxX = Math.min(window.innerWidth - 170, Math.round(box.x + box.width - 30));
    const minY = 220;
    const maxY = Math.max(minY, Math.round(box.y - 110));
    const points = [];

    for (let y = minY; y <= maxY; y += 70) {
      for (let x = minX; x <= maxX; x += 90) {
        const el = document.elementFromPoint(x, y);
        if (!el) {
          continue;
        }

        if (el.closest(interactiveSelector)) {
          continue;
        }

        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const visible =
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none";
        if (!visible || rect.width < 40 || rect.height < 40) {
          continue;
        }

        const text = (el.innerText || el.textContent || "").replace(/\s+/g, "").trim();
        if (text.length > 0) {
          continue;
        }

        points.push({ x, y });
      }
    }

    const deduped = [];
    for (const point of points) {
      if (
        deduped.some(
          (existing) => Math.abs(existing.x - point.x) < 35 && Math.abs(existing.y - point.y) < 35
        )
      ) {
        continue;
      }
      deduped.push(point);
    }

    return deduped;
  }, {
    x: composerBox.x,
    y: composerBox.y,
    width: composerBox.width
  });
}

async function performHarmlessInteractionJitter(page, composer) {
  const points = shuffleArray(await getSafeBackgroundPoints(page, composer));
  if (points.length === 0) {
    return;
  }

  const actionCount = Math.min(points.length, randomInt(SAFE_CLICK_MIN_ACTIONS, SAFE_CLICK_MAX_ACTIONS));
  for (const point of points.slice(0, actionCount)) {
    const targetX = point.x + randomInt(-12, 12);
    const targetY = point.y + randomInt(-10, 10);
    await page.mouse.move(targetX, targetY, { steps: randomInt(6, 20) }).catch(() => {});
    await sleep(randomInt(180, 700));
  }
}

async function verifyDraftClearedAfterSend(page, composer, message, { timeoutMs = 12000 } = {}) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const composerVisible = await composer.isVisible().catch(() => false);
    let draftStillMatches = false;
    let attachmentCount = 0;

    if (composerVisible) {
      draftStillMatches = await composerMatchesExpected(composer, message);
      attachmentCount = await countDraftAttachmentTiles(page, composer).catch(() => 0);
    }

    if ((!composerVisible || !draftStillMatches) && attachmentCount === 0) {
      return;
    }

    await sleep(450);
  }

  throw new Error("Send click did not clear the draft state, so the message was not marked complete.");
}

async function dumpDraftAttachmentDebugInfo(page, composer, count) {
  const composerBox = await composer.boundingBox();
  if (!composerBox) {
    return;
  }

  const band = await page.locator("body *").evaluateAll((els, box) => {
    const bandTop = Math.max(window.innerHeight - 340, box.y - 120);
    const bandBottom = Math.min(window.innerHeight - 110, box.y + 140);

    return els
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const visible =
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none";
        if (!visible) {
          return null;
        }

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        if (
          centerX <= box.x - 80 ||
          centerX >= box.x + box.width - 20 ||
          centerY <= bandTop ||
          centerY >= bandBottom
        ) {
          return null;
        }

        return {
          tag: el.tagName,
          text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
          ariaLabel: el.getAttribute("aria-label"),
          title: el.getAttribute("title"),
          alt: el.getAttribute("alt"),
          role: el.getAttribute("role"),
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height)
        };
      })
      .filter(Boolean);
  }, {
    x: composerBox.x,
    y: composerBox.y,
    width: composerBox.width
  });

  const debugPath = path.resolve("artifacts", "draft-attachment-debug.json");
  fs.mkdirSync(path.resolve("artifacts"), { recursive: true });
  fs.writeFileSync(
    debugPath,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        expectedCount: count,
        composerBox,
        nodes: band
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`Saved draft attachment debug info to ${debugPath}`);
}

function getContinueLocators(page) {
  return [
    page.getByRole("button", { name: /^continue$/i }).first(),
    page.locator('button:has-text("Continue")').first(),
    page.locator('div[role="button"]:has-text("Continue")').first(),
    page.locator('[aria-label="Continue" i]').first(),
    page.locator('[aria-label*="continue" i]').first()
  ];
}

function getProfileMessageButtonLocators(page) {
  return [
    page.getByRole("button", { name: /^message$/i }).first(),
    page.getByRole("link", { name: /^message$/i }).first(),
    page.locator('[aria-label="Message" i]').first(),
    page.locator('div[role="button"]:has-text("Message")').first()
  ];
}

function getComposerLocators(page) {
  return [
    page.locator('div[role="textbox"][contenteditable="true"]').first(),
    page.locator('[contenteditable="true"][role="textbox"]').first(),
    page.locator('[aria-label*="message" i][contenteditable="true"]').first(),
    page.locator('[aria-label*="Message" i][contenteditable="true"]').first()
  ];
}

function getAttachmentControlLocators(page) {
  const selectors = [
    'div[role="button"][aria-label*="photo" i]',
    'div[role="button"][aria-label*="image" i]',
    'div[role="button"][aria-label*="media" i]',
    'div[role="button"][aria-label*="attach" i]',
    'div[role="button"][aria-label*="file" i]',
    'div[role="button"][aria-label*="gallery" i]',
    'div[role="button"][aria-label*="upload" i]',
    'div[role="button"][aria-label*="camera" i]',
    'div[role="button"][aria-label*="more actions" i]',
    'button[aria-label*="photo" i]',
    'button[aria-label*="image" i]',
    'button[aria-label*="media" i]',
    'button[aria-label*="attach" i]',
    'button[aria-label*="file" i]',
    'button[aria-label*="gallery" i]',
    'button[aria-label*="upload" i]',
    'button[aria-label*="camera" i]',
    'button[aria-label*="more actions" i]',
    'label:has(input[type="file"])'
  ];

  return selectors.map((selector) => page.locator(selector).first());
}

async function tryAttachmentControls(page, locators, absolutePath) {
  for (const locator of locators) {
    if (await locator.isVisible().catch(() => false)) {
      if (await clickAttachmentControlAndSetFile(page, locator, absolutePath)) {
        return true;
      }
    }
  }

  return false;
}

async function clickAttachmentControlAndSetFile(page, locator, absolutePath) {
  const chooserPromise = page
    .waitForEvent("filechooser", { timeout: FILE_CHOOSER_WAIT_MS })
    .catch(() => null);
  await jitteredClick(locator, { timeout: 3000 }).catch(() => {});
  await sleep(FILE_INPUT_SETTLE_MS);
  const chooser = await chooserPromise;
  if (chooser) {
    await chooser.setFiles(absolutePath);
    await sleep(1500);
    return true;
  }

  if (await setFilesOnBestAvailableInput(page, absolutePath)) {
    return true;
  }

  return false;
}

async function tryCompactComposerAttachmentFlow(page, absolutePath, composer = null) {
  const candidates = await getNearbyComposerAttachmentLocators(page, composer);
  for (const candidate of candidates) {
    if (await clickAttachmentControlAndSetFile(page, candidate, absolutePath)) {
      return true;
    }

    if (await tryAttachmentControls(page, getAttachmentControlLocators(page), absolutePath)) {
      return true;
    }
  }

  return false;
}

async function getNearbyComposerAttachmentLocators(page, composer = null) {
  const resolvedComposer = composer || (await findComposer(page, { waitMs: 0 }).catch(() => null));
  if (!resolvedComposer) {
    return [];
  }

  const composerBox = await resolvedComposer.boundingBox();
  if (!composerBox) {
    return [];
  }

  const buttonLocator = page.locator('button, [role="button"]');
  const candidateIndexes = await buttonLocator.evaluateAll((els, box) => {
    const positivePattern = /(attach|photo|image|media|file|gallery|upload|camera|add|more)/i;
    const negativePattern = /(send|thumb|emoji|sticker|gif|voice|microphone|call|search|details|info)/i;

    return els
      .map((el, index) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const visible =
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none";
        if (!visible) {
          return null;
        }

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const toolbarY = box.y + box.height - box.toolbarInset;
        const label = [
          el.getAttribute("aria-label"),
          el.getAttribute("title"),
          el.innerText,
          el.textContent
        ]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        if (negativePattern.test(label)) {
          return null;
        }

        const verticalDelta = Math.abs(centerY - toolbarY);
        const leftGap = box.x - centerX;
        if (
          centerX >= box.x ||
          leftGap > box.maxLeftGap ||
          verticalDelta > box.maxYDelta ||
          rect.width > box.maxSize ||
          rect.height > box.maxSize
        ) {
          return null;
        }

        let score = 1000 - leftGap - verticalDelta;
        if (positivePattern.test(label)) {
          score += 5000;
        } else if (!label) {
          score += 2500;
        }

        return { index, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.index);
  }, {
    x: composerBox.x,
    y: composerBox.y,
    height: composerBox.height,
    maxLeftGap: COMPOSER_CONTROL_MAX_LEFT_GAP,
    maxYDelta: COMPOSER_CONTROL_ROW_MAX_Y_DELTA,
    maxSize: COMPOSER_CONTROL_MAX_SIZE,
    toolbarInset: 18
  });

  return candidateIndexes.map((index) => buttonLocator.nth(index));
}

async function findProfilePopupComposer(page, { waitMs = 15000 } = {}) {
  const composers = page.locator(COMPOSER_SELECTOR);
  const started = Date.now();

  while (Date.now() - started < waitMs) {
    const candidateIndex = await composers
      .evaluateAll((els) => {
        const candidates = els
          .map((el, index) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const visible =
              rect.width > 0 &&
              rect.height > 0 &&
              style.visibility !== "hidden" &&
              style.display !== "none";
            if (!visible) {
              return null;
            }

            let fixedAncestor = null;
            for (let node = el.parentElement; node; node = node.parentElement) {
              const nodeStyle = window.getComputedStyle(node);
              if (nodeStyle.position === "fixed") {
                fixedAncestor = node;
                break;
              }
            }

            if (!fixedAncestor) {
              return null;
            }

            const fixedRect = fixedAncestor.getBoundingClientRect();
            const popupLike =
              fixedRect.left > window.innerWidth * 0.45 &&
              fixedRect.width < window.innerWidth * 0.5 &&
              fixedRect.height > 220;
            if (!popupLike) {
              return null;
            }

            return {
              index,
              score: fixedRect.left * 10 + fixedRect.top + fixedRect.width
            };
          })
          .filter(Boolean)
          .sort((a, b) => b.score - a.score);

        return candidates[0]?.index ?? -1;
      })
      .catch(() => -1);

    if (candidateIndex >= 0) {
      return composers.nth(candidateIndex);
    }

    await sleep(400);
  }

  throw new Error("Could not find the profile message popover composer.");
}

async function refreshActiveComposer(page, routeLabel) {
  if (routeLabel === "profile Message fallback") {
    return findProfilePopupComposer(page, { waitMs: 6000 });
  }

  return findComposer(page, { waitMs: 6000 });
}

async function getAttachmentControlsNearComposer(page, composer) {
  const composerBox = await composer.boundingBox();
  if (!composerBox) {
    return [];
  }

  const controls = page.locator("button, [role=\"button\"]");
  const candidateIndexes = await controls.evaluateAll((els, box) => {
    const positivePattern = /(attach a photo or video|photo|image|media|attach|upload|file|gallery|camera)/i;
    const negativePattern = /(send|emoji|gif|sticker|voice|microphone|call|search|details|info|like|comment|react|reply)/i;

    return els
      .map((el, index) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const visible =
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none";
        if (!visible) {
          return null;
        }

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const label = [
          el.getAttribute("aria-label"),
          el.getAttribute("title"),
          el.innerText,
          el.textContent
        ]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        if (!positivePattern.test(label) || negativePattern.test(label)) {
          return null;
        }

        const withinX = centerX >= box.x - 140 && centerX <= box.x + box.width + 140;
        const withinY = centerY >= box.y - 120 && centerY <= box.y + box.height + 120;
        if (!withinX || !withinY) {
          return null;
        }

        const verticalDistance = Math.abs(centerY - (box.y + box.height / 2));
        return {
          index,
          score: 5000 - verticalDistance - Math.abs(centerX - (box.x + box.width))
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.index);
  }, composerBox);

  return candidateIndexes.map((index) => controls.nth(index));
}

async function setFilesOnBestAvailableInput(page, absolutePath) {
  const inputs = page.locator('input[type="file"]');
  const count = await inputs.count();
  const candidateIndexes = [];

  for (let index = count - 1; index >= 0; index -= 1) {
    const input = inputs.nth(index);
    const usable = await input
      .evaluate((el) => {
        if (!(el instanceof HTMLInputElement) || !el.isConnected || el.disabled) {
          return false;
        }

        const accept = (el.getAttribute("accept") || "").toLowerCase();
        return (
          accept === "" ||
          accept.includes("image") ||
          accept.includes("*/*") ||
          accept.includes(".png") ||
          accept.includes(".jpg") ||
          accept.includes(".jpeg") ||
          accept.includes(".webp")
        );
      })
      .catch(() => false);

    if (usable) {
      candidateIndexes.push(index);
    }
  }

  for (const index of candidateIndexes) {
    const input = inputs.nth(index);
    const setOk = await input.setInputFiles(absolutePath).then(() => true).catch(() => false);
    if (!setOk) {
      continue;
    }

    await sleep(1500);
    const hasFile = await input
      .evaluate((el) => Boolean(el.files && el.files.length > 0))
      .catch(() => false);
    if (hasFile) {
      return true;
    }

    return true;
  }

  return false;
}

async function dumpUploadDebugInfo(page, absolutePath) {
  fs.mkdirSync(path.resolve("artifacts"), { recursive: true });
  const debugPath = path.resolve("artifacts", "upload-debug.json");
  const debug = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('button, [role="button"], input[type="file"], label, [contenteditable="true"]')];
    return nodes.map((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none";
      return {
        tag: el.tagName,
        text: (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120),
        ariaLabel: el.getAttribute("aria-label"),
        title: el.getAttribute("title"),
        type: el.getAttribute("type"),
        accept: el.getAttribute("accept"),
        role: el.getAttribute("role"),
        visible,
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height)
      };
    }).filter((item) => item.visible || item.type === "file");
  });

  fs.writeFileSync(
    debugPath,
    JSON.stringify(
      {
        imagePath: absolutePath,
        capturedAt: new Date().toISOString(),
        nodes: debug
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`Saved upload debug info to ${debugPath}`);
}

async function clickSend(page, composer = null) {
  // Focus the composer and press Enter to send. This is more reliable than
  // finding a send button, especially on profile pages where page-level
  // Send/Share buttons can be misidentified as the Messenger send button.
  if (composer) {
    await jitteredClick(composer, { timeout: 5000 }).catch(() => {});
    await sleep(randomInt(150, 400));
    await page.keyboard.press("Enter");
    await sleep(randomInt(900, 2400));
    return;
  }

  // Fallback: try button selectors when no composer reference is available
  const selectors = [
    'div[role="button"][aria-label="Press Enter to send"]',
    'div[role="button"][aria-label*="send" i]',
    'button[aria-label*="send" i]',
    'button:has-text("Send")',
    'div[role="button"]:has-text("Send")'
  ];

  for (const selector of selectors) {
    const button = page.locator(selector).first();
    if (await button.isVisible().catch(() => false)) {
      await jitteredClick(button, { timeout: 5000 });
      await sleep(randomInt(900, 2400));
      return;
    }
  }

  throw new Error("Could not find the send button.");
}

async function saveReadyScreenshotIfConfigured(page, config, leadNumber, lead) {
  if (!config.readyScreenshotDir) {
    return;
  }

  fs.mkdirSync(config.readyScreenshotDir, { recursive: true });
  const safeName = slugify(`${leadNumber}-${lead.firstName}-${lead.messageId}-ready`);
  const screenshotPath = path.resolve(config.readyScreenshotDir, `${safeName}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Saved ready-state screenshot to ${screenshotPath}`);
}

async function assertActiveThreadLooksExpected(page, lead) {
  const matches = await page.evaluate((firstName) => {
    const target = String(firstName || "").trim().toLowerCase();
    if (!target) {
      return [];
    }

    const els = [...document.querySelectorAll("body *")];
    return els
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const visible =
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none";
        if (!visible) {
          return null;
        }

        if (rect.top > 240 || rect.left < 260 || rect.left > window.innerWidth - 280) {
          return null;
        }

        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (!text || text.length > 120) {
          return null;
        }

        if (!text.toLowerCase().includes(target)) {
          return null;
        }

        return text;
      })
      .filter(Boolean)
      .slice(0, 10);
  }, lead.firstName);

  if (matches.length > 0) {
    return;
  }

  throw new Error(
    `Active thread no longer appears to match ${lead.firstName}. Stopping before send.`
  );
}

async function askDecision(rl, prompt) {
  return (await rl.question(prompt)).trim().toLowerCase();
}

function resolveFrom(fromFile, targetPath) {
  return path.resolve(path.dirname(fromFile), targetPath);
}

function firstDefinedValue(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

function extractFirstName(value) {
  const cleaned = String(value || "").trim();
  if (!cleaned) {
    return "";
  }

  return cleaned.split(/\s+/)[0];
}

function extractMessageId(value) {
  const cleaned = String(value || "").trim();
  if (!cleaned) {
    return "";
  }

  const directMatch = cleaned.match(/^\d+$/);
  if (directMatch) {
    return directMatch[0];
  }

  const urlMatch = cleaned.match(/\/messages\/t\/(\d+)/i);
  if (urlMatch) {
    return urlMatch[1];
  }

  const idParamMatch = cleaned.match(/[?&]id=(\d+)/i);
  if (idParamMatch) {
    return idParamMatch[1];
  }

  return "";
}

function slugify(value) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  cannotMessageThread,
  clearExistingDraftAttachments,
  continueLooksVisible,
  createRunState,
  countDraftAttachmentTiles,
  dismissContinueIfPresent,
  extractMessageId,
  findComposer,
  findProfilePopupComposer,
  getAttachmentControlLocators,
  getAttachmentControlsNearComposer,
  getNearbyComposerAttachmentLocators,
  getProfileMessageButtonLocators,
  getComposerLocators,
  getContinueLocators,
  loadLeads,
  normalizeParagraphFlow,
  pageShowsUnavailableContent,
  repairComposerTextIfNeeded,
  renderTemplate,
  resolveLeadThreadUrl,
  resolveLeadPause,
  resolveThreadMessagingState,
  setFilesOnBestAvailableInput,
  splitMessageIntoRandomChunks,
  tryCompactComposerAttachmentFlow,
  uploadImage
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
