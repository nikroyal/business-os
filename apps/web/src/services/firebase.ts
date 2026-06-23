import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  collection,
  getDocs,
  deleteDoc,
  deleteField
} from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  interests: string[];
  timezone: string;
  emailPreferences: {
    dailyBriefing: boolean;
    weeklyReport: boolean;
    alerts: boolean;
  };
  reportingCurrency?: 'USD' | 'INR';
  usdToInrRate?: number;
  createdAt?: string;
  
  // Gemini Configuration
  geminiEnabled?: boolean;
  geminiApiKey?: string;
  geminiModel?: string;
  geminiTone?: 'editorial' | 'analytical' | 'succinct';

  // Dispatch Configuration
  preferredDeliveryTime?: string;
  preferredTimezone?: string;
  emailDeliveryAddress?: string;
  aiCommentaryIncluded?: boolean;

  // Onboarding & Setup Progress
  setupCompleted?: boolean;
  onboardingCompleted?: boolean;
}

export interface Holding {
  id: string;
  userId: string;
  symbol: string;
  name: string;
  ticker: string;
  exchange: string;
  assetClass: string;
  currency: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string; // YYYY-MM-DD
  currentPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioSnapshot {
  date: string; // YYYY-MM-DD
  portfolioValue: number;
  investedCapital: number;
  gainLoss: number;
  holdingsCount: number;
}

export interface WatchlistItem {
  id: string;
  userId: string;
  symbol: string;
  ticker: string;
  exchange: string;
  currency: string;
  name: string;
  addedAt: string;
}

export interface DailyReport {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  title: string;
  summary: string;
  sections: {
    marketSnapshot: {
      globalTrend: 'bullish' | 'bearish' | 'neutral';
      usMarket: string;
      indianMarket: string;
      cryptoMarket: string;
    };
    portfolioSummary: {
      totalValue: number;
      totalGainLoss: number;
      performanceLabel: string;
      allocationHighlights: string;
    };
    watchlistMovers: {
      ticker: string;
      exchange: string;
      price: number;
      changePercent: number;
      direction: 'up' | 'down';
    }[];
    riskFlags: {
      level: 'info' | 'warning' | 'danger';
      message: string;
      suggestion: string;
    }[];
    learningItem: {
      term: string;
      definition: string;
      context: string;
    };
    portfolioDelta?: {
      upgrades: { ticker: string; prev: number; curr: number }[];
      downgrades: { ticker: string; prev: number; curr: number }[];
      newDips: { ticker: string; classification: string }[];
      smartMoneyChanges: { ticker: string; prevFlow: string; currFlow: string }[];
      healthChange: { prevScore: number; currScore: number };
    };
  };
  rawContent?: string;
  createdAt: string;
}

export interface Opportunity {
  id: string;
  userId: string;
  title: string;
  ticker: string;
  exchange: string;
  rationale: string;
  confidenceScore: number;
  supportingMetrics: {
    ruleMatched: string;
    currentPrice: number;
    metricValue: string;
    [key: string]: any;
  };
  generatedTimestamp: string;
  tags: ('momentum' | 'value' | 'diversification' | 'watchlist')[];
}

export interface AICommentary {
  id: string;
  userId: string;
  executiveSummary: string;
  portfolioCommentary: string;
  riskCommentary: string;
  opportunityCommentary: string;
  marketContext: string;
  generatedTimestamp: string;
  inputHash: string;
}

export interface SmartMoneyMetric<T> {
  value: T | null;
  source: string;
  timestamp: string;
  freshness: string;
  confidence: 'high' | 'medium' | 'low' | 'none';
}

export interface CompanyIntelligence {
  ticker: string;
  exchange: string;
  name: string;
  sector: string;
  qualityScore: number;
  qualityRationale: string;
  qualityBreakdown?: {
    moat: { score: number; max: number; weight: number; contribution: number; value: string; rationale: string };
    leverage: { score: number; max: number; weight: number; contribution: number; value: number; rationale: string };
    fcfMargin: { score: number; max: number; weight: number; contribution: number; value: number; rationale: string };
  };
  research: {
    moatRating: 'wide' | 'narrow' | 'none';
    moatRationale: string;
    fundamentalHealthScore: number;
    leverageRatio: number;
    freeCashFlowMargin: number;
    majorRisks: string[];
    updatedAt: string;
    fundamentals?: {
      revenueGrowthYoy: number | null;
      earningsGrowthYoy: number | null;
      roic: number | null;
      grossMargin: number | null;
      operatingMargin: number | null;
      debtToEquity: number | null;
      marketCapMillions: number | null;
      industry: string | null;
    };
  };
  dip: {
    dipDetected: boolean;
    severityPercent: number;
    zScore: number;
    catalyst: string;
    isStructural: boolean;
    currentPrice?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    ema50?: number;
    volatility?: number;
    qualityScore?: number;
    classification?: 'Healthy' | 'Uncertain' | 'Dangerous';
    classificationRationale?: string;
    updatedAt: string;
  };
  smartMoney: {
    institutionalOwnershipPercent: number | null;
    netInstitutionalFlow: 'accumulation' | 'distribution' | 'neutral' | 'unavailable';
    accumulationScore: number;
    optionsVolumeRatio: number | null;
    optionSentiment: 'bullish' | 'bearish' | 'neutral' | 'unavailable';
    insiderTransactions?: SmartMoneyMetric<{
      netSharesBought: number;
      totalTransactionsCount: number;
      buyCount: number;
      sellCount: number;
    }>;
    insiderSentiment?: SmartMoneyMetric<{
      mspr: number;
      change: number;
    }>;
    optionsVolume?: SmartMoneyMetric<{
      putCallRatio: number;
      sentiment: 'bullish' | 'bearish' | 'neutral';
    }>;
    institutionalOwnership?: SmartMoneyMetric<{
      ownershipPercent: number;
      netFlow: 'accumulation' | 'distribution' | 'neutral';
    }>;
    updatedAt: string;
  };
  updatedAt: string;
}

export interface FactorBreakdown {
  score: number;
  max: number;
  weight: number;
  contribution: number;
  explanation: string;
}

export interface UserConviction {
  id?: string;
  userId: string;
  ticker: string;
  exchange: string;
  overallScore: number;
  breakdown: {
    allocationFactor: FactorBreakdown;
    fundamentalFactor: FactorBreakdown;
    dipFactor: FactorBreakdown;
    institutionalFactor: FactorBreakdown;
  };
  rationale: string;
  updatedAt: string;
}





// Config variables from Vite
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if config is provided and valid
const isFirebaseConfigured = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== 'your-api-key' && 
  firebaseConfig.projectId && 
  firebaseConfig.projectId !== 'your-project-id';

let realAuth: any = null;
let realDb: any = null;

if (isFirebaseConfigured) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    realAuth = getAuth(app);
    realDb = getFirestore(app);
    console.log('Firebase initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize real Firebase services:', error);
  }
} else {
  console.log('Firebase config missing or placeholder. Running in DEMO/MOCK mode.');
}

// Global state for mock authentication to trigger callbacks correctly
const mockCallbacks = new Set<(user: any) => void>();
let mockCurrentUser: any = null;

// Helper to load current user from localStorage on init
const initMockUser = () => {
  const saved = localStorage.getItem('business_os_mock_user');
  if (saved) {
    try {
      mockCurrentUser = JSON.parse(saved);
    } catch {
      mockCurrentUser = null;
    }
  }
};
initMockUser();

// Auth Service wrapper
export const authService = {
  isMock: !realAuth,

  getCurrentUser() {
    if (realAuth) {
      return realAuth.currentUser;
    }
    return mockCurrentUser;
  },

  async getIdToken(): Promise<string> {
    if (realAuth && realAuth.currentUser) {
      return await realAuth.currentUser.getIdToken();
    }
    return mockCurrentUser ? `mock_${mockCurrentUser.uid}` : 'mock_anonymous';
  },
  
  async signup(email: string, password: string, displayName: string): Promise<any> {
    if (realAuth) {
      const cred = await createUserWithEmailAndPassword(realAuth, email, password);
      // Initialize default firestore user record
      const defaultProfile: UserProfile = {
        uid: cred.user.uid,
        email: email,
        displayName: displayName || email.split('@')[0],
        riskProfile: 'moderate',
        interests: ['Artificial Intelligence'],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        emailPreferences: {
          dailyBriefing: true,
          weeklyReport: true,
          alerts: true
        },
        createdAt: new Date().toISOString()
      };
      await dbService.saveUserProfile(cred.user.uid, defaultProfile);
      return cred.user;
    } else {
      // Mock signup logic
      const users = JSON.parse(localStorage.getItem('business_os_mock_db_users') || '[]');
      if (users.find((u: any) => u.email === email)) {
        throw new Error('User already exists in mock database.');
      }
      const newMockUser = {
        uid: 'mock_' + Math.random().toString(36).substr(2, 9),
        email,
        displayName
      };
      users.push({ ...newMockUser, password });
      localStorage.setItem('business_os_mock_db_users', JSON.stringify(users));
      
      // Save default profile for mock user
      const defaultProfile: UserProfile = {
        uid: newMockUser.uid,
        email: email,
        displayName: displayName || email.split('@')[0],
        riskProfile: 'moderate',
        interests: ['Artificial Intelligence'],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        emailPreferences: {
          dailyBriefing: true,
          weeklyReport: true,
          alerts: true
        },
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(`profile_${newMockUser.uid}`, JSON.stringify(defaultProfile));
      
      mockCurrentUser = newMockUser;
      localStorage.setItem('business_os_mock_user', JSON.stringify(mockCurrentUser));
      mockCallbacks.forEach(cb => cb(mockCurrentUser));
      return newMockUser;
    }
  },

  async login(email: string, password: string): Promise<any> {
    if (realAuth) {
      const cred = await signInWithEmailAndPassword(realAuth, email, password);
      return cred.user;
    } else {
      // Mock login logic
      const users = JSON.parse(localStorage.getItem('business_os_mock_db_users') || '[]');
      const match = users.find((u: any) => u.email === email && u.password === password);
      if (!match) {
        throw new Error('Invalid email or password (Demo Mode).');
      }
      mockCurrentUser = {
        uid: match.uid,
        email: match.email,
        displayName: match.displayName
      };
      localStorage.setItem('business_os_mock_user', JSON.stringify(mockCurrentUser));
      mockCallbacks.forEach(cb => cb(mockCurrentUser));
      return mockCurrentUser;
    }
  },

  async logout(): Promise<void> {
    // 1. Clear in-memory caches dynamically to avoid circular dependencies
    try {
      import('./marketDataService').then((m) => {
        if (m.marketDataService && m.marketDataService.clearCache) {
          m.marketDataService.clearCache();
        }
      });
    } catch (e) {
      console.warn('Failed to clear market data cache:', e);
    }

    // 2. Clear localStorage caches
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          if (
            key.startsWith('company_intelligence_') ||
            key.startsWith('user_conviction_') ||
            key.startsWith('ai_commentary_') ||
            key.startsWith('setup_wizard_draft_') ||
            key.startsWith('onboarding_celebrated_') ||
            key.startsWith('opportunities_') ||
            key.startsWith('reports_')
          ) {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.warn('Failed to sanitize localStorage:', e);
    }

    if (realAuth) {
      await signOut(realAuth);
    } else {
      mockCurrentUser = null;
      localStorage.removeItem('business_os_mock_user');
      mockCallbacks.forEach(cb => cb(null));
    }
  },

  onAuthStateChanged(callback: (user: any) => void): () => void {
    if (realAuth) {
      return onAuthStateChanged(realAuth, callback);
    } else {
      mockCallbacks.add(callback);
      // Trigger initial callback with currently loaded mock user
      callback(mockCurrentUser);
      return () => {
        mockCallbacks.delete(callback);
      };
    }
  }
};

// Database Service wrapper
export const dbService = {
  async saveUserProfile(uid: string, profile: UserProfile): Promise<void> {
    const cleanProfile = { ...profile };
    if ('geminiApiKey' in cleanProfile) {
      delete cleanProfile.geminiApiKey;
    }
    if (realDb) {
      const docRef = doc(realDb, 'users', uid);
      await setDoc(docRef, cleanProfile, { merge: true });
    } else {
      localStorage.setItem(`profile_${uid}`, JSON.stringify(cleanProfile));
    }
  },

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    if (realDb) {
      const docRef = doc(realDb, 'users', uid);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const data = snapshot.data() as UserProfile;
        if (data.geminiApiKey) {
          delete data.geminiApiKey;
          try {
            await updateDoc(docRef, { geminiApiKey: deleteField() });
          } catch (e) {
            console.error('Failed to clean up geminiApiKey from firestore:', e);
          }
        }
        return data;
      }
      return null;
    } else {
      const saved = localStorage.getItem(`profile_${uid}`);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.geminiApiKey) {
          delete data.geminiApiKey;
          localStorage.setItem(`profile_${uid}`, JSON.stringify(data));
        }
        return data as UserProfile;
      }
      return null;
    }
  },

  async updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    const cleanUpdates = { ...updates };
    if ('geminiApiKey' in cleanUpdates) {
      delete cleanUpdates.geminiApiKey;
    }
    if (realDb) {
      const docRef = doc(realDb, 'users', uid);
      await updateDoc(docRef, { ...cleanUpdates, geminiApiKey: deleteField() } as any);
    } else {
      const current = await this.getUserProfile(uid);
      if (current) {
        const merged = { ...current, ...cleanUpdates };
        if ('geminiApiKey' in merged) {
          delete merged.geminiApiKey;
        }
        localStorage.setItem(`profile_${uid}`, JSON.stringify(merged));
      }
    }
  },

  async getHoldings(userId: string): Promise<Holding[]> {
    const migrateHolding = (h: any): Holding => {
      const timestamp = h.createdAt || new Date().toISOString();
      const purchaseDate = h.purchaseDate || (timestamp ? timestamp.split('T')[0] : new Date().toISOString().split('T')[0]);
      
      const symbol = h.symbol || '';
      const ticker = h.ticker || symbol;
      
      let exchange = h.exchange;
      if (!exchange) {
        if (h.assetClass?.toLowerCase() === 'crypto') {
          exchange = 'CRYPTO';
        } else if (h.assetClass?.toLowerCase() === 'cash') {
          exchange = 'CASH';
        } else if (['RELIANCE', 'TCS', 'INFY', 'WIPRO'].includes(ticker.toUpperCase())) {
          exchange = 'NSE';
        } else {
          exchange = 'NASDAQ';
        }
      }

      const currency = h.currency || (['NSE', 'BSE'].includes(exchange) ? 'INR' : 'USD');
      const assetClass = h.assetClass || 'Equity';
      const quantity = typeof h.quantity === 'number' ? h.quantity : parseFloat(h.quantity) || 0;
      const purchasePrice = typeof h.purchasePrice === 'number' ? h.purchasePrice : parseFloat(h.purchasePrice) || 0;
      const currentPrice = typeof h.currentPrice === 'number' ? h.currentPrice : (parseFloat(h.currentPrice) || purchasePrice);
      const name = h.name || `${ticker} Asset`;

      return {
        id: h.id,
        userId: h.userId,
        symbol,
        name,
        ticker,
        exchange,
        assetClass,
        currency,
        quantity,
        purchasePrice,
        purchaseDate,
        currentPrice,
        createdAt: timestamp,
        updatedAt: h.updatedAt || timestamp
      };
    };

    if (realDb) {
      const colRef = collection(realDb, 'users', userId, 'holdings');
      const snapshot = await getDocs(colRef);
      const holdings: Holding[] = [];
      snapshot.forEach(doc => {
        holdings.push(migrateHolding({ id: doc.id, ...doc.data() }));
      });
      return holdings.sort((a, b) => a.symbol.localeCompare(b.symbol));
    } else {
      const saved = localStorage.getItem(`holdings_${userId}`);
      const raw: any[] = saved ? JSON.parse(saved) : [];
      const holdings: Holding[] = raw.map(item => migrateHolding(item));
      return holdings.sort((a, b) => a.symbol.localeCompare(b.symbol));
    }
  },

  async addHolding(userId: string, data: Omit<Holding, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Holding> {
    const timestamp = new Date().toISOString();
    if (realDb) {
      const colRef = collection(realDb, 'users', userId, 'holdings');
      const docRef = doc(colRef);
      const newHolding: Holding = {
        id: docRef.id,
        userId,
        ...data,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await setDoc(docRef, newHolding);
      return newHolding;
    } else {
      const saved = localStorage.getItem(`holdings_${userId}`);
      const holdings: Holding[] = saved ? JSON.parse(saved) : [];
      const newHolding: Holding = {
        id: 'holding_' + Math.random().toString(36).substr(2, 9),
        userId,
        ...data,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      holdings.push(newHolding);
      localStorage.setItem(`holdings_${userId}`, JSON.stringify(holdings));
      return newHolding;
    }
  },

  async updateHolding(userId: string, holdingId: string, updates: Partial<Omit<Holding, 'id' | 'userId' | 'createdAt'>>): Promise<void> {
    const timestamp = new Date().toISOString();
    if (realDb) {
      const docRef = doc(realDb, 'users', userId, 'holdings', holdingId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: timestamp
      });
    } else {
      const saved = localStorage.getItem(`holdings_${userId}`);
      const holdings: Holding[] = saved ? JSON.parse(saved) : [];
      const index = holdings.findIndex(h => h.id === holdingId);
      if (index !== -1) {
        holdings[index] = {
          ...holdings[index],
          ...updates,
          updatedAt: timestamp
        };
        localStorage.setItem(`holdings_${userId}`, JSON.stringify(holdings));
      }
    }
  },

  async deleteHolding(userId: string, holdingId: string): Promise<void> {
    if (realDb) {
      const docRef = doc(realDb, 'users', userId, 'holdings', holdingId);
      await deleteDoc(docRef);
    } else {
      const saved = localStorage.getItem(`holdings_${userId}`);
      let holdings: Holding[] = saved ? JSON.parse(saved) : [];
      holdings = holdings.filter(h => h.id !== holdingId);
      localStorage.setItem(`holdings_${userId}`, JSON.stringify(holdings));
    }
  },

  async savePortfolioSnapshot(userId: string, snapshot: { date: string; portfolioValue: number; investedCapital: number; gainLoss: number; holdingsCount: number }): Promise<void> {
    if (realDb) {
      const docRef = doc(realDb, 'users', userId, 'portfolioSnapshots', snapshot.date);
      await setDoc(docRef, snapshot);
    } else {
      const saved = localStorage.getItem(`snapshots_${userId}`);
      const list: any[] = saved ? JSON.parse(saved) : [];
      const filtered = list.filter(item => item.date !== snapshot.date);
      filtered.push(snapshot);
      localStorage.setItem(`snapshots_${userId}`, JSON.stringify(filtered));
    }
  },

  async getWatchlist(userId: string): Promise<WatchlistItem[]> {
    if (realDb) {
      const colRef = collection(realDb, 'users', userId, 'watchlist');
      const snapshot = await getDocs(colRef);
      const items: WatchlistItem[] = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        items.push({
          id: doc.id,
          userId,
          symbol: d.symbol || '',
          ticker: d.ticker || d.symbol || '',
          exchange: d.exchange || 'NASDAQ',
          currency: d.currency || 'USD',
          name: d.name || d.symbol || '',
          addedAt: d.addedAt || new Date().toISOString()
        });

      });
      return items.sort((a, b) => a.symbol.localeCompare(b.symbol));
    } else {
      const saved = localStorage.getItem(`watchlist_${userId}`);
      const items: WatchlistItem[] = saved ? JSON.parse(saved) : [];
      return items.sort((a, b) => a.symbol.localeCompare(b.symbol));
    }
  },

  async addWatchlistItem(userId: string, item: Omit<WatchlistItem, 'id' | 'userId' | 'addedAt'>): Promise<WatchlistItem> {
    const timestamp = new Date().toISOString();
    if (realDb) {
      const colRef = collection(realDb, 'users', userId, 'watchlist');
      const docRef = doc(colRef);
      const newItem: WatchlistItem = {
        id: docRef.id,
        userId,
        ...item,
        addedAt: timestamp
      };
      await setDoc(docRef, newItem);
      return newItem;
    } else {
      const saved = localStorage.getItem(`watchlist_${userId}`);
      const items: WatchlistItem[] = saved ? JSON.parse(saved) : [];
      const newItem: WatchlistItem = {
        id: 'watch_' + Math.random().toString(36).substr(2, 9),
        userId,
        ...item,
        addedAt: timestamp
      };
      items.push(newItem);
      localStorage.setItem(`watchlist_${userId}`, JSON.stringify(items));
      return newItem;
    }
  },

  async deleteWatchlistItem(userId: string, itemId: string): Promise<void> {
    if (realDb) {
      const docRef = doc(realDb, 'users', userId, 'watchlist', itemId);
      await deleteDoc(docRef);
    } else {
      const saved = localStorage.getItem(`watchlist_${userId}`);
      let items: WatchlistItem[] = saved ? JSON.parse(saved) : [];
      items = items.filter(i => i.id !== itemId);
      localStorage.setItem(`watchlist_${userId}`, JSON.stringify(items));
    }
  },

  async getReports(userId: string): Promise<DailyReport[]> {
    if (realDb) {
      const colRef = collection(realDb, 'users', userId, 'reports');
      const snapshot = await getDocs(colRef);
      const list: DailyReport[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as DailyReport);
      });
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else {
      const saved = localStorage.getItem(`reports_${userId}`);
      const list: DailyReport[] = saved ? JSON.parse(saved) : [];
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  },

  async getReport(userId: string, reportId: string): Promise<DailyReport | null> {
    if (realDb) {
      const docRef = doc(realDb, 'users', userId, 'reports', reportId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return { id: snapshot.id, ...snapshot.data() } as DailyReport;
      }
      return null;
    } else {
      const saved = localStorage.getItem(`reports_${userId}`);
      const list: DailyReport[] = saved ? JSON.parse(saved) : [];
      const item = list.find(r => r.id === reportId);
      return item || null;
    }
  },

  async saveReport(userId: string, report: Omit<DailyReport, 'id' | 'createdAt'>): Promise<DailyReport> {
    const timestamp = new Date().toISOString();
    if (realDb) {
      const colRef = collection(realDb, 'users', userId, 'reports');
      const docRef = doc(colRef);
      const newReport: DailyReport = {
        id: docRef.id,
        ...report,
        createdAt: timestamp
      };
      await setDoc(docRef, newReport);
      return newReport;
    } else {
      const saved = localStorage.getItem(`reports_${userId}`);
      const list: DailyReport[] = saved ? JSON.parse(saved) : [];
      const newReport: DailyReport = {
        id: 'report_' + Math.random().toString(36).substr(2, 9),
        ...report,
        createdAt: timestamp
      };
      list.push(newReport);
      localStorage.setItem(`reports_${userId}`, JSON.stringify(list));
      return newReport;
    }
  }
,

  async deleteReport(userId: string, reportId: string): Promise<void> {
    if (realDb) {
      const docRef = doc(realDb, 'users', userId, 'reports', reportId);
      await deleteDoc(docRef);
    } else {
      const saved = localStorage.getItem(`reports_${userId}`);
      let list: DailyReport[] = saved ? JSON.parse(saved) : [];
      list = list.filter(r => r.id !== reportId);
      localStorage.setItem(`reports_${userId}`, JSON.stringify(list));
    }
  },

  async getOpportunities(userId: string): Promise<Opportunity[]> {
    if (realDb) {
      const docRef = doc(realDb, 'users', userId, 'opportunities', 'latest');
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        return (data.items || []) as Opportunity[];
      }
      return [];
    } else {
      const saved = localStorage.getItem(`opportunities_${userId}`);
      const list: Opportunity[] = saved ? JSON.parse(saved) : [];
      return list.sort((a, b) => b.generatedTimestamp.localeCompare(a.generatedTimestamp));
    }
  },

  async saveOpportunities(userId: string, opportunities: Omit<Opportunity, 'id'>[]): Promise<Opportunity[]> {
    const timestamp = new Date().toISOString();
    const savedList: Opportunity[] = opportunities.map(opp => ({
      id: 'opp_' + Math.random().toString(36).substr(2, 9),
      ...opp,
      generatedTimestamp: timestamp
    }));

    if (realDb) {
      const docRef = doc(realDb, 'users', userId, 'opportunities', 'latest');
      await setDoc(docRef, {
        generatedTimestamp: timestamp,
        items: savedList
      });
      return savedList;
    } else {
      localStorage.setItem(`opportunities_${userId}`, JSON.stringify(savedList));
      return savedList;
    }
  },

  async getAICommentary(userId: string, id: string): Promise<AICommentary | null> {
    if (realDb) {
      const docRef = doc(realDb, 'users', userId, 'aiCommentary', id);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as AICommentary;
      }
      return null;
    } else {
      const saved = localStorage.getItem(`ai_commentary_${userId}_${id}`);
      return saved ? JSON.parse(saved) : null;
    }
  },

  async saveAICommentary(userId: string, id: string, commentary: Omit<AICommentary, 'id' | 'userId'>): Promise<AICommentary> {
    const data: AICommentary = {
      id,
      userId,
      ...commentary
    };
    if (realDb) {
      const docRef = doc(realDb, 'users', userId, 'aiCommentary', id);
      await setDoc(docRef, data);
      return data;
    } else {
      localStorage.setItem(`ai_commentary_${userId}_${id}`, JSON.stringify(data));
      return data;
    }
  },

  async getDispatchHistory(userId: string): Promise<any[]> {
    if (realDb) {
      const colRef = collection(realDb, 'users', userId, 'dispatchHistory');
      const snapshot = await getDocs(colRef);
      const list: any[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      return list.sort((a: any, b: any) => b.generatedAt.localeCompare(a.generatedAt));
    } else {
      const saved = localStorage.getItem(`dispatchHistory_${userId}`);
      const list = saved ? JSON.parse(saved) : [];
      return list.sort((a: any, b: any) => b.generatedAt.localeCompare(a.generatedAt));
    }
  },

  async getCompanyIntelligence(ticker: string, exchange: string): Promise<CompanyIntelligence | null> {
    const key = `${ticker}:${exchange}`;
    if (realDb) {
      const docRef = doc(realDb, 'companyIntelligence', key);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as CompanyIntelligence;
      }
      return null;
    } else {
      const saved = localStorage.getItem(`company_intelligence_${key}`);
      return saved ? JSON.parse(saved) : null;
    }
  },

  async saveCompanyIntelligence(intel: CompanyIntelligence): Promise<CompanyIntelligence> {
    const key = `${intel.ticker}:${intel.exchange}`;
    if (realDb) {
      const docRef = doc(realDb, 'companyIntelligence', key);
      await setDoc(docRef, intel);
      return intel;
    } else {
      localStorage.setItem(`company_intelligence_${key}`, JSON.stringify(intel));
      return intel;
    }
  },

  async getUserConviction(userId: string, ticker: string, exchange: string): Promise<UserConviction | null> {
    const key = `${ticker}:${exchange}`;
    if (realDb) {
      const docRef = doc(realDb, 'users', userId, 'convictions', key);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as UserConviction;
      }
      return null;
    } else {
      const saved = localStorage.getItem(`user_conviction_${userId}_${key}`);
      return saved ? JSON.parse(saved) : null;
    }
  },

  async saveUserConviction(conviction: UserConviction): Promise<UserConviction> {
    const key = `${conviction.ticker}:${conviction.exchange}`;
    if (realDb) {
      const docRef = doc(realDb, 'users', conviction.userId, 'convictions', key);
      await setDoc(docRef, conviction);
      return conviction;
    } else {
      localStorage.setItem(`user_conviction_${conviction.userId}_${key}`, JSON.stringify(conviction));
      return conviction;
    }
  },

  async getAllUserConvictions(userId: string): Promise<UserConviction[]> {
    if (realDb) {
      const colRef = collection(realDb, 'users', userId, 'convictions');
      const snapshot = await getDocs(colRef);
      const list: UserConviction[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as UserConviction);
      });
      return list;
    } else {
      const list: UserConviction[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`user_conviction_${userId}_`)) {
          const item = localStorage.getItem(key);
          if (item) list.push(JSON.parse(item));
        }
      }
      return list;
    }
  },

  async savePortfolioHistoryRecord(userId: string, record: any): Promise<void> {
    if (realDb) {
      const docRef = doc(realDb, 'users', userId, 'portfolioHistory', record.date);
      await setDoc(docRef, record);
    } else {
      localStorage.setItem(`portfolio_history_${userId}_${record.date}`, JSON.stringify(record));
    }
  },

  async getPortfolioHistoryRecord(userId: string, date: string): Promise<any | null> {
    if (realDb) {
      const docRef = doc(realDb, 'users', userId, 'portfolioHistory', date);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data();
      }
      return null;
    } else {
      const saved = localStorage.getItem(`portfolio_history_${userId}_${date}`);
      return saved ? JSON.parse(saved) : null;
    }
  },

  async getAllPortfolioHistoryRecords(userId: string): Promise<any[]> {
    if (realDb) {
      const colRef = collection(realDb, 'users', userId, 'portfolioHistory');
      const snapshot = await getDocs(colRef);
      const list: any[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data());
      });
      return list.sort((a, b) => b.date.localeCompare(a.date));
    } else {
      const list: any[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`portfolio_history_${userId}_`)) {
          const item = localStorage.getItem(key);
          if (item) list.push(JSON.parse(item));
        }
      }
      return list.sort((a, b) => b.date.localeCompare(a.date));
    }
  },

  async saveAlert(userId: string, alert: any): Promise<void> {
    if (realDb) {
      const docRef = doc(realDb, 'users', userId, 'alerts', alert.id);
      await setDoc(docRef, alert);
    } else {
      localStorage.setItem(`alert_${userId}_${alert.id}`, JSON.stringify(alert));
    }
  },

  async getAlerts(userId: string): Promise<any[]> {
    if (realDb) {
      const colRef = collection(realDb, 'users', userId, 'alerts');
      const snapshot = await getDocs(colRef);
      const list: any[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data());
      });
      return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } else {
      const list: any[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`alert_${userId}_`)) {
          const item = localStorage.getItem(key);
          if (item) list.push(JSON.parse(item));
        }
      }
      return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }
  },

  async dismissAlert(userId: string, alertId: string): Promise<void> {
    if (realDb) {
      const docRef = doc(realDb, 'users', userId, 'alerts', alertId);
      await setDoc(docRef, { read: true }, { merge: true });
    } else {
      const key = `alert_${userId}_${alertId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const alert = JSON.parse(saved);
        alert.read = true;
        localStorage.setItem(key, JSON.stringify(alert));
      }
    }
  }
};



