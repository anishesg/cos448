const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Overview
  getOverview: () => ipcRenderer.invoke("get-overview"),

  // Leads
  getLeads: (params) => ipcRenderer.invoke("get-leads", params),
  updateLeadStatus: (params) => ipcRenderer.invoke("update-lead-status", params),

  // Groups
  getGroups: () => ipcRenderer.invoke("get-groups"),
  addGroup: (params) => ipcRenderer.invoke("add-group", params),
  updateGroupStatus: (params) => ipcRenderer.invoke("update-group-status", params),
  deleteGroup: (params) => ipcRenderer.invoke("delete-group", params),

  // Activity
  getScrapeLog: (params) => ipcRenderer.invoke("get-scrape-log", params),
  getBudgetHistory: () => ipcRenderer.invoke("get-budget-history"),

  // Config
  getConfig: () => ipcRenderer.invoke("get-config"),
  saveConfig: (cfg) => ipcRenderer.invoke("save-config", cfg),

  // Jobs
  runJob: (params) => ipcRenderer.invoke("run-job", params),
  killJob: (params) => ipcRenderer.invoke("kill-job", params),
  getRunningJobs: () => ipcRenderer.invoke("get-running-jobs"),

  // Pipeline
  startPipeline: () => ipcRenderer.invoke("start-pipeline"),
  stopPipeline: () => ipcRenderer.invoke("stop-pipeline"),
  getPipelineStatus: () => ipcRenderer.invoke("get-pipeline-status"),

  // Autopilot
  startAutopilot: () => ipcRenderer.invoke("start-autopilot"),
  stopAutopilot: () => ipcRenderer.invoke("stop-autopilot"),
  getAutopilotStatus: () => ipcRenderer.invoke("get-autopilot-status"),
  getAutopilotCycles: (params) => ipcRenderer.invoke("get-autopilot-cycles", params),
  getAutopilotKeywords: () => ipcRenderer.invoke("get-autopilot-keywords"),

  // Campaign / Messaging
  getCampaignStatus: () => ipcRenderer.invoke("get-campaign-status"),
  saveMessageTemplate: (params) => ipcRenderer.invoke("save-message-template", params),

  // Form Pipeline Leads
  getPipelineLeads: (params) => ipcRenderer.invoke("get-pipeline-leads", params),
  getEmailLog: (params) => ipcRenderer.invoke("get-email-log", params),

  // Keyword Search Stats
  getKeywordSearchStats: () => ipcRenderer.invoke("get-keyword-search-stats"),
  getSearchKeywords: () => ipcRenderer.invoke("get-search-keywords"),

  // Events from main
  onJobOutput: (cb) => ipcRenderer.on("job-output", (_, data) => cb(data)),
  onJobFinished: (cb) => ipcRenderer.on("job-finished", (_, data) => cb(data)),
  onPipelineLog: (cb) => ipcRenderer.on("pipeline-log", (_, data) => cb(data)),
  onPipelineStopped: (cb) => ipcRenderer.on("pipeline-stopped", () => cb()),
  onAutopilotLog: (cb) => ipcRenderer.on("autopilot-log", (_, data) => cb(data)),
  onAutopilotStopped: (cb) => ipcRenderer.on("autopilot-stopped", () => cb()),

  // Utility
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
});
