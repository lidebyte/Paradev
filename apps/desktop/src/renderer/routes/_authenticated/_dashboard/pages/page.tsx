import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PagesView } from "./components/PagesView";
import { isPageScope, type PageScope } from "./utils/pageScope";

export type PagesSearch = {
	q?: string;
	scope?: PageScope;
	author?: string;
	workspace?: string;
	project?: string;
	archived?: boolean;
};

export const Route = createFileRoute("/_authenticated/_dashboard/pages/")({
	component: PagesPage,
	validateSearch: (search: Record<string, unknown>): PagesSearch => ({
		q: typeof search.q === "string" && search.q ? search.q : undefined,
		scope: isPageScope(search.scope) ? search.scope : undefined,
		author:
			typeof search.author === "string" && search.author
				? search.author
				: undefined,
		workspace:
			typeof search.workspace === "string" && search.workspace
				? search.workspace
				: undefined,
		project:
			typeof search.project === "string" && search.project
				? search.project
				: undefined,
		archived: search.archived === true ? true : undefined,
	}),
});

function PagesPage() {
	const { q, scope, author, workspace, project, archived } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	return (
		<PagesView
			search={q ?? ""}
			scope={scope ?? "all"}
			authorId={author ?? null}
			workspaceId={workspace ?? null}
			projectId={project ?? null}
			archived={archived ?? false}
			onSearchChange={(value) =>
				navigate({
					search: (prev) => ({ ...prev, q: value || undefined }),
					replace: true,
				})
			}
			onScopeChange={(value) =>
				navigate({
					search: (prev) => ({
						...prev,
						scope: value === "all" ? undefined : value,
						archived: undefined,
					}),
					replace: true,
				})
			}
			onAuthorChange={(value) =>
				navigate({
					search: (prev) => ({ ...prev, author: value ?? undefined }),
					replace: true,
				})
			}
			onWorkspaceChange={(value) =>
				navigate({
					search: (prev) => ({ ...prev, workspace: value ?? undefined }),
					replace: true,
				})
			}
			onProjectChange={(value) =>
				navigate({
					search: (prev) => ({
						...prev,
						project: value ?? undefined,
						workspace: undefined,
					}),
					replace: true,
				})
			}
			onShowArchived={() =>
				navigate({ search: () => ({ archived: true }), replace: true })
			}
			onOpenPage={(page) =>
				navigate({ to: "/pages/$slug", params: { slug: page.slug } })
			}
		/>
	);
}
