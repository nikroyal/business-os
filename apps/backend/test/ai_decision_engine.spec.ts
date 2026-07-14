import { describe, it, expect } from "vitest";
import { AIOrchestrator, AIModelRegistry, FEATURE_REQUIREMENTS } from "../src/aiModelRegistry";

describe("BusinessOS Enterprise AI Decision Engine & Routing Regression Prevention Suite", () => {
  const models = AIOrchestrator.DEFAULT_MODELS;

  describe("PHASE 2 - MODEL REGISTRY v2 SSOT METADATA", () => {
    it("verify every model in registry describes itself with enterprise metadata", () => {
      expect(models.length).toBeGreaterThan(15);
      for (const model of models) {
        expect(model.id).toBeDefined();
        expect(model.displayName).toBeDefined();
        expect(model.provider).toBeDefined();
        expect(typeof model.contextWindow).toBe("number");
        expect(typeof model.maxOutput).toBe("number");
        expect(typeof model.enabled).toBe("boolean");
      }
    });
  });

  describe("PHASE 3 - DECLARATIVE FEATURE REQUIREMENTS", () => {
    it("verify all statutory BusinessOS features declare explicit AI requirements", () => {
      const features = [
        "Copilot",
        "Daily Email",
        "Research Engine",
        "Editorial Commentary",
        "Reports",
        "Opportunities",
        "Benchmarking",
        "Playground",
        "Embeddings",
        "Reranking"
      ];

      for (const fName of features) {
        const req = AIModelRegistry.getFeatureRequirements(fName);
        expect(req).toBeDefined();
        expect(req?.featureId).toBe(fName);
        expect(Array.isArray(req?.requiredCapabilities)).toBe(true);
        expect(req?.preferredTaskType).toBeDefined();
      }
    });
  });

  describe("PHASE 4 & 6 - MULTI-STAGE ROUTING ENGINE & EXPLAINABILITY", () => {
    it("evaluateModelsForTask produces complete explainable RoutingDecision", () => {
      const decision = AIOrchestrator.evaluateModelsForTask("copilot_conversation", models, {
        globalProviderPreference: "openrouter",
        freeFirstRouting: true
      }, "Copilot");

      expect(decision).toBeDefined();
      expect(decision.decisionId).toContain("dec_");
      expect(decision.task).toBe("copilot_conversation");
      expect(decision.winningModel).toBeDefined();
      expect(decision.winningModelDisplayName).toBeDefined();
      expect(decision.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(decision.confidenceScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(decision.candidateModels)).toBe(true);
      expect(Array.isArray(decision.rejectedModels)).toBe(true);
      expect(decision.explanation).toContain("Selected");
    });

    it("evaluates candidate scoring breakdown properly", () => {
      const decision = AIOrchestrator.evaluateModelsForTask("coding", models, {
        globalProviderPreference: "openrouter"
      });

      expect(decision.candidateModels.length).toBeGreaterThan(0);
      const top = decision.candidateModels[0];
      expect(top).toHaveProperty("compositeScore");
      expect(top.scoreBreakdown).toHaveProperty("qualityScore");
      expect(top.scoreBreakdown).toHaveProperty("reliabilityScore");
      expect(top.scoreBreakdown).toHaveProperty("speedScore");
      expect(top.scoreBreakdown).toHaveProperty("costScore");
    });
  });

  describe("PHASE 5 & 8 - HEALTH AWARENESS & BACKWARDS COMPATIBILITY", () => {
    it("filters out disabled or unhealthy models cleanly", () => {
      const mockModels = [
        {
          ...models[0],
          id: "mock-healthy",
          enabled: true,
          cooldownStatus: "healthy" as const
        },
        {
          ...models[0],
          id: "mock-cooldown",
          enabled: true,
          cooldownStatus: "cooldown" as const
        },
        {
          ...models[0],
          id: "mock-disabled",
          enabled: false
        }
      ];

      const decision = AIOrchestrator.evaluateModelsForTask("copilot_conversation", mockModels);
      expect(decision.candidateModels.some(m => m.modelId === "mock-cooldown")).toBe(false);
      expect(decision.rejectedModels.some(m => m.modelId === "mock-cooldown")).toBe(true);
      expect(decision.rejectedModels.some(m => m.modelId === "mock-disabled")).toBe(true);
    });

    it("maintains backwards compatibility for selectBestModelForTask", () => {
      const selected = AIOrchestrator.selectBestModelForTask("daily_email", models);
      const chosen = models.find(m => m.id === selected);
      expect(chosen?.provider).toBe("google");
    });
  });
});
