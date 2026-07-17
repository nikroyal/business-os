import { describe, it, expect } from "vitest";
import { AIOrchestrator, AIModelRegistry } from "../src/aiModelRegistry";

describe("BusinessOS AI Master Diagnostics & Feature Verification Suite", () => {
  const models = AIOrchestrator.DEFAULT_MODELS;

  it("prints and verifies the default model routing mapping for all AI features", () => {
    const subsystems = [
      "Copilot",
      "Daily Email",
      "Research Engine",
      "Editorial Commentary",
      "Reports",
      "Opportunities",
      "Benchmarking",
      "Playground",
      "Embeddings",
      "Reranking",
      "Business School",
      "Background AI Jobs"
    ];

    console.log("\n=======================================================");
    console.log("   BUSINESSOS AI MASTER FEATURE RESOLUTION REGISTRY");
    console.log("=======================================================");

    for (const sub of subsystems) {
      const resolved = AIModelRegistry.resolveModel("Automatic", sub);
      const matched = models.find(m => m.id === resolved);
      const providerName = matched?.provider === "google" ? "Google Gemini API" : "OpenRouter API";
      
      console.log(`Subsystem: ${sub.padEnd(22)} -> Model: ${resolved.padEnd(35)} [Provider: ${providerName}]`);

      // Daily Email MUST resolve to native Gemini
      if (sub === "Daily Email") {
        expect(matched?.provider).toBe("google");
        expect(resolved).toBe("gemini-3.5-flash");
      } else {
        // Every other AI subsystem MUST resolve to OpenRouter
        expect(matched?.provider).toBe("openrouter");
        expect(resolved).not.toContain("gemini-");
      }
    }
    console.log("=======================================================\n");
  });

  it("verifies logical choices 'Latest Flash' and 'Latest Pro' resolve correctly by subsystem", () => {
    // 1. For general features (e.g. Copilot), logical choices must resolve to OpenRouter models
    const copilotFlash = AIModelRegistry.resolveModel("Latest Flash", "Copilot");
    expect(copilotFlash).toBe("openai/gpt-4o-mini");

    const copilotPro = AIModelRegistry.resolveModel("Latest Pro", "Copilot");
    expect(copilotPro).toBe("llama-3.3-70b-instruct");

    // 2. For Daily Email, logical choices must resolve to Google Gemini native models
    const dailyFlash = AIModelRegistry.resolveModel("Latest Flash", "Daily Email");
    expect(dailyFlash).toBe("gemini-3.5-flash");

    const dailyPro = AIModelRegistry.resolveModel("Latest Pro", "Daily Email");
    expect(dailyPro).toBe("gemini-3.1-pro-preview");
  });

  it("verifies full config customizability and global provider preferences", async () => {
    const customConfig = {
      modelMapping: {
        'Latest Pro': 'custom-pro-override',
        'Latest Flash': 'custom-flash-override'
      },
      routingPolicies: {
        globalProviderPref: "google" as const,
        freeFirstRouting: false
      }
    };

    // Logical mappings overridden inside general features
    const resolvedOverride = AIModelRegistry.resolveModel("Latest Pro", "Copilot", customConfig);
    expect(resolvedOverride).toBe("custom-pro-override");

    // Dynamic routing engine respects config policies
    const decision = AIOrchestrator.evaluateModelsForTask("copilot_conversation", models, customConfig, "Copilot");
    expect(decision.provider).toBe("google"); // globalProviderPref = "google" forces Gemini
  });

  it("validates operational stats & telemetry API capability", async () => {
    const stats = await AIOrchestrator.getOperationalStats("businessos-0001a");
    expect(stats).toBeDefined();
    expect(stats.models.length).toBeGreaterThan(0);
    expect(stats.providerComparison.google.availableModelsCount).toBeGreaterThan(0);
    expect(stats.providerComparison.openrouter.availableModelsCount).toBeGreaterThan(0);
  });
});
