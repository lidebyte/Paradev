import { readFile } from "node:fs/promises";
import path from "node:path";
import { SUPERSET_MANAGED_SKILLS } from "@superset/shared/plugins";

const MCP_SKILL_URL =
	"https://raw.githubusercontent.com/paradevai/skills/main/skills/superset-mcp/SKILL.md";
const MCP_SKILL_NAME = "superset-mcp";
const PUBLISHED_PREFIX = "paradev-";
const LEGACY_PREFIX = "superset-";

export const BUNDLED_SKILLS_DIR = path.join(
	process.cwd(),
	"../../plugins/paradev/skills",
);

const BUNDLED_NAMES: readonly string[] = SUPERSET_MANAGED_SKILLS.map(
	(skill) => skill.name,
);

const publishedName = (bundled: string) => `${PUBLISHED_PREFIX}${bundled}`;

export const SKILL_NAMES: readonly string[] = [
	...BUNDLED_NAMES.map(publishedName),
	MCP_SKILL_NAME,
];

export function skillUrl(name: string): string {
	return `/.well-known/agent-skills/${name}/SKILL.md`;
}

export function isSkillName(value: string): boolean {
	return SKILL_NAMES.includes(value);
}

/** The published name an old bare or `superset-<name>` URL now lives under, if any. */
export function legacySkillTarget(value: string): string | null {
	const name = value.startsWith(LEGACY_PREFIX)
		? value.slice(LEGACY_PREFIX.length)
		: value;
	return BUNDLED_NAMES.includes(name) ? publishedName(name) : null;
}

/** Sets the frontmatter `name:` line, leaving every other byte as it was. */
export function withFrontmatterName(content: string, name: string): string {
	const match = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(content);
	if (!match) return content;
	const frontmatter = match[0].replace(/^name:.*$/m, `name: ${name}`);
	return frontmatter + content.slice(match[0].length);
}

export async function fetchSkill(name: string): Promise<string | null> {
	const bundled = name.startsWith(PUBLISHED_PREFIX)
		? name.slice(PUBLISHED_PREFIX.length)
		: null;
	if (bundled !== null && BUNDLED_NAMES.includes(bundled)) {
		const content = await readFile(
			path.join(BUNDLED_SKILLS_DIR, bundled, "SKILL.md"),
			"utf-8",
		).catch(() => null);
		return content === null ? null : withFrontmatterName(content, name);
	}
	if (name !== MCP_SKILL_NAME) return null;
	const response = await fetch(MCP_SKILL_URL, { next: { revalidate: 3600 } });
	if (!response.ok) {
		return null;
	}
	return response.text();
}

export async function skillResponse(
	request: Request,
	skill: string,
): Promise<Response> {
	const target = legacySkillTarget(skill);
	if (target) {
		return Response.redirect(new URL(skillUrl(target), request.url), 308);
	}
	if (!isSkillName(skill)) {
		return new Response("Not found", { status: 404 });
	}
	const content = await fetchSkill(skill);
	if (!content) {
		return new Response("Skill source unavailable", { status: 503 });
	}
	return new Response(content, {
		headers: {
			"content-type": "text/markdown; charset=utf-8",
			"Cache-Control": "public, max-age=3600, s-maxage=3600",
		},
	});
}
