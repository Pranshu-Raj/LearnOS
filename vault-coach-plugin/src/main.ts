import { Plugin, WorkspaceLeaf } from 'obsidian';
import { VaultCoachView, VIEW_TYPE_VAULT_COACH } from './VaultCoachView';

export default class VaultCoachPlugin extends Plugin {
    async onload() {
        // Register the view
        this.registerView(
            VIEW_TYPE_VAULT_COACH,
            (leaf) => new VaultCoachView(leaf)
        );

        // Add ribbon icon
        this.addRibbonIcon('graduation-cap', 'Open Vault Coach', () => {
            this.activateView();
        });
    }

    async onunload() {
        // Clean up
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
