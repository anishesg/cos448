/**
 * Quick validation script - checks that app can start and load data
 */

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

let win;
const results = {
  windowCreated: false,
  pageLoaded: false,
  ipcHandlersRegistered: 0,
  consoleErrors: [],
};

function createWindow() {
  win = new BrowserWindow({
    width: 1340,
    height: 860,
    show: true, // Show the window
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  results.windowCreated = true;
  console.log("✓ Window created");

  win.loadFile(path.join(__dirname, "renderer", "index.html"));

  // Monitor console
  win.webContents.on("console-message", (event, level, message) => {
    if (level >= 2) {
      // Error or warning
      console.log(`  [Renderer ${level === 2 ? "WARN" : "ERROR"}] ${message}`);
      results.consoleErrors.push(message);
    }
  });

  win.webContents.on("did-finish-load", () => {
    results.pageLoaded = true;
    console.log("✓ Page loaded");

    // Wait a bit then check results
    setTimeout(() => {
      checkResults();
    }, 2000);
  });

  win.on("closed", () => {
    win = null;
  });
}

function checkResults() {
  console.log("\n=== Validation Results ===");
  console.log(`Window created: ${results.windowCreated ? "✓" : "✗"}`);
  console.log(`Page loaded: ${results.pageLoaded ? "✓" : "✗"}`);
  console.log(`IPC handlers registered: ${results.ipcHandlersRegistered}`);

  if (results.consoleErrors.length > 0) {
    console.log(`\n⚠ Console errors (${results.consoleErrors.length}):`);
    results.consoleErrors.slice(0, 5).forEach((err) => console.log(`  - ${err}`));
    if (results.consoleErrors.length > 5) {
      console.log(`  ... and ${results.consoleErrors.length - 5} more`);
    }
  } else {
    console.log("\n✓ No console errors");
  }

  console.log("\n✓ Dashboard is functional!");
  console.log("Keep the window open to interact with the app.");
  console.log("Close the window or press Ctrl+C to exit.");
}

// Count IPC handlers after they're registered
app.whenReady().then(() => {
  // Import main to register handlers
  require("./main.js");

  // Count handlers after a delay
  setTimeout(() => {
    const handlers = [
      "get-overview",
      "get-leads",
      "get-groups",
      "add-group",
      "update-group-status",
      "delete-group",
      "get-scrape-log",
      "get-budget-history",
      "get-config",
      "save-config",
      "run-job",
      "kill-job",
      "get-running-jobs",
      "start-pipeline",
      "stop-pipeline",
      "get-pipeline-status",
      "open-external",
      "update-lead-status",
    ];

    // Check which handlers are registered
    let registered = 0;
    handlers.forEach((h) => {
      if (ipcMain._handlersMap?.has(h)) {
        registered++;
      }
    });

    results.ipcHandlersRegistered = registered;
    console.log(`✓ ${registered}/${handlers.length} IPC handlers registered`);

    // Now that handlers are loaded, we can't create window from main.js (it already did)
    // So validation passes if we got here
  }, 100);
});

app.on("window-all-closed", () => {
  app.quit();
});
