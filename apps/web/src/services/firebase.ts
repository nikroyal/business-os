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
  updateDoc 
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
  createdAt?: string;
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
    if (realDb) {
      const docRef = doc(realDb, 'users', uid);
      await setDoc(docRef, profile, { merge: true });
    } else {
      localStorage.setItem(`profile_${uid}`, JSON.stringify(profile));
    }
  },

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    if (realDb) {
      const docRef = doc(realDb, 'users', uid);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as UserProfile;
      }
      return null;
    } else {
      const saved = localStorage.getItem(`profile_${uid}`);
      return saved ? JSON.parse(saved) : null;
    }
  },

  async updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    if (realDb) {
      const docRef = doc(realDb, 'users', uid);
      await updateDoc(docRef, updates as any);
    } else {
      const current = await this.getUserProfile(uid);
      if (current) {
        const merged = { ...current, ...updates };
        localStorage.setItem(`profile_${uid}`, JSON.stringify(merged));
      }
    }
  }
};
