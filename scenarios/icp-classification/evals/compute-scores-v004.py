import json
from datetime import datetime, timezone

judge_runs = {
    "abacus-ai": {
        "accuracy": [4, 3, 4],
        "label_normalization": [5, 4, 5],
        "completeness": [5, 5, 5],
        "specificity": [4, 4, 4]
    },
    "bartos-industries": {
        "accuracy": [5, 4, 5],
        "label_normalization": [5, 5, 5],
        "completeness": [5, 5, 5],
        "specificity": [4, 3, 4]
    },
    "dbs-building-solutions": {
        "accuracy": [5, 4, 5],
        "label_normalization": [5, 5, 5],
        "completeness": [5, 5, 5],
        "specificity": [3, 3, 2]
    },
    "dealer-teamwork": {
        "accuracy": [4, 4, 3],
        "label_normalization": [5, 5, 5],
        "completeness": [5, 5, 5],
        "specificity": [4, 3, 4]
    },
    "osp": {
        "accuracy": [5, 5, 4],
        "label_normalization": [5, 5, 5],
        "completeness": [5, 5, 5],
        "specificity": [4, 4, 5]
    },
    "roush-cleantech": {
        "accuracy": [5, 4, 5],
        "label_normalization": [5, 5, 5],
        "completeness": [5, 5, 5],
        "specificity": [5, 4, 5]
    },
    "title-one": {
        "accuracy": [3, 3, 2],
        "label_normalization": [5, 5, 5],
        "completeness": [5, 4, 5],
        "specificity": [5, 5, 4]
    },
    "trx-services": {
        "accuracy": [5, 5, 5],
        "label_normalization": [5, 5, 5],
        "completeness": [5, 5, 5],
        "specificity": [5, 5, 5]
    },
    "wisconsin-plastics": {
        "accuracy": [5, 4, 5],
        "label_normalization": [4, 4, 4],
        "completeness": [5, 5, 5],
        "specificity": [4, 4, 4]
    }
}

rationales = {
    "abacus-ai": {
        "accuracy": "icp_fit correct (weak). Industry matches GT exactly. company_size wrong (startup vs SMB -- 85 employees is SMB). DMs close to GT in casual style.",
        "label_normalization": "Excellent casual lowercase: engineering directors, data science leaders, analytics directors. Very close to GT style.",
        "completeness": "All 6 required fields present with substantive values.",
        "specificity": "DataRobot/H2O competition, Fortune 500 deals, custom ML models. Company-specific."
    },
    "bartos-industries": {
        "accuracy": "icp_fit correct (strong). Industry close to GT. DMs excellent overlap. Reasoning captures quantified pain correctly.",
        "label_normalization": "Perfect casual: sales leads, operations directors, plant managers.",
        "completeness": "All fields present with substantive values.",
        "specificity": "5-day quotes, OEM buyers. Good but three pain points overlap on quoting theme."
    },
    "dbs-building-solutions": {
        "accuracy": "icp_fit correct (strong). Fixed from v003. Industry matches GT. DMs reasonable overlap. Reasoning captures budget signal.",
        "label_normalization": "Perfect casual: ops directors, sales leads, service directors.",
        "completeness": "All fields present with substantive values.",
        "specificity": "QA scaling, diverse accounts. But lighter than GT -- misses ServiceTitan, 340 employees, Midwest geography."
    },
    "dealer-teamwork": {
        "accuracy": "icp_fit correct (weak). company_size wrong (startup vs SMB -- 45 employees is SMB). Industry reasonable. Reasoning captures SaaS niche market issue.",
        "label_normalization": "Excellent casual: sales directors, growth leads, the founder.",
        "completeness": "All fields present with substantive values.",
        "specificity": "Dealer.com, CDK competitors. Company-specific but pain points somewhat generic."
    },
    "osp": {
        "accuracy": "icp_fit correct (moderate). Fixed from v003 (was strong). DMs very close to GT. Reasoning nails the 'too small' nuance.",
        "label_normalization": "Perfect casual: sales leads, ops directors, the founder. Near-identical to GT style.",
        "completeness": "All fields present with substantive values.",
        "specificity": "Spreadsheet tracking, manual follow-up, growth outpacing infrastructure. Excellent company-specific."
    },
    "roush-cleantech": {
        "accuracy": "icp_fit correct (moderate). DMs very close to GT. Industry close. Reasoning captures government/RFP limitation.",
        "label_normalization": "All lowercase casual: fleet directors, ops managers, procurement leads. Excellent.",
        "completeness": "All fields present with substantive values.",
        "specificity": "Government RFPs, propane and EV solutions, municipalities/school districts. Excellent."
    },
    "title-one": {
        "accuracy": "icp_fit wrong (moderate vs weak GT). Company is 15 employees, under $2M, government buyers, no sales function -- textbook weak. DMs excellent match to GT.",
        "label_normalization": "Excellent casual: the founder, ops lead. Very close to GT.",
        "completeness": "All fields present. 2 DMs appropriate for company size.",
        "specificity": "40 districts, 3 states, no sales function, founder bottleneck. Excellent company-specific."
    },
    "trx-services": {
        "accuracy": "icp_fit correct (strong). Industry close to GT. DMs excellent overlap. Reasoning perfect -- captures quantified pain and commercial buyers.",
        "label_normalization": "Perfect casual: service directors, operations leads, sales leads.",
        "completeness": "All fields present with substantive values.",
        "specificity": "12-15% follow-ups, 6 regions, legacy ERP. Excellent, near-GT quality."
    },
    "wisconsin-plastics": {
        "accuracy": "icp_fit correct (moderate). Fixed from v003. Industry matches GT. DMs reasonable. Reasoning nails capacity constraint nuance.",
        "label_normalization": "Mostly casual: founder, biz dev lead good. 'operations director' slightly formal but acceptable.",
        "completeness": "All fields present with substantive values.",
        "specificity": "Capacity constraints, trade shows, word-of-mouth. Good company-specific."
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

with open("scenarios/icp-classification/evals/v004-raw.json") as f:
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
    "prompt_version": "v004",
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

with open("scenarios/icp-classification/evals/v004.json", "w") as f:
    json.dump(result, f, indent=2)

print(f"Overall: {overall_score:.4f}, Train: {train_score:.4f}, Val: {val_score:.4f}")
print(f"Dimension averages: {dim_averages}")
print(f"Inputs: {len(per_input)}")
for p in per_input:
    print(f"  {p['input_id']}: {p['weighted_score']:.4f} ({p['split']})")
