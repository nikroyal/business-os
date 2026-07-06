import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src";
import { renderDailyFTEmail, renderWeeklyFTEmail } from "../src/dispatch";

describe("BusinessOS Backend Worker API Tests", () => {
	describe("GET /api/health", () => {
		it('responds with status "ok" (unit style)', async () => {
			const request = new Request("http://example.com/api/health");
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(200);
			const body = await response.json() as any;
			expect(body.status).toBe("ok");
		});

		it('responds with status "ok" (integration style)', async () => {
			const response = await SELF.fetch("http://example.com/api/health");
			expect(response.status).toBe(200);
			const body = await response.json() as any;
			expect(body.status).toBe("ok");
		});
	});

	describe("Authentication protection", () => {
		it("rejects unauthorized access with 401 for market-data endpoints", async () => {
			const response = await SELF.fetch("http://example.com/api/market-data/quote?symbol=AAPL");
			expect(response.status).toBe(401);
			const body = await response.json() as any;
			expect(body.error).toContain("Unauthorized");
		});

		it("rejects unauthorized access with 401 for commentary endpoints", async () => {
			const response = await SELF.fetch("http://example.com/api/commentary/generate", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					systemPrompt: "test",
					userPrompt: "test"
				})
			});
			expect(response.status).toBe(401);
		});

		it("allows access with mock authentication token prefix", async () => {
			// Using mock token which bypasses Google JWK verification
			const response = await SELF.fetch("http://example.com/api/market-data/quote?symbol=AAPL", {
				headers: {
					"Authorization": "Bearer mock_user123"
				}
			});
			// Since we don't have FINNHUB_API_KEY configured in vitest env, it will return 500 or fallback, but it won't be 401!
			expect(response.status).not.toBe(401);
		});
	});

	describe("GET /api/health/services", () => {
		it("rejects unauthorized access", async () => {
			const response = await SELF.fetch("http://example.com/api/health/services");
			expect(response.status).toBe(401);
		});

		it("returns all 7 services status structure when authenticated", async () => {
			const response = await SELF.fetch("http://example.com/api/health/services", {
				headers: {
					"Authorization": "Bearer mock_user123"
				}
			});
			expect(response.status).toBe(200);
			const data = await response.json() as any;
			
			expect(data).toHaveProperty("workers");
			expect(data).toHaveProperty("firestore");
			expect(data).toHaveProperty("finnhub");
			expect(data).toHaveProperty("gemini");
			expect(data).toHaveProperty("resend");
			expect(data).toHaveProperty("fred");
			expect(data).toHaveProperty("secEdgar");

			expect(data.workers).toHaveProperty("status");
			expect(data.workers).toHaveProperty("description");
			expect(data.fred).toHaveProperty("status");
			expect(data.fred).toHaveProperty("description");
			expect(data.secEdgar).toHaveProperty("status");
			expect(data.secEdgar).toHaveProperty("description");
		});
	});

	describe("POST /api/system/fred/refresh", () => {
		it("rejects unauthorized access", async () => {
			const response = await SELF.fetch("http://example.com/api/system/fred/refresh", {
				method: "POST"
			});
			expect(response.status).toBe(401);
		});

		it("allows access and triggers refresh when authenticated", async () => {
			const response = await SELF.fetch("http://example.com/api/system/fred/refresh", {
				method: "POST",
				headers: {
					"Authorization": "Bearer mock_user123"
				}
			});
			expect(response.status).toBe(200);
			const data = await response.json() as any;
			expect(data.success).toBe(true);
		});
	});

	describe("POST /api/system/sec/ingest", () => {
		it("rejects unauthorized access", async () => {
			const response = await SELF.fetch("http://example.com/api/system/sec/ingest", {
				method: "POST"
			});
			expect(response.status).toBe(401);
		});

		it("allows access and triggers ingest when authenticated", async () => {
			const response = await SELF.fetch("http://example.com/api/system/sec/ingest", {
				method: "POST",
				headers: {
					"Authorization": "Bearer mock_user123"
				}
			});
			expect(response.status).not.toBe(401);
		});
	});

	describe("Scheduled Worker Cron Trigger", () => {
		it("triggers the scheduled function without throwing", async () => {
			const ctx = createExecutionContext();
			const event = { cron: "*/30 * * * *" };
			// Run scheduled trigger
			await expect((async () => {
				if (worker.scheduled) {
					await worker.scheduled(event, env, ctx);
				}
				await waitOnExecutionContext(ctx);
			})()).resolves.not.toThrow();
		}, 15000);
	});

	describe("Email Template Rendering", () => {
		const mockProfile: any = {
			uid: "user123",
			email: "user@example.com",
			displayName: "John Doe",
			riskProfile: "moderate",
			interests: ["AI"],
			timezone: "UTC",
			emailPreferences: { dailyBriefing: true, weeklyReport: true, alerts: true },
			reportingCurrency: "USD"
		};

		const mockReport: any = {
			id: "report_123",
			userId: "user123",
			date: "2026-06-22",
			title: "Daily Briefing Title",
			summary: "Editorial summary text here.",
			sections: {
				marketSnapshot: {
					globalTrend: "bullish",
					usMarket: "US market commentary",
					indianMarket: "Indian market commentary",
					cryptoMarket: "Crypto market commentary"
				},
				portfolioSummary: {
					totalValue: 100000,
					totalGainLoss: 5000,
					performanceLabel: "Modest Gains",
					allocationHighlights: "High concentration in Tech"
				},
				watchlistMovers: [
					{ ticker: "AAPL", exchange: "NASDAQ", price: 180.50, changePercent: 1.25, direction: "up" }
				],
				riskFlags: [
					{ level: "warning", message: "Concentration high", suggestion: "Diversify positions" }
				],
				learningItem: {
					term: "HHI",
					definition: "Measure of concentration risk",
					context: "HHI under 1500 is good"
				}
			},
			createdAt: "2026-06-22T12:00:00Z"
		};

		it("renders daily FT email correctly without AI commentary", () => {
			const html = renderDailyFTEmail(mockProfile, mockReport, null);
			expect(html).toContain("Daily Briefing");
			expect(html).toContain("Daily Briefing Title");
			expect(html).toContain("Editorial summary text here.");
		});

		it("renders daily FT email correctly with AI commentary", () => {
			const mockCommentary = {
				executiveSummary: "AI summary context.",
				portfolioCommentary: "AI portfolio details.",
				riskCommentary: "AI risk details.",
				opportunityCommentary: "AI opportunities details.",
				marketContext: "AI market details."
			};
			const html = renderDailyFTEmail(mockProfile, mockReport, mockCommentary);
			expect(html).toContain("AI Editorial Insights");
			expect(html).toContain("AI summary context.");
		});

		it("renders weekly FT email correctly", () => {
			const mockAnalytics: any = {
				totalValue: 100000,
				totalCost: 95000,
				totalGainLoss: 5000,
				totalGainLossPercent: 5.26,
				sectorAllocation: [{ name: "Technology", value: 80000, percentage: 80 }],
				geographicAllocation: [{ name: "United States", value: 100000, percentage: 100, region: "North America" }],
				currencyExposure: [{ name: "USD", value: 100000, percentage: 100 }],
				concentrationRisk: { hhi: 6400, status: "High", topAssetWeight: 80, top3Weight: 100, description: "Highly concentrated" },
				topHoldings: [],
				bestPerformers: [],
				worstPerformers: [],
				diversification: { score: 45, status: "Average", description: "Moderate diversification" },
				health: { status: "Warning", score: 65, summary: "Warning state", flags: [] }
			};
			const html = renderWeeklyFTEmail(mockProfile, mockAnalytics, [], null);
			expect(html).toContain("Weekly Summary");
			expect(html).toContain("Weekly Portfolio Valuation");
			expect(html).toContain("6400 (High)");
		});
	});

	describe("Administrative APIs /api/admin/*", () => {
		it("rejects unauthorized access with 401", async () => {
			const response = await SELF.fetch("http://example.com/api/admin/users");
			expect(response.status).toBe(401);
		});

		it("rejects non-admin/owner access with 403", async () => {
			const response = await SELF.fetch("http://example.com/api/admin/users", {
				headers: {
					"Authorization": "Bearer mock_free_1"
				}
			});
			// Should return 403 Forbidden because mock_free_1 role is not OWNER or ADMIN
			expect(response.status).toBe(403);
		});

		it("allows access for mock OWNER token and returns list of users", async () => {
			const response = await SELF.fetch("http://example.com/api/admin/users", {
				headers: {
					"Authorization": "Bearer mock_owner_1"
				}
			});
			expect(response.status).toBe(200);
			const users = await response.json() as any[];
			expect(Array.isArray(users)).toBe(true);
		});

		it("returns system stats correctly when authenticated as OWNER", async () => {
			const response = await SELF.fetch("http://example.com/api/admin/system-stats", {
				headers: {
					"Authorization": "Bearer mock_owner_1"
				}
			});
			expect(response.status).toBe(200);
			const stats = await response.json() as any;
			expect(stats).toHaveProperty("health");
			expect(stats).toHaveProperty("apiAnalytics");
			expect(stats).toHaveProperty("queues");
			expect(stats.health.firestore.status).toBe("operational");
		});

		it("returns AI orchestrator stats correctly when authenticated as OWNER", async () => {
			const response = await SELF.fetch("http://example.com/api/admin/ai-orchestrator/stats", {
				headers: {
					"Authorization": "Bearer mock_owner_1"
				}
			});
			expect(response.status).toBe(200);
			const stats = await response.json() as any;
			expect(stats).toHaveProperty("overview");
			expect(stats).toHaveProperty("models");
			expect(stats).toHaveProperty("breakdowns");
		});
	});

	describe("CORS Configuration", () => {
		const pagesDevOrigin = "https://business-os-cf0.pages.dev";
		const localhostOrigin = "http://localhost:5173";
		const localhostOtherPortOrigin = "http://localhost:3000";
		const randomOrigin = "https://malicious-site.com";

		it("returns correct CORS headers for allowed production origin in GET request", async () => {
			const response = await SELF.fetch("http://example.com/api/health", {
				headers: {
					"Origin": pagesDevOrigin
				}
			});
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(pagesDevOrigin);
			expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
		});

		it("returns correct CORS headers for localhost origin in GET request", async () => {
			const response = await SELF.fetch("http://example.com/api/health", {
				headers: {
					"Origin": localhostOrigin
				}
			});
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(localhostOrigin);
			expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
		});

		it("returns correct CORS headers for other localhost ports in GET request", async () => {
			const response = await SELF.fetch("http://example.com/api/health", {
				headers: {
					"Origin": localhostOtherPortOrigin
				}
			});
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(localhostOtherPortOrigin);
			expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
		});

		it("returns production origin fallback for unauthorized/external origin", async () => {
			const response = await SELF.fetch("http://example.com/api/health", {
				headers: {
					"Origin": randomOrigin
				}
			});
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(pagesDevOrigin);
		});

		it("returns identical CORS headers for preflight OPTIONS request on allowed production origin", async () => {
			const response = await SELF.fetch("http://example.com/api/health", {
				method: "OPTIONS",
				headers: {
					"Origin": pagesDevOrigin,
					"Access-Control-Request-Method": "GET",
					"Access-Control-Request-Headers": "Authorization"
				}
			});
			expect(response.status).toBe(204);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(pagesDevOrigin);
			expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
			expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
		});

		it("returns identical CORS headers for preflight OPTIONS request on localhost origin", async () => {
			const response = await SELF.fetch("http://example.com/api/health", {
				method: "OPTIONS",
				headers: {
					"Origin": localhostOrigin,
					"Access-Control-Request-Method": "GET",
					"Access-Control-Request-Headers": "Authorization"
				}
			});
			expect(response.status).toBe(204);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(localhostOrigin);
			expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
		});
	});
});

