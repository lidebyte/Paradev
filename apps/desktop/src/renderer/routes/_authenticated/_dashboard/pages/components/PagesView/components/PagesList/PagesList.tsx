import { Trans, useLingui } from "@lingui/react/macro";
import { COMPANY } from "@superset/shared/constants";
import { PAGE_LIST_MAX_WORKSPACE_IDS } from "@superset/trpc/page-schema";
import { Input } from "@superset/ui/input";
import { toast } from "@superset/ui/sonner";
import { Tabs, TabsList, TabsTrigger } from "@superset/ui/tabs";
import { keepPreviousData } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LuSearch } from "react-icons/lu";
import { cloudTrpc } from "renderer/lib/cloud-trpc";
import { FeatureHeader } from "renderer/routes/_authenticated/_dashboard/components/FeatureHeader";
import { LoadMoreSentinel } from "renderer/routes/_authenticated/_dashboard/components/LoadMoreSentinel";
import { useDebouncedSearchNavigation } from "renderer/routes/_authenticated/_dashboard/hooks/useDebouncedSearchNavigation";
import { usePagesList } from "renderer/routes/_authenticated/_dashboard/hooks/usePagesList";
import { pagesListInput } from "renderer/routes/_authenticated/_dashboard/utils/pagesListInput";
import type { PageProject } from "../../../../hooks/usePageWorkspaceProjects";
import { type PageScope, serverScope } from "../../../../utils/pageScope";
import { PagesGrid } from "../../../PagesGrid";
import { AuthorFilter, type PageAuthorOption } from "../AuthorFilter";
import { type PageProjectOption, ProjectFilter } from "../ProjectFilter";
import { type PageWorkspaceOption, WorkspaceFilter } from "../WorkspaceFilter";

const TABS: Array<{ value: PageScope }> = [
	{ value: "all" },
	{ value: "pinned" },
	{ value: "team" },
	{ value: "shared" },
	{ value: "mine" },
];

const ARCHIVED_TAB = "archived";

export interface PagesListProps {
	search: string;
	scope: PageScope;
	authorId: string | null;
	workspaceId: string | null;
	projectId: string | null;
	archived: boolean;
	onSearchChange: (search: string) => void;
	onScopeChange: (scope: PageScope) => void;
	onAuthorChange: (authorId: string | null) => void;
	onWorkspaceChange: (workspaceId: string | null) => void;
	onProjectChange: (projectId: string | null) => void;
	/** Turning it on clears every other filter. */
	onShowArchived: () => void;
	onOpenPage: (page: { slug: string }) => void;
	currentUserId: string | undefined;
	favoritePageIds: string[];
	favoritePageIdSet: ReadonlySet<string>;
	onTogglePin: (pageId: string) => void;
	workspaceNames: Map<string, string>;
	workspaceProjects: Map<string, PageProject>;
	creatingWithAgent: boolean;
	onCreateWithAgent: () => void;
	searchDebounceMs?: number;
}

export function PagesList({
	search,
	scope,
	authorId,
	workspaceId,
	projectId,
	archived,
	onSearchChange,
	onScopeChange,
	onAuthorChange,
	onWorkspaceChange,
	onProjectChange,
	onShowArchived,
	onOpenPage,
	currentUserId,
	favoritePageIds,
	favoritePageIdSet,
	onTogglePin,
	workspaceNames,
	workspaceProjects,
	creatingWithAgent,
	onCreateWithAgent,
	searchDebounceMs,
}: PagesListProps) {
	const { t } = useLingui();
	const utils = cloudTrpc.useUtils();

	// The input answers the keystroke; the URL — and so the query — settles.
	//
	// A pending search is deliberately never cancelled when another filter
	// changes: every handler here updates the URL through a functional updater,
	// so a search landing after a scope change composes with it instead of
	// clobbering it. Cancelling would strand the typed text in the box while the
	// grid stayed unfiltered.
	const [searchInput, setSearchInput] = useState(search);
	useEffect(() => setSearchInput(search), [search]);
	const { scheduleSearchNavigation, cancelPendingSearchNavigation } =
		useDebouncedSearchNavigation(onSearchChange, searchDebounceMs);
	const handleSearchChange = useCallback(
		(value: string) => {
			setSearchInput(value);
			scheduleSearchNavigation(value);
		},
		[scheduleSearchNavigation],
	);

	const showArchived = () => {
		if (archived) return;
		// Unlike the other filters, this one clears the search, so a pending
		// one must not land after it.
		cancelPendingSearchNavigation();
		onShowArchived();
	};

	const unscopedCountsInput = useMemo(
		() => ({
			...(search ? { search } : {}),
			...(authorId ? { authorId } : {}),
			...(archived ? { archived } : {}),
			pinnedIds: favoritePageIds,
		}),
		[search, authorId, archived, favoritePageIds],
	);
	// Never narrowed by workspace or project: it is what those two pickers
	// offer, and what a project resolves to.
	const breakdownQuery = cloudTrpc.page.counts.useQuery(unscopedCountsInput, {
		placeholderData: keepPreviousData,
	});
	const linkedWorkspaces = breakdownQuery.data?.workspaces;
	const breakdownIsCurrent =
		breakdownQuery.data !== undefined && !breakdownQuery.isPlaceholderData;

	const projectWorkspaceIds = useMemo(() => {
		if (!projectId || !linkedWorkspaces) return [];
		return linkedWorkspaces
			.filter((row) => workspaceProjects.get(row.workspaceId)?.id === projectId)
			.sort((a, b) => b.count - a.count)
			.slice(0, PAGE_LIST_MAX_WORKSPACE_IDS)
			.map((row) => row.workspaceId)
			.sort();
	}, [projectId, linkedWorkspaces, workspaceProjects]);

	const workspaceScope = useMemo(() => {
		if (workspaceId) return { workspaceId };
		if (projectId) return { workspaceIds: projectWorkspaceIds };
		return {};
	}, [workspaceId, projectId, projectWorkspaceIds]);
	const scopeResolved =
		workspaceId !== null || projectId === null || breakdownIsCurrent;

	const filter = useMemo(
		() => ({
			...(search ? { search } : {}),
			scope: serverScope(scope),
			...(authorId ? { authorId } : {}),
			...workspaceScope,
			...(scope === "pinned" ? { ids: favoritePageIds } : {}),
			...(archived ? { archived } : {}),
		}),
		[search, scope, authorId, workspaceScope, favoritePageIds, archived],
	);

	const pages = usePagesList(filter, { enabled: scopeResolved });
	const { items, hasNextPage, isFetchingNextPage, scrollRef, sentinelRef } =
		pages;

	const countsQuery = cloudTrpc.page.counts.useQuery(
		{ ...unscopedCountsInput, ...workspaceScope },
		{ enabled: scopeResolved, placeholderData: keepPreviousData },
	);
	const counts = useMemo(
		() => ({
			all: countsQuery.data?.all ?? 0,
			pinned: countsQuery.data?.pinned ?? 0,
			team: countsQuery.data?.team ?? 0,
			shared: countsQuery.data?.shared ?? 0,
			mine: countsQuery.data?.mine ?? 0,
		}),
		[countsQuery.data],
	);

	const listInput = useMemo(() => pagesListInput(filter), [filter]);
	const dropFromList = async ({ id }: { id: string }) => {
		await utils.page.listPaginated.cancel(listInput);
		const previous = utils.page.listPaginated.getInfiniteData(listInput);
		utils.page.listPaginated.setInfiniteData(listInput, (old) =>
			old
				? {
						...old,
						pages: old.pages.map((page) => ({
							...page,
							items: page.items.filter((entry) => entry.id !== id),
						})),
					}
				: old,
		);
		return { previous };
	};
	const restoreList = (
		_error: unknown,
		_variables: unknown,
		context: Awaited<ReturnType<typeof dropFromList>> | undefined,
	) => {
		if (context?.previous) {
			utils.page.listPaginated.setInfiniteData(listInput, context.previous);
		}
	};

	const deletePage = cloudTrpc.page.delete.useMutation({
		onMutate: dropFromList,
		onError: restoreList,
		onSuccess: (_data, { id }) => {
			if (favoritePageIdSet.has(id)) onTogglePin(id);
		},
		onSettled: () => {
			void utils.page.listPaginated.invalidate(listInput);
			void utils.page.counts.invalidate();
		},
	});

	const setPageArchived = cloudTrpc.page.setArchived.useMutation({
		onMutate: dropFromList,
		onError: restoreList,
		onSettled: () => {
			void utils.page.listPaginated.invalidate();
			void utils.page.counts.invalidate();
		},
	});

	const duplicatePage = cloudTrpc.page.duplicate.useMutation({
		onSettled: () => {
			void utils.page.listPaginated.invalidate();
			void utils.page.counts.invalidate();
		},
	});

	const tabLabels: Record<PageScope, string> = {
		all: t({ message: "All" }),
		pinned: t({ message: "Pinned" }),
		team: t({ message: "Team" }),
		shared: t({ message: "Shared with me" }),
		mine: t({ message: "Just me" }),
	};

	const authorOptions = useMemo<PageAuthorOption[]>(() => {
		const rows = countsQuery.data?.authors ?? [];
		return rows
			.flatMap((row) =>
				row.userId
					? [
							{
								userId: row.userId,
								name: row.name || t({ message: "Unknown" }),
								image: row.image,
								isCurrentUser: row.userId === currentUserId,
							},
						]
					: [],
			)
			.sort((a, b) => {
				if (a.isCurrentUser !== b.isCurrentUser)
					return a.isCurrentUser ? -1 : 1;
				return a.name.localeCompare(b.name);
			});
	}, [countsQuery.data, currentUserId, t]);

	const workspaceOptions = useMemo<PageWorkspaceOption[]>(
		() =>
			(linkedWorkspaces ?? [])
				.filter(
					(row) =>
						workspaceNames.has(row.workspaceId) &&
						(projectId === null ||
							workspaceProjects.get(row.workspaceId)?.id === projectId),
				)
				.map((row) => ({
					workspaceId: row.workspaceId,
					name: workspaceNames.get(row.workspaceId) ?? row.workspaceId,
					count: row.count,
				}))
				.sort((a, b) => a.name.localeCompare(b.name)),
		[linkedWorkspaces, workspaceNames, workspaceProjects, projectId],
	);

	const projectOptions = useMemo<PageProjectOption[]>(() => {
		const names = new Map<string, string>();
		for (const row of linkedWorkspaces ?? []) {
			const project = workspaceProjects.get(row.workspaceId);
			if (project) names.set(project.id, project.name);
		}
		return [...names]
			.map(([id, name]) => ({ projectId: id, name }))
			.sort((a, b) => a.name.localeCompare(b.name));
	}, [linkedWorkspaces, workspaceProjects]);

	// Pins are local, so their tab does not wait for the counts.
	const hasPinned = countsQuery.data
		? counts.pinned > 0
		: favoritePageIds.length > 0 && !archived;
	const tabs = useMemo(
		() =>
			TABS.filter((tab) => {
				if (scope === tab.value) return true;
				if (tab.value === "pinned") return hasPinned;
				if (tab.value === "shared") return counts.shared > 0;
				return true;
			}),
		[counts, scope, hasPinned],
	);

	const hasFilters =
		Boolean(search.trim()) ||
		scope !== "all" ||
		authorId !== null ||
		workspaceId !== null ||
		projectId !== null;
	// From the list, not the counts: those arrive on their own query, and a
	// zero default while they are in flight would blank a loaded grid.
	const orgEmpty =
		!hasFilters &&
		!archived &&
		!pages.isPending &&
		!pages.error &&
		items.length === 0;

	return (
		<div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
			<div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-8 pt-4 pb-12">
				<FeatureHeader
					title={<Trans>Pages</Trans>}
					docsUrl={`${COMPANY.DOCS_URL}/pages`}
					onCreate={onCreateWithAgent}
					isCreating={creatingWithAgent}
				/>

				<div className="mt-6 flex flex-wrap items-center justify-between gap-2">
					<Tabs
						value={archived ? ARCHIVED_TAB : scope}
						onValueChange={(value) => {
							if (value === ARCHIVED_TAB) showArchived();
							else onScopeChange(value as PageScope);
						}}
					>
						<TabsList className="h-8 gap-1 bg-transparent p-0">
							{tabs.map((tab) => (
								<TabsTrigger
									key={tab.value}
									value={tab.value}
									className="h-8 rounded-md px-3 data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
								>
									<span className="text-sm">{tabLabels[tab.value]}</span>
									{!orgEmpty && !archived && (
										<span className="ml-1 text-muted-foreground text-xs tabular-nums">
											{counts[tab.value]}
										</span>
									)}
								</TabsTrigger>
							))}
							<TabsTrigger
								value={ARCHIVED_TAB}
								className="h-8 rounded-md px-3 data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground/70"
							>
								<span className="text-sm">
									<Trans>Archived</Trans>
								</span>
							</TabsTrigger>
						</TabsList>
					</Tabs>

					<div className="flex flex-wrap items-center gap-2">
						{(projectOptions.length > 0 || projectId !== null) && (
							<ProjectFilter
								value={projectId}
								options={projectOptions}
								onChange={onProjectChange}
							/>
						)}
						{(workspaceOptions.length > 0 || workspaceId !== null) && (
							<WorkspaceFilter
								value={workspaceId}
								options={workspaceOptions}
								onChange={onWorkspaceChange}
							/>
						)}
						{(authorOptions.length > 1 || authorId !== null) && (
							<AuthorFilter
								value={authorId}
								options={authorOptions}
								onChange={onAuthorChange}
							/>
						)}
						<div className="relative w-56">
							<LuSearch className="-translate-y-1/2 absolute top-1/2 left-2 size-3.5 text-muted-foreground" />
							<Input
								value={searchInput}
								onChange={(event) => handleSearchChange(event.target.value)}
								placeholder={t({
									message: "Search pages",
								})}
								className="h-8 pl-7 text-sm"
							/>
						</div>
					</div>
				</div>

				<PagesGrid
					pages={items}
					onCreate={onCreateWithAgent}
					isCreating={creatingWithAgent}
					pinnedPageIds={favoritePageIdSet}
					currentUserId={currentUserId}
					isPending={pages.isPending}
					error={items.length === 0 ? pages.error?.message : undefined}
					hasFilters={!orgEmpty && hasFilters}
					archived={archived}
					onOpen={onOpenPage}
					onTogglePin={onTogglePin}
					onSetArchived={async (pageId, next) => {
						await setPageArchived.mutateAsync({ id: pageId, archived: next });
						toast.success(
							next
								? t({ message: "Page archived" })
								: t({ message: "Page unarchived" }),
						);
					}}
					onDelete={async (pageId) => {
						await deletePage.mutateAsync({ id: pageId });
						toast.success(
							t({
								message: "Page deleted",
							}),
						);
					}}
					onDuplicate={async (pageId, title) => {
						await duplicatePage.mutateAsync({ id: pageId, title });
						toast.success(t({ message: "Page duplicated" }));
					}}
				/>

				<LoadMoreSentinel
					sentinelRef={sentinelRef}
					hasNextPage={hasNextPage}
					isFetchingNextPage={isFetchingNextPage}
				/>
			</div>
		</div>
	);
}
