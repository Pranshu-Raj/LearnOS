import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import VaultCoachPlugin from "./main";

export const VIEW_TYPE_VAULT_COACH = "vault-coach-view";

export class VaultCoachView extends ItemView {
    plugin: VaultCoachPlugin;
    timerInterval: NodeJS.Timeout | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: VaultCoachPlugin) {
        super(leaf);
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
        // Automatically re-render if a file's metadata changes (e.g. checked off elsewhere)
        this.registerEvent(this.app.metadataCache.on('changed', () => this.render()));
    }

    async render() {
        const container = this.containerEl.children[1];
        container.empty();
        
        container.createEl("h2", { text: "Vault Coach" });

        // Show API Credentials Banner if no key is set for selected provider
        const currentProvider = this.plugin.settings?.visionProvider || 'gemini';
        let keyConfigured = false;
        if (currentProvider === 'gemini') keyConfigured = !!this.plugin.settings?.geminiApiKey;
        else if (currentProvider === 'groq') keyConfigured = !!this.plugin.settings?.groqApiKey;
        else if (currentProvider === 'openrouter') keyConfigured = !!this.plugin.settings?.openrouterApiKey;

        if (!keyConfigured) {
            const warningBox = container.createDiv();
            warningBox.style.padding = "10px";
            warningBox.style.marginBottom = "15px";
            warningBox.style.borderRadius = "5px";
            warningBox.style.backgroundColor = "var(--background-secondary-alt)";
            warningBox.style.border = "1px solid var(--text-warning)";
            warningBox.createEl("p", { text: `⚠️ API Key not configured for selected provider (${currentProvider.toUpperCase()}). Please open Plugin Settings to configure your API key.` });
        }

        const curriculumFile = this.app.vault.getAbstractFileByPath("Curriculum.md");
        if (!curriculumFile || !(curriculumFile instanceof TFile)) {
            container.createEl("p", { text: "Curriculum.md not found. Please generate a curriculum first." });
            return;
        }

        const files = this.app.vault.getMarkdownFiles();
        const topics: { file: TFile, fm: any }[] = [];

        for (const file of files) {
            if (file.path.startsWith("Topics/")) {
                const cache = this.app.metadataCache.getFileCache(file);
                const fm = cache?.frontmatter;
                if (fm && fm.topic) {
                    topics.push({ file, fm });
                }
            }
        }

        const pendingTopics = topics.filter(t => t.fm.status !== 'done');
        
        if (pendingTopics.length === 0) {
            container.createEl("p", { text: "All topics completed! 🎉" });
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

            // Left side: Checkbox + Title
            const leftDiv = li.createDiv();
            leftDiv.style.display = "flex";
            leftDiv.style.alignItems = "center";

            const checkbox = leftDiv.createEl("input", { type: "checkbox" });
            checkbox.checked = topic.fm.status === 'done';
            checkbox.style.marginRight = "10px";
            
            checkbox.addEventListener("change", async () => {
                await this.app.fileManager.processFrontMatter(topic.file, (frontmatter) => {
                    frontmatter.status = checkbox.checked ? 'done' : 'not-started';
                });
            });

            // Make the title clickable to open the file
            const titleSpan = leftDiv.createEl("span", { text: topic.fm.topic });
            titleSpan.style.cursor = "pointer";
            titleSpan.style.textDecoration = "underline";
            titleSpan.addEventListener("click", () => {
                this.app.workspace.getLeaf(false).openFile(topic.file);
            });

            // Right side: Pomodoro Button
            const rightDiv = li.createDiv();
            const pomoBtn = rightDiv.createEl("button", { text: "⏱️ Focus" });
            
            pomoBtn.addEventListener("click", () => {
                this.renderTimer(container, topic);
            });
        }
    }

    renderTimer(container: Element, topic: { file: TFile, fm: any }) {
        container.empty();
        
        container.createEl("h2", { text: "Focus Mode" });
        container.createEl("h4", { text: topic.fm.topic });
        
        const defaultMins = this.plugin.settings?.defaultPomodoroMinutes || 25;
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
                if (this.timerInterval) clearInterval(this.timerInterval);
            } else {
                isRunning = true;
                startBtn.innerText = "Pause";
                this.timerInterval = setInterval(tick, 1000);
            }
        });

        stopBtn.addEventListener("click", async () => {
            if (this.timerInterval) clearInterval(this.timerInterval);
            
            const elapsedSeconds = (estimatedMinutes * 60) - secondsRemaining;
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
            if (this.timerInterval) clearInterval(this.timerInterval);
            this.render();
        });
    }

    formatTime(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    async onClose() {
        if (this.timerInterval) clearInterval(this.timerInterval);
    }
}
