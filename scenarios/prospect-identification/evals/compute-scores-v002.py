#!/usr/bin/env python3
"""
compute-scores-v002.py
Score haiku v002 outputs for prospect-identification.

Judge runs executed manually (Opus judge inline, triple consistent scores).
Normalization: (score - 1) / 4  (maps 1-5 -> 0-1)

v002 mutation: added 3-question reasoning step before output.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

BASE = Path("scenarios/prospect-identification")
RAW_FILE = BASE / "evals/v002-raw.json"
GT_DIR = BASE / "ground-truth"
OUT_FILE = BASE / "evals/v002.json"

WEIGHTS = {
    "business_type_accuracy": 0.35,
    "decision_maker_accuracy": 0.35,
    "label_normalization": 0.20,
    "format_compliance": 0.10,
}

judge_scores = {
    "abacus-ai": {
        "business_type_accuracy": 2,  # Got "Fortune 500" right but still picks specific verticals (finance/mfg) instead of analytics
        "decision_maker_accuracy": 4,  # "CTOs and chief data officers" -- very close to GT "CTOs and heads of data"
        "label_normalization": 3,      # "chief data officers" spelled out; GT uses casual "heads of data"
        "format_compliance": 4,        # "Fortune" flags as title case (proper noun but triggers check)
    },
    "bartos-industries": {
        "business_type_accuracy": 3,  # Regressed: "automotive suppliers" != "automotive OEMs" -- suppliers are Bartos, not customers
        "decision_maker_accuracy": 5,  # Exact match: procurement managers and supply chain directors
        "label_normalization": 4,      # Casual, clean
        "format_compliance": 5,
    },
    "dbs-building-solutions": {
        "business_type_accuracy": 4,  # "multi-location office buildings and medical facilities" -- close to GT
        "decision_maker_accuracy": 4,  # "facilities managers and operations directors" -- minor plural form diff
        "label_normalization": 4,      # Casual, matches GT register
        "format_compliance": 5,
    },
    "dealer-teamwork": {
        "business_type_accuracy": 3,  # "dealership groups and independent dealerships" -- lost "automotive" specificity and "rooftops" jargon
        "decision_maker_accuracy": 3,  # Still says "general managers" not "GMs"; "marketing directors" not "dealer marketing managers"
        "label_normalization": 3,      # Still missing "GMs" abbreviation
        "format_compliance": 5,
    },
    "osp": {
        "business_type_accuracy": 5,  # Exact match: mid-size law firms and financial services companies
        "decision_maker_accuracy": 3,  # "office managers" right; "finance directors" vs "IT directors" -- still wrong function
        "label_normalization": 4,      # Casual, clean
        "format_compliance": 5,
    },
    "roush-cleantech": {
        "business_type_accuracy": 3,  # "municipal fleets" now correct; "logistics companies" still misses "school district transportation"
        "decision_maker_accuracy": 3,  # "fleet managers" exact; "operations directors" vs "transportation directors"
        "label_normalization": 4,      # Casual, clean
        "format_compliance": 5,
    },
    "title-one": {
        "business_type_accuracy": 3,  # "K-12 public school districts" now correct; "charter networks" still misses "state education agencies"
        "decision_maker_accuracy": 2,  # Regression: "directors of instruction" (curriculum) and "assistant superintendents" -- wrong DMs
        "label_normalization": 3,      # "directors of instruction" is valid but missed the casual superintendent/federal programs framing
        "format_compliance": 5,        # "K-12" passes (single-char prefix before hyphen)
    },
    "trx-services": {
        "business_type_accuracy": 2,  # "commercial property operators" vague; "multifamily companies" wrong (residential vs industrial)
        "decision_maker_accuracy": 5,  # Exact match: facility managers and property managers
        "label_normalization": 4,      # Casual, clean
        "format_compliance": 5,
    },
    "wisconsin-plastics": {
        "business_type_accuracy": 3,  # "consumer product brands" still conflates brand with manufacturer; "medical device companies" right
        "decision_maker_accuracy": 3,  # "sourcing directors" ~ "procurement managers" (same function); "operations managers" still wrong
        "label_normalization": 4,      # Casual, clean
        "format_compliance": 5,
    },
}

rationales = {
    "abacus-ai": {
        "business_type_accuracy": "Reasoning step got 'Fortune 500' right but Haiku still picked specific verticals (financial services + manufacturers). GT is cross-industry: Fortune 500 enterprises and mid-market analytics companies.",
        "decision_maker_accuracy": "CTOs exact match. 'Chief data officers' is the formal title for 'heads of data' -- correct function, slight formality gap.",
        "label_normalization": "'Chief data officers' spelled out instead of 'CDOs' or GT's casual 'heads of data'. Reasoning step didn't improve casualness.",
    },
    "bartos-industries": {
        "business_type_accuracy": "Regression: 'automotive suppliers' means companies that supply parts -- Bartos IS a supplier, selling TO OEMs. The customer is OEMs, not fellow suppliers.",
        "decision_maker_accuracy": "Exact match on both titles -- procurement managers and supply chain directors. Reasoning step worked perfectly here.",
        "label_normalization": "Clean, casual throughout.",
    },
    "dbs-building-solutions": {
        "business_type_accuracy": "'Multi-location office buildings and medical facilities' -- added 'multi-location' detail, otherwise comparable to GT.",
        "decision_maker_accuracy": "'Facilities managers' (plural form) vs GT 'facility managers'. Both are correct -- minor grammatical variation.",
        "label_normalization": "Appropriate register throughout.",
    },
    "dealer-teamwork": {
        "business_type_accuracy": "'Dealership groups and independent dealerships' -- lost the excellent 'independent rooftops' industry jargon from v001. Dropped 'automotive' specificity.",
        "decision_maker_accuracy": "Still spelling out 'general managers' not 'GMs'. 'Marketing directors' is still one level above actual 'dealer marketing managers'.",
        "label_normalization": "Casualness regression from v001 -- the reasoning step made the output more generic, not more casual.",
    },
    "osp": {
        "business_type_accuracy": "Exact match. Reasoning step correctly identified the customer types.",
        "decision_maker_accuracy": "Office managers correct. 'Finance directors' is wrong function -- if OSP is IT/managed services, IT directors sign the contract, not finance directors.",
        "label_normalization": "Clean and casual throughout.",
    },
    "roush-cleantech": {
        "business_type_accuracy": "Reasoning step got 'municipal fleets' -- the primary segment. But 'logistics companies' is still wrong for second type; GT says 'school district transportation'.",
        "decision_maker_accuracy": "'Fleet managers' exact. 'Operations directors' is adjacent but 'transportation directors' is the specific title at municipalities and school districts.",
        "label_normalization": "Clean, casual throughout.",
    },
    "title-one": {
        "business_type_accuracy": "Improvement: K-12 is now right. But 'charter networks' still misses the more important 'state education agencies' buyer segment.",
        "decision_maker_accuracy": "Regression: reasoning step led to 'directors of instruction' (curriculum leader) and 'assistant superintendents' -- neither has the budget authority that superintendents and federal programs directors do.",
        "label_normalization": "'Directors of instruction' is valid education jargon but misses the GT framing.",
    },
    "trx-services": {
        "business_type_accuracy": "'Commercial property operators' is vague. 'Multifamily companies' (apartment buildings) is wrong -- TRX serves commercial/industrial, not residential.",
        "decision_maker_accuracy": "Exact match: facility managers and property managers. The reasoning step correctly identified the actual buyers.",
        "label_normalization": "Casual, clean throughout.",
    },
    "wisconsin-plastics": {
        "business_type_accuracy": "'Consumer product brands' still the brand-vs-manufacturer confusion. 'Medical device companies' is correct.",
        "decision_maker_accuracy": "'Sourcing directors' is functionally same as 'procurement managers' -- close. 'Operations managers' still wrong; should be 'product engineers' who spec components.",
        "label_normalization": "Casual, clean.",
    },
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
        })

    n = len(per_input)
    train_items = [p for p in per_input if p["split"] == "train"]
    val_items = [p for p in per_input if p["split"] == "val"]

    overall = round(sum(p["weighted_score"] for p in per_input) / n, 4)
    train_avg = round(sum(p["weighted_score"] for p in train_items) / len(train_items), 4)
    val_avg = round(sum(p["weighted_score"] for p in val_items) / len(val_items), 4)
    dim_avgs = {d: round(dim_totals[d] / n, 4) for d in WEIGHTS}

    output = {
        "prompt_version": "v002",
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
