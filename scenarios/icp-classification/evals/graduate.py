#!/usr/bin/env python3
"""Graduate the best prompt from an anneal loop to the library.

Reads loop-state.json and scenario.json, finds the best prompt version,
and writes it to library/{scenario_name}.md with YAML frontmatter metadata.

Usage:
    python graduate.py [scenario_dir]

If scenario_dir is not provided, defaults to the parent of this script's
evals/ directory.
"""

import json
import os
import sys
from datetime import date, timezone
from pathlib import Path


def main():
    # 1. Resolve scenario directory
    script_dir = Path(__file__).resolve().parent
    if len(sys.argv) > 1:
        scenario_dir = Path(sys.argv[1]).resolve()
    else:
        scenario_dir = script_dir.parent

    # 2. Read loop-state.json and scenario.json
    loop_state_path = scenario_dir / "evals" / "loop-state.json"
    scenario_json_path = scenario_dir / "scenario.json"

    if not loop_state_path.exists():
        print(f"ERROR: {loop_state_path} not found")
        sys.exit(1)
    if not scenario_json_path.exists():
        print(f"ERROR: {scenario_json_path} not found")
        sys.exit(1)

    with open(loop_state_path, "r", encoding="utf-8") as f:
        loop_state = json.load(f)
    with open(scenario_json_path, "r", encoding="utf-8") as f:
        scenario = json.load(f)

    # 3. Find the best version
    best_version = loop_state["best_version"]
    scenario_name = scenario["name"]

    # 4. Read the best prompt file
    prompt_path = scenario_dir / "prompts" / f"{best_version}.md"
    if not prompt_path.exists():
        print(f"ERROR: Prompt file {prompt_path} not found")
        sys.exit(1)

    with open(prompt_path, "r", encoding="utf-8") as f:
        prompt_text = f.read()

    # 5. Look up the best version's score_history entry
    score_entry = None
    for entry in loop_state["score_history"]:
        if entry["version"] == best_version:
            score_entry = entry
            break

    if score_entry is None:
        print(f"ERROR: No score_history entry found for {best_version}")
        sys.exit(1)

    overall_score = score_entry["overall"]
    train_score = score_entry["train"]
    val_score = score_entry["val"]
    tokens = score_entry["tokens"]

    # 6. Count iterations run
    iterations_run = len(loop_state["score_history"])

    # 7. Get scenario metadata
    accuracy_threshold = scenario["config"]["accuracy_threshold"]
    target_model = scenario["config"]["target_model"]

    # Count input files (any file in inputs/ directory)
    inputs_dir = scenario_dir / "inputs"
    test_set_size = 0
    if inputs_dir.exists():
        test_set_size = len([f for f in inputs_dir.iterdir() if f.is_file()])

    # 8. Create library/ directory at project root
    # Project root is two levels up from evals/ (evals -> scenario -> scenarios -> root)
    project_root = scenario_dir.parent.parent
    library_dir = project_root / "library"
    library_dir.mkdir(parents=True, exist_ok=True)

    # 9. Write graduated prompt with YAML frontmatter
    output_path = library_dir / f"{scenario_name}.md"
    today = date.today().isoformat()

    frontmatter = f"""---
scenario: {scenario_name}
graduated: {today}
accuracy:
  overall: {overall_score}
  train: {train_score}
  validation: {val_score}
threshold: {accuracy_threshold}
iterations: {iterations_run}
best_version: {best_version}
target_model: {target_model}
test_set_size: {test_set_size}
tokens: {tokens}
---
"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(frontmatter)
        f.write(prompt_text)

    # 10. Print summary
    print(f"Graduated: {scenario_name}")
    print(f"  Best version: {best_version}")
    print(f"  Overall score: {overall_score}")
    print(f"  Train score: {train_score}")
    print(f"  Validation score: {val_score}")
    print(f"  Threshold: {accuracy_threshold}")
    print(f"  Iterations run: {iterations_run}")
    print(f"  Tokens: {tokens}")
    print(f"  Test set size: {test_set_size}")
    print(f"  Output: {output_path}")

    # 11. Warn if loop hasn't halted yet
    if loop_state.get("halt_reason") is None:
        print()
        print("WARNING: The anneal loop has not halted yet (halt_reason is null).")
        print("Graduating the current best version. The loop may still improve this prompt.")


if __name__ == "__main__":
    main()
