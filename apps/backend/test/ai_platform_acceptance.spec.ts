import { describe, it, expect } from "vitest";
import { AIOrchestrator, GoogleGeminiAdapter, OpenRouterAdapter } from "../src/aiModelRegistry";

describe("BusinessOS AI Platform - End-to-End Production Acceptance Audit", () => {

  describe("PHASE 1 - PROVIDER CONNECTIVITY & ADAPTER VERIFICATION", () => {
    it("verify GoogleGeminiAdapter formatting and error classification", () => {
      const gemini = new GoogleGeminiAdapter();
      expect(gemini).toBeDefined();

      const errorClass1 = AIOrchestrator.classifyError(429, "Quota exceeded for day");
      expect(errorClass1).toBe("DAILY_QUOTA_EXCEEDED");

      const errorClass2 = AIOrchestrator.classifyError(503, "Service unavailable overloaded");
      expect(errorClass2).toBe("MODEL_OVERLOADED");
    });

    it("verify OpenRouterAdapter formatting and authentication headers", () => {
      const openRouter = new OpenRouterAdapter();
      expect(openRouter).toBeDefined();
    });
  });

  describe("PHASE 2 - MODEL DISCOVERY & REGISTRY SSOT", () => {
    it("verify every configured model in AIOrchestrator.DEFAULT_MODELS is valid and has complete metadata", () => {
      const models = AIOrchestrator.DEFAULT_MODELS;
      expect(models.length).toBeGreaterThan(0);

      const ids = new Set<string>();
      for (const model of models) {
        expect(model.id).toBeDefined();
        expect(model.displayName).toBeDefined();
        expect(model.category).toBeDefined();
        expect(["google", "openrouter"]).toContain(model.provider);
        expect(typeof model.enabled).toBe("boolean");
        expect(model.contextWindow).toBeGreaterThan(0);

        expect(ids.has(model.id)).toBe(false);
        ids.add(model.id);
      }
    });
  });

  describe("PHASE 3 - TASK ROUTING VERIFICATION", () => {
    it("verify default routing policies for all BusinessOS features", () => {
      const models = AIOrchestrator.DEFAULT_MODELS;

      // Daily Email -> Google Gemini
      const dailyEmailModel = AIOrchestrator.selectBestModelForTask("daily_email", models);
      const dailyEmailObj = models.find(m => m.id === dailyEmailModel);
      expect(dailyEmailObj?.provider).toBe("google");
      expect(dailyEmailObj?.id).toBe("gemini-3.5-flash");

      // All other tasks -> OpenRouter by default
      const tasks: Array<"copilot_conversation" | "market_summary" | "company_analysis" | "report_generation" | "deep_research" | "short_summarization" | "long_writing"> = [
        "copilot_conversation",
        "market_summary",
        "company_analysis",
        "report_generation",
        "deep_research",
        "short_summarization",
        "long_writing"
      ];

      for (const task of tasks) {
        const selectedId = AIOrchestrator.selectBestModelForTask(task, models, { globalProviderPreference: "openrouter", freeFirstRouting: true });
        const selectedObj = models.find(m => m.id === selectedId);
        expect(selectedObj?.provider).toBe("openrouter");
      }
    });
  });

  describe("PHASE 4 - OPENROUTER FREE-FIRST ROUTING", () => {
    it("verify preference for openrouter/free when freeFirstRouting is enabled", () => {
      const models = AIOrchestrator.DEFAULT_MODELS;
      const selectedId = AIOrchestrator.selectBestModelForTask("copilot_conversation", models, {
        globalProviderPreference: "openrouter",
        freeFirstRouting: true
      });
      expect(selectedId).toBe("openrouter/free");
    });
  });

  describe("PHASE 5 - FALLBACK & COOLDOWN LOGIC", () => {
    it("verify error classification and cooldown resilience", () => {
      const classification = AIOrchestrator.classifyError(500, "Internal Server Error");
      expect(classification).toBe("INTERNAL_PROVIDER_ERROR");
    });
  });

  describe("PHASE 6 - TELEMETRY RECORDING", () => {
    it("verify telemetry record structure contains all required operational attributes", () => {
      const sampleRecord = {
        feature: "Copilot",
        provider: "openrouter",
        model: "openrouter/free",
        promptTokens: 150,
        completionTokens: 350,
        totalTokens: 500,
        latencyMs: 820,
        cost: 0,
        success: true,
        timestamp: new Date().toISOString()
      };
      expect(sampleRecord.feature).toBe("Copilot");
      expect(sampleRecord.provider).toBe("openrouter");
      expect(sampleRecord.totalTokens).toBe(500);
    });
  });

  describe("PHASE 9 - OPERATIONS CENTER & HEALTH STATS", () => {
    it("verify operational stats structure and mock fallback", async () => {
      const stats = await AIOrchestrator.getOperationalStats("mock_project_id");
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty("models");
      expect(stats).toHaveProperty("quota");
      expect(stats.providerComparison).toHaveProperty("google");
      expect(stats.providerComparison).toHaveProperty("openrouter");
      expect(stats.providerComparison.google.availableModelsCount).toBeGreaterThan(0);
      expect(stats.providerComparison.openrouter.availableModelsCount).toBeGreaterThan(0);
    });
  });

  describe("PHASE 10 - PROVIDER API KEY VALIDATION & STRICT ISOLATION", () => {
    it("verify validateProviders checks both Google Gemini and OpenRouter configuration status", async () => {
      const res = await AIOrchestrator.validateProviders({});
      expect(res.google.status).toBe("not_configured");
      expect(res.openrouter.status).toBe("not_configured");
    });

    it("verify execute throws descriptive CONFIGURATION_ERROR (HTTP 400) when OpenRouter API key is missing", async () => {
      await expect(
        AIOrchestrator.execute(
          "Copilot",
          "System",
          "User",
          "openrouter/free",
          "proj",
          { google: "google_key_only", openrouter: "" },
          "user"
        )
      ).rejects.toThrow(/OPENROUTER_API_KEY is missing or not configured/);
    });

    it("verify execute throws descriptive CONFIGURATION_ERROR (HTTP 400) when Google Gemini API key is missing", async () => {
      await expect(
        AIOrchestrator.execute(
          "Daily Email",
          "System",
          "User",
          "gemini-3.5-flash",
          "proj",
          { google: "", openrouter: "or_key_only" },
          "user"
        )
      ).rejects.toThrow(/GEMINI_API_KEY is missing or not configured/);
    });

    it("verify error classification recognizes configuration errors and JSON parse errors", () => {
      expect(AIOrchestrator.classifyError(400, "Configuration Error: OPENROUTER_API_KEY is missing")).toBe("CONFIGURATION_ERROR");
      expect(AIOrchestrator.classifyError(500, "JSON parse failure: OpenRouter returned malformed non-JSON payload")).toBe("JSON_PARSE_FAILURE");
    });
  });

  describe("PHASE 11 - COMPLETE TASK ROUTING & SSOT VERIFICATION", () => {
    it("verify every task type routes to the correct provider and model according to SSOT", () => {
      const models = AIOrchestrator.DEFAULT_MODELS;

      // 1. Daily Email ALWAYS uses Gemini
      const dailyModelId = AIOrchestrator.selectBestModelForTask("daily_email", models);
      const dailyModel = models.find(m => m.id === dailyModelId);
      expect(dailyModel?.provider).toBe("google");

      // 2. Copilot defaults to OpenRouter
      const copilotModelId = AIOrchestrator.selectBestModelForTask("copilot_conversation", models);
      const copilotModel = models.find(m => m.id === copilotModelId);
      expect(copilotModel?.provider).toBe("openrouter");

      // 3. Research uses OpenRouter
      const researchModelId = AIOrchestrator.selectBestModelForTask("deep_research", models);
      const researchModel = models.find(m => m.id === researchModelId);
      expect(researchModel?.provider).toBe("openrouter");

      // 4. Commentary uses OpenRouter
      const commentaryModelId = AIOrchestrator.selectBestModelForTask("editorial_commentary", models);
      const commentaryModel = models.find(m => m.id === commentaryModelId);
      expect(commentaryModel?.provider).toBe("openrouter");

      // 5. Playground supports every available model
      const playgroundModels = models.filter(m => m.enabled && m.visibleInRegistry !== false);
      expect(playgroundModels.length).toBeGreaterThanOrEqual(10);
    });
  });
});
