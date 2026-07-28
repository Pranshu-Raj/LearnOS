import os
import sys
import re
import yaml

from pathlib import Path
from typing import List, Dict, Any
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from google import genai
from google.genai import types

try:
    from scripts.analytics import get_vault_analytics
except ImportError:
    from analytics import get_vault_analytics

# Load API key
load_dotenv()

# Pydantic schemas for Gemini structured output
class TopicEstimateAdjustment(BaseModel):
    filename: str = Field(description="The exact filename of the topic markdown file e.g. macros-declarative-procedural.md")
    new_estimated_minutes: int = Field(description="Adjusted estimated minutes based on user's study velocity ratio")
    rationale: str = Field(description="Brief 1-sentence reason for adjusting the estimate")

class ReplanOutput(BaseModel):
    summary: str = Field(description="Summary of overall schedule recalibration based on study velocity ratio")
    topic_adjustments: List[TopicEstimateAdjustment]

def replan_curriculum(vault_dir: str = "TestVault") -> Dict[str, Any]:
    """
    Analyzes study velocity in vault_dir and uses Gemini API (with deterministic fallback)
    to recalibrate estimated_minutes for remaining incomplete topics.
    """
    analytics = get_vault_analytics(vault_dir)
    remaining_topics = analytics.get("remaining_topics", [])

    if not remaining_topics:
        print("No remaining incomplete topics to re-plan.")
        return {"status": "no_op", "message": "All topics completed."}

    api_key = os.getenv("GEMINI_API_KEY")
    replan_data = None

    if api_key and api_key != "your_api_key_here":
        try:
            client = genai.Client(api_key=api_key)
            prompt = f"""
You are an expert AI Learning Coach.
Review the user's current study pace velocity analytics:
- Velocity Ratio (Actual / Estimated): {analytics['velocity_ratio']} (A value > 1.0 means topics take longer than expected; < 1.0 means faster).
- Completed Topics Count: {analytics['completed_topics']}
- Bottleneck Topics (took > 30% longer): {analytics['bottlenecks']}

Below are the remaining incomplete topics:
{remaining_topics}

Your Task:
Based on the user's velocity ratio ({analytics['velocity_ratio']}x), adjust the `new_estimated_minutes` for each remaining topic so that future study plans are realistic.
If velocity ratio > 1.0, increase estimates accordingly. If < 1.0, adjust down or keep reasonable minimums (e.g. at least 15 min).
Provide a brief rationale for each topic.
"""
            # Try primary model
            response = client.models.generate_content(
                model='gemini-3.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ReplanOutput,
                    temperature=0.2,
                ),
            )
            if response and response.text:
                replan_data = ReplanOutput.model_validate_json(response.text)
        except Exception as e:
            print(f"Gemini API temporary limit or error ({e}). Using deterministic velocity fallback...")

    # Deterministic Fallback if API unavailable or rate-limited
    if not replan_data:
        ratio = analytics.get("velocity_ratio", 1.0)
        if ratio <= 0:
            ratio = 1.0

        adjustments = []
        for topic in remaining_topics:
            old_est = topic.get("estimated", 30)
            new_est = max(15, int(round((old_est * ratio) / 15.0) * 15))
            adjustments.append(TopicEstimateAdjustment(
                filename=topic["filename"],
                new_estimated_minutes=new_est,
                rationale=f"Recalibrated by velocity ratio ({ratio}x) fallback."
            ))
        replan_data = ReplanOutput(
            summary=f"Recalibrated schedule based on velocity ratio ({ratio}x).",
            topic_adjustments=adjustments
        )

    # Mutate Topic Files Frontmatter
    topics_dir = Path(vault_dir) / "Topics"
    updated_count = 0

    for adj in replan_data.topic_adjustments:
        target_file = topics_dir / adj.filename
        if target_file.exists():
            content = target_file.read_text(encoding="utf-8")
            match = re.search(r"^---\n(.*?)\n---", content, re.DOTALL)
            if match:
                fm = yaml.safe_load(match.group(1)) or {}
                fm["estimated_minutes"] = adj.new_estimated_minutes
                fm["replanned_rationale"] = adj.rationale
                new_yaml = yaml.dump(fm, sort_keys=False)
                new_content = re.sub(r"^---\n(.*?)\n---", f"---\n{new_yaml}---", content, flags=re.DOTALL)
                target_file.write_text(new_content, encoding="utf-8")
                updated_count += 1

    return {
        "status": "success",
        "velocity_ratio": analytics['velocity_ratio'],
        "summary": replan_data.summary,
        "updated_topics_count": updated_count,
        "adjustments": [a.model_dump() for a in replan_data.topic_adjustments]
    }

if __name__ == "__main__":
    target_vault = sys.argv[1] if len(sys.argv) > 1 else "TestVault"
    print(f"Running Adaptive Weekly Re-Plan for '{target_vault}'...")
    res = replan_curriculum(target_vault)
    print(f"\nRe-Plan Complete! Summary: {res.get('summary')}")
    print(f"Updated {res.get('updated_topics_count')} topic files.")
