import os
import yaml
from pathlib import Path
from generator import Curriculum

def write_to_vault(vault_path: str, curriculum: Curriculum, deadline: str, hours_per_day: float):
    """
    Takes the structured Curriculum object and writes it into the local Obsidian Vault
    as Markdown files with YAML frontmatter.
    """
    base_path = Path(vault_path)
    base_path.mkdir(parents=True, exist_ok=True)
    topics_path = base_path / "Topics"
    topics_path.mkdir(exist_ok=True)
    
    # Write Curriculum.md
    curriculum_frontmatter = {
        "goal": curriculum.goal,
        "deadline": deadline,
        "hours_per_day": hours_per_day,
        "status": "active"
    }
    
    curr_file = base_path / "Curriculum.md"
    with open(curr_file, 'w', encoding='utf-8') as f:
        f.write("---\n")
        # dump yaml frontmatter
        yaml.dump(curriculum_frontmatter, f, default_flow_style=False, sort_keys=False)
        f.write("---\n\n")
        f.write(f"# Curriculum: {curriculum.goal}\n\n")
        f.write("## Topics\n")
        for topic in curriculum.topics:
            # Create standard Obsidian Wikilinks
            f.write(f"- [[{topic.topic}]]\n")
            
    # Write Topics/*.md
    for topic in curriculum.topics:
        topic_frontmatter = {
            "topic": topic.topic,
            "status": "not-started",
            "estimated_minutes": topic.estimated_minutes,
            "actual_minutes": 0,
            "first_learned": None,
            "next_review": None,
            "review_count": 0,
            "last_review_quality": None,
            "feynman_prompt": topic.feynman_prompt
        }
        
        topic_file = topics_path / f"{topic.slug}.md"
        with open(topic_file, 'w', encoding='utf-8') as f:
            f.write("---\n")
            yaml.dump(topic_frontmatter, f, default_flow_style=False, sort_keys=False)
            f.write("---\n\n")
            f.write(f"# {topic.topic}\n\n")
            f.write("## Notes\n")
            
    print(f"Successfully wrote curriculum and {len(curriculum.topics)} topics to {vault_path}")
