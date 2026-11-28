/** Antigravity CLI transcript usage (`~/.gemini/antigravity-cli/brain`). */
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { UsageLogEntry } from "./parse";
import { forEachLine, toSessionLabel } from "./parse";

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as JsonObject)
		: null;
}

function numberAt(value: JsonObject, keys: string[]): number {
	for (const key of keys) {
		const candidate = value[key];
		if (typeof candidate === "number" && Number.isFinite(candidate)) {
			return Math.max(0, candidate);
		}
	}
	return 0;
}

function findUsage(value: unknown, depth = 0): JsonObject | null {
	if (depth > 5) return null;
	const current = object(value);
	if (!current) return null;
	for (const key of ["usage", "usage_metadata", "usageMetadata"]) {
		const usage = object(current[key]);
		if (usage) return usage;
	}
	for (const child of Object.values(current)) {
		const found = findUsage(child, depth + 1);
		if (found) return found;
	}
	return null;
}

interface TokenFields {
	input: number;
	cached: number;
	cacheRead: number;
	output: number;
	reasoning: number;
}

function readTokens(usage: JsonObject): TokenFields {
	return {
		input: numberAt(usage, [
			"input_tokens",
			"inputTokens",
			"prompt_token_count",
			"promptTokenCount",
		]),
		cached: numberAt(usage, [
			"cached_input_tokens",
			"cachedInputTokens",
			"cached_content_token_count",
			"cachedContentTokenCount",
		]),
		// agy counts cache reads outside input_tokens; Gemini counts them inside.
		cacheRead: numberAt(usage, ["cache_read_tokens", "cacheReadTokens"]),
		output: numberAt(usage, [
			"output_tokens",
			"outputTokens",
			"candidates_token_count",
			"candidatesTokenCount",
		]),
		reasoning: numberAt(usage, [
			"reasoning_tokens",
			"reasoningTokens",
			"thoughts_token_count",
			"thoughtsTokenCount",
		]),
	};
}

function hasTokens(tokens: TokenFields): boolean {
	return tokens.input + tokens.cached + tokens.cacheRead + tokens.output > 0;
}

export function parseAgyTranscriptLine(
	line: string,
	sessionId: string,
	cwd: string | null,
): UsageLogEntry | null {
	let value: JsonObject | null;
	try {
		value = object(JSON.parse(line));
	} catch {
		return null;
	}
	if (!value) return null;
	let usage = value;
	let tokens = readTokens(value);
	if (!hasTokens(tokens)) {
		const nested = findUsage(value);
		if (!nested) return null;
		usage = nested;
		tokens = readTokens(nested);
	}
	if (!hasTokens(tokens)) return null;
	const { input, cached, cacheRead, output, reasoning } = tokens;
	const rawTimestamp =
		value.created_at ?? value.timestamp ?? value.createdAt ?? usage.timestamp;
	const timestampMs =
		typeof rawTimestamp === "number"
			? rawTimestamp < 1e12
				? rawTimestamp * 1000
				: rawTimestamp
			: typeof rawTimestamp === "string"
				? Date.parse(rawTimestamp)
				: Number.NaN;
	if (!Number.isFinite(timestampMs)) return null;
	const modelValue = value.model ?? usage.model ?? value.model_id;
	const model =
		typeof modelValue === "string"
			? modelValue
			: ((object(modelValue)?.id as string | undefined) ?? "antigravity");
	return {
		agent: "agy",
		model,
		timestampMs,
		cwd,
		sessionId,
		uncachedInput: Math.max(0, input - cached),
		cachedInput: Math.min(input, cached) + cacheRead,
		cacheWrite5m: 0,
		cacheWrite1h: 0,
		output,
		reasoningOutput: Math.min(output, reasoning),
	};
}

/**
 * A transcript does not name its working directory. agy keeps it in its
 * conversation cache, and in the prompt history for a conversation that
 * started before the folder was trusted.
 */
async function readAgyWorkspaces(root: string): Promise<Map<string, string>> {
	const workspaces = new Map<string, string>();
	try {
		const cache = object(
			JSON.parse(
				await readFile(
					join(root, "cache", "conversation_metadata.json"),
					"utf8",
				),
			),
		);
		for (const [id, value] of Object.entries(
			object(cache?.conversations) ?? {},
		)) {
			const uris = object(object(value)?.summary)?.WorkspaceURIs;
			const uri = Array.isArray(uris) ? uris[0] : null;
			if (typeof uri !== "string" || !uri.startsWith("file://")) continue;
			try {
				workspaces.set(id, fileURLToPath(uri));
			} catch {}
		}
	} catch {}
	await forEachLine(join(root, "history.jsonl"), (line) => {
		let prompt: JsonObject | null = null;
		try {
			prompt = object(JSON.parse(line));
		} catch {
			return;
		}
		const id = prompt?.conversationId;
		const workspace = prompt?.workspace;
		if (
			typeof id === "string" &&
			typeof workspace === "string" &&
			!workspaces.has(id)
		) {
			workspaces.set(id, workspace);
		}
	}).catch(() => {});
	return workspaces;
}

const USER_REQUEST = /^<USER_REQUEST>\n([\s\S]*?)\n<\/USER_REQUEST>/;

function userRequest(content: unknown): unknown {
	return typeof content === "string"
		? (USER_REQUEST.exec(content)?.[1] ?? content)
		: content;
}

export async function collectAgyEntries(
	cutoffMs: number,
	out: UsageLogEntry[],
	sessionLabels: Map<string, string>,
	root = join(homedir(), ".gemini", "antigravity-cli"),
): Promise<number> {
	const brain = join(root, "brain");
	let sessions: string[];
	try {
		sessions = await readdir(brain);
	} catch {
		return 0;
	}
	const workspaces = await readAgyWorkspaces(root);
	let scanned = 0;
	for (const sessionId of sessions) {
		const path = join(
			brain,
			sessionId,
			".system_generated",
			"logs",
			"transcript_full.jsonl",
		);
		try {
			if ((await stat(path)).mtimeMs < cutoffMs) continue;
		} catch {
			continue;
		}
		scanned += 1;
		let cwd: string | null = workspaces.get(sessionId) ?? null;
		await forEachLine(path, (line) => {
			let envelope: JsonObject | null = null;
			try {
				envelope = object(JSON.parse(line));
			} catch {
				return;
			}
			if (!cwd) {
				const workspace = object(envelope?.workspace);
				const candidate =
					envelope?.cwd ?? workspace?.current_dir ?? workspace?.project_dir;
				if (typeof candidate === "string") cwd = candidate;
			}
			if (!sessionLabels.has(sessionId) && envelope?.type === "USER_INPUT") {
				const label = toSessionLabel(userRequest(envelope.content));
				if (label) sessionLabels.set(sessionId, label);
			}
			const entry = parseAgyTranscriptLine(line, sessionId, cwd);
			if (entry && entry.timestampMs >= cutoffMs) out.push(entry);
		});
	}
	return scanned;
}
