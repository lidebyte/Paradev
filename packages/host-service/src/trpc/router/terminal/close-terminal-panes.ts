import {
	allLayoutTabs,
	type PaneLayoutOpResult,
	type PaneLayoutRequest,
} from "@superset/shared/pane-layout-ops";

type ApplyPaneLayoutOp = (
	request: PaneLayoutRequest,
) => Promise<PaneLayoutOpResult>;

export async function closeTerminalPanes(
	apply: ApplyPaneLayoutOp,
	workspaceId: string,
	terminalId: string,
): Promise<string[]> {
	const { layout } = await apply({ workspaceId, op: { type: "list" } });
	const paneIds = allLayoutTabs(layout)
		.flatMap((tab) => tab.panes)
		.filter(
			(pane) => pane.kind === "terminal" && pane.terminalId === terminalId,
		)
		.map((pane) => pane.id);
	for (const paneId of paneIds) {
		await apply({ workspaceId, op: { type: "close", paneId } }).catch(
			(error) => {
				console.warn("[terminal] could not close a terminal pane", {
					paneId,
					error,
				});
			},
		);
	}
	return paneIds;
}
