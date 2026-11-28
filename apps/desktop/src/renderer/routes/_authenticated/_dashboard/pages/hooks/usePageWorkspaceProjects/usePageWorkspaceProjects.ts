import { useMemo } from "react";
import { useHostProjects } from "renderer/hooks/host-projects/useHostProjects";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";

export interface PageProject {
	id: string;
	name: string;
}

/** The project of each host workspace, keyed by workspace id. */
export function usePageWorkspaceProjects(): Map<string, PageProject> {
	const { workspaces } = useHostWorkspaces();
	const { projects } = useHostProjects();

	return useMemo(() => {
		const names = new Map(
			projects.map((project) => [project.id, project.name]),
		);
		const byWorkspace = new Map<string, PageProject>();
		for (const workspace of workspaces) {
			if (!workspace.projectId) continue;
			const name = names.get(workspace.projectId);
			if (name)
				byWorkspace.set(workspace.id, { id: workspace.projectId, name });
		}
		return byWorkspace;
	}, [workspaces, projects]);
}
