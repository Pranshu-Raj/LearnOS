 import os
import sys
import re
import time
import yaml
import base64
import json
import requests
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

def parse_with_groq_text(raw_text: str, api_key: str) -> Optional[ParsedPlanner]:
    """Uses Groq's Llama 3.3 70B model to format raw OCR text into structured tasks."""
    try:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        prompt_text = (
            "You are an expert task planner. Given this raw text extracted from a daily planner image:\n"
            f"'''{raw_text}'''\n\n"
            "Extract and format all tasks into strict JSON matching this schema:\n"
            "{\n"
            '  "date": "YYYY-MM-DD",\n'
            '  "goal": "Main Daily Goal",\n'
            '  "tasks": [\n'
            '    {"task": "Task Title", "slug": "file-slug", "estimated_minutes": 45, "subtasks": ["subtask 1"]}\n'
            '  ]\n'
            "}\n"
            "Return ONLY valid raw JSON."
        )
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [{"role": "user", "content": prompt_text}],
            "temperature": 0.2
        }
        print("[GROQ LLAMA-3.3] Structuring OCR text via Groq Llama 3.3 70B...")
        resp = requests.post(url, headers=headers, json=payload, timeout=25)
        if resp.status_code == 200:
            content = resp.json()["choices"][0]["message"]["content"]
            match = re.search(r"\{[\s\S]*\}", content)
            if match:
                return ParsedPlanner.model_validate_json(match.group(0))
        else:
            print(f"[GROQ ERROR] Status {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"[GROQ TEXT PARSER ERROR] {e}")
    return None

def parse_with_openrouter(image_path: str, api_key: str) -> Optional[ParsedPlanner]:
    """Fallback Vision OCR using OpenRouter Free Vision API with 2-Chop Tiling (Top & Bottom halves)."""
    try:
        import io
        img = Image.open(image_path).convert("RGB")
        w, h = img.size

        # 2-Chop Tiling: Slice image into Top Half (0-55%) and Bottom Half (45-100%)
        top_crop = img.crop((0, 0, w, int(h * 0.55)))
        bot_crop = img.crop((0, int(h * 0.45), w, h))

        buf1, buf2 = io.BytesIO(), io.BytesIO()
        top_crop.save(buf1, format="JPEG", quality=95)
        bot_crop.save(buf2, format="JPEG", quality=95)

        b64_top = base64.b64encode(buf1.getvalue()).decode("utf-8")
        b64_bot = base64.b64encode(buf2.getvalue()).decode("utf-8")

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        prompt_top = "Transcribe ALL text, headers (e.g. Phase 1 - Azure Infrastructure), titles, and bullet points in this TOP half of the daily planner photo in detail."
        prompt_bot = "Transcribe ALL text, phase titles (e.g. Phase 5, Phase 6, Phase 7), subtasks, and notes in this BOTTOM half of the daily planner photo in detail."

        model_id = "nvidia/nemotron-nano-12b-v2-vl:free"
        
        payload_top = {
            "model": model_id,
            "messages": [{"role": "user", "content": [{"type": "text", "text": prompt_top}, {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_top}"}}]}]
        }
        payload_bot = {
            "model": model_id,
            "messages": [{"role": "user", "content": [{"type": "text", "text": prompt_bot}, {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_bot}"}}]}]
        }

        print("[OPENROUTER TILING] Reading Top Half...")
        r_top = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload_top, timeout=25)
        print("[OPENROUTER TILING] Reading Bottom Half...")
        r_bot = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload_bot, timeout=25)

        top_text = r_top.json()["choices"][0]["message"]["content"] if r_top.status_code == 200 else ""
        bot_text = r_bot.json()["choices"][0]["message"]["content"] if r_bot.status_code == 200 else ""

        full_raw_text = f"{top_text}\n\n{bot_text}"
        print(f"[OPENROUTER TILING SUCCESS] Combined Raw Text Length: {len(full_raw_text)} chars.")

        # Pass combined text to Groq Llama 3.3 70B for structuring
        groq_key = os.getenv("GROQ_API_KEY")
        if groq_key:
            return parse_with_groq_text(full_raw_text, groq_key)

    except Exception as e:
        print(f"[OPENROUTER TILING ERROR] {e}")
    return None

def extract_ocr_text_local(image_path: str) -> str:
    """Extracts raw text from image locally using pytesseract if available."""
    try:
        import pytesseract
        image = Image.open(image_path)
        text = pytesseract.image_to_string(image)
        return text.strip()
    except Exception as e:
        print(f"[LOCAL OCR NOTICE] Pytesseract OCR engine not installed on OS: {e}")
        return ""

def parse_planner_image(image_path: str) -> ParsedPlanner:
    """
    Multi-AI Provider Vision OCR Engine.
    Tries: 1) OpenRouter Vision API, 2) Gemini Vision API, 3) Groq Llama 3.3 (with OCR), 4) Fallback.
    """
    # 1. Primary Priority: OpenRouter Vision API (if OPENROUTER_API_KEY is set in .env)
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    if openrouter_key and openrouter_key.strip() and openrouter_key != "your_openrouter_api_key_here":
        res = parse_with_openrouter(image_path, openrouter_key)
        if res:
            return res

    # 2. Gemini Vision API
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and gemini_key != "your_api_key_here":
        try:
            client = genai.Client(api_key=gemini_key)
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

            for model_name in ['gemini-3.5-flash', 'gemini-2.0-flash']:
                for attempt in range(2):
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
                            return ParsedPlanner.model_validate_json(response.text)
                    except Exception as e:
                        print(f"[GEMINI VISION] Model {model_name} error: {e}. Checking Groq fallback...")
                        break
        except Exception as e:
            print(f"[GEMINI VISION FAILED] {e}")

    # 2. Secondary: Groq Llama 3.3 70B with Local OCR
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key and groq_key.strip():
        raw_ocr_text = extract_ocr_text_local(image_path)
        if raw_ocr_text:
            res = parse_with_groq_text(raw_ocr_text, groq_key)
            if res:
                return res

    # 3. Tertiary: OpenRouter Free Vision API
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    if openrouter_key:
        res = parse_with_openrouter(image_path, openrouter_key)
        if res:
            return res

    # 4. Fallback if AI APIs are rate limited
    print("[FALLBACK] All AI APIs unavailable. Creating default task entry for planner photo...")
    filename = Path(image_path).stem
    today_str = time.strftime("%Y-%m-%d")
    return ParsedPlanner(
        date=today_str,
        goal="Imported Daily Planner Photo",
        tasks=[
            PlannerTask(
                task=f"Review Planner Photo ({filename})",
                slug=f"planner-photo-{int(time.time())}",
                estimated_minutes=45,
                subtasks=["Complete tasks from mobile planner upload"]
            )
        ]
    )

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

    curriculum_file = vault_path / "Curriculum.md"
    curriculum_entry = f"\n\n## Planner Import: {parsed_planner.date} - {parsed_planner.goal}\n"
    for t in parsed_planner.tasks:
        curriculum_entry += f"- [{t.task}](Topics/{t.slug}.md) ({t.estimated_minutes} min)\n"
    
    if curriculum_file.exists():
        curriculum_file.write_text(curriculum_file.read_text(encoding="utf-8") + curriculum_entry, encoding="utf-8")
    else:
        curriculum_file.write_text(f"# Learning Curriculum\n{curriculum_entry}", encoding="utf-8")

    return created_files
