import { Plugin, WorkspaceLeaf } from 'obsidian';
import { VaultCoachView, VIEW_TYPE_VAULT_COACH } from './VaultCoachView';
import { VaultCoachSettingTab } from './VaultCoachSettingTab';

export interface VaultCoachSettings {
    geminiApiKey: string;
    groqApiKey: string;
    openrouterApiKey: string;
    visionProvider: 'gemini' | 'groq' | 'openrouter';
    defaultPomodoroMinutes: number;
    revisionIntervals: string;
}

export const DEFAULT_SETTINGS: VaultCoachSettings = {
    geminiApiKey: '',
    groqApiKey: '',
    openrouterApiKey: '',
    visionProvider: 'gemini',
    defaultPomodoroMinutes: 25,
    revisionIntervals: '1, 3, 7, 16, 35'
};

export default class VaultCoachPlugin extends Plugin {
    settings: VaultCoachSettings;

    async onload() {
        await this.loadSettings();

        // Register the view
        this.registerView(
            VIEW_TYPE_VAULT_COACH,
            (leaf) => new VaultCoachView(leaf, this)
        );

        // Add ribbon icon
        this.addRibbonIcon('graduation-cap', 'Open Vault Coach', () => {
            this.activateView();
        });

        // Add settings tab
        this.addSettingTab(new VaultCoachSettingTab(this.app, this));
    }

    async onunload() {
        // Clean up
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async activateView() {
        const { workspace } = this.app;
        
        let leaf: WorkspaceLeaf | null = null;
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
}
