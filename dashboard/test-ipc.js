/**
 * IPC Handler Integration Test
 * Simulates IPC calls to validate all handlers work correctly
 */

const { app, ipcMain } = require("electron");
const path = require("path");

// Load main.js to register all handlers
require("./main.js");

let testsPassed = 0;
let testsFailed = 0;

async function testIPC(name, channel, args = {}) {
  try {
    // Simulate an IPC call
    const handlers = ipcMain._events;
    const handler = handlers[channel];

    if (!handler) {
      throw new Error(`No handler registered for '${channel}'`);
    }

    // Call the handler
    const result = await new Promise((resolve, reject) => {
      const mockEvent = { sender: { send: () => {} } };

      // Get the actual handler function (may be wrapped)
      const fn = Array.isArray(handler) ? handler[0] : handler;

      // Invoke with mock event and args
      Promise.resolve(fn(mockEvent, args))
        .then(resolve)
        .catch(reject);
    });

    console.log(`✓ ${name}`);
    if (result && typeof result === "object") {
      const keys = Object.keys(result);
      if (keys.length <= 5) {
        console.log(`  → ${JSON.stringify(result).slice(0, 100)}`);
      } else {
        console.log(`  → Returned object with ${keys.length} keys`);
      }
    }
    testsPassed++;
    return result;
  } catch (err) {
    console.error(`✗ ${name}: ${err.message}`);
    testsFailed++;
    return null;
  }
}

app.whenReady().then(async () => {
  console.log("=== IPC Handler Integration Test ===\n");

  // Wait a bit for handlers to register
  await new Promise((r) => setTimeout(r, 100));

  // Test all IPC handlers
  await testIPC("get-overview", "get-overview");
  await testIPC("get-leads (no filter)", "get-leads", { offset: 0, limit: 10 });
  await testIPC("get-leads (with status)", "get-leads", { offset: 0, limit: 10, status: "QUEUED" });
  await testIPC("get-leads (with search)", "get-leads", { offset: 0, limit: 10, search: "test" });
  await testIPC("get-groups", "get-groups");
  await testIPC("get-scrape-log", "get-scrape-log", { limit: 20 });
  await testIPC("get-budget-history", "get-budget-history");
  await testIPC("get-config", "get-config");
  await testIPC("get-pipeline-status", "get-pipeline-status");
  await testIPC("get-running-jobs", "get-running-jobs");

  // Test add group (with cleanup)
  const testGroupUrl = `https://www.facebook.com/groups/test_ipc_${Date.now()}`;
  const addResult = await testIPC("add-group", "add-group", {
    url: testGroupUrl,
    name: "Test IPC Group",
  });

  // Find the group we just added
  if (addResult) {
    const groups = await testIPC("get-groups (verify add)", "get-groups");
    const added = groups?.find((g) => g.group_url === testGroupUrl);
    if (added) {
      console.log(`  → Group added with ID: ${added.id}`);

      // Test update status
      await testIPC("update-group-status", "update-group-status", {
        id: added.id,
        status: "PAUSED",
      });

      // Test delete
      await testIPC("delete-group", "delete-group", { id: added.id });
      console.log(`  → Cleaned up test group`);
    }
  }

  // Summary
  console.log("\n=== Test Results ===");
  console.log(`✓ Passed: ${testsPassed}`);
  console.log(`✗ Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);

  if (testsFailed > 0) {
    console.log("\n⚠ Some IPC handlers failed. Review errors above.");
  } else {
    console.log("\n✓ All IPC handlers working correctly!");
  }

  setTimeout(() => app.quit(), 500);
});

app.on("window-all-closed", () => {
  // Don't quit
});
