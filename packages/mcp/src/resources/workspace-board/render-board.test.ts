import { expect, test } from "bun:test";
import { renderBoard as sourceRenderBoard } from "./render-board";

const renderBoard: typeof sourceRenderBoard = new Function(
	`return ${sourceRenderBoard.toString()}`,
)();

test("renders one row per workspace, grouped by project", () => {
	const html = renderBoard({
		structuredContent: {
			result: [
				{
					id: "1",
					hostId: "mac-mini",
					projectName: "paradev",
					name: "Fix <login>",
					branch: "fix-login",
					worktreeExists: true,
				},
				{
					id: "2",
					hostId: "mac-mini",
					projectName: "paradev",
					name: "Docs",
					branch: "docs",
					worktreeExists: false,
				},
				{ id: "3", name: "Cloud box", branch: "main", status: "awake" },
			],
		},
	});

	expect(html.match(/<details/g)).toHaveLength(2);
	expect(html.match(/<li class="row">/g)).toHaveLength(3);
	expect(html).not.toContain("mac-mini");
	expect(html).toContain('<span class="name">Fix &lt;login&gt;</span>');
	expect(html).toContain('<span class="branch">fix-login</span>');
	expect(html).toContain('data-tone="danger">missing</span>');
	expect(html).toContain('<span class="project">Workspaces</span>');
	expect(html).toContain('data-tone="success">awake</span>');
});

test("shows the tool error instead of an empty board", () => {
	const html = renderBoard({
		isError: true,
		content: [{ type: "text", text: "Host <offline>" }],
	});

	expect(html).toBe('<p class="error">Host &lt;offline&gt;</p>');
	expect(renderBoard({ structuredContent: { result: [] } })).toBe(
		'<p class="empty">No workspaces</p>',
	);
});
