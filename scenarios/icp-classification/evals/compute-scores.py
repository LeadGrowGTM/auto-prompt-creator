import json
from datetime import datetime, timezone

judge_runs = {
    "abacus-ai": {
        "accuracy": [2, 2, 2],
        "label_normalization": [3, 3, 4],
        "completeness": [5, 5, 5],
        "specificity": [3, 3, 3]
    },
    "bartos-industries": {
        "accuracy": [3, 3, 3],
        "label_normalization": [3, 3, 3],
        "completeness": [5, 5, 5],
        "specificity": [4, 4, 4]
    },
    "dbs-building-solutions": {
        "accuracy": [4, 4, 4],
        "label_normalization": [3, 3, 3],
        "completeness": [5, 5, 5],
        "specificity": [4, 4, 5]
    },
    "dealer-teamwork": {
        "accuracy": [3, 3, 3],
        "label_normalization": [4, 4, 4],
        "completeness": [5, 5, 5],
        "specificity": [4, 4, 3]
    },
    "osp": {
        "accuracy": [3, 3, 3],
        "label_normalization": [4, 4, 4],
        "completeness": [5, 5, 5],
        "specificity": [4, 4, 4]
    },
    "roush-cleantech": {
        "accuracy": [2, 2, 3],
        "label_normalization": [3, 3, 3],
        "completeness": [5, 5, 5],
        "specificity": [3, 3, 3]
    },
    "title-one": {
        "accuracy": [1, 1, 2],
        "label_normalization": [3, 3, 3],
        "completeness": [4, 4, 4],
        "specificity": [3, 3, 3]
    },
    "trx-services": {
        "accuracy": [4, 4, 4],
        "label_normalization": [4, 4, 4],
        "completeness": [5, 5, 5],
        "specificity": [5, 5, 4]
    },
    "wisconsin-plastics": {
        "accuracy": [4, 4, 4],
        "label_normalization": [4, 4, 4],
        "completeness": [5, 5, 5],
        "specificity": [4, 4, 3]
    }
}

rationales = {
    "abacus-ai": {
        "accuracy": "Industry and company size correct (AI/ML platform, SMB), but icp_fit is opposite (strong vs weak) and decision makers target wrong persona (sales/marketing vs technical leads).",
        "label_normalization": "Industry label matches well. VP of Sales and VP of Marketing lean formal compared to ground truth casual CTOs, engineering leads.",
        "completeness": "All 6 required fields present with substantive, multi-item arrays.",
        "specificity": "Pain points reference company-specific details (DataRobot, Fortune 500, enterprise deals) but miss the core insight about wrong buyer persona for ICP."
    },
    "bartos-industries": {
        "accuracy": "icp_fit wrong (moderate vs strong). Industry metal fabrication close to precision manufacturing but less specific. DMs partially overlap but miss plant managers and quoting leads.",
        "label_normalization": "Business Development Manager is too formal. Metal fabrication is casual but less precise than ground truth precision manufacturing.",
        "completeness": "All fields present with substantive values throughout.",
        "specificity": "Excellent company-specific details: 5-day quote turnaround, automotive/aerospace OEMs, ISO 9001 certification."
    },
    "dbs-building-solutions": {
        "accuracy": "icp_fit correct (strong), industry exact match (commercial cleaning), size correct (mid-market). DMs are plausible but different roles than ground truth.",
        "label_normalization": "Title-cased Operations Manager, Sales Manager are more formal than ground truth ops directors, facility managers.",
        "completeness": "All fields present with substantive, detailed values.",
        "specificity": "Highly specific: references 340-person headcount, three facility types, ServiceTitan dispatch, and $28M revenue baseline."
    },
    "dealer-teamwork": {
        "accuracy": "icp_fit wrong (moderate vs weak). Industry label similar but slightly different. CEO matches, other DMs are close but not exact.",
        "label_normalization": "Good casual style: lowercase VP sales, concise automotive marketing tech industry label.",
        "completeness": "All 6 fields present with substantive values.",
        "specificity": "References specific competitors (Dealer.com, CDK), 300+ dealerships, 45-employee team. Company-specific."
    },
    "osp": {
        "accuracy": "icp_fit wrong (strong vs moderate). Industry close but less precise (office services vs managed office services). DMs partially overlap.",
        "label_normalization": "Lowercase casual titles throughout. Simple, direct industry label.",
        "completeness": "All fields present with substantive values.",
        "specificity": "Mentions specific pain points: spreadsheet lead tracking, 20% YoY growth, law firm and financial services verticals."
    },
    "roush-cleantech": {
        "accuracy": "icp_fit wrong (strong vs moderate). Industry focuses on electrification vs broader clean energy. DMs list sales-side roles vs ground truth buyer-side roles.",
        "label_normalization": "Business development managers is too formal. Other labels reasonable but not as casual as ground truth.",
        "completeness": "All fields present with substantive values.",
        "specificity": "Mentions RFP cycles and municipalities but misses the core dynamic about government procurement making outbound less effective."
    },
    "title-one": {
        "accuracy": "icp_fit completely opposite (strong vs weak). Head of Sales fabricated -- the company has no sales function. Only industry label matches.",
        "label_normalization": "Founder/CEO and Head of Sales are formal title-case. Ground truth uses casual the founder, lead consultants.",
        "completeness": "All fields present but decision_makers has only 2 entries, thinner than typical.",
        "specificity": "References real details (3 states, 40 districts) but draws completely wrong conclusion about fit."
    },
    "trx-services": {
        "accuracy": "icp_fit correct (strong). Industry very close (commercial HVAC services vs commercial HVAC). DMs partially overlap with ops manager.",
        "label_normalization": "Lowercase casual throughout. Industry label slightly verbose but natural.",
        "completeness": "All fields present with substantive, detailed values.",
        "specificity": "Highly specific: 12-15% follow-up loss, 6 metro areas, legacy ERP coordination challenges, preventive maintenance renewals."
    },
    "wisconsin-plastics": {
        "accuracy": "icp_fit correct (moderate). Industry injection molding is a valid narrower synonym of plastics manufacturing. DMs partially overlap.",
        "label_normalization": "Good casual style: lowercase, concise labels. Injection molding and business development are natural.",
        "completeness": "All fields present with substantive values.",
        "specificity": "Company-specific: capacity constraints, word-of-mouth/trade show reliance, no structured pipeline."
    }
}

splits = {
    "abacus-ai": "train",
    "bartos-industries": "train",
    "dbs-building-solutions": "train",
    "dealer-teamwork": "train",
    "osp": "train",
    "roush-cleantech": "validation",
    "title-one": "validation",
    "trx-services": "validation",
    "wisconsin-plastics": "validation"
}

with open("scenarios/icp-classification/evals/v001-raw.json") as f:
    raw = json.load(f)

haiku_outputs = {r["input_id"]: r["haiku_output"] for r in raw["results"]}

weights = {"accuracy": 0.4, "label_normalization": 0.25, "completeness": 0.2, "specificity": 0.15}
dims = ["accuracy", "label_normalization", "completeness", "specificity"]

per_input = []
dim_totals = {d: 0.0 for d in dims}

input_order = ["abacus-ai", "bartos-industries", "dbs-building-solutions", "dealer-teamwork", "osp",
               "roush-cleantech", "title-one", "trx-services", "wisconsin-plastics"]

for input_id in input_order:
    runs = judge_runs[input_id]
    dimensions = {}
    weighted_score = 0.0

    for d in dims:
        scores = sorted(runs[d])
        median = scores[1]
        normalized = (median - 1) / 4
        dimensions[d] = {
            "median": median,
            "runs": runs[d],
            "normalized": round(normalized, 4)
        }
        weighted_score += normalized * weights[d]
        dim_totals[d] += normalized

    per_input.append({
        "input_id": input_id,
        "split": splits[input_id],
        "weighted_score": round(weighted_score, 4),
        "dimensions": dimensions,
        "haiku_output": haiku_outputs[input_id],
        "parse_failure": False,
        "judge_skipped": False,
        "judge_rationales": rationales[input_id]
    })

train_scores = [p["weighted_score"] for p in per_input if p["split"] == "train"]
val_scores = [p["weighted_score"] for p in per_input if p["split"] == "validation"]
all_scores = [p["weighted_score"] for p in per_input]

train_score = round(sum(train_scores) / len(train_scores), 4)
val_score = round(sum(val_scores) / len(val_scores), 4)
overall_score = round(sum(all_scores) / len(all_scores), 4)

dim_averages = {d: round(dim_totals[d] / 9, 4) for d in dims}

result = {
    "prompt_version": "v001",
    "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "config": {
        "target_model": "haiku",
        "judge_model": "opus",
        "judge_runs": 3,
        "rubric_version": 1,
        "normalization": "(score - 1) / 4"
    },
    "aggregate": {
        "overall_score": overall_score,
        "train_score": train_score,
        "validation_score": val_score,
        "dimension_averages": dim_averages,
        "inputs_evaluated": 9,
        "parse_failures": 0
    },
    "per_input": per_input,
    "failure_patterns": []
}

with open("scenarios/icp-classification/evals/v001.json", "w") as f:
    json.dump(result, f, indent=2)

print(f"Overall: {overall_score:.3f}, Train: {train_score:.3f}, Val: {val_score:.3f}")
print(f"Dimension averages: {dim_averages}")
print(f"Inputs: {len(per_input)}")
for p in per_input:
    print(f"  {p['input_id']}: {p['weighted_score']:.4f} ({p['split']})")
