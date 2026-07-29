import { App, PluginSettingTab, Setting } from 'obsidian';
import VaultCoachPlugin, { VaultCoachSettings } from './main';

export class VaultCoachSettingTab extends PluginSettingTab {
    plugin: VaultCoachPlugin;

    constructor(app: App, plugin: VaultCoachPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Vault Coach Settings' });

        // API Key Section Header
        containerEl.createEl('h3', { text: 'API Credentials (BYOK)' });

        new Setting(containerEl)
            .setName('Gemini API Key')
            .setDesc('Enter your Google Gemini API Key for vision OCR and curriculum generation.')
            .addText(text => text
                .setPlaceholder('AIzaSy...')
                .setValue(this.plugin.settings.geminiApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.geminiApiKey = value.trim();
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Groq API Key')
            .setDesc('Enter your Groq API Key for fast vision parsing fallback.')
            .addText(text => text
                .setPlaceholder('gsk_...')
                .setValue(this.plugin.settings.groqApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.groqApiKey = value.trim();
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('OpenRouter API Key')
            .setDesc('Enter your OpenRouter API Key for free Vision Llama models.')
            .addText(text => text
                .setPlaceholder('sk-or-...')
                .setValue(this.plugin.settings.openrouterApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.openrouterApiKey = value.trim();
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default Vision Provider')
            .setDesc('Select your preferred AI model provider for planner OCR parsing.')
            .addDropdown(dropdown => dropdown
                .addOption('gemini', 'Google Gemini Vision')
                .addOption('groq', 'Groq Llama 3.2 Vision')
                .addOption('openrouter', 'OpenRouter Free Vision')
                .setValue(this.plugin.settings.visionProvider)
                .onChange(async (value: 'gemini' | 'groq' | 'openrouter') => {
                    this.plugin.settings.visionProvider = value;
                    await this.plugin.saveSettings();
                }));

        // Study & Spaced Repetition Settings
        containerEl.createEl('h3', { text: 'Study & Revision Preferences' });

        new Setting(containerEl)
            .setName('Default Pomodoro Duration (Minutes)')
            .setDesc('Standard focus session duration in minutes.')
            .addText(text => text
                .setPlaceholder('25')
                .setValue(this.plugin.settings.defaultPomodoroMinutes.toString())
                .onChange(async (value) => {
                    const parsed = parseInt(value, 10);
                    if (!isNaN(parsed) && parsed > 0) {
                        this.plugin.settings.defaultPomodoroMinutes = parsed;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Spaced Repetition Intervals (Days)')
            .setDesc('Comma-separated list of revision intervals (e.g. 1, 3, 7, 16, 35).')
            .addText(text => text
                .setPlaceholder('1, 3, 7, 16, 35')
                .setValue(this.plugin.settings.revisionIntervals)
                .onChange(async (value) => {
                    this.plugin.settings.revisionIntervals = value.trim();
                    await this.plugin.saveSettings();
                }));
    }
}
