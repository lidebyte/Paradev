import { BUNDLED_SKILLS } from "@superset/shared/plugins/bundled-skills";

const PLACEHOLDER = "BundledSkillsTable";

interface MdNode {
	type: string;
	name?: string;
	value?: string;
	children?: MdNode[];
}

const cell = (child: MdNode): MdNode => ({
	type: "tableCell",
	children: [child],
});

const row = (name: MdNode, description: string): MdNode => ({
	type: "tableRow",
	children: [cell(name), cell({ type: "text", value: description })],
});

export function bundledSkillsTable(
	skills: readonly { name: string; description: string }[],
): MdNode {
	return {
		type: "table",
		children: [
			row({ type: "text", value: "Skill" }, "What it does"),
			...skills.map((skill) =>
				row(
					{ type: "inlineCode", value: `superset:${skill.name}` },
					skill.description,
				),
			),
		],
	};
}

function replacePlaceholder(node: MdNode, table: MdNode): void {
	if (!node.children) return;
	node.children = node.children.map((child) => {
		if (child.type === "mdxJsxFlowElement" && child.name === PLACEHOLDER) {
			return table;
		}
		replacePlaceholder(child, table);
		return child;
	});
}

/** Replaces `<BundledSkillsTable />` with a markdown table of the bundled skills. */
export function remarkBundledSkills() {
	return (tree: MdNode) =>
		replacePlaceholder(tree, bundledSkillsTable(BUNDLED_SKILLS));
}
