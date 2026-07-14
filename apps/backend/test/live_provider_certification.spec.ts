import { describe, it, expect } from 'vitest';
import { AIOrchestrator } from '../src/aiModelRegistry';

describe('Enterprise AI Live Provider Certification Suite', () => {
  it('audits every configured provider and model without assuming success when credentials are absent', async () => {
    const geminiKey = process.env.GEMINI_API_KEY || '';
    const openRouterKey = process.env.OPENROUTER_API_KEY || '';

    const report = await AIOrchestrator.runLiveProviderCertificationSuite({
      google: geminiKey,
      openrouter: openRouterKey
    }, false);

    expect(report.totalModels).toBeGreaterThanOrEqual(30);
    expect(report.models.length).toBe(report.totalModels);

    // Verify no model has a CONFIG_ERROR (invalid apiModelId or matching displayName)
    const configErrors = report.models.filter(m => m.verificationType === 'CONFIG_ERROR');
    expect(configErrors).toHaveLength(0);

    // Verify every single model explicitly states its verification status
    report.models.forEach(m => {
      expect(m.id).toBeDefined();
      expect(m.displayName).toBeDefined();
      expect(m.provider).toMatch(/^(google|openrouter)$/);
      expect(m.apiModelId).toBeDefined();
      expect(m.apiModelId).not.toEqual(m.displayName);

      if (m.provider === 'google' && !geminiKey) {
        expect(m.status).toBe('MANUAL');
        expect(m.verificationType).toBe('MANUAL_PRODUCTION_VERIFICATION');
        expect(m.message).toContain('Requires manual production verification against live GEMINI_API_KEY');
      } else if (m.provider === 'openrouter' && !openRouterKey) {
        expect(m.status).toBe('MANUAL');
        expect(m.verificationType).toBe('MANUAL_PRODUCTION_VERIFICATION');
        expect(m.message).toContain('Requires manual production verification against live OPENROUTER_API_KEY');
      }
    });
  });

  it('performs end-to-end certification audit of every statutory AI feature', async () => {
    const geminiKey = process.env.GEMINI_API_KEY || '';
    const openRouterKey = process.env.OPENROUTER_API_KEY || '';

    const report = await AIOrchestrator.runLiveProviderCertificationSuite({
      google: geminiKey,
      openrouter: openRouterKey
    }, false);

    expect(report.featuresAudit).toBeDefined();
    expect(report.featuresAudit.length).toBe(10);

    const featureNames = report.featuresAudit.map(f => f.feature);
    expect(featureNames).toContain('Copilot Chat Engine');
    expect(featureNames).toContain('Daily Briefing Email');
    expect(featureNames).toContain('Research Engine');
    expect(featureNames).toContain('Editorial Commentary');
    expect(featureNames).toContain('Reports Generator');
    expect(featureNames).toContain('Opportunities Analyzer');
    expect(featureNames).toContain('Benchmarking Suite');
    expect(featureNames).toContain('AI Playground');
    expect(featureNames).toContain('Vector Embeddings');
    expect(featureNames).toContain('Semantic Reranker');

    report.featuresAudit.forEach(fa => {
      expect(fa.selectedModel).toBeDefined();
      expect(fa.apiModelId).toBeDefined();
      expect(['PASS', 'FAIL', 'MANUAL']).toContain(fa.status);
    });
  });

  it('executes live API prompt requests when real API keys are provided in environment', async () => {
    const geminiKey = process.env.GEMINI_API_KEY || '';
    const openRouterKey = process.env.OPENROUTER_API_KEY || '';

    const testLive = Boolean(geminiKey || openRouterKey);
    const report = await AIOrchestrator.runLiveProviderCertificationSuite({
      google: geminiKey,
      openrouter: openRouterKey
    }, testLive);

    if (testLive) {
      expect(report.passedCount + report.failedCount + report.manualCount).toBe(report.totalModels);
    } else {
      expect(report.manualCount).toBe(report.totalModels);
    }
  });
});
