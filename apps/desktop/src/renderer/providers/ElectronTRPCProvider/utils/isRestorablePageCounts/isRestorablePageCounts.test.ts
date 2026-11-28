import { describe, expect, test } from "bun:test";
import { isRestorablePageCounts } from "./isRestorablePageCounts";

const DAY = 24 * 60 * 60 * 1000;
const key = (input?: object) => [["page", "counts"], { input, type: "query" }];
const at = (queryKey: readonly unknown[], ageMs = 0) =>
	isRestorablePageCounts({
		queryKey,
		dataUpdatedAt: 1_000_000 - ageMs,
		now: 1_000_000,
		maxAgeMs: DAY,
	});

describe("isRestorablePageCounts", () => {
	test("keeps the counts Pages opens with", () => {
		expect(at(key({ pinnedIds: ["a"] }))).toBe(true);
		expect(at(key())).toBe(true);
	});

	test("drops every filtered variant", () => {
		expect(at(key({ pinnedIds: [], search: "report" }))).toBe(false);
		expect(at(key({ pinnedIds: [], archived: true }))).toBe(false);
		expect(at(key({ pinnedIds: [], workspaceIds: ["w"] }))).toBe(false);
	});

	test("drops counts last fetched more than the max age ago", () => {
		expect(at(key({ pinnedIds: ["a"] }), DAY + 1)).toBe(false);
	});
});
