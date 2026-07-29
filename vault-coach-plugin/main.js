var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  DEFAULT_SETTINGS: () => DEFAULT_SETTINGS,
  default: () => VaultCoachPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// src/VaultCoachView.ts
var import_obsidian = require("obsidian");
var VIEW_TYPE_VAULT_COACH = "vault-coach-view";
var VaultCoachView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.timerInterval = null;
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_VAULT_COACH;
  }
  getDisplayText() {
    return "Vault Coach";
  }
  async onOpen() {
    await this.render();
    this.registerEvent(this.app.metadataCache.on("changed", () => this.render()));
  }
  async render() {
    var _a, _b, _c, _d;
    const container = this.containerEl.children[1];
    container.empty();
    container.createEl("h2", { text: "Vault Coach" });
    const currentProvider = ((_a = this.plugin.settings) == null ? void 0 : _a.visionProvider) || "gemini";
    let keyConfigured = false;
    if (currentProvider === "gemini")
      keyConfigured = !!((_b = this.plugin.settings) == null ? void 0 : _b.geminiApiKey);
    else if (currentProvider === "groq")
      keyConfigured = !!((_c = this.plugin.settings) == null ? void 0 : _c.groqApiKey);
    else if (currentProvider === "openrouter")
      keyConfigured = !!((_d = this.plugin.settings) == null ? void 0 : _d.openrouterApiKey);
    if (!keyConfigured) {
      const warningBox = container.createDiv();
      warningBox.style.padding = "10px";
      warningBox.style.marginBottom = "15px";
      warningBox.style.borderRadius = "5px";
      warningBox.style.backgroundColor = "var(--background-secondary-alt)";
      warningBox.style.border = "1px solid var(--text-warning)";
      warningBox.createEl("p", { text: `\u26A0\uFE0F API Key not configured for selected provider (${currentProvider.toUpperCase()}). Please open Plugin Settings to configure your API key.` });
    }
    const curriculumFile = this.app.vault.getAbstractFileByPath("Curriculum.md");
    if (!curriculumFile || !(curriculumFile instanceof import_obsidian.TFile)) {
      container.createEl("p", { text: "Curriculum.md not found. Please generate a curriculum first." });
      return;
    }
    const files = this.app.vault.getMarkdownFiles();
    const topics = [];
    for (const file of files) {
      if (file.path.startsWith("Topics/")) {
        const cache = this.app.metadataCache.getFileCache(file);
        const fm = cache == null ? void 0 : cache.frontmatter;
        if (fm && fm.topic) {
          topics.push({ file, fm });
        }
      }
    }
    const pendingTopics = topics.filter((t) => t.fm.status !== "done");
    if (pendingTopics.length === 0) {
      container.createEl("p", { text: "All topics completed! \u{1F389}" });
      return;
    }
    container.createEl("h3", { text: "Up Next" });
    const list = container.createEl("ul");
    list.style.listStyle = "none";
    list.style.padding = "0";
    for (const topic of pendingTopics) {
      const li = list.createEl("li");
      li.style.display = "flex";
      li.style.alignItems = "center";
      li.style.justifyContent = "space-between";
      li.style.marginBottom = "10px";
      li.style.padding = "10px";
      li.style.border = "1px solid var(--background-modifier-border)";
      li.style.borderRadius = "5px";
      const leftDiv = li.createDiv();
      leftDiv.style.display = "flex";
      leftDiv.style.alignItems = "center";
      const checkbox = leftDiv.createEl("input", { type: "checkbox" });
      checkbox.checked = topic.fm.status === "done";
      checkbox.style.marginRight = "10px";
      checkbox.addEventListener("change", async () => {
        await this.app.fileManager.processFrontMatter(topic.file, (frontmatter) => {
          frontmatter.status = checkbox.checked ? "done" : "not-started";
        });
      });
      const titleSpan = leftDiv.createEl("span", { text: topic.fm.topic });
      titleSpan.style.cursor = "pointer";
      titleSpan.style.textDecoration = "underline";
      titleSpan.addEventListener("click", () => {
        this.app.workspace.getLeaf(false).openFile(topic.file);
      });
      const rightDiv = li.createDiv();
      const pomoBtn = rightDiv.createEl("button", { text: "\u23F1\uFE0F Focus" });
      pomoBtn.addEventListener("click", () => {
        this.renderTimer(container, topic);
      });
    }
  }
  renderTimer(container, topic) {
    var _a;
    container.empty();
    container.createEl("h2", { text: "Focus Mode" });
    container.createEl("h4", { text: topic.fm.topic });
    const defaultMins = ((_a = this.plugin.settings) == null ? void 0 : _a.defaultPomodoroMinutes) || 25;
    const estimatedMinutes = topic.fm.estimated_minutes || defaultMins;
    let secondsRemaining = estimatedMinutes * 60;
    let isRunning = false;
    const timerDisplay = container.createEl("div", { text: this.formatTime(secondsRemaining) });
    timerDisplay.style.fontSize = "40px";
    timerDisplay.style.fontWeight = "bold";
    timerDisplay.style.textAlign = "center";
    timerDisplay.style.margin = "20px 0";
    const controlsDiv = container.createDiv();
    controlsDiv.style.display = "flex";
    controlsDiv.style.justifyContent = "center";
    controlsDiv.style.gap = "10px";
    const startBtn = controlsDiv.createEl("button", { text: "Start" });
    const stopBtn = controlsDiv.createEl("button", { text: "Stop & Log" });
    const cancelBtn = controlsDiv.createEl("button", { text: "Cancel" });
    const tick = () => {
      if (secondsRemaining > 0) {
        secondsRemaining--;
        timerDisplay.innerText = this.formatTime(secondsRemaining);
      }
    };
    startBtn.addEventListener("click", () => {
      if (isRunning) {
        isRunning = false;
        startBtn.innerText = "Resume";
        if (this.timerInterval)
          clearInterval(this.timerInterval);
      } else {
        isRunning = true;
        startBtn.innerText = "Pause";
        this.timerInterval = setInterval(tick, 1e3);
      }
    });
    stopBtn.addEventListener("click", async () => {
      if (this.timerInterval)
        clearInterval(this.timerInterval);
      const elapsedSeconds = estimatedMinutes * 60 - secondsRemaining;
      const elapsedMinutes = Math.ceil(elapsedSeconds / 60);
      const input = window.prompt(`Session ended! How many minutes did you actually spend on this?`, elapsedMinutes.toString());
      if (input !== null) {
        const loggedMinutes = parseInt(input) || elapsedMinutes;
        await this.app.fileManager.processFrontMatter(topic.file, (frontmatter) => {
          frontmatter.actual_minutes = (frontmatter.actual_minutes || 0) + loggedMinutes;
        });
      }
      this.render();
    });
    cancelBtn.addEventListener("click", () => {
      if (this.timerInterval)
        clearInterval(this.timerInterval);
      this.render();
    });
  }
  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  async onClose() {
    if (this.timerInterval)
      clearInterval(this.timerInterval);
  }
};

// src/VaultCoachSettingTab.ts
var import_obsidian2 = require("obsidian");
var VaultCoachSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Vault Coach Settings" });
    containerEl.createEl("h3", { text: "API Credentials (BYOK)" });
    new import_obsidian2.Setting(containerEl).setName("Gemini API Key").setDesc("Enter your Google Gemini API Key for vision OCR and curriculum generation.").addText((text) => text.setPlaceholder("AIzaSy...").setValue(this.plugin.settings.geminiApiKey).onChange(async (value) => {
      this.plugin.settings.geminiApiKey = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Groq API Key").setDesc("Enter your Groq API Key for fast vision parsing fallback.").addText((text) => text.setPlaceholder("gsk_...").setValue(this.plugin.settings.groqApiKey).onChange(async (value) => {
      this.plugin.settings.groqApiKey = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("OpenRouter API Key").setDesc("Enter your OpenRouter API Key for free Vision Llama models.").addText((text) => text.setPlaceholder("sk-or-...").setValue(this.plugin.settings.openrouterApiKey).onChange(async (value) => {
      this.plugin.settings.openrouterApiKey = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Default Vision Provider").setDesc("Select your preferred AI model provider for planner OCR parsing.").addDropdown((dropdown) => dropdown.addOption("gemini", "Google Gemini Vision").addOption("groq", "Groq Llama 3.2 Vision").addOption("openrouter", "OpenRouter Free Vision").setValue(this.plugin.settings.visionProvider).onChange(async (value) => {
      this.plugin.settings.visionProvider = value;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h3", { text: "Study & Revision Preferences" });
    new import_obsidian2.Setting(containerEl).setName("Default Pomodoro Duration (Minutes)").setDesc("Standard focus session duration in minutes.").addText((text) => text.setPlaceholder("25").setValue(this.plugin.settings.defaultPomodoroMinutes.toString()).onChange(async (value) => {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed) && parsed > 0) {
        this.plugin.settings.defaultPomodoroMinutes = parsed;
        await this.plugin.saveSettings();
      }
    }));
    new import_obsidian2.Setting(containerEl).setName("Spaced Repetition Intervals (Days)").setDesc("Comma-separated list of revision intervals (e.g. 1, 3, 7, 16, 35).").addText((text) => text.setPlaceholder("1, 3, 7, 16, 35").setValue(this.plugin.settings.revisionIntervals).onChange(async (value) => {
      this.plugin.settings.revisionIntervals = value.trim();
      await this.plugin.saveSettings();
    }));
  }
};

// src/main.ts
var DEFAULT_SETTINGS = {
  geminiApiKey: "",
  groqApiKey: "",
  openrouterApiKey: "",
  visionProvider: "gemini",
  defaultPomodoroMinutes: 25,
  revisionIntervals: "1, 3, 7, 16, 35"
};
var VaultCoachPlugin = class extends import_obsidian3.Plugin {
  async onload() {
    await this.loadSettings();
    this.registerView(
      VIEW_TYPE_VAULT_COACH,
      (leaf) => new VaultCoachView(leaf, this)
    );
    this.addRibbonIcon("graduation-cap", "Open Vault Coach", () => {
      this.activateView();
    });
    this.addSettingTab(new VaultCoachSettingTab(this.app, this));
  }
  async onunload() {
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async activateView() {
    const { workspace } = this.app;
    let leaf = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_VAULT_COACH);
    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: VIEW_TYPE_VAULT_COACH, active: true });
      }
    }
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
};
