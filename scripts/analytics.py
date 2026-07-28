import os
import re
import yaml
from pathlib import Path
from typing import Dict, Any, List

def get_vault_analytics(vault_dir: str) -> Dict[str, Any]:
    """
    Scans a vault's Topics directory and calculates pace/velocity metrics.
    
    Returns:
        Dict with total_topics, completed_topics, total_estimated_minutes,
        total_actual_minutes, velocity_ratio (actual / estimated),
        bottlenecks (topics that took > 30% longer), and remaining_topics.
    """
    topics_dir = Path(vault_dir) / "Topics"
    if not topics_dir.exists():
        return {
            "total_topics": 0,
            "completed_topics": 0,
            "total_estimated_minutes": 0,
            "total_actual_minutes": 0,
            "velocity_ratio": 1.0,
            "bottlenecks": [],
            "remaining_topics": []
        }

    total_estimated = 0
    total_actual = 0
    completed_count = 0
    total_count = 0
    bottlenecks = []
    remaining = []

    for file_path in topics_dir.glob("*.md"):
        total_count += 1
        content = file_path.read_text(encoding="utf-8")
        match = re.search(r"^---\n(.*?)\n---", content, re.DOTALL)
        if match:
            try:
                fm = yaml.safe_load(match.group(1)) or {}
                status = fm.get("status", "not-started")
                est = int(fm.get("estimated_minutes", 0) or 0)
                act = int(fm.get("actual_minutes", 0) or 0)

                if status == "done":
                    completed_count += 1
                    total_estimated += est
                    total_actual += act

                    # Bottleneck detection: took >30% longer than estimated
                    if act > est * 1.3 and est > 0:
                        bottlenecks.append({
                            "filename": file_path.name,
                            "topic": fm.get("topic", file_path.name),
                            "estimated": est,
                            "actual": act,
                            "overage_percent": round(((act - est) / est) * 100, 1)
                        })
                else:
                    remaining.append({
                        "filename": file_path.name,
                        "topic": fm.get("topic", file_path.name),
                        "estimated": est,
                        "status": status
                    })
            except Exception as e:
                print(f"Error parsing YAML in {file_path}: {e}")

    velocity_ratio = round(total_actual / total_estimated, 2) if total_estimated > 0 else 1.0

    return {
        "total_topics": total_count,
        "completed_topics": completed_count,
        "total_estimated_minutes": total_estimated,
        "total_actual_minutes": total_actual,
        "velocity_ratio": velocity_ratio,
        "bottlenecks": bottlenecks,
        "remaining_topics": remaining
    }

if __name__ == "__main__":
    import json
    import sys
    target_vault = sys.argv[1] if len(sys.argv) > 1 else "TestVault"
    print(json.dumps(get_vault_analytics(target_vault), indent=2))
