/**
 * Serialized with `toString()` into the board's HTML, so it must stay
 * self-contained: no imports and no references to other module-level names.
 */
export function renderBoard(toolResult: unknown): string {
	type Row = Record<string, unknown>;
	const escapeHtml = (value: unknown) =>
		String(value).replace(
			/[&<>"']/g,
			(char) =>
				({
					"&": "&amp;",
					"<": "&lt;",
					">": "&gt;",
					'"': "&quot;",
					"'": "&#39;",
				})[char] as string,
		);
	const text = (value: unknown) =>
		typeof value === "string" && value.length > 0 ? value : null;
	const statusOf = (row: Row) => {
		if (text(row.status)) return text(row.status) as string;
		if (row.archivedAt) return "archived";
		if (row.worktreeExists === false) return "missing";
		return null;
	};
	const toneOf = (status: string) => {
		if (status === "awake") return "success";
		if (status === "provisioning") return "info";
		if (status === "failed" || status === "missing") return "danger";
		return "neutral";
	};

	const result =
		toolResult && typeof toolResult === "object" ? (toolResult as Row) : {};
	if (result.isError) {
		const message = (Array.isArray(result.content) ? result.content : [])
			.map((part) =>
				part && typeof part === "object" ? text(part.text) : null,
			)
			.filter((part) => part !== null)
			.join("\n");
		return `<p class="error">${escapeHtml(message || "Could not list workspaces")}</p>`;
	}

	const content =
		result.structuredContent && typeof result.structuredContent === "object"
			? (result.structuredContent as Row)
			: {};
	const rows = (Array.isArray(content.result) ? content.result : []).filter(
		(row): row is Row => !!row && typeof row === "object",
	);
	if (rows.length === 0) {
		return '<p class="empty">No workspaces</p>';
	}

	const groups = new Map<string, Row[]>();
	for (const row of rows) {
		const project = text(row.projectName) ?? "Workspaces";
		groups.set(project, [...(groups.get(project) ?? []), row]);
	}

	return [...groups.entries()]
		.map(([project, projectRows]) => {
			const items = projectRows
				.map((row) => {
					const name =
						text(row.name) ?? text(row.branch) ?? text(row.id) ?? "Workspace";
					const branch = text(row.branch);
					const status = statusOf(row);
					return [
						'<li class="row">',
						`<span class="name">${escapeHtml(name)}</span>`,
						branch && branch !== name
							? `<span class="branch">${escapeHtml(branch)}</span>`
							: "",
						status
							? `<span class="status" data-tone="${toneOf(status)}">${escapeHtml(status)}</span>`
							: "",
						"</li>",
					].join("");
				})
				.join("");
			return [
				'<details class="group" open>',
				"<summary>",
				`<span class="project">${escapeHtml(project)}</span>`,
				`<span class="count">${projectRows.length}</span>`,
				"</summary>",
				`<ul>${items}</ul>`,
				"</details>",
			].join("");
		})
		.join("");
}
