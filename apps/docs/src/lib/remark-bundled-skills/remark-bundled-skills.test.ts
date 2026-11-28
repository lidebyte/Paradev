import { expect, test } from "bun:test";
import { remarkBundledSkills } from "./remark-bundled-skills";

test("replaces the placeholder with a row per bundled skill", () => {
	const tree = {
		type: "root",
		children: [
			{ type: "paragraph", children: [] },
			{ type: "mdxJsxFlowElement", name: "BundledSkillsTable" },
		],
	};
	remarkBundledSkills()(tree);
	const table = tree.children[1] as {
		type: string;
		children: { children: { children: { value?: string }[] }[] }[];
	};
	expect(table.type).toBe("table");
	const names = table.children
		.slice(1)
		.map((row) => row.children[0]?.children[0]?.value);
	expect(names).toContain("paradev:orchestrate");
	expect(names.length).toBeGreaterThan(10);
});

test("leaves nodes without children as they were", () => {
	const text = { type: "text", value: "hi" };
	remarkBundledSkills()({ type: "root", children: [text] });
	expect(text).toEqual({ type: "text", value: "hi" });
});
