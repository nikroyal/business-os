import { authService, dbService } from './firebase';

export interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'failure' | 'not_configured';
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
  };
}

const LOCAL_STORAGE_KEY = 'business_os_health_status';

export class ServiceHealthService {
  private static getApiBaseUrl(): string {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
    return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

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
  public static async checkHealth(userId: string): Promise<PlatformHealth> {
    const apiBaseUrl = this.getApiBaseUrl();
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
      }
    };

    // Helper to map backend status to standard colors
    const mapStatus = (status: string): { status: any; color: any } => {
      switch (status) {
        case 'operational':
          return { status: 'operational', color: 'green' };
        case 'degraded':
          return { status: 'degraded', color: 'orange' };
        case 'not_configured':
          return { status: 'not_configured', color: 'gray' };
        default:
          return { status: 'failure', color: 'red' };
      }
    };

    // 1. Worker API check
    let workerAlive = false;
    try {
      const res = await fetch(`${apiBaseUrl}/api/health`);
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

    // 3. Worker-based proxy service checks (Finnhub, Gemini, Resend)
    if (workerAlive) {
      try {
        const token = await authService.getIdToken();
        const res = await fetch(`${apiBaseUrl}/api/health/services`, {
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
        } else {
          // Worker was reachable but status services endpoint failed (e.g., unauthorized)
          const desc = `Health endpoint returned status ${res.status}`;
          health.services.finnhub = { name: 'Finnhub', status: 'failure', color: 'red', description: desc };
          health.services.gemini = { name: 'Gemini', status: 'failure', color: 'red', description: desc };
          health.services.resend = { name: 'Resend', status: 'failure', color: 'red', description: desc };
        }
      } catch (err: any) {
        const desc = `Verification failed: ${err.message || err}`;
        health.services.finnhub = { name: 'Finnhub', status: 'failure', color: 'red', description: desc };
        health.services.gemini = { name: 'Gemini', status: 'failure', color: 'red', description: desc };
        health.services.resend = { name: 'Resend', status: 'failure', color: 'red', description: desc };
      }
    } else {
      // Worker is down, so backend services are implicitly unreachable
      const desc = 'Cloudflare Worker is down / unreachable';
      health.services.finnhub = { name: 'Finnhub', status: 'failure', color: 'red', description: desc };
      health.services.gemini = { name: 'Gemini', status: 'failure', color: 'red', description: desc };
      health.services.resend = { name: 'Resend', status: 'failure', color: 'red', description: desc };
    }

    // Persist last successful health check to localStorage
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(health));

    return health;
  }
}

export default ServiceHealthService;
