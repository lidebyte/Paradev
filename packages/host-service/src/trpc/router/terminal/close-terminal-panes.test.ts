import { describe, expect, test } from "bun:test";
import type {
	PaneLayoutPane,
	PaneLayoutRequest,
	PaneLayoutTab,
} from "@superset/shared/pane-layout-ops";
import { closeTerminalPanes } from "./close-terminal-panes";

function pane(id: string, kind: string, terminalId: string): PaneLayoutPane {
	return { id, kind, title: null, terminalId, active: false };
}

function tab(id: string, panes: PaneLayoutPane[]): PaneLayoutTab {
	return {
		id,
		title: null,
		active: false,
		activePaneId: null,
		layout: { type: "pane", paneId: panes[0]?.id ?? "" },
		panes,
	};
}

describe("closeTerminalPanes", () => {
	test("closes the terminal's panes in both areas, leaves the others, and goes on after a failed close", async () => {
		const layout = {
			activeTabId: null,
			tabs: [
				tab("t1", [pane("main", "terminal", "term-1")]),
				tab("t2", [pane("other", "terminal", "term-2")]),
				tab("t3", [pane("chat", "chat-v3", "term-1")]),
			],
			sidebar: {
				open: true,
				fullScreen: false,
				activeTabId: null,
				tabs: [tab("s1", [pane("side", "terminal", "term-1")])],
			},
		};
		const ops: PaneLayoutRequest["op"][] = [];
		const closed = await closeTerminalPanes(
			async (request) => {
				ops.push(request.op);
				if (request.op.type === "close" && request.op.paneId === "main") {
					throw new Error("Pane not found");
				}
				return { paneId: null, tabId: null, layout };
			},
			"ws-1",
			"term-1",
		);

		expect(closed).toEqual(["main", "side"]);
		expect(ops).toEqual([
			{ type: "list" },
			{ type: "close", paneId: "main" },
			{ type: "close", paneId: "side" },
		]);
	});
});
