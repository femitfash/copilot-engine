import { classifyProviderError } from "../src/engine/error-classifier";

const anthropicCreditError = {
  status: 400,
  error: {
    type: "error",
    error: {
      type: "invalid_request_error",
      message:
        "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.",
    },
  },
};

const openaiQuotaError = {
  status: 429,
  code: "insufficient_quota",
  error: {
    message: "You exceeded your current quota, please check your plan and billing details.",
    type: "insufficient_quota",
    code: "insufficient_quota",
  },
};

let failures = 0;

function assertCode(label: string, actual: string, expected: string): void {
  if (actual !== expected) {
    console.error(`FAIL: ${label} — expected "${expected}", got "${actual}"`);
    failures++;
  } else {
    console.log(`PASS: ${label} → ${actual}`);
  }
}

assertCode(
  "Anthropic 400 credit-balance error",
  classifyProviderError(anthropicCreditError, "anthropic").code,
  "insufficient_credits"
);

assertCode(
  "OpenAI 429 insufficient_quota error",
  classifyProviderError(openaiQuotaError, "openai").code,
  "insufficient_credits"
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll error-classifier checks passed.");
