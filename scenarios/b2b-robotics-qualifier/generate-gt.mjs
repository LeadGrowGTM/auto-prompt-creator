#!/usr/bin/env bun
/**
 * Generate ground truth files from test-data.json
 */
import { readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";

const BASE = resolve(import.meta.dir);
const testData = JSON.parse(readFileSync("C:/Users/mitch/Everything_CC/leadgrow-hq/prompts/b2b-robotics-qualifier/test-data.json", "utf-8"));

for (const item of testData) {
  let split;
  if (item.id <= 30) split = "train";
  else if (item.id <= 45) split = "val";
  else split = "holdout";

  const gt = {
    id: String(item.id).padStart(3, "0"),
    domain: item.domain,
    split,
    input: {
      description: item.description
    },
    ground_truth: {
      is_b2b: item.expected.is_b2b,
      robotics_equipment_score: item.expected.robotics_equipment_score,
      qualified: item.expected.qualified
    }
  };

  const filename = String(item.id).padStart(3, "0") + "-" + item.domain.replace(/\./g, "-") + ".json";
  writeFileSync(join(BASE, "ground-truth", filename), JSON.stringify(gt, null, 2) + "\n");
}

console.log(`Generated ${testData.length} ground truth files`);
