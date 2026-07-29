import os
import re
import json
import requests
from pathlib import Path
from dotenv import load_dotenv
from planner_parser import ParsedPlanner, save_planner_to_vault

load_dotenv()

def process_extracted_text():
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise ValueError("GROQ_API_KEY is missing in .env")

    raw_text_path = "extracted_planner_text.txt"
    if not os.path.exists(raw_text_path):
        print("extracted_planner_text.txt not found")
        return

    raw_text = open(raw_text_path, encoding="utf-8").read().strip()
    print("[RAW PLANNER TEXT READ SUCCESS]:")
    print(raw_text)

    prompt = (
        "You are an expert task planner AI. Examine this raw daily planner text extracted from a photo:\n"
        f"'''{raw_text}'''\n\n"
        "Group the items into logical phases/tasks and format into strict JSON matching this schema:\n"
        "{\n"
        '  "date": "2026-07-28",\n'
        '  "goal": "Azure Infrastructure and Security Setup",\n'
        '  "tasks": [\n'
        '    {"task": "Phase Title", "slug": "file-slug", "estimated_minutes": 60, "subtasks": ["subtask 1", "subtask 2"]}\n'
        '  ]\n'
        "}\n"
        "Return ONLY raw JSON."
    )

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2
    }

    print("\n[GROQ API] Calling Groq Llama 3.3 70B API...")
    resp = requests.post(url, headers=headers, json=payload, timeout=30)
    if resp.status_code != 200:
        print(f"Groq API Error {resp.status_code}: {resp.text}")
        return

    content = resp.json()["choices"][0]["message"]["content"]
    match = re.search(r"\{[\s\S]*\}", content)
    if not match:
        print("Failed to find JSON in Groq response:", content)
        return

    parsed = ParsedPlanner.model_validate_json(match.group(0))
    created_files = save_planner_to_vault(parsed, "TestVault")

    print("\n=======================================================")
    print(f"GROQ LLAMA 3.3 70B VAULT SAVE SUCCESS!")
    print(f"Date: {parsed.date}")
    print(f"Goal: {parsed.goal}")
    print(f"Created Topic Files ({len(created_files)}):")
    for f in created_files:
        print(f"  -> {f}")
    print("\nExtracted Tasks & Subtasks:")
    for t in parsed.tasks:
        print(f"\n* {t.task} ({t.estimated_minutes} min)")
        for st in t.subtasks:
            print(f"   - {st}")
    print("=======================================================\n")

if __name__ == "__main__":
    process_extracted_text()
