import os
import sys
import re
import yaml
from pathlib import Path
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from PIL import Image
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

class PlannerTask(BaseModel):
    task: str = Field(description="Title of the task extracted from the daily planner image")
    slug: str = Field(description="File-safe slug for the topic markdown filename e.g. build-auth-api")
    estimated_minutes: int = Field(description="Desired/estimated time in minutes required to complete the task")
    subtasks: List[str] = Field(default_factory=list, description="Sub-tasks or checklist items listed under this task")

class ParsedPlanner(BaseModel):
    date: str = Field(description="Date or header extracted from the planner page e.g. 2026-07-28")
    goal: str = Field(description="Main focus or goal for the day")
    tasks: List[PlannerTask]

def parse_planner_image(image_path: str) -> ParsedPlanner:
    """
    Passes an image of a daily planner to Gemini Vision API and returns structured ParsedPlanner data.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_api_key_here":
        raise ValueError("GEMINI_API_KEY environment variable is missing or invalid.")

    client = genai.Client(api_key=api_key)
    
    # Open image with Pillow
    image = Image.open(image_path)
    
    prompt = """
    You are an expert OCR and Task Planner AI assistant.
    Examine this image of a daily planner / task list / notebook.
    Extract the overall date or title, main goal, and each distinct task.
    For each task:
    1. Provide a clear task title.
    2. Create a clean file-safe slug (e.g. 'implement-jwt-auth').
    3. Extract or estimate a realistic desired completion time in minutes (estimated_minutes). If unspecified, estimate based on complexity (e.g. 30, 45, 60 min).
    4. Extract any bullet points / sub-tasks listed under the task.
    """

    models_to_try = ['gemini-3.5-flash', 'gemini-2.0-flash']
    response = None
    last_error = None

    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[image, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ParsedPlanner,
                    temperature=0.2,
                ),
            )
            if response and response.text:
                break
        except Exception as e:
            print(f"Model {model_name} Vision error: {e}. Trying fallback...")
            last_error = e

    if not response or not response.text:
        raise last_error or ValueError("Failed to parse planner image with Gemini Vision.")

    return ParsedPlanner.model_validate_json(response.text)

def save_planner_to_vault(parsed_planner: ParsedPlanner, vault_dir: str = "TestVault") -> List[str]:
    """
    Saves extracted planner tasks into individual Markdown files inside vault_dir/Topics/.
    """
    vault_path = Path(vault_dir)
    topics_dir = vault_path / "Topics"
    topics_dir.mkdir(parents=True, exist_ok=True)

    created_files = []

    for task in parsed_planner.tasks:
        filename = f"{task.slug}.md"
        filepath = topics_dir / filename

        subtask_md = "\n".join([f"- [ ] {st}" for st in task.subtasks]) if task.subtasks else "- [ ] Complete task"

        content = f"""---
topic: "{task.task}"
status: "not-started"
estimated_minutes: {task.estimated_minutes}
actual_minutes: 0
created_date: "{parsed_planner.date}"
---

# {task.task}

## Tasks
{subtask_md}
"""
        filepath.write_text(content, encoding="utf-8")
        created_files.append(str(filepath))

    # Also append/update Curriculum.md summary
    curriculum_file = vault_path / "Curriculum.md"
    curriculum_entry = f"\n\n## Planner Import: {parsed_planner.date} - {parsed_planner.goal}\n"
    for t in parsed_planner.tasks:
        curriculum_entry += f"- [{t.task}](Topics/{t.slug}.md) ({t.estimated_minutes} min)\n"
    
    if curriculum_file.exists():
        curriculum_file.write_text(curriculum_file.read_text(encoding="utf-8") + curriculum_entry, encoding="utf-8")
    else:
        curriculum_file.write_text(f"# Learning Curriculum\n{curriculum_entry}", encoding="utf-8")

    return created_files
