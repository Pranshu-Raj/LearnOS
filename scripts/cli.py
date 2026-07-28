import os
import sys
from generator import generate_curriculum
from vault_writer import write_to_vault

def main():
    print("=======================================")
    print("  Vault Coach: Curriculum Generator")
    print("=======================================\n")
    
    goal = input("What is your learning goal? (e.g. Learn React): ")
    deadline = input("What is your deadline? (e.g. 2026-09-01): ")
    try:
        hours_per_day = float(input("How many hours a day can you study?: "))
    except ValueError:
        print("Error: Please enter a valid number for hours.")
        sys.exit(1)
        
    print("\n[1/2] Generating curriculum via Gemini... (This may take a few seconds)")
    try:
        curriculum = generate_curriculum(goal, deadline, hours_per_day)
    except Exception as e:
        print(f"Error: Failed to generate curriculum. {e}")
        sys.exit(1)
        
    # By default we dump into a local TestVault within the project for Phase 2 prototyping
    vault_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "TestVault"))
    
    print(f"[2/2] Writing to Obsidian Vault at:\n -> {vault_path}...")
    write_to_vault(vault_path, curriculum, deadline, hours_per_day)
    
    print("\nDone! You can now open the 'TestVault' folder as a vault in Obsidian.")

if __name__ == "__main__":
    main()
