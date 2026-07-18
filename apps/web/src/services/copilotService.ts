import { authService } from './firebase';
import { buildApiUrl } from './urlBuilder';

export interface CopilotMessageMetadata {
  confidenceScore: number;
  dataFreshness: string;
  executionCost: number;
  costLevel: 'Very Low' | 'Medium' | 'High';
  subsystemsUsed: string[];
  usedSources: { name: string; url?: string; timestamp?: string }[];
  fallbackModelUsed?: boolean;
  requestedModel?: string;
  actualModel?: string;
  infoMessage?: string;
}

export interface CopilotMessage {
  id: string;
  sender: 'user' | 'copilot';
  content: string;
  timestamp: string;
  metadata?: CopilotMessageMetadata;
}

export interface CopilotSession {
  id: string;
  userId: string;
  title: string;
  researchMode: 'quick' | 'businessos' | 'live' | 'deep';
  pinned: boolean;
  favorite: boolean;
  archived: boolean;
  messageCount: number;
  latestChunkIndex: number;
  createdAt: string;
  updatedAt: string;
}

export class CopilotService {
  private static readonly TTL_MOCK_DELAY = 1000;

  // --- PERSISTENT COPILOT SESSIONS APIS ---

  public static async getSessions(isMockMode: boolean): Promise<CopilotSession[]> {
    if (isMockMode) {
      const saved = localStorage.getItem('mock_copilot_sessions');
      return saved ? JSON.parse(saved) : [];
    }

    try {
      const token = await authService.getIdToken() || 'mock_anonymous';
      const res = await fetch(buildApiUrl('api/copilot/sessions'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed to load live sessions, falling back to local mock sessions:', e);
    }
    return this.getSessions(true);
  }

  public static async createSession(
    prompt: string,
    mode: CopilotSession['researchMode'],
    isMockMode: boolean
  ): Promise<CopilotSession> {
    if (isMockMode) {
      const sessions = await this.getSessions(true);
      const newSession: CopilotSession = {
        id: `session_${Date.now()}`,
        userId: 'mock_user',
        title: prompt.slice(0, 40) + (prompt.length > 40 ? '...' : ''),
        researchMode: mode,
        pinned: false,
        favorite: false,
        archived: false,
        messageCount: 0,
        latestChunkIndex: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      sessions.unshift(newSession);
      localStorage.setItem('mock_copilot_sessions', JSON.stringify(sessions));
      
      // Save empty chunk 0
      localStorage.setItem(`mock_chunk_${newSession.id}_0`, JSON.stringify([]));
      return newSession;
    }

    const token = await authService.getIdToken() || 'mock_anonymous';
    const res = await fetch(buildApiUrl('api/copilot/sessions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ prompt, mode })
    });
    if (res.ok) {
      return await res.json();
    }
    throw new Error('Failed to compile session');
  }

  public static async updateSession(
    sessionId: string,
    updates: Partial<CopilotSession>,
    isMockMode: boolean
  ): Promise<CopilotSession> {
    if (isMockMode) {
      const sessions = await this.getSessions(true);
      const idx = sessions.findIndex(s => s.id === sessionId);
      if (idx !== -1) {
        sessions[idx] = {
          ...sessions[idx],
          ...updates,
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem('mock_copilot_sessions', JSON.stringify(sessions));
        return sessions[idx];
      }
      throw new Error('Session not found');
    }

    const token = await authService.getIdToken() || 'mock_anonymous';
    const res = await fetch(buildApiUrl(`api/copilot/sessions/${sessionId}`), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });
    if (res.ok) {
      return await res.json();
    }
    throw new Error('Failed to update session');
  }

  public static async deleteSession(sessionId: string, isMockMode: boolean): Promise<void> {
    if (isMockMode) {
      const sessions = await this.getSessions(true);
      const filtered = sessions.filter(s => s.id !== sessionId);
      localStorage.setItem('mock_copilot_sessions', JSON.stringify(filtered));
      
      // Clean chunks from localstorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`mock_chunk_${sessionId}_`)) {
          localStorage.removeItem(key);
        }
      }
      return;
    }

    const token = await authService.getIdToken() || 'mock_anonymous';
    const res = await fetch(buildApiUrl(`api/copilot/sessions/${sessionId}`), {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      throw new Error('Failed to delete session');
    }
  }

  public static async getHistory(sessionId: string, isMockMode: boolean): Promise<CopilotMessage[]> {
    if (isMockMode) {
      const messages: CopilotMessage[] = [];
      const cachedSession = (await this.getSessions(true)).find(s => s.id === sessionId);
      if (cachedSession) {
        const latestIdx = cachedSession.latestChunkIndex || 0;
        for (let i = 0; i <= latestIdx; i++) {
          const chunkStr = localStorage.getItem(`mock_chunk_${sessionId}_${i}`);
          if (chunkStr) {
            messages.push(...JSON.parse(chunkStr));
          }
        }
      }
      return messages;
    }

    try {
      const token = await authService.getIdToken() || 'mock_anonymous';
      const res = await fetch(buildApiUrl(`api/copilot/sessions/${sessionId}/history`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const body = await res.json() as any;
        return body.messages;
      }
    } catch (e) {
      console.warn('Failed to load live chat history, falling back to local history:', e);
    }
    return this.getHistory(sessionId, true);
  }

  // --- COPILOT RUN CHAT APIS ---

  public static async sendChatMessage(
    sessionId: string,
    prompt: string,
    isMockMode: boolean
  ): Promise<CopilotMessage> {
    if (isMockMode) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, this.TTL_MOCK_DELAY));
      
      const sessions = await this.getSessions(true);
      const sIdx = sessions.findIndex(s => s.id === sessionId);
      if (sIdx === -1) throw new Error('Session not found');
      
      const session = sessions[sIdx];
      const mode = session.researchMode || 'businessos';

      // Load active chunk
      let latestIdx = session.latestChunkIndex || 0;
      const chunkKey = `mock_chunk_${sessionId}_${latestIdx}`;
      let chunkMessages: CopilotMessage[] = [];
      const chunkStr = localStorage.getItem(chunkKey);
      if (chunkStr) chunkMessages = JSON.parse(chunkStr);

      const userMsg: CopilotMessage = {
        id: `msg_user_${Date.now()}`,
        sender: 'user',
        content: prompt,
        timestamp: new Date().toISOString()
      };

      // Mock Cost details
      let costLevel: 'Very Low' | 'Medium' | 'High' = 'Very Low';
      let executionCost = 0.0001;
      let dataFreshness = 'Cached';
      let confidenceScore = 95;
      const subsystemsUsed = ['Mock Security', 'Offline Cache'];
      const usedSources: { name: string; url?: string; timestamp?: string }[] = [{ name: 'Offline Storage LocalCache' }];

      if (mode === 'businessos') {
        costLevel = 'Medium';
        executionCost = 0.0012;
        dataFreshness = 'Cached (2h ago)';
        subsystemsUsed.push('Portfolio Analytics', 'FRED Cache');
        usedSources.push({ name: 'System Database Cache' });
      } else if (mode === 'live') {
        costLevel = 'Medium';
        executionCost = 0.0110;
        dataFreshness = 'Live';
        confidenceScore = 92;
        subsystemsUsed.push('Live Web News crawler');
        usedSources.push({ name: 'Reuters Market Feed', url: 'https://reuters.com' });
      } else if (mode === 'deep') {
        costLevel = 'High';
        executionCost = 0.0450;
        dataFreshness = 'Live (Scraped)';
        confidenceScore = 88;
        subsystemsUsed.push('Deep Research scraper', 'SEC Facts crawler');
        usedSources.push({ name: 'SEC EDGAR Archive', url: 'https://sec.gov' });
      }

      // Generate a conversational mock response
      let response = '';
      const lp = prompt.toLowerCase();

      if (lp.includes('apple') || lp.includes('aapl')) {
        response = `Apple remains one of the most resilient businesses in the market. The company generates extraordinary free cash flow — over $100B annually — and has returned enormous capital to shareholders through buybacks, which mechanically supports EPS growth even in flat revenue environments.

That said, whether it's a good investment right now depends on your time horizon and entry price. Apple's forward P/E sits in the mid-to-high 20s, which is elevated relative to its historical average and relative to its revenue growth rate (low single digits). The Services segment is the real growth engine here — it's higher margin, recurring, and growing at ~15% annually.

**Key risks to watch:**
- China revenue concentration (~17% of total) and ongoing geopolitical tension
- Regulatory pressure on the App Store take rate in the EU and US
- AI monetisation is still largely unproven at scale

The bull case is that Services re-rates the stock higher as investors assign a SaaS-like multiple to that segment. The bear case is that hardware growth plateaus and the market de-rates the premium.

* [Follow-up: How does Apple's Services revenue compare to its hardware margins?]
* [Follow-up: What does Apple's valuation look like compared to Microsoft?]
* [Follow-up: What are the biggest risks to Apple's China business?]`;
      } else if (lp.includes('nvidia') || lp.includes('nvda') || lp.includes('amd')) {
        response = `Nvidia and AMD are both strong semiconductor businesses, but they're at very different points in their cycles right now.

Nvidia is in a league of its own when it comes to AI infrastructure. Their H100 and Blackwell GPU families have essentially created a monopoly on large-scale AI training workloads. Data center revenue grew over 400% year-over-year at peak, and while that rate will normalise, the absolute demand from hyperscalers (Microsoft, Google, Amazon, Meta) remains enormous. The risk is valuation — Nvidia trades at a significant premium and any demand slowdown would hit hard.

AMD, by contrast, is the best positioned challenger. Their MI300X GPU is gaining traction in inference workloads, and their CPU business (EPYC) is still taking share from Intel in servers. AMD is cheaper on a relative basis and has a cleaner execution story.

**The short answer:** Nvidia has a stronger moat and better near-term demand visibility. AMD has a better risk/reward if you believe GPU competition will intensify.

* [Follow-up: What is Nvidia's current valuation multiple compared to historical levels?]
* [Follow-up: Which hyperscalers are AMD's biggest customers for MI300X?]
* [Follow-up: How does AMD's EPYC server market share compare to Intel Xeon?]`;
      } else if (lp.includes('portfolio') || lp.includes('holding') || lp.includes('position')) {
        response = `Looking at your portfolio, you're currently allocated across technology growth assets with moderate diversification. A few things stand out.

Your concentration in US equities is high — which has worked well historically but introduces meaningful single-market risk. The HHI (Herfindahl–Hirschman Index) for your sector exposure sits in the **moderate zone**, meaning you're not dangerously concentrated, but there's room to improve balance.

The key macro factor bearing on your holdings right now is the interest rate environment. If rates stay higher for longer, growth multiples will face continued pressure. If we get cuts in the next two quarters, that would be a meaningful tailwind for the tech-heavy allocation you have.

**One flag worth noting:** currency risk. Your portfolio is predominantly USD-denominated. If the dollar weakens (which some FRED indicators suggest is possible), international purchasing power of those assets decreases in relative terms.

* [Follow-up: What is my current sector allocation breakdown?]
* [Follow-up: How would a 1% rate cut affect my portfolio?]
* [Follow-up: Which of my holdings has the highest concentration risk?]`;
      } else if (lp.includes('inflation') || lp.includes('cpi') || lp.includes('interest rate') || lp.includes('macro') || lp.includes('economy') || lp.includes('gdp') || lp.includes('yield')) {
        response = `The US macro picture right now is genuinely complex — we're in a late-cycle environment that doesn't fit neatly into a single narrative.

Inflation has come down significantly from its 2022 peak of ~9%, but the "last mile" to the Fed's 2% target has proven sticky. Core services inflation, driven largely by shelter costs and wages, is running around 3.3% YoY. That's why the Fed has been cautious about cutting rates despite market pressure.

The yield curve remains inverted — the 2-year Treasury yields more than the 10-year, which has historically been a recession indicator. That said, this inversion has persisted far longer than typical cycles, leading some economists to question its predictive reliability in the current environment.

GDP growth has been more resilient than many expected — consumer spending, particularly in services, has held up. But leading indicators like the ISM Manufacturing Index and credit card delinquency rates are flashing early warning signs.

**Bottom line:** the base case is a soft landing, but the distribution of outcomes is wider than usual.

* [Follow-up: What does a yield curve inversion historically signal for equities?]
* [Follow-up: How are Fed rate cut expectations priced into markets currently?]
* [Follow-up: Which sectors perform best in a late-cycle slowdown?]`;
      } else if (lp.includes('microsoft') || lp.includes('msft')) {
        response = `Microsoft is arguably the most diversified and defensible of the mega-cap technology companies right now. Azure cloud is growing at ~28-30% annually and is the clear number two behind AWS, with credible momentum to close the gap. The Copilot AI integration across Office 365 and Teams represents a meaningful monetisation opportunity — Microsoft is charging a premium ($30/user/month) for Copilot access, and enterprise adoption is accelerating.

The company also benefits from extraordinary recurring revenue across enterprise software (Windows, Office, Dynamics, LinkedIn), which provides a resilient base even if cloud growth moderates.

**Valuation:** Microsoft trades at approximately 30-32x forward earnings, which is a premium but arguably justified given the combination of cloud growth, AI optionality, and cash generation. It's expensive on an absolute basis but less so relative to its quality.

The main risks are the pace of AI monetisation (which needs to justify the heavy CapEx investment), and potential regulatory scrutiny around its partnership with OpenAI.

* [Follow-up: How does Microsoft Azure compare to AWS and Google Cloud?]
* [Follow-up: What is Microsoft Copilot's current adoption rate among enterprises?]
* [Follow-up: Compare Microsoft and Apple as long-term holds]`;
      } else {
        response = `That's a great question. Let me work through this with the data I have available.

Based on your query about "${prompt.length > 60 ? prompt.substring(0, 60) + '...' : prompt}", here's my assessment under **${mode.toUpperCase()} mode** with ${confidenceScore}% confidence based on ${usedSources.length} grounded source${usedSources.length !== 1 ? 's' : ''}.

The financial markets context suggests a cautious but opportunistic stance is warranted right now. Macro headwinds from elevated interest rates are real, but sector-specific opportunities still exist for investors with a longer time horizon.

If you can give me a more specific question — a company name, ticker, sector, or macro topic — I can give you a much more targeted and useful analysis.

* [Follow-up: What macro themes should I be paying attention to right now?]
* [Follow-up: Can you summarise the current state of the US economy?]
* [Follow-up: Which sectors look most attractive under current conditions?]`;
      }

      const copilotMsg: CopilotMessage = {
        id: `msg_copilot_${Date.now()}`,
        sender: 'copilot',
        content: response,
        timestamp: new Date().toISOString(),
        metadata: {
          confidenceScore,
          dataFreshness,
          executionCost,
          costLevel,
          subsystemsUsed,
          usedSources
        }
      };

      chunkMessages.push(userMsg, copilotMsg);
      localStorage.setItem(chunkKey, JSON.stringify(chunkMessages));

      // Update session updates
      session.messageCount = (session.messageCount || 0) + 2;
      session.updatedAt = new Date().toISOString();
      localStorage.setItem('mock_copilot_sessions', JSON.stringify(sessions));

      return copilotMsg;
    }

    const token = await authService.getIdToken() || 'mock_anonymous';
    const res = await fetch(buildApiUrl('api/copilot/chat'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ sessionId, prompt })
    });
    if (res.ok) {
      return await res.json();
    }
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || 'Failed to process chat request');
  }

  // --- REPORT EXPORT ACTION ---

  public static async exportReport(
    ticker: string,
    exchange: string,
    isMockMode: boolean
  ): Promise<string> {
    try {
      const module = await import('./researchEngine');
      const result = await module.ResearchEngine.generateResearchReport(ticker, exchange, isMockMode);
      
      // Format markdown string
      const reportMarkdown = `
# EQUITY RESEARCH BRIEF: ${result.ticker} (${result.exchange})
*Generated: ${result.generationDate} | Engine Version: ${result.reportVersion}*
*Confidence Score: ${result.confidenceScore}%*

## 1. Executive Thesis Summary
${result.executiveSummary}

## 2. Financial Metrics Analysis
${result.financialMetricsAnalysis}

## 3. Risks & Mitigations
${result.risksAndMitigations}

## 4. SEC/Filing Earnings Trend
| Quarter | Revenue | Operating Margin | Net Income |
| :--- | :--- | :--- | :--- |
${result.earningsTrend.map(e => `| ${e.quarter} | ${e.revenue.toLocaleString()} | ${e.operatingMargin}% | ${e.netIncome.toLocaleString()} |`).join('\n')}

---
### Grounded Sources:
${result.sourcesUsed.map((s, idx) => `[${idx + 1}] ${s.name} ${s.url ? `(${s.url})` : ''} - ${s.timestamp}`).join('\n')}
`;
      return reportMarkdown;
    } catch (e) {
      console.error('Failed to trigger research engine export:', e);
      throw e;
    }
  }
}
export default CopilotService;
