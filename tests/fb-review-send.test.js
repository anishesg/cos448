const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const {
  cannotMessageThread,
  clearExistingDraftAttachments,
  createRunState,
  findProfilePopupComposer,
  getNearbyComposerAttachmentLocators,
  loadLeads,
  normalizeParagraphFlow,
  pageShowsUnavailableContent,
  repairComposerTextIfNeeded,
  renderTemplate,
  resolveLeadThreadUrl,
  resolveLeadPause,
  resolveThreadMessagingState,
  splitMessageIntoRandomChunks,
  tryCompactComposerAttachmentFlow,
  uploadImage
} = require("../scripts/fb-review-send.js");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fb-review-send-tests-"));
const imagePath = path.join(tmpDir, "fixture.png");
fs.writeFileSync(
  imagePath,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAukB9p8x6wAAAABJRU5ErkJggg==",
    "base64"
  )
);

let browser;
let page;

test.before(async () => {
  browser = await chromium.launch({ headless: true });
});

test.after(async () => {
  await browser.close();
});

test.beforeEach(async () => {
  page = await browser.newPage();
});

test.afterEach(async () => {
  await page.close();
});

test("resolveThreadMessagingState clicks Continue and returns the composer", async () => {
  await page.setContent(`
    <button id="continue" aria-label="Continue">Continue</button>
    <div id="composer" role="textbox" contenteditable="true" style="display:none"></div>
    <script>
      document.getElementById("continue").addEventListener("click", () => {
        document.getElementById("continue").remove();
        document.getElementById("composer").style.display = "block";
      });
    </script>
  `);

  const state = await resolveThreadMessagingState(page, { timeoutMs: 5000 });

  assert.equal(state.status, "ready");
  assert.equal(await state.composer.isVisible(), true);
});

test("resolveThreadMessagingState can surface Continue without clicking it", async () => {
  await page.setContent(`
    <button id="continue" aria-label="Continue">Continue</button>
  `);

  const state = await resolveThreadMessagingState(page, {
    timeoutMs: 2500,
    allowContinueClick: false
  });

  assert.deepEqual(state, { status: "needsContinue" });
});

test("resolveThreadMessagingState returns cannotMessage when the thread is blocked", async () => {
  await page.setContent(`
    <div>You can’t message this account right now.</div>
  `);

  const state = await resolveThreadMessagingState(page, { timeoutMs: 1500 });

  assert.deepEqual(state, { status: "cannotMessage" });
});

test("pageShowsUnavailableContent detects Facebook's broken-content page", async () => {
  await page.setContent(`
    <div>This content isn't available right now</div>
    <div>Go back</div>
  `);

  assert.equal(await pageShowsUnavailableContent(page), true);
});

test("findProfilePopupComposer prefers the fixed message popover over page comment boxes", async () => {
  await page.setContent(`
    <div style="margin-top:200px">
      <div id="comment" role="textbox" contenteditable="true"></div>
    </div>
    <div
      id="popup"
      style="position:fixed; right:24px; bottom:24px; width:360px; height:320px; background:#fff; border:1px solid #ccc;"
    >
      <div id="popup-composer" role="textbox" contenteditable="true" style="position:absolute; left:16px; right:16px; bottom:16px;"></div>
    </div>
  `);

  const composer = await findProfilePopupComposer(page, { waitMs: 1500 });
  assert.equal(await composer.getAttribute("id"), "popup-composer");
});

test("cannotMessageThread detects a delayed blocked-thread banner", async () => {
  await page.setContent(`
    <div id="root"></div>
    <script>
      setTimeout(() => {
        document.getElementById("root").textContent = "You can't reply to this conversation.";
      }, 120);
    </script>
  `);

  const blocked = await cannotMessageThread(page, {
    attempts: 4,
    intervalMs: 80,
    visibleTimeoutMs: 60
  });

  assert.equal(blocked, true);
});

test("splitMessageIntoRandomChunks preserves the exact message body", () => {
  const message = "Hey Divya,\n\nI'm Anish Kataria, and I wanted to reach out.";
  const chunks = splitMessageIntoRandomChunks(message);

  assert.equal(chunks.join(""), message);
  assert.equal(chunks.every((chunk) => chunk.length > 0), true);
});

test("renderTemplate replaces bracketed first-name placeholders verbatim", () => {
  const rendered = renderTemplate("Hey [First Name]!\n\nThis is a test.", {
    firstName: "Sutapa"
  });

  assert.equal(rendered, "Hey Sutapa!\n\nThis is a test.");
});

test("loadLeads preserves exact message/profile URLs for opener fallbacks", () => {
  const csvPath = path.join(tmpDir, "leads.csv");
  fs.writeFileSync(
    csvPath,
    [
      "Name,Profile URL,Message URL,Completed",
      "Neha Nainani,https://www.facebook.com/profile.php?id=1309268588,https://www.facebook.com/messages/t/1309268588,",
      "Sutapa Sen,https://www.facebook.com/profile.php?id=1124800510,https://www.facebook.com/messages/t/1124800510,yes"
    ].join("\n"),
    "utf8"
  );

  const leads = loadLeads(csvPath, { startAtRow: 1 });
  assert.equal(leads.length, 1);
  assert.equal(leads[0].firstName, "Neha");
  assert.equal(leads[0].fullName, "Neha Nainani");
  assert.equal(leads[0].profileUrl, "https://www.facebook.com/profile.php?id=1309268588");
  assert.equal(leads[0].messageUrl, "https://www.facebook.com/messages/t/1309268588");
});

test("resolveLeadThreadUrl prefers the CSV message URL when present", () => {
  const url = resolveLeadThreadUrl(
    { threadUrlTemplate: "https://www.facebook.com/messages/t/{messageId}" },
    {
      messageId: "1309268588",
      messageUrl: "https://www.facebook.com/messages/t/1309268588?source=sheet"
    }
  );

  assert.equal(url, "https://www.facebook.com/messages/t/1309268588?source=sheet");
});

test("normalizeParagraphFlow ignores soft-wrap line breaks inside paragraphs", () => {
  const normalized = normalizeParagraphFlow(
    "Hey Rumi!\nI saw you had a student in high school,\nand are looking for research.\n\nSecond paragraph."
  );

  assert.equal(
    normalized,
    "Hey Rumi! I saw you had a student in high school, and are looking for research.\n\nSecond paragraph."
  );
});

test("repairComposerTextIfNeeded retypes a malformed draft before send", async () => {
  await page.setContent(`
    <div
      id="composer"
      role="textbox"
      contenteditable="true"
      style="width:420px; min-height:120px; border:1px solid #ccc; padding:8px;"
    >Bad draft text</div>
  `);

  const composer = page.locator("#composer");
  const repaired = await repairComposerTextIfNeeded(
    page,
    composer,
    "Hey Sutapa!\n\nThis is the corrected message.",
    "Test composer"
  );

  assert.equal(repaired, true);
  assert.equal(
    await composer.evaluate((el) => (el.innerText || "").replace(/\n{3,}/g, "\n\n")),
    "Hey Sutapa!\n\nThis is the corrected message."
  );
});

test("resolveLeadPause upgrades to a long batch break after the configured send count", () => {
  const config = {
    postActionDelayMs: 0,
    betweenMessagesMinMs: 1000,
    betweenMessagesMaxMs: 1000,
    batchSizeMin: 2,
    batchSizeMax: 2,
    batchBreakMinMs: 3600000,
    batchBreakMaxMs: 3600000
  };
  const runState = createRunState(config);

  const firstPause = resolveLeadPause(config, runState, { countTowardsBatch: true });
  assert.equal(firstPause.waitMs, 1000);
  assert.equal(runState.sentSinceBreak, 1);

  const secondPause = resolveLeadPause(config, runState, { countTowardsBatch: true });
  assert.equal(secondPause.waitMs, 3600000);
  assert.match(secondPause.label, /batch break/i);
  assert.equal(runState.sentSinceBreak, 0);
  assert.equal(runState.nextBreakAfter, 2);
});

test("uploadImage uses an existing hidden image input", async () => {
  await page.setContent(`
    <input id="uploader" type="file" accept="image/*" style="display:none" />
  `);

  await uploadImage(page, imagePath);

  const fileName = await page.locator("#uploader").evaluate((el) => el.files[0]?.name || "");
  assert.equal(fileName, path.basename(imagePath));
});

test("uploadImage accepts a generic file input when Messenger exposes */*", async () => {
  await page.setContent(`
    <input id="uploader" type="file" accept="*/*" style="display:none" />
  `);

  await uploadImage(page, imagePath);

  const fileName = await page.locator("#uploader").evaluate((el) => el.files[0]?.name || "");
  assert.equal(fileName, path.basename(imagePath));
});

test("uploadImage sets only one matching file input even if multiple hidden inputs exist", async () => {
  await page.setContent(`
    <input id="uploader-a" type="file" accept="*/*" style="display:none" />
    <input id="uploader-b" type="file" accept="*/*" style="display:none" />
    <input id="uploader-c" type="file" accept="*/*" style="display:none" />
  `);

  await uploadImage(page, imagePath);

  const counts = await Promise.all([
    page.locator("#uploader-a").evaluate((el) => el.files.length),
    page.locator("#uploader-b").evaluate((el) => el.files.length),
    page.locator("#uploader-c").evaluate((el) => el.files.length)
  ]);
  assert.equal(counts.reduce((sum, value) => sum + value, 0), 1);
});

test("uploadImage clicks attachment UI and uses a newly created input", async () => {
  await page.setContent(`
    <button id="add-photo" aria-label="Add photo">Add photo</button>
    <script>
      document.getElementById("add-photo").addEventListener("click", () => {
        if (document.getElementById("dynamic-uploader")) {
          return;
        }
        const input = document.createElement("input");
        input.id = "dynamic-uploader";
        input.type = "file";
        input.accept = "image/*";
        input.style.display = "none";
        document.body.appendChild(input);
      });
    </script>
  `);

  await uploadImage(page, imagePath);

  const fileName = await page
    .locator("#dynamic-uploader")
    .evaluate((el) => el.files[0]?.name || "");
  assert.equal(fileName, path.basename(imagePath));
});

test("compact composer fallback uses the nearest left-side attachment control", async () => {
  await page.setContent(`
    <button id="attach-toggle" style="position:absolute; left:16px; top:20px; width:32px; height:32px;"></button>
    <button id="send" aria-label="Send" style="position:absolute; left:420px; top:20px; width:32px; height:32px;"></button>
    <div id="composer" role="textbox" contenteditable="true" style="position:absolute; left:64px; top:16px; width:340px; height:40px;"></div>
    <script>
      document.getElementById("attach-toggle").addEventListener("click", () => {
        if (document.getElementById("dynamic-uploader")) {
          return;
        }
        const input = document.createElement("input");
        input.id = "dynamic-uploader";
        input.type = "file";
        input.accept = "image/*";
        input.style.display = "none";
        document.body.appendChild(input);
      });
    </script>
  `);

  const candidates = await getNearbyComposerAttachmentLocators(page);
  assert.equal(candidates.length > 0, true);

  await tryCompactComposerAttachmentFlow(page, imagePath);

  const fileName = await page
    .locator("#dynamic-uploader")
    .evaluate((el) => el.files[0]?.name || "");
  assert.equal(fileName, path.basename(imagePath));
});

test("compact composer fallback finds an open-more-actions button aligned to the composer footer", async () => {
  await page.setContent(`
    <div
      id="composer"
      role="textbox"
      contenteditable="true"
      style="position:absolute; left:436px; top:685px; width:552px; height:240px;"
    ></div>
    <div
      id="more-actions"
      role="button"
      aria-label="Open more actions"
      style="position:absolute; left:380px; top:897px; width:36px; height:36px;"
    ></div>
    <script>
      document.getElementById("more-actions").addEventListener("click", () => {
        if (document.getElementById("dynamic-uploader")) {
          return;
        }
        const input = document.createElement("input");
        input.id = "dynamic-uploader";
        input.type = "file";
        input.accept = "image/*";
        input.style.display = "none";
        document.body.appendChild(input);
      });
    </script>
  `);

  await tryCompactComposerAttachmentFlow(page, imagePath);

  const fileName = await page
    .locator("#dynamic-uploader")
    .evaluate((el) => el.files[0]?.name || "");
  assert.equal(fileName, path.basename(imagePath));
});

test("clearExistingDraftAttachments removes existing attachment chips from the composer", async () => {
  await page.setContent(`
    <div
      id="composer"
      role="textbox"
      contenteditable="true"
      style="position:absolute; left:340px; top:480px; width:520px; height:220px; background:#222;"
    >
      <div class="chip" id="chip-a" style="position:absolute; left:24px; top:8px; width:40px; height:40px; background:#555;"></div>
      <button
        aria-label="Remove attachment a"
        style="position:absolute; left:52px; top:4px; width:16px; height:16px;"
        onclick="document.getElementById('chip-a').remove(); this.remove();"
      >x</button>
      <div class="chip" id="chip-b" style="position:absolute; left:88px; top:8px; width:40px; height:40px; background:#666;"></div>
      <button
        aria-label="Remove attachment b"
        style="position:absolute; left:116px; top:4px; width:16px; height:16px;"
        onclick="document.getElementById('chip-b').remove(); this.remove();"
      >x</button>
    </div>
  `);

  const composer = page.locator("#composer");
  const cleared = await clearExistingDraftAttachments(page, composer);

  assert.equal(cleared, 2);
  assert.equal(await page.locator(".chip").count(), 0);
});

test("clearExistingDraftAttachments can remove thumbnail tiles via top-right hotspots", async () => {
  await page.setContent(`
    <div
      id="composer"
      role="textbox"
      contenteditable="true"
      style="position:absolute; left:340px; top:480px; width:520px; height:220px; background:#222;"
    ></div>
    <div
      class="tile"
      role="listitem"
      aria-label="fixture.png"
      style="position:absolute; left:388px; top:488px; width:40px; height:40px; background:#888;"
      onclick="if (event.offsetX >= 28 && event.offsetY <= 12) this.remove();"
    ></div>
    <div
      class="tile"
      role="listitem"
      aria-label="fixture.png"
      style="position:absolute; left:444px; top:488px; width:40px; height:40px; background:#999;"
      onclick="if (event.offsetX >= 28 && event.offsetY <= 12) this.remove();"
    ></div>
  `);

  const composer = page.locator("#composer");
  const cleared = await clearExistingDraftAttachments(page, composer);

  assert.equal(cleared >= 2, true);
  assert.equal(await page.locator(".tile").count(), 0);
});
