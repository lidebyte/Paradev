import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectAgyEntries, parseAgyTranscriptLine } from "./agy";
import type { UsageLogEntry } from "./parse";

describe("parseAgyTranscriptLine", () => {
	it("parses Gemini-style usage metadata", () => {
		const entry = parseAgyTranscriptLine(
			JSON.stringify({
				created_at: "2026-08-28T12:00:00Z",
				model: { id: "gemini-3.1-pro" },
				response: {
					usageMetadata: {
						promptTokenCount: 100,
						cachedContentTokenCount: 25,
						candidatesTokenCount: 30,
						thoughtsTokenCount: 10,
					},
				},
			}),
			"session-1",
			"/repo",
		);
		expect(entry).toMatchObject({
			agent: "agy",
			model: "gemini-3.1-pro",
			uncachedInput: 75,
			cachedInput: 25,
			output: 30,
			reasoningOutput: 10,
		});
	});

	it("parses agy step lines with top-level token counts", () => {
		const entry = parseAgyTranscriptLine(
			JSON.stringify({
				step_index: 3,
				source: "MODEL",
				type: "PLANNER_RESPONSE",
				status: "DONE",
				created_at: "2026-10-14T03:03:40Z",
				input_tokens: 3013,
				cache_read_tokens: 14973,
				output_tokens: 1518,
			}),
			"session-1",
			"/repo",
		);
		expect(entry).toMatchObject({
			agent: "agy",
			model: "antigravity",
			timestampMs: Date.parse("2026-10-14T03:03:40Z"),
			uncachedInput: 3013,
			cachedInput: 14973,
			output: 1518,
		});
	});

	it("prefers top-level agy tokens over a nested usage object", () => {
		const entry = parseAgyTranscriptLine(
			JSON.stringify({
				type: "PLANNER_RESPONSE",
				created_at: "2026-10-14T03:03:40Z",
				input_tokens: 100,
				output_tokens: 20,
				tool_calls: [{ args: { usage: { input_tokens: 9999 } } }],
			}),
			"session-1",
			"/repo",
		);
		expect(entry).toMatchObject({ uncachedInput: 100, output: 20 });
	});

	it("skips lines that are not JSON objects", () => {
		expect(parseAgyTranscriptLine("null", "session-1", "/repo")).toBeNull();
		expect(parseAgyTranscriptLine("[1,2]", "session-1", "/repo")).toBeNull();
	});
});

describe("collectAgyEntries", () => {
	function writeTranscript(root: string, sessionId: string, prompt: string) {
		const logs = join(root, "brain", sessionId, ".system_generated", "logs");
		mkdirSync(logs, { recursive: true });
		writeFileSync(
			join(logs, "transcript_full.jsonl"),
			[
				{
					type: "USER_INPUT",
					created_at: "2026-11-28T15:48:46Z",
					content: `<USER_REQUEST>\n${prompt}\n</USER_REQUEST>\n<ADDITIONAL_METADATA>\nThe current local time is: 2026-11-28T07:48:46-08:00.\n</ADDITIONAL_METADATA>`,
				},
				{
					type: "PLANNER_RESPONSE",
					created_at: "2026-11-28T15:48:47Z",
					model: "gemini-3.8-flash-low",
					input_tokens: 2295,
					cache_read_tokens: 12078,
					output_tokens: 53,
				},
			]
				.map((line) => JSON.stringify(line))
				.join("\n"),
		);
	}

	it("takes the project and session label from agy's own records", async () => {
		const root = mkdtempSync(join(tmpdir(), "agy-usage-"));
		writeTranscript(root, "in-cache", "Fix the flaky test");
		writeTranscript(root, "in-history", "Add a changelog entry");
		mkdirSync(join(root, "cache"));
		writeFileSync(
			join(root, "cache", "conversation_metadata.json"),
			JSON.stringify({
				conversations: {
					"in-cache": {
						summary: { WorkspaceURIs: ["file:///tmp/my%20repo"] },
					},
					"in-history": { summary: { WorkspaceURIs: null } },
				},
			}),
		);
		writeFileSync(
			join(root, "history.jsonl"),
			JSON.stringify({
				display: "continue",
				workspace: "/tmp/other-repo",
				conversationId: "in-history",
			}),
		);

		const out: UsageLogEntry[] = [];
		const labels = new Map<string, string>();
		await collectAgyEntries(0, out, labels, root);

		expect(
			Object.fromEntries(out.map((entry) => [entry.sessionId, entry.cwd])),
		).toEqual({ "in-cache": "/tmp/my repo", "in-history": "/tmp/other-repo" });
		expect(Object.fromEntries(labels)).toEqual({
			"in-cache": "Fix the flaky test",
			"in-history": "Add a changelog entry",
		});
	});
});
