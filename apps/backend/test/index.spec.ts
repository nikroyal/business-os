import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src";

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
});
