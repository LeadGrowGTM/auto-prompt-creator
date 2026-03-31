import json
from datetime import datetime, timezone

judge_runs = {
    "abacus-ai": {
        "accuracy": [4, 4, 4],
        "label_normalization": [2, 3, 2],
        "completeness": [5, 5, 5],
        "specificity": [3, 3, 3]
    },
    "bartos-industries": {
        "accuracy": [3, 3, 2],
        "label_normalization": [4, 4, 4],
        "completeness": [5, 5, 5],
        "specificity": [4, 4, 3]
    },
    "dbs-building-solutions": {
        "accuracy": [4, 4, 4],
        "label_normalization": [3, 4, 3],
        "completeness": [5, 5, 5],
        "specificity": [3, 3, 3]
    },
    "dealer-teamwork": {
        "accuracy": [3, 3, 3],
        "label_normalization": [3, 3, 2],
        "completeness": [5, 5, 5],
        "specificity": [3, 3, 4]
    },
    "osp": {
        "accuracy": [2, 2, 3],
        "label_normalization": [4, 4, 4],
        "completeness": [5, 5, 5],
        "specificity": [3, 3, 3]
    },
    "roush-cleantech": {
        "accuracy": [3, 3, 3],
        "label_normalization": [4, 4, 4],
        "completeness": [5, 5, 5],
        "specificity": [3, 3, 2]
    },
    "title-one": {
        "accuracy": [3, 3, 3],
        "label_normalization": [3, 3, 3],
        "completeness": [5, 5, 5],
        "specificity": [4, 4, 4]
    },
    "trx-services": {
        "accuracy": [2, 2, 2],
        "label_normalization": [2, 3, 2],
        "completeness": [5, 5, 5],
        "specificity": [5, 4, 4]
    },
    "wisconsin-plastics": {
        "accuracy": [3, 3, 2],
        "label_normalization": [3, 3, 3],
        "completeness": [5, 5, 5],
        "specificity": [4, 4, 4]
    }
}

rationales = {
    "abacus-ai": {
        "accuracy": "icp_fit correct (weak). Industry 'machine learning platforms' close to GT 'AI/ML platform'. DMs VP of Engineering/Director of Analytics are reasonable tech buyer roles but more formal than GT CTOs/engineering leads.",
        "label_normalization": "VP of Engineering and Director of Analytics are formal title-case. GT uses casual CTOs, engineering leads, data team managers.",
        "completeness": "All 6 required fields present with substantive values.",
        "specificity": "Pain points are reasonable but miss key competitive details (DataRobot, Fortune 500 selling motion). More generic than GT."
    },
    "bartos-industries": {
        "accuracy": "icp_fit wrong (moderate vs strong). Industry precision metal fabrication close to GT precision manufacturing. DMs partially overlap (plant manager matches). Reasoning about operational pain being primary is a reasonable misread.",
        "label_normalization": "Good casual lowercase style: sales VP, operations VP, plant manager. Natural labels.",
        "completeness": "All fields present with substantive values.",
        "specificity": "Good specific details: 5-day quote turnaround, competitor speed pressure. But narrowly focused on quoting, missing two-plant scaling."
    },
    "dbs-building-solutions": {
        "accuracy": "icp_fit correct (strong). Industry commercial cleaning and facility maintenance close to GT commercial cleaning. DMs partial overlap: regional manager matches, but sales director and owner differ from GT ops directors/facility managers.",
        "label_normalization": "Industry label slightly verbose ('and facility maintenance'). Titles are casual. Mostly good.",
        "completeness": "All fields present with substantive values.",
        "specificity": "Pain points are directionally right but more generic than GT. Misses ServiceTitan mention and 340-person headcount specifics."
    },
    "dealer-teamwork": {
        "accuracy": "icp_fit wrong (moderate vs weak). Closer than v001 but still not matching GT weak classification. DMs partially match GT CEO, but Head of Marketing and Founder/CEO are formal.",
        "label_normalization": "Head of Marketing and Founder/CEO are formal title-case. VP Sales is borderline casual.",
        "completeness": "All 6 fields present with substantive values.",
        "specificity": "Mentions Dealer.com, CDK competitors and 300+ dealerships. Company-specific."
    },
    "osp": {
        "accuracy": "icp_fit wrong (strong vs moderate). DMs are wrong personas: office manager and compliance officer are buyer-side roles, not company-side sales roles. GT has sales managers, ops leads, the owner.",
        "label_normalization": "Good casual lowercase throughout. Direct industry label.",
        "completeness": "All fields present with substantive values.",
        "specificity": "Pain points focus on service delivery (print, HIPAA compliance) rather than the sales/growth challenge that GT highlights."
    },
    "roush-cleantech": {
        "accuracy": "icp_fit overcorrected (weak vs moderate). GT says moderate because there's still some outbound potential, just limited. Reasoning about RFP processes is correct but conclusion too harsh. DMs very close to GT.",
        "label_normalization": "Good casual style: fleet managers, procurement directors, sustainability officers. Close to GT fleet directors, procurement managers, sustainability leads.",
        "completeness": "All fields present with substantive values.",
        "specificity": "Pain points are generic fleet/emissions concerns. Misses specific government contract dynamics and propane autogas vs EV education challenge."
    },
    "title-one": {
        "accuracy": "icp_fit correct (weak). Industry school consulting close to GT education consulting. DMs are buyer-side (federal programs directors, superintendents) not company-side (the founder, lead consultants).",
        "label_normalization": "Titles are reasonable but don't match GT casual style. Federal programs directors is natural though.",
        "completeness": "All fields present with substantive values.",
        "specificity": "Good specifics: Title I compliance, 3 states, no sales team. Reasoning is strong."
    },
    "trx-services": {
        "accuracy": "icp_fit wrong and regressed (moderate vs strong). This was correct in v001 (strong). The blocking factor rules caused overcaution. DMs partial overlap but formal title-case.",
        "label_normalization": "Owner, Service Manager, Sales Manager are title-case formal. GT uses lowercase ops managers, service directors, branch managers.",
        "completeness": "All fields present with substantive values.",
        "specificity": "Excellent specificity: 12-15% follow-up loss, 6 metro areas, legacy ERP. Company-specific."
    },
    "wisconsin-plastics": {
        "accuracy": "icp_fit overcorrected (weak vs moderate). Capacity constraint rule triggered too aggressively. GT says moderate because the growth potential is real despite constraints. DMs partial overlap.",
        "label_normalization": "owner/founder OK, but operations manager and business development manager are formal title-case. GT uses VP of sales, plant manager, business development leads.",
        "completeness": "All fields present with substantive values.",
        "specificity": "Good specifics: capacity constraints, trade show reliance, pipeline visibility gap."
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

with open("scenarios/icp-classification/evals/v002-raw.json") as f:
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
    "prompt_version": "v002",
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

with open("scenarios/icp-classification/evals/v002.json", "w") as f:
    json.dump(result, f, indent=2)

print(f"Overall: {overall_score:.4f}, Train: {train_score:.4f}, Val: {val_score:.4f}")
print(f"Dimension averages: {dim_averages}")
print(f"Inputs: {len(per_input)}")
for p in per_input:
    print(f"  {p['input_id']}: {p['weighted_score']:.4f} ({p['split']})")
