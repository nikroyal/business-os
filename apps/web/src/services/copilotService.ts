import { authService } from './firebase';

export interface CopilotMessageMetadata {
  confidenceScore: number;
  dataFreshness: string;
  executionCost: number;
  costLevel: 'Very Low' | 'Medium' | 'High';
  subsystemsUsed: string[];
  usedSources: { name: string; url?: string; timestamp?: string }[];
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
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const token = await authService.getIdToken() || 'mock_anonymous';
      const res = await fetch(`${baseUrl}/api/copilot/sessions`, {
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

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
    const token = await authService.getIdToken() || 'mock_anonymous';
    const res = await fetch(`${baseUrl}/api/copilot/sessions`, {
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

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
    const token = await authService.getIdToken() || 'mock_anonymous';
    const res = await fetch(`${baseUrl}/api/copilot/sessions/${sessionId}`, {
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

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
    const token = await authService.getIdToken() || 'mock_anonymous';
    const res = await fetch(`${baseUrl}/api/copilot/sessions/${sessionId}`, {
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
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const token = await authService.getIdToken() || 'mock_anonymous';
      const res = await fetch(`${baseUrl}/api/copilot/sessions/${sessionId}/history`, {
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

      // Generate a mock response using details
      let response = '';
      if (prompt.toLowerCase().includes('portfolio') || prompt.toLowerCase().includes('holding')) {
        response = `Based on your cached portfolio data, you hold allocations in technology growth assets. 
        
### Portfolio Grounding Details
* Your HHI index remains in the **Moderate** zone.
* Diversification score is rated at **74/100**.
* You have notable exposure in **USD-denominated assets** (which introduces currency volatility risk).

No specific trade suggestions will be made. Please monitor sector overexposures in the dashboard.`;
      } else if (prompt.toLowerCase().includes('inflation') || prompt.toLowerCase().includes('yield') || prompt.toLowerCase().includes('macro')) {
        response = `### Macroeconomic Indicators (FRED Grounded)
* **CPI Inflation (YoY):** 3.3% [[1]](https://fred.stlouisfed.org) (Flat trend)
* **US 10-Year Treasury Yield:** 4.35% (Slightly falling trend)
* **Yield Curve Spread (10Y-2Y):** -0.35 points (Inverted)

**Economic Analysis:**
Inflation indicators remain above target rates. Multiple expansion headwinds are present for high valuation growth stocks under the current yields regime. Inverted yield spreads historically warn of prospective macro contractions.`;
      } else {
        response = `Thank you for your inquiry about "${prompt}". 
        
As your BusinessOS Copilot, I am evaluating this query under **${mode.toUpperCase()}** Mode. 

### Grounding Assessment
* System confidence is computed at **${confidenceScore}%**.
* Sources lists contain **${usedSources.length} verified paths**.

Please specify if you would like me to compile details regarding your holdings, macroeconomic indicators, or active news.`;
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

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
    const token = await authService.getIdToken() || 'mock_anonymous';
    const res = await fetch(`${baseUrl}/api/copilot/chat`, {
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
