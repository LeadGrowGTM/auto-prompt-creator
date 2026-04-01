import json
from datetime import datetime, timezone

judge_runs = {
    "abacus-ai": {
        "accuracy": [4, 4, 4],
        "label_normalization": [2, 2, 2],
        "completeness": [5, 5, 5],
        "specificity": [4, 4, 3]
    },
    "bartos-industries": {
        "accuracy": [4, 4, 5],
        "label_normalization": [3, 3, 3],
        "completeness": [5, 5, 5],
        "specificity": [3, 4, 3]
    },
    "dbs-building-solutions": {
        "accuracy": [3, 3, 2],
        "label_normalization": [3, 4, 3],
        "completeness": [5, 5, 5],
        "specificity": [3, 3, 4]
    },
    "dealer-teamwork": {
        "accuracy": [4, 4, 4],
        "label_normalization": [3, 3, 3],
        "completeness": [5, 5, 5],
        "specificity": [4, 3, 4]
    },
    "osp": {
        "accuracy": [2, 2, 2],
        "label_normalization": [3, 3, 3],
        "completeness": [4, 4, 5],
        "specificity": [4, 4, 4]
    },
    "roush-cleantech": {
        "accuracy": [4, 3, 4],
        "label_normalization": [4, 5, 4],
        "completeness": [5, 5, 5],
        "specificity": [3, 4, 3]
    },
    "title-one": {
        "accuracy": [3, 3, 3],
        "label_normalization": [4, 4, 4],
        "completeness": [5, 5, 5],
        "specificity": [3, 3, 2]
    },
    "trx-services": {
        "accuracy": [4, 5, 4],
        "label_normalization": [2, 2, 3],
        "completeness": [4, 5, 4],
        "specificity": [5, 4, 5]
    },
    "wisconsin-plastics": {
        "accuracy": [2, 3, 2],
        "label_normalization": [2, 2, 3],
        "completeness": [5, 5, 5],
        "specificity": [4, 4, 4]
    }
}

rationales = {
    "abacus-ai": {
        "accuracy": "icp_fit correct (weak). Industry AI/ML platforms very close to GT. DMs are formal titles (VP of Sales etc) vs GT casual (CTOs, engineering leads). Size and reasoning correct.",
        "label_normalization": "VP of Sales, VP of Marketing, Sales Development Manager are all formal title-case. GT uses CTOs, engineering leads, data team managers.",
        "completeness": "All 6 required fields present with substantive values.",
        "specificity": "Good company-specific details: Fortune 500 procurement, DataRobot/H2O.ai competition, long sales cycles."
    },
    "bartos-industries": {
        "accuracy": "icp_fit correct (strong). Fixed from v002. Industry metal fabrication close to GT precision manufacturing. DMs overlap partially. Reasoning strong.",
        "label_normalization": "VP Sales borderline casual. Operations Manager formal. CEO fine. GT has more casual quoting team leads.",
        "completeness": "All fields present with substantive values.",
        "specificity": "5-day quotes, OEM suppliers. But all three pain points about same quoting issue. GT has more diversity (aerospace specs, two-plant scaling)."
    },
    "dbs-building-solutions": {
        "accuracy": "icp_fit REGRESSED (moderate vs strong GT). Haiku read operational pain as disqualifying despite prompt saying it doesn't. B2B service + $28M + commercial buyers should be strong.",
        "label_normalization": "Sales VP, Regional Manager, Operations Director -- decent casual. Industry still verbose with 'and facility maintenance'.",
        "completeness": "All fields present with substantive values.",
        "specificity": "References 340+ headcount, QA scaling, territory expansion. Misses ServiceTitan mention."
    },
    "dealer-teamwork": {
        "accuracy": "icp_fit correct (weak). Fixed from v002 moderate. SaaS blocking factor working correctly here. Industry and reasoning good.",
        "label_normalization": "VP Sales borderline, Sales Development Director formal, CMO fine as casual acronym.",
        "completeness": "All fields present with substantive values.",
        "specificity": "Mentions Dealer.com, CDK competitors. Company-specific competition and scaling challenges."
    },
    "osp": {
        "accuracy": "icp_fit wrong (strong vs moderate GT). Prompt's positive criteria trigger: B2B service + sales pain (spreadsheets) + commercial buyers. But GT says too small for high-ROI outbound.",
        "label_normalization": "Sales Manager, Operations Director -- formal title-case. GT uses sales managers, ops leads, the owner.",
        "completeness": "All fields present. Only 2 DMs instead of 3.",
        "specificity": "Excellent: spreadsheet tracking, 20% YoY growth, sales capacity. Company-specific."
    },
    "roush-cleantech": {
        "accuracy": "icp_fit correct (moderate). Fixed from v002 weak. Government buyer downgrade working. DMs are company-side sales roles, not buyer-side per GT.",
        "label_normalization": "All lowercase casual: sales directors, business development managers, account executives. Good style.",
        "completeness": "All fields present with substantive values.",
        "specificity": "RFP cycles, multi-segment buyer dynamics. Misses propane autogas vs EV education challenge."
    },
    "title-one": {
        "accuracy": "icp_fit correct (weak). Industry matches GT. DMs are buyer-side (superintendent etc) not company-side (the founder, lead consultants). Size correct.",
        "label_normalization": "All lowercase good casual style. But wrong personas (buyer-side not company-side).",
        "completeness": "All fields present with substantive values.",
        "specificity": "Describes buyer needs not company sales challenges. GT focuses on no sales function, founder overload, revenue under $2M."
    },
    "trx-services": {
        "accuracy": "icp_fit correct (strong). Fixed from v002 regression. Industry matches GT. Positive criteria working here. Reasoning solid.",
        "label_normalization": "Sales Manager, Operations Manager are formal title-case. GT uses ops managers, service directors, branch managers.",
        "completeness": "All fields present. Only 2 DMs.",
        "specificity": "Excellent: 12-15% follow-up loss, legacy ERP, 6 metro areas, upsell coordination."
    },
    "wisconsin-plastics": {
        "accuracy": "icp_fit overcorrected (strong vs moderate GT). Positive criteria triggered too eagerly. Capacity constraints mean more leads won't help yet. GT says moderate.",
        "label_normalization": "Owner/CEO compound formal, Sales Director formal, Operations Manager formal. GT uses VP of sales, plant manager, biz dev leads.",
        "completeness": "All fields present with substantive values.",
        "specificity": "Capacity constraints, trade show reliance, margin optimization. Good company-specific details."
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

with open("scenarios/icp-classification/evals/v003-raw.json") as f:
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
    "prompt_version": "v003",
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

with open("scenarios/icp-classification/evals/v003.json", "w") as f:
    json.dump(result, f, indent=2)

print(f"Overall: {overall_score:.4f}, Train: {train_score:.4f}, Val: {val_score:.4f}")
print(f"Dimension averages: {dim_averages}")
print(f"Inputs: {len(per_input)}")
for p in per_input:
    print(f"  {p['input_id']}: {p['weighted_score']:.4f} ({p['split']})")
