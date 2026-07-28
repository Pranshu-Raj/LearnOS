import sys
import os
import json
from pathlib import Path
from scripts.planner_parser import parse_planner_image, save_planner_to_vault

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/cli_vision.py <path_to_planner_image> [vault_directory]")
        sys.exit(1)

    image_path = sys.argv[1]
    vault_dir = sys.argv[2] if len(sys.argv) > 2 else "TestVault"

    if not Path(image_path).exists():
        print(f"Error: Image file '{image_path}' does not exist.")
        sys.exit(1)

    print(f"📷 Processing daily planner image '{image_path}' with Gemini Multimodal Vision...")
    
    try:
        parsed = parse_planner_image(image_path)
        print(f"✅ Extracted Date: {parsed.date}")
        print(f"🎯 Daily Goal: {parsed.goal}")
        print(f"📋 Extracted {len(parsed.tasks)} tasks:")

        for t in parsed.tasks:
            print(f"   - {t.task} ({t.estimated_minutes} min) [{len(t.subtasks)} subtasks]")

        created_files = save_planner_to_vault(parsed, vault_dir)
        print(f"\n✨ Successfully saved {len(created_files)} task files to Obsidian vault '{vault_dir}/Topics/'.")
        
    except Exception as e:
        print(f"❌ Ingestion Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
