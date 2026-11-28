import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SUPERSET_MANAGED_SKILLS } from "@superset/shared/plugins";
import matter from "gray-matter";
import {
	BUNDLED_SKILLS_DIR,
	fetchSkill,
	SKILL_NAMES,
	skillResponse,
	withFrontmatterName,
} from "./skills-source";

const ORIGIN = "https://paradev.com";

const get = (skill: string) =>
	skillResponse(
		new Request(`${ORIGIN}/.well-known/agent-skills/${skill}/SKILL.md`),
		skill,
	);

describe("agent skills source", () => {
	test("publishes every bundled skill as paradev-<name>, plus superset-mcp", () => {
		expect(SKILL_NAMES).toEqual([
			...SUPERSET_MANAGED_SKILLS.map((skill) => `paradev-${skill.name}`),
			"superset-mcp",
		]);
	});

	test("serves each bundled skill under its published name", async () => {
		for (const { name } of SUPERSET_MANAGED_SKILLS) {
			const response = await get(`paradev-${name}`);
			expect(response.status).toBe(200);
			expect(matter(await response.text()).data.name).toBe(`paradev-${name}`);
		}
	});

	test("changes only the name line of the served file", async () => {
		const source = await readFile(
			path.join(BUNDLED_SKILLS_DIR, "page", "SKILL.md"),
			"utf-8",
		);
		const served = await fetchSkill("paradev-page");
		expect(served).toBe(source.replace(/^name: page$/m, "name: paradev-page"));
		const before = matter(source);
		const after = matter(served ?? "");
		expect(after.content).toBe(before.content);
		expect(after.data).toEqual({ ...before.data, name: "paradev-page" });
	});

	test("bare and superset- names redirect permanently to paradev-<name>", async () => {
		for (const skill of ["orchestrate", "superset-orchestrate"]) {
			const response = await get(skill);
			expect(response.status).toBe(308);
			expect(response.headers.get("location")).toBe(
				`${ORIGIN}/.well-known/agent-skills/paradev-orchestrate/SKILL.md`,
			);
		}
	});

	test("an unknown name is not found", async () => {
		for (const skill of ["ghost", "superset-ghost", "paradev-ghost"]) {
			expect((await get(skill)).status).toBe(404);
		}
	});

	test("superset-mcp is not redirected", async () => {
		const original = globalThis.fetch;
		globalThis.fetch = (async () =>
			new Response(
				"---\nname: superset-mcp\n---\n",
			)) as unknown as typeof fetch;
		try {
			const response = await get("superset-mcp");
			expect(response.status).toBe(200);
			expect(await response.text()).toBe("---\nname: superset-mcp\n---\n");
		} finally {
			globalThis.fetch = original;
		}
	});
});

describe("withFrontmatterName", () => {
	test("rewrites only the name line inside the frontmatter", () => {
		const file =
			"---\nname: page\ndescription: x\n---\n\nname: body line stays\n";
		expect(withFrontmatterName(file, "paradev-page")).toBe(
			"---\nname: paradev-page\ndescription: x\n---\n\nname: body line stays\n",
		);
	});

	test("leaves a file without frontmatter alone", () => {
		expect(withFrontmatterName("name: x\n", "y")).toBe("name: x\n");
	});
});
