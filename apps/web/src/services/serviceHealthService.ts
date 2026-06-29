import { authService, dbService } from './firebase';
import { buildApiUrl } from './urlBuilder';

export interface ServiceStatus {
  name: string;
  status:
    | 'operational'
    | 'degraded'
    | 'failure'
    | 'not_configured'
    | 'available'
    | 'healthy'
    | 'cache_empty'
    | 'waiting_for_scheduled_sync'
    | 'last_sync_failed';
  color: 'green' | 'orange' | 'red' | 'gray';
  description: string;
}

export interface PlatformHealth {
  lastChecked: string;
  services: {
    worker: ServiceStatus;
    firestore: ServiceStatus;
    finnhub: ServiceStatus;
    gemini: ServiceStatus;
    resend: ServiceStatus;
    fred: ServiceStatus;
    secEdgar: ServiceStatus;
    dataMoat: ServiceStatus;
  };
  lastSuccessDispatch?: string;
  lastFailedDispatch?: string;
}

const LOCAL_STORAGE_KEY = 'business_os_health_status';

export class ServiceHealthService {


  /**
   * Retrieves the last cached health status from localStorage.
   */
  public static getCachedHealth(): PlatformHealth | null {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!cached) return null;
    try {
      return JSON.parse(cached) as PlatformHealth;
    } catch {
      return null;
    }
  }

  /**
   * Performs a complete status check of all services.
   */
  public static async checkHealth(userId: string, force = false): Promise<PlatformHealth> {
    // Implement local caching to avoid excessive checks (60s threshold)
    const cached = this.getCachedHealth();
    if (cached && !force) {
      const ageMs = Date.now() - new Date(cached.lastChecked).getTime();
      if (ageMs < 60000) {
        console.log('[ServiceHealthService] Returning cached health status (age: ' + Math.round(ageMs/1000) + 's)');
        return cached;
      }
    }


    const generatedTimestamp = new Date().toISOString();

    // Default status skeleton
    const health: PlatformHealth = {
      lastChecked: generatedTimestamp,
      services: {
        worker: { name: 'Cloudflare Worker API', status: 'failure', color: 'red', description: 'Reaching edge backend...' },
        firestore: { name: 'Firestore', status: 'failure', color: 'red', description: 'Verifying DB connectivity...' },
        finnhub: { name: 'Finnhub', status: 'not_configured', color: 'gray', description: 'Pending API check' },
        gemini: { name: 'Gemini', status: 'not_configured', color: 'gray', description: 'Pending API check' },
        resend: { name: 'Resend', status: 'not_configured', color: 'gray', description: 'Pending API check' },
        fred: { name: 'FRED', status: 'available', color: 'green', description: 'Pending API check' },
        secEdgar: { name: 'SEC EDGAR', status: 'available', color: 'green', description: 'Pending API check' },
        dataMoat: { name: 'Data Moat & Cache', status: 'not_configured', color: 'gray', description: 'Pending API check' },
      }
    };

    // Helper to map backend status to standard colors
    const mapStatus = (status: string): { status: any; color: any } => {
      switch (status) {
        case 'available':
        case 'healthy':
        case 'operational':
          return { status, color: 'green' };
        case 'cache_empty':
        case 'waiting_for_scheduled_sync':
        case 'degraded':
          return { status, color: 'orange' };
        case 'last_sync_failed':
        case 'failure':
          return { status, color: 'red' };
        case 'not_configured':
          return { status: 'not_configured', color: 'gray' };
        default:
          return { status, color: 'red' };
      }
    };

    // 1. Worker API check
    let workerAlive = false;
    try {
      const res = await fetch(buildApiUrl('api/health'));
      if (res.ok) {
        const data = await res.json() as any;
        health.services.worker = {
          name: 'Cloudflare Worker API',
          status: 'operational',
          color: 'green',
          description: data.runtime ? `Operational on ${data.runtime}` : 'Operational'
        };
        workerAlive = true;
      } else {
        health.services.worker = {
          name: 'Cloudflare Worker API',
          status: 'failure',
          color: 'red',
          description: `Backend returned status ${res.status}`
        };
      }
    } catch (err: any) {
      health.services.worker = {
        name: 'Cloudflare Worker API',
        status: 'failure',
        color: 'red',
        description: `Unreachable: ${err.message || err}`
      };
    }

    // 2. Firestore Connectivity check
    try {
      if (authService.isMock) {
        health.services.firestore = {
          name: 'Firestore',
          status: 'operational',
          color: 'green',
          description: 'Local storage emulation operational'
        };
      } else {
        // Quick query to verify Firestore connectivity
        await dbService.getUserProfile(userId);
        health.services.firestore = {
          name: 'Firestore',
          status: 'operational',
          color: 'green',
          description: 'Connection active and operational'
        };
      }
    } catch (err: any) {
      health.services.firestore = {
        name: 'Firestore',
        status: 'failure',
        color: 'red',
        description: `Connection failed: ${err.message || err}`
      };
    }

    // 3. Worker-based proxy service checks (Finnhub, Gemini, Resend, FRED, SEC EDGAR)
    if (workerAlive) {
      try {
        const token = await authService.getIdToken();
        const res = await fetch(buildApiUrl('api/health/services'), {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          const serviceStatuses = await res.json() as any;

          // Finnhub
          if (serviceStatuses.finnhub) {
            const mapped = mapStatus(serviceStatuses.finnhub.status);
            health.services.finnhub = {
              name: 'Finnhub',
              status: mapped.status,
              color: mapped.color,
              description: serviceStatuses.finnhub.description
            };
          }

          // Gemini
          if (serviceStatuses.gemini) {
            const mapped = mapStatus(serviceStatuses.gemini.status);
            health.services.gemini = {
              name: 'Gemini',
              status: mapped.status,
              color: mapped.color,
              description: serviceStatuses.gemini.description
            };
          }

          // Resend
          if (serviceStatuses.resend) {
            const mapped = mapStatus(serviceStatuses.resend.status);
            health.services.resend = {
              name: 'Resend',
              status: mapped.status,
              color: mapped.color,
              description: serviceStatuses.resend.description
            };
          }

          // FRED
          if (serviceStatuses.fred) {
            const mapped = mapStatus(serviceStatuses.fred.status);
            health.services.fred = {
              name: 'FRED',
              status: mapped.status,
              color: mapped.color,
              description: serviceStatuses.fred.description,
              metadata: serviceStatuses.fred.metadata
            } as any;
          }

          // SEC EDGAR
          if (serviceStatuses.secEdgar) {
            const mapped = mapStatus(serviceStatuses.secEdgar.status);
            health.services.secEdgar = {
              name: 'SEC EDGAR',
              status: mapped.status,
              color: mapped.color,
              description: serviceStatuses.secEdgar.description,
              metadata: serviceStatuses.secEdgar.metadata
            } as any;
          }
        } else {
          // Worker was reachable but status services endpoint failed (e.g., unauthorized)
          const desc = `Health endpoint returned status ${res.status}`;
          health.services.finnhub = { name: 'Finnhub', status: 'failure', color: 'red', description: desc };
          health.services.gemini = { name: 'Gemini', status: 'failure', color: 'red', description: desc };
          health.services.resend = { name: 'Resend', status: 'failure', color: 'red', description: desc };
          health.services.fred = { name: 'FRED', status: 'failure', color: 'red', description: desc };
          health.services.secEdgar = { name: 'SEC EDGAR', status: 'failure', color: 'red', description: desc };
        }
      } catch (err: any) {
        const desc = `Verification failed: ${err.message || err}`;
        health.services.finnhub = { name: 'Finnhub', status: authService.isMock ? 'not_configured' : 'failure', color: authService.isMock ? 'gray' : 'red', description: desc };
        health.services.gemini = { name: 'Gemini', status: authService.isMock ? 'not_configured' : 'failure', color: authService.isMock ? 'gray' : 'red', description: desc };
        health.services.resend = { name: 'Resend', status: authService.isMock ? 'not_configured' : 'failure', color: authService.isMock ? 'gray' : 'red', description: desc };
        
        if (authService.isMock) {
          const { secStatus, secDesc, secMeta, fredStatus, fredDesc, fredMeta } = this.getMockOfflinePublicServicesHealth();
          health.services.secEdgar = { name: 'SEC EDGAR', status: secStatus, color: secStatus === 'healthy' ? 'green' : 'orange', description: secDesc, metadata: secMeta } as any;
          health.services.fred = { name: 'FRED', status: fredStatus, color: fredStatus === 'healthy' ? 'green' : 'orange', description: fredDesc, metadata: fredMeta } as any;
        } else {
          health.services.fred = { name: 'FRED', status: 'failure', color: 'red', description: desc };
          health.services.secEdgar = { name: 'SEC EDGAR', status: 'failure', color: 'red', description: desc };
        }
      }
    } else {
      // Worker is down, so backend services are implicitly unreachable
      const desc = 'Cloudflare Worker is down / unreachable';
      health.services.finnhub = { name: 'Finnhub', status: authService.isMock ? 'not_configured' : 'failure', color: authService.isMock ? 'gray' : 'red', description: desc };
      health.services.gemini = { name: 'Gemini', status: authService.isMock ? 'not_configured' : 'failure', color: authService.isMock ? 'gray' : 'red', description: desc };
      health.services.resend = { name: 'Resend', status: authService.isMock ? 'not_configured' : 'failure', color: authService.isMock ? 'gray' : 'red', description: desc };
      
      if (authService.isMock) {
        const { secStatus, secDesc, secMeta, fredStatus, fredDesc, fredMeta } = this.getMockOfflinePublicServicesHealth();
        health.services.secEdgar = { name: 'SEC EDGAR', status: secStatus, color: secStatus === 'healthy' ? 'green' : 'orange', description: secDesc, metadata: secMeta } as any;
        health.services.fred = { name: 'FRED', status: fredStatus, color: fredStatus === 'healthy' ? 'green' : 'orange', description: fredDesc, metadata: fredMeta } as any;
      } else {
        health.services.fred = { name: 'FRED', status: 'failure', color: 'red', description: desc };
        health.services.secEdgar = { name: 'SEC EDGAR', status: 'failure', color: 'red', description: desc };
      }
    }

    // 4. Data Quality cache check
    if (workerAlive) {
      try {
        const token = await authService.getIdToken();
        const res = await fetch(buildApiUrl('api/system/data-quality'), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const dq = await res.json() as any;
          const score = dq.overallHealthScore ?? 0;
          let status: 'operational' | 'degraded' | 'failure' = 'operational';
          let color: 'green' | 'orange' | 'red' = 'green';
          if (score < 50) {
            status = 'failure';
            color = 'red';
          } else if (score < 85) {
            status = 'degraded';
            color = 'orange';
          }
          health.services.dataMoat = {
            name: 'Data Moat & Cache',
            status,
            color,
            description: `Health score: ${score}%. Caches are populated & verified.`
          };
        } else {
          health.services.dataMoat = {
            name: 'Data Moat & Cache',
            status: 'degraded',
            color: 'orange',
            description: `Failed to load data quality: HTTP ${res.status}`
          };
        }
      } catch (err: any) {
        health.services.dataMoat = {
          name: 'Data Moat & Cache',
          status: 'failure',
          color: 'red',
          description: `Data quality check failed: ${err.message || err}`
        };
      }
    } else {
      health.services.dataMoat = {
        name: 'Data Moat & Cache',
        status: 'failure',
        color: 'red',
        description: 'Cloudflare Worker is down'
      };
    }

    // Fetch dispatch history to identify last success and last failed dispatches
    try {
      const history = await dbService.getDispatchHistory(userId);
      const lastSuccess = history.find((h: any) => h.status === 'success');
      const lastFailed = history.find((h: any) => h.status === 'failed');
      if (lastSuccess) {
        health.lastSuccessDispatch = lastSuccess.deliveredAt || lastSuccess.generatedAt;
      }
      if (lastFailed) {
        health.lastFailedDispatch = lastFailed.generatedAt;
      }
    } catch (err) {
      console.warn('Failed to fetch dispatch history for health metrics:', err);
    }

    // Persist last successful health check to localStorage
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(health));

    return health;
  }

  /**
   * Helper to derive public services health status when running offline in Demo Mode.
   */
  private static getMockOfflinePublicServicesHealth() {
    let secCachedCount = 0;
    let oldestFilingDateStr = '';
    let hasStaleCompany = false;
    const secTickers = ['AAPL', 'MSFT'];

    for (const t of secTickers) {
      const cached = localStorage.getItem(`sec_facts_${t}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          secCachedCount++;
          const filings = parsed.data?.recentFilings || [];
          for (const f of filings) {
            if (f.filingDate && (!oldestFilingDateStr || f.filingDate < oldestFilingDateStr)) {
              oldestFilingDateStr = f.filingDate;
            }
          }
          const ageMs = Date.now() - parsed.cachedAt;
          if (ageMs > 5 * 24 * 60 * 60 * 1000) {
            hasStaleCompany = true;
          }
        } catch {}
      }
    }

    const secStatus = secCachedCount === 0 
      ? 'cache_empty' 
      : hasStaleCompany 
        ? 'waiting_for_scheduled_sync' 
        : 'healthy';

    const secDesc = secCachedCount === 0 
      ? 'SEC filings cache is empty (Offline).' 
      : `SEC EDGAR is available (Offline). ${secCachedCount} mock companies cached.`;

    const secMeta = {
      lastIngestionRun: new Date().toISOString(),
      companiesCached: secCachedCount,
      filingsCached: secCachedCount * 3,
      oldestCachedFilingAge: oldestFilingDateStr ? Math.floor((Date.now() - new Date(oldestFilingDateStr).getTime()) / (1000 * 3600 * 24)) : 0,
      cacheFreshness: secCachedCount === 0 ? 'missing' : hasStaleCompany ? 'stale' : 'fresh'
    };

    return {
      secStatus,
      secDesc,
      secMeta,
      fredStatus: 'healthy',
      fredDesc: 'FRED economic indicators are operational (Offline).',
      fredMeta: {
        lastSuccessfulCheck: new Date().toISOString(),
        apiConnectivity: 'connected',
        latestIndicatorCount: 7,
        cacheFreshness: 'fresh'
      }
    };
  }
}

export default ServiceHealthService;
