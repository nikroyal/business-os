import { describe, it, expect } from "vitest";
import { AIModelRegistry } from "../src/aiModelRegistry";

describe("AI Response Normalization Layer & Safe Parsing Tests", () => {
  
  it("Scenario 1: parses valid JSON response directly", () => {
    const raw = `{"response": "Hello world", "metadata": {"confidenceScore": 95, "dataFreshness": "Live"}}`;
    const parsed = AIModelRegistry.extractAndParseJson(raw);
    expect(parsed.response).toBe("Hello world");
    expect(parsed.metadata.confidenceScore).toBe(95);
  });

  it("Scenario 2 & 3 & 15: handles plain-text / markdown response directly for natural-language tasks", () => {
    const rawText = "## Factual Data\nHere is the factual data requested. No JSON here.";
    const normalized = AIModelRegistry.normalizeAIResponse(rawText, "Copilot");
    expect(normalized.response).toBe(rawText);
    expect(normalized.metadata.confidenceScore).toBe(90); // default fallback
  });

  it("Scenario 4: extracts JSON from inside ```json fences", () => {
    const raw = "Here is the result:\n```json\n{\n  \"response\": \"Fenced JSON\"\n}\n```\nHope that helps!";
    const parsed = AIModelRegistry.extractAndParseJson(raw);
    expect(parsed.response).toBe("Fenced JSON");
  });

  it("Scenario 5: handles and repairs malformed JSON with single quotes", () => {
    const raw = "{'response': 'Single quotes value', 'number': 42}";
    const parsed = AIModelRegistry.extractAndParseJson(raw);
    expect(parsed.response).toBe("Single quotes value");
    expect(parsed.number).toBe(42);
  });

  it("Scenario 6: repairs and parses truncated JSON missing closing brackets/braces", () => {
    const raw = `{"response": "Truncated response", "list": [1, 2, 3`;
    const parsed = AIModelRegistry.extractAndParseJson(raw);
    expect(parsed.response).toBe("Truncated response");
    expect(parsed.list).toEqual([1, 2, 3]);
  });

  it("Scenario 7 & 8 & 9: detects raw formats correctly", () => {
    expect(AIModelRegistry.detectFormat("{\n}")).toBe("json");
    expect(AIModelRegistry.detectFormat("## Header")).toBe("markdown");
    expect(AIModelRegistry.detectFormat("```json\n{}```")).toBe("markdown_fenced");
    expect(AIModelRegistry.detectFormat("Plain text")).toBe("text");
  });

  it("Scenario 12: structured-output normalization fallback when JSON parsing fails completely", () => {
    const rawText = "Some completely random unstructured text response.";
    const normalized = AIModelRegistry.normalizeAIResponse(rawText, "Editorial Commentary");
    expect(normalized.executiveSummary).toBe(rawText);
    expect(normalized.portfolioCommentary).toBe("No portfolio analysis available.");
  });

  it("Scenario 15: Explicitly reproduces the production failure with ## Factual Data", () => {
    const rawText = "## Factual Data\n* Apple holds strong solvency indicators.";
    // Should NOT crash and throw Unexpected token '#', but normalize safely.
    const normalized = AIModelRegistry.normalizeAIResponse(rawText, "Copilot");
    expect(normalized.response).toBe(rawText);
  });

  it("Repairs truncated string values inside JSON", () => {
    const raw = `{"response": "Hello world`;
    const parsed = AIModelRegistry.extractAndParseJson(raw);
    expect(parsed.response).toBe("Hello world");
  });
});
