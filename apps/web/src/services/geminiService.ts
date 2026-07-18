import { dbService, authService } from './firebase';
import type { UserProfile, DailyReport, Opportunity, AICommentary } from './firebase';
import type { PortfolioAnalytics } from './portfolioAnalyticsService';
import { AIModelRegistry } from './aiModelRegistry';
import { buildApiUrl } from './urlBuilder';

export class GeminiService {
  private static lastCallTime = 0;
  private static COOLDOWN_MS = 5000; // 5-second rate limit to prevent double scan spamming

  /**
   * Generates a deterministic hash of inputs to serve as the cache key validation.
   */
  public static calculateHash(
    profile: UserProfile | null,
    report: Omit<DailyReport, 'id' | 'createdAt'> | DailyReport,
    analytics: PortfolioAnalytics,
    opportunities: Opportunity[]
  ): string {
    const inputPayload = {
      uid: profile?.uid || '',
      riskProfile: profile?.riskProfile || 'moderate',
      interests: profile?.interests || [],
      reportingCurrency: profile?.reportingCurrency || 'USD',
      dailyReportTitle: report.title,
      portfolioValue: analytics.totalValue,
      holdingsCount: analytics.topHoldings.length,
      opportunitiesCount: opportunities.length,
      riskFlags: analytics.health.flags.map(f => f.message),
    };
    
    const str = JSON.stringify(inputPayload);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return hash.toString();
  }

  /**
   * Invokes the Gemini API (using standard client-side fetch calls to keep the bundle size small
   * and runtime flexible) to build professional editorial commentary around raw analytics.
   */
  public static async generateEditorialCommentary(
    userId: string,
    profile: UserProfile | null,
    report: Omit<DailyReport, 'id' | 'createdAt'> | DailyReport,
    analytics: PortfolioAnalytics,
    opportunities: Opportunity[],
    commentaryId: string
  ): Promise<AICommentary | null> {
    // 1. Check if Gemini is enabled
    if (!profile?.geminiEnabled) {
      console.info("[GeminiService] Gemini integration is disabled.");
      return null;
    }

    // 2. Resolve input hash
    const currentHash = this.calculateHash(profile, report, analytics, opportunities);

    // 3. Check database cache
    try {
      const cached = await dbService.getAICommentary(userId, commentaryId);
      if (cached && cached.inputHash === currentHash) {
        console.info("[GeminiService] Loading cached AI commentary.");
        return cached;
      }
    } catch (cacheErr) {
      console.warn("[GeminiService] Cache check failed:", cacheErr);
    }

    // 4. Rate-limit cooldown guard
    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    if (elapsed < this.COOLDOWN_MS) {
      console.warn(`[GeminiService] Cooldown triggered. Please wait ${Math.ceil((this.COOLDOWN_MS - elapsed) / 1000)} seconds.`);
      const cachedFallback = await dbService.getAICommentary(userId, commentaryId);
      if (cachedFallback) {
        return cachedFallback;
      }
      throw new Error(`Rate limit cooldown: Please wait ${Math.ceil((this.COOLDOWN_MS - elapsed) / 1000)}s before calling AI again.`);
    }
    this.lastCallTime = now;

    // 5. Trigger Fetch request to Gemini REST endpoint via worker backend
    const model = AIModelRegistry.resolveModel(profile.modelEditorialCommentary || profile.geminiModel, 'Editorial Commentary');
    const tone = profile.geminiTone || 'editorial';

    const systemPrompt = `You are a Senior Editorial Writer for an elite global financial dispatch (Financial Times/Wall Street Journal style).
Your role is to write dryly analytical, objective, and highly professional commentary sections to contextualize raw statistics.
Tone preference: '${tone}' mode (objective, formal, sophisticated, journalistic, zero fluff).

WRITING STYLE GUIDELINES:
- Write strictly in the style of the Financial Times, Wall Street Journal, or institutional investment research notes.
- Avoid generic, verbose AI vocabulary, fluff, and boilerplate. Absolutely do NOT use words like "delve", "tapestry", "in conclusion", "furthermore", "moreover", "testament", "dive", "unlock", "harness", "journey".
- Keep sentences concise, punchy, and highly informative, emphasizing numbers, metrics, and quantitative facts.
- Start directly with the analysis; do not use introductory boilerplate or summaries.

CRITICAL CONSTRAINTS:
1. Do NOT invent, estimate, or modify any financial figures, scores, or prices. Use ONLY the provided numbers exactly.
2. Do NOT write specific buy/sell recommendations, independent price targets, or financial advice. Contextualize only.
3. Your output MUST be a valid JSON object containing exactly these 5 keys, with no other wrapping text:
   - executiveSummary (1-2 paragraphs of macro and portfolio contextualization)
   - portfolioCommentary (1 paragraph explaining allocation structural risks, sector imbalances, or asset class exposure)
   - riskCommentary (1 paragraph discussing portfolio warning flags, concentration indices, or currency depreciation risk)
   - opportunityCommentary (1 paragraph analyzing value/momentum opportunities)
   - marketContext (1 paragraph on global market index and sector behaviors)`;

    const userPrompt = `
Quantitative Dataset:
- Risk Posture: ${profile.riskProfile || 'moderate'}
- Reader Tracks: ${JSON.stringify(profile.interests || [])}
- Macro Status: Title: "${report.title}", Trend: "${report.sections.marketSnapshot.globalTrend}"
- Portfolio Value: ${analytics.totalValue.toFixed(2)} (${profile.reportingCurrency || 'USD'}), Gain/Loss: ${analytics.totalGainLoss.toFixed(2)} (${analytics.totalGainLossPercent.toFixed(1)}%)
- Sector Weights: ${JSON.stringify(analytics.sectorAllocation.map(s => `${s.name}: ${s.percentage.toFixed(1)}%`))}
- Concentration Index HHI: ${analytics.concentrationRisk.hhi} (${analytics.concentrationRisk.status})
- Warning Flags: ${JSON.stringify(analytics.health.flags.map(f => f.message))}
- Market Movers: ${JSON.stringify(report.sections.watchlistMovers)}
- Scanned Opportunity Candidates: ${JSON.stringify(opportunities.map(o => ({ ticker: o.ticker, name: o.title, score: o.confidenceScore, rule: o.supportingMetrics.ruleMatched })))}

Output JSON format exactly:`;

    try {
      const endpoint = buildApiUrl('api/commentary/generate');
      
      const token = await authService.getIdToken();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          systemPrompt,
          userPrompt,
          model
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API via worker backend returned status ${response.status}`);
      }

      const responseData = await response.json();
      const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text || responseData.choices?.[0]?.message?.content;
      
      if (!rawText) {
        throw new Error("No response text found in backend AI response.");
      }

      // Parse output safely
      let cleanJson: any = {};
      try {
        cleanJson = JSON.parse(rawText.trim());
      } catch (parseErr) {
        console.warn("[GeminiService] Failed to parse rawText as JSON directly, attempting recovery:", parseErr);
        const trimmed = rawText.trim();
        const startIdx = trimmed.indexOf('{');
        const endIdx = trimmed.lastIndexOf('}');
        if (startIdx !== -1 && endIdx > startIdx) {
          try {
            cleanJson = JSON.parse(trimmed.substring(startIdx, endIdx + 1));
          } catch (e) {
            console.warn("[GeminiService] Recovery parsing failed as well.");
          }
        }
      }

      const aiCommentary: Omit<AICommentary, 'id' | 'userId'> = {
        executiveSummary: cleanJson.executiveSummary || rawText || 'No summary generated.',
        portfolioCommentary: cleanJson.portfolioCommentary || 'No portfolio analysis available.',
        riskCommentary: cleanJson.riskCommentary || 'No risk assessment generated.',
        opportunityCommentary: cleanJson.opportunityCommentary || 'No opportunities scan analysis.',
        marketContext: cleanJson.marketContext || 'No global market contextualization.',
        generatedTimestamp: new Date().toISOString(),
        inputHash: currentHash,
        fallbackModelUsed: cleanJson._metadata?.fallbackModelUsed,
        infoMessage: cleanJson._metadata?.infoMessage
      };

      // Store in DB
      return await dbService.saveAICommentary(userId, commentaryId, aiCommentary);

    } catch (err: any) {
      console.error("[GeminiService] Execution failed:", err);
      throw new Error(`Gemini service error: ${err.message}`);
    }
  }
}

export default GeminiService;
