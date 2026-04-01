#!/usr/bin/env python3
"""
compute-scores-v001.py
Score haiku outputs against ground truth for prospect-identification scenario.

Dimensions:
  business_type_accuracy  (0.35) — LLM judge
  decision_maker_accuracy (0.35) — LLM judge
  label_normalization     (0.20) — LLM judge
  format_compliance       (0.10) — programmatic

Judge: Opus, triple-run median (same pattern as icp-classification).
Output: evals/v001.json
"""

import json
import re
import subprocess
import tempfile
import os
from datetime import datetime, timezone
from pathlib import Path

BASE = Path("scenarios/prospect-identification")
RAW_FILE = BASE / "evals/v001-raw.json"
GT_DIR = BASE / "ground-truth"
OUT_FILE = BASE / "evals/v001.json"

WEIGHTS = {
    "business_type_accuracy": 0.35,
    "decision_maker_accuracy": 0.35,
    "label_normalization": 0.20,
    "format_compliance": 0.10,
}

LLM_DIMS = ["business_type_accuracy", "decision_maker_accuracy", "label_normalization"]
JUDGE_RUNS = 3


# ---------------------------------------------------------------------------
# Programmatic format_compliance scorer (0-5 scale, 1 point per check)
# ---------------------------------------------------------------------------
KNOWN_PLURALS = {
    "staff", "personnel", "leadership", "management", "executives",
    "people", "workforce",
}

def is_plural(title: str) -> bool:
    """Rough pluralization check: ends with s, or known plural form."""
    t = title.strip().lower()
    if t.endswith("s"):
        return True
    if t in KNOWN_PLURALS:
        return True
    return False

def score_format_compliance(haiku_output: dict | None, ground_truth: dict) -> tuple[int, list[str]]:
    """
    Returns (score 0-5, list of failure notes).

    Checks:
      1. businessTypes word count ≤7
      2. decisionMakers word count ≤6
      3. Both DM titles are plural (split on 'and', check each)
      4. Both fields contain 'and' as separator
      5. Lowercase rule: no unexpected capitals (acronyms OK: all-caps tokens allowed)
    """
    if haiku_output is None:
        return 0, ["parse failure — no output"]

    score = 0
    failures = []

    bt = haiku_output.get("businessTypes", "")
    dm = haiku_output.get("decisionMakers", "")

    # Check 1: businessTypes word count ≤7
    bt_words = len(bt.strip().split()) if bt.strip() else 0
    if bt_words <= 7:
        score += 1
    else:
        failures.append(f"businessTypes is {bt_words} words (limit 7): \"{bt}\"")

    # Check 2: decisionMakers word count ≤6
    dm_words = len(dm.strip().split()) if dm.strip() else 0
    if dm_words <= 6:
        score += 1
    else:
        failures.append(f"decisionMakers is {dm_words} words (limit 6): \"{dm}\"")

    # Check 3: Both DM titles are plural
    if " and " in dm.lower():
        parts = [p.strip() for p in dm.lower().split(" and ", 1)]
        # Check last word of each part for pluralization
        part_checks = []
        for part in parts:
            words = part.strip().split()
            if words:
                last_word = words[-1]
                part_checks.append(is_plural(last_word))
            else:
                part_checks.append(False)
        if all(part_checks):
            score += 1
        else:
            failures.append(f"DM titles not all plural: \"{dm}\"")
    elif dm.strip():
        # Single entry or no "and" — can't verify two plural titles
        words = dm.strip().split()
        if words and is_plural(words[-1]):
            score += 1
        else:
            failures.append(f"decisionMakers missing 'and' or not plural: \"{dm}\"")
    else:
        failures.append("decisionMakers is empty")

    # Check 4: Both fields contain 'and'
    bt_has_and = " and " in bt.lower()
    dm_has_and = " and " in dm.lower()
    if bt_has_and and dm_has_and:
        score += 1
    else:
        if not bt_has_and:
            failures.append(f"businessTypes missing 'and' separator: \"{bt}\"")
        if not dm_has_and:
            failures.append(f"decisionMakers missing 'and' separator: \"{dm}\"")

    # Check 5: Lowercase (no unexpected capitals)
    # Allow all-uppercase tokens (acronyms: CMOs, VPs, CROs, IT, HVAC, OEMs, etc.)
    # Flag any token that is Title Case (first letter upper, rest lower with length > 1)
    def has_unexpected_caps(text: str) -> bool:
        tokens = text.strip().split()
        for token in tokens:
            # Strip trailing punctuation
            clean = token.rstrip(",.;:")
            if not clean:
                continue
            # All-upper tokens are OK (acronyms)
            if clean.upper() == clean:
                continue
            # All-lower is OK
            if clean.lower() == clean:
                continue
            # Title Case (first upper, rest lower) is a violation
            if clean[0].isupper() and clean[1:].islower():
                return True
            # Mixed case (e.g., "CRMs" — first char upper, ends with lower 's')
            # Allow: starts with all-upper prefix (CMOs, VPs, CROs, ITs)
            # Heuristic: if uppercase prefix >= 2 chars and ends with 's', allow
            match = re.match(r'^([A-Z]{2,})([a-z]*)$', clean)
            if match:
                continue  # e.g., "CMOs", "VPs", "OEMs"
            # Otherwise flag
            if any(c.isupper() for c in clean):
                return True
        return False

    if not has_unexpected_caps(bt) and not has_unexpected_caps(dm):
        score += 1
    else:
        if has_unexpected_caps(bt):
            failures.append(f"businessTypes has unexpected capitals: \"{bt}\"")
        if has_unexpected_caps(dm):
            failures.append(f"decisionMakers has unexpected capitals: \"{dm}\"")

    return score, failures


# ---------------------------------------------------------------------------
# LLM judge
# ---------------------------------------------------------------------------
JUDGE_PROMPT_TEMPLATE = """You are an expert B2B sales strategist scoring AI output quality.

Score the following haiku output against the ground truth for the prospect-identification task.
The task: given a company description, output the two most precise business types to prospect into and two decision maker titles most likely to book meetings.

Company: {company_name}
Company description: {company_description}

Ground truth:
  businessTypes: {gt_businessTypes}
  decisionMakers: {gt_decisionMakers}

Haiku output:
  businessTypes: {haiku_businessTypes}
  decisionMakers: {haiku_decisionMakers}

Score ONLY these two dimensions on a 1-5 scale:

business_type_accuracy (1-5):
  5 = the two business types are precisely correct for who this company sells to. Specific verticals/segments, not generic. Matches actual ICP.
  4 = mostly right, minor variation in specificity or framing
  3 = partially right — one type is accurate, one is off or too generic
  2 = both types are vague, wrong vertical, or describing the company itself instead of its customers
  1 = completely wrong or missing

decision_maker_accuracy (1-5):
  5 = the two DM titles are the actual buyers with budget authority who would take a meeting. Recognizable, right seniority.
  4 = mostly right, one title is slightly off in seniority or framing
  3 = partially right — one title is accurate, one is wrong or too obscure
  2 = both titles are wrong level (too junior/senior), wrong function, or made-up roles
  1 = completely wrong or missing

label_normalization (1-5):
  5 = language is casual and natural throughout — "CMOs" not "Chief Marketing Officers", "GMs" not "General Managers". Like talking to a friend.
  4 = mostly casual, one minor formality slipped through
  3 = mix of casual and formal. Some full title expansions or stiff language.
  2 = mostly formal. Full title expansions. Corporate jargon.
  1 = completely formal or unnatural language throughout.

Respond ONLY with valid JSON:
{{
  "business_type_accuracy": <1-5>,
  "decision_maker_accuracy": <1-5>,
  "label_normalization": <1-5>,
  "rationale": {{
    "business_type_accuracy": "<one sentence>",
    "decision_maker_accuracy": "<one sentence>",
    "label_normalization": "<one sentence>"
  }}
}}"""


def call_opus_judge(prompt: str) -> dict | None:
    """Call claude CLI with opus model, return parsed JSON or None."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as f:
        f.write(prompt)
        tmp_path = f.name

    try:
        bash_path = 'C:\\Program Files\\Git\\usr\\bin\\bash.exe'
        unix_path = tmp_path.replace('\\', '/')
        raw = subprocess.check_output(
            f'cat "{unix_path}" | claude --print --model opus --allowedTools ""',
            shell=True,
            executable=bash_path,
            encoding='utf-8',
            timeout=180,
        ).strip()

        # Strip code fences
        cleaned = raw.replace('```json', '').replace('```', '').strip()
        match = re.search(r'\{[\s\S]*\}', cleaned)
        if match:
            return json.loads(match.group(0))
        return json.loads(cleaned)
    except Exception as e:
        print(f"  Judge call failed: {e}")
        return None
    finally:
        os.unlink(tmp_path)


def run_judge_triple(prompt: str) -> tuple[dict | None, list]:
    """Run judge 3 times, return (median scores dict, all_runs list)."""
    runs = []
    for i in range(JUDGE_RUNS):
        result = call_opus_judge(prompt)
        if result:
            runs.append(result)
        else:
            print(f"  Judge run {i+1} failed")

    if not runs:
        return None, runs

    # Median per dimension
    medians = {}
    last_rationale = runs[-1].get("rationale", {})

    for dim in LLM_DIMS:
        scores = sorted([r[dim] for r in runs if dim in r])
        if scores:
            medians[dim] = scores[len(scores) // 2]  # median
        else:
            medians[dim] = 1

    medians["rationale"] = last_rationale
    return medians, runs


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    with open(RAW_FILE) as f:
        raw = json.load(f)

    # Load ground truths
    gt_map = {}
    for gt_file in sorted(GT_DIR.glob("*.json")):
        gt = json.loads(gt_file.read_text())
        gt_map[gt["id"]] = gt

    haiku_map = {r["input_id"]: r for r in raw["results"]}

    per_input = []
    dim_totals = {d: 0.0 for d in WEIGHTS}
    parse_failures = 0

    input_order = sorted(gt_map.keys())

    for input_id in input_order:
        gt = gt_map[input_id]
        raw_result = haiku_map.get(input_id, {})
        haiku_output = raw_result.get("haiku_output")
        split = gt["split"]

        print(f"\n=== Scoring: {input_id} ({split}) ===")

        if raw_result.get("parse_failure") or haiku_output is None:
            print("  Parse failure — skipping judge, assigning 0s")
            parse_failures += 1
            per_input.append({
                "input_id": input_id,
                "split": split,
                "weighted_score": 0.0,
                "dimensions": {d: {"score": 0, "normalized": 0.0} for d in WEIGHTS},
                "haiku_output": haiku_output,
                "parse_failure": True,
                "judge_skipped": True,
                "judge_rationales": {},
            })
            continue

        gt_data = gt["ground_truth"]

        # --- Programmatic: format_compliance ---
        fmt_score, fmt_failures = score_format_compliance(haiku_output, gt_data)
        print(f"  format_compliance: {fmt_score}/5")
        if fmt_failures:
            for f in fmt_failures:
                print(f"    - {f}")

        # --- LLM judge for 3 dimensions ---
        judge_prompt = JUDGE_PROMPT_TEMPLATE.format(
            company_name=gt["input"]["company_name"],
            company_description=gt["input"]["company_description"],
            gt_businessTypes=gt_data["businessTypes"],
            gt_decisionMakers=gt_data["decisionMakers"],
            haiku_businessTypes=haiku_output.get("businessTypes", "[missing]"),
            haiku_decisionMakers=haiku_output.get("decisionMakers", "[missing]"),
        )

        judge_medians, judge_runs_data = run_judge_triple(judge_prompt)

        if judge_medians is None:
            print("  All judge runs failed — assigning 1s for LLM dims")
            judge_medians = {d: 1 for d in LLM_DIMS}
            judge_medians["rationale"] = {}

        for d in LLM_DIMS:
            print(f"  {d}: {judge_medians.get(d, 1)}/5")

        # Build dimensions dict
        dimensions = {}
        weighted_score = 0.0

        for dim, weight in WEIGHTS.items():
            if dim == "format_compliance":
                raw_score = fmt_score
            else:
                raw_score = judge_medians.get(dim, 1)

            normalized = (raw_score - 1) / 4
            dimensions[dim] = {
                "score": raw_score,
                "normalized": round(normalized, 4),
            }
            weighted_score += normalized * weight
            dim_totals[dim] += normalized

        per_input.append({
            "input_id": input_id,
            "split": split,
            "weighted_score": round(weighted_score, 4),
            "dimensions": dimensions,
            "haiku_output": haiku_output,
            "parse_failure": False,
            "judge_skipped": False,
            "judge_rationales": judge_medians.get("rationale", {}),
            "format_compliance_failures": fmt_failures,
        })

        print(f"  weighted_score: {weighted_score:.4f}")

    # Aggregate
    n = len(per_input)
    train_items = [p for p in per_input if p["split"] == "train"]
    val_items = [p for p in per_input if p["split"] == "val"]

    train_score = round(sum(p["weighted_score"] for p in train_items) / len(train_items), 4) if train_items else 0.0
    val_score = round(sum(p["weighted_score"] for p in val_items) / len(val_items), 4) if val_items else 0.0
    overall_score = round(sum(p["weighted_score"] for p in per_input) / n, 4) if n else 0.0

    dim_averages = {d: round(dim_totals[d] / n, 4) for d in WEIGHTS}

    result = {
        "prompt_version": "v001",
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "config": {
            "target_model": "haiku",
            "judge_model": "opus",
            "judge_runs": JUDGE_RUNS,
            "rubric_version": 1,
            "normalization": "(score - 1) / 4",
            "format_compliance": "programmatic",
        },
        "aggregate": {
            "overall_score": overall_score,
            "train_score": train_score,
            "validation_score": val_score,
            "dimension_averages": dim_averages,
            "inputs_evaluated": n,
            "parse_failures": parse_failures,
        },
        "per_input": per_input,
        "failure_patterns": [],
    }

    with open(OUT_FILE, "w") as f:
        json.dump(result, f, indent=2)

    print(f"\n=== SCORES ===")
    print(f"Overall: {overall_score:.3f}, Train: {train_score:.3f}, Val: {val_score:.3f}")
    print(f"Dimension averages: {dim_averages}")
    for p in per_input:
        print(f"  {p['input_id']}: {p['weighted_score']:.4f} ({p['split']})")
    print(f"\nOutput written to: {OUT_FILE}")


if __name__ == "__main__":
    main()
