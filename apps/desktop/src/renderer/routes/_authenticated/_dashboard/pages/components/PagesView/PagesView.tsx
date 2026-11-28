import { authClient } from "renderer/lib/auth-client";
import { PageHeader } from "renderer/routes/_authenticated/_dashboard/components/PageHeader";
import { usePageFavorites } from "renderer/routes/_authenticated/_dashboard/hooks/usePageFavorites";
import { usePageWorkspaceNames } from "../../hooks/usePageWorkspaceNames";
import { usePageWorkspaceProjects } from "../../hooks/usePageWorkspaceProjects";
import { PagesList, type PagesListProps } from "./components/PagesList";
import { useCreatePageWithAgent } from "./hooks/useCreatePageWithAgent";

type PagesViewProps = Pick<
	PagesListProps,
	| "search"
	| "scope"
	| "authorId"
	| "workspaceId"
	| "projectId"
	| "archived"
	| "onSearchChange"
	| "onScopeChange"
	| "onAuthorChange"
	| "onWorkspaceChange"
	| "onProjectChange"
	| "onShowArchived"
	| "onOpenPage"
>;

export function PagesView(props: PagesViewProps) {
	const { creatingWithAgent, handleCreateWithAgent } = useCreatePageWithAgent();
	const { data: session } = authClient.useSession();
	const { favoritePageIds, favoritePageIdSet, toggleFavorite } =
		usePageFavorites();
	const workspaceNames = usePageWorkspaceNames();
	const workspaceProjects = usePageWorkspaceProjects();

	return (
		<div className="flex h-full w-full flex-1 flex-col overflow-hidden">
			<PageHeader />

			<PagesList
				{...props}
				currentUserId={session?.user.id}
				favoritePageIds={favoritePageIds}
				favoritePageIdSet={favoritePageIdSet}
				onTogglePin={toggleFavorite}
				workspaceNames={workspaceNames}
				workspaceProjects={workspaceProjects}
				creatingWithAgent={creatingWithAgent}
				onCreateWithAgent={handleCreateWithAgent}
			/>
		</div>
	);
}
