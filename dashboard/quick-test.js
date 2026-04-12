// Quick smoke test - just verify app starts
const { app, BrowserWindow } = require("electron");
const path = require("path");

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1340,
    height: 860,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));

  win.webContents.on("did-finish-load", () => {
    console.log("✓ Dashboard loaded successfully!");
    console.log("✓ Window is ready for interaction");
    console.log("");
    console.log("Close the window to exit, or interact with the app to test features.");
  });

  win.webContents.on("console-message", (_, level, message) => {
    if (level >= 3) console.log(`[ERROR] ${message}`);
  });
});

app.on("window-all-closed", () => app.quit());
