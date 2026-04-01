#!/usr/bin/env python3
"""
compute-scores-v001.py
Score haiku v001 outputs for prospect-identification.

Judge runs executed manually (Opus judge inline, triple consistent scores).
Normalization: (score - 1) / 4  (maps 1-5 → 0-1)

Dimensions (weights):
  business_type_accuracy  0.35
  decision_maker_accuracy 0.35
  label_normalization     0.20
  format_compliance       0.10  (programmatic)
"""

import json
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

# ---------------------------------------------------------------------------
# Hardcoded judge scores (triple-run median, executed manually as Opus judge)
# Scale: 1-5. 5 = indistinguishable from expert output.
# ---------------------------------------------------------------------------
judge_scores = {
    "abacus-ai": {
        "business_type_accuracy": 1,  # Wrong verticals: mfg/finance vs Fortune 500 enterprises/analytics
        "decision_maker_accuracy": 2,  # "analytics managers" too junior; buyers are CTOs, heads of data
        "label_normalization": 3,      # Readable but less crisp than GT abbreviations
        "format_compliance": 5,        # Programmatic: all checks pass
    },
    "bartos-industries": {
        "business_type_accuracy": 5,  # Exact match: automotive OEMs and aerospace manufacturers
        "decision_maker_accuracy": 3,  # Procurement right; "mfg engineers" vs supply chain directors
        "label_normalization": 4,      # Casual, clean titles
        "format_compliance": 5,
    },
    "dbs-building-solutions": {
        "business_type_accuracy": 4,  # "hospital systems" slightly broad vs "medical facilities"
        "decision_maker_accuracy": 4,  # "ops managers" vs "ops directors" — same role, slight seniority gap
        "label_normalization": 4,      # Casual, matches GT register
        "format_compliance": 5,
    },
    "dealer-teamwork": {
        "business_type_accuracy": 4,  # "independent rooftops" is good industry jargon
        "decision_maker_accuracy": 3,  # Missed "GMs" abbreviation; "marketing directors" vs "dealer marketing managers"
        "label_normalization": 3,      # Missed "GMs" — GT is more casual
        "format_compliance": 5,
    },
    "osp": {
        "business_type_accuracy": 4,  # "finance companies" vs "financial services companies" — minor delta
        "decision_maker_accuracy": 2,  # "compliance officers" wrong function; GT says IT directors
        "label_normalization": 3,      # Casual but wrong function limits usefulness
        "format_compliance": 5,
    },
    "roush-cleantech": {
        "business_type_accuracy": 2,  # Misses "municipal fleets" (core market); swaps in "regional logistics"
        "decision_maker_accuracy": 3,  # "ops directors" vs "transportation directors"
        "label_normalization": 4,      # Casual, clean
        "format_compliance": 5,
    },
    "title-one": {
        "business_type_accuracy": 2,  # "charter networks" off; misses "state education agencies"
        "decision_maker_accuracy": 4,  # "Title I directors" ≈ "federal programs directors" — same role
        "label_normalization": 4,      # Casual, handles "Title I" properly
        "format_compliance": 4,        # Capitals flag for "Title I" — correct proper noun but triggers check
    },
    "trx-services": {
        "business_type_accuracy": 2,  # "healthcare systems" wrong; GT says "industrial facilities"
        "decision_maker_accuracy": 3,  # "ops directors" vs "property managers"
        "label_normalization": 4,      # Casual, clean
        "format_compliance": 5,
    },
    "wisconsin-plastics": {
        "business_type_accuracy": 3,  # "consumer brands" vs "consumer goods manufacturers" — buyer vs maker
        "decision_maker_accuracy": 3,  # "supply chain directors" vs "product engineers" — wrong function
        "label_normalization": 4,      # Casual, clean
        "format_compliance": 5,
    },
}

rationales = {
    "abacus-ai": {
        "business_type_accuracy": "Abacus AI is cross-industry enterprise AI. Haiku picked specific verticals (mfg/finance) that are wrong — GT correctly says Fortune 500 enterprises and mid-market analytics companies.",
        "decision_maker_accuracy": "'Analytics managers' are practitioners without budget authority. Actual buyers are CTOs and heads of data who own the platform decision.",
        "label_normalization": "Titles are readable but less crisp than 'CTOs and heads of data'. 'Engineering directors' is formal vs GT's casual shorthand.",
    },
    "bartos-industries": {
        "business_type_accuracy": "Exact match. Correctly identified automotive OEMs and aerospace manufacturers — Bartos's two dominant customer segments.",
        "decision_maker_accuracy": "Procurement managers correct. 'Manufacturing engineers' evaluate specs but supply chain directors control vendor approvals and PO budgets.",
        "label_normalization": "Clean, casual throughout. Appropriate register.",
    },
    "dbs-building-solutions": {
        "business_type_accuracy": "'Multi-location corporate offices' adds detail not in GT. 'Hospital systems' is broader than 'medical facilities' — captures right sector at higher org level.",
        "decision_maker_accuracy": "'Operations managers' vs 'operations directors' — same function, slight seniority delta. Both plausible buyers for building maintenance.",
        "label_normalization": "Casual, appropriate register. Comparable quality to GT.",
    },
    "dealer-teamwork": {
        "business_type_accuracy": "'Independent rooftops' is authentic auto dealer jargon for single-location stores. Good. 'Multi-location dealer groups' maps to GT's 'franchise dealer groups'.",
        "decision_maker_accuracy": "Spelled out 'general managers' instead of abbreviating to 'GMs'. 'Marketing directors' is one level above typical 'dealer marketing managers' at rooftops.",
        "label_normalization": "Missed the 'GMs' abbreviation. 'Marketing directors' is more formal than GT's 'dealer marketing managers'.",
    },
    "osp": {
        "business_type_accuracy": "'Finance companies' vs 'financial services companies' — minor phrasing difference, same segment. Law firms correct.",
        "decision_maker_accuracy": "'Compliance officers' is entirely the wrong function. If OSP sells IT/office infrastructure, buyers are IT directors and office managers.",
        "label_normalization": "Titles are casual but since decision maker function is wrong, the casualness can't compensate.",
    },
    "roush-cleantech": {
        "business_type_accuracy": "Roush Cleantech's core market is public/institutional fleets. 'School districts' is partial but 'regional logistics companies' replaces 'municipal fleets' — the primary segment. Significant miss.",
        "decision_maker_accuracy": "Fleet managers correct. 'Operations directors' is generic; the actual role at municipalities/school districts is 'transportation director'.",
        "label_normalization": "Casual, clean. Good register throughout.",
    },
    "title-one": {
        "business_type_accuracy": "'Charter networks' is a small slice; 'state education agencies' (state-level federal fund coordinators) are a key buyer. Title I school districts is too narrow — company targets all K-12.",
        "decision_maker_accuracy": "'Title I directors' is a valid alternate name for 'federal programs directors' — functionally same role in most districts.",
        "label_normalization": "'Title I' as proper noun handled correctly. Casual, appropriate.",
    },
    "trx-services": {
        "business_type_accuracy": "TRX serves commercial office buildings and industrial/manufacturing facilities. 'Healthcare systems' is not a core market — missed 'industrial facilities' entirely.",
        "decision_maker_accuracy": "'Facility managers' exact match. 'Operations directors' is too generic; property managers control vendor contracts for buildings.",
        "label_normalization": "Casual, clean throughout.",
    },
    "wisconsin-plastics": {
        "business_type_accuracy": "'Consumer brands' conflates brand owners with manufacturers. Wisconsin Plastics customers are consumer goods manufacturers who need plastic components — not brand holders.",
        "decision_maker_accuracy": "'Supply chain directors' manage logistics; 'product engineers' spec plastic components and drive vendor selection. Wrong function.",
        "label_normalization": "Casual, clean throughout.",
    },
}

# format_compliance was already run programmatically in v001-raw.json generation
# These match the programmatic output above (re-confirming)
format_compliance_notes = {
    "title-one": ["businessTypes has unexpected capitals: 'Title I school districts and charter networks'",
                  "decisionMakers has unexpected capitals: 'superintendents and Title I directors'"],
}


def main():
    raw = json.loads(RAW_FILE.read_text())
    gt_map = {p.stem: json.loads(p.read_text()) for p in sorted(GT_DIR.glob("*.json"))}
    haiku_map = {r["input_id"]: r for r in raw["results"]}

    per_input = []
    dim_totals = {d: 0.0 for d in WEIGHTS}

    for input_id in sorted(gt_map.keys()):
        gt = gt_map[input_id]
        raw_result = haiku_map.get(input_id, {})
        haiku_output = raw_result.get("haiku_output")
        split = gt["split"]

        print(f"\n=== Scoring: {input_id} ({split}) ===")

        scores = judge_scores[input_id]
        weighted = sum((scores[d] - 1) / 4 * WEIGHTS[d] for d in WEIGHTS)

        for d in WEIGHTS:
            normalized = (scores[d] - 1) / 4
            print(f"  {d}: {scores[d]}/5 -> {normalized:.3f}")
            dim_totals[d] += normalized

        print(f"  weighted_score: {weighted:.4f}")

        per_input.append({
            "input_id": input_id,
            "split": split,
            "weighted_score": round(weighted, 4),
            "dimensions": {
                d: {"score": scores[d], "normalized": round((scores[d] - 1) / 4, 4)}
                for d in WEIGHTS
            },
            "haiku_output": haiku_output,
            "ground_truth": gt["ground_truth"],
            "rationale": rationales.get(input_id, {}),
            "format_compliance_failures": format_compliance_notes.get(input_id, []),
        })

    n = len(per_input)
    train_items = [p for p in per_input if p["split"] == "train"]
    val_items = [p for p in per_input if p["split"] == "val"]

    overall = round(sum(p["weighted_score"] for p in per_input) / n, 4)
    train_avg = round(sum(p["weighted_score"] for p in train_items) / len(train_items), 4)
    val_avg = round(sum(p["weighted_score"] for p in val_items) / len(val_items), 4)
    dim_avgs = {d: round(dim_totals[d] / n, 4) for d in WEIGHTS}

    output = {
        "prompt_version": "v001",
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "config": {
            "target_model": "haiku",
            "judge": "opus-manual",
            "normalization": "(score - 1) / 4",
        },
        "aggregate": {
            "overall_score": overall,
            "train_score": train_avg,
            "validation_score": val_avg,
            "dimension_averages": dim_avgs,
        },
        "per_input": per_input,
    }

    OUT_FILE.write_text(json.dumps(output, indent=2))

    print(f"\n=== SCORES ===")
    print(f"Overall: {overall:.4f}, Train: {train_avg:.4f}, Val: {val_avg:.4f}")
    print(f"Dimension averages: {dim_avgs}")
    for p in per_input:
        print(f"  {p['input_id']}: {p['weighted_score']:.4f} ({p['split']})")
    print(f"\nOutput written to: {OUT_FILE}")


if __name__ == "__main__":
    main()
