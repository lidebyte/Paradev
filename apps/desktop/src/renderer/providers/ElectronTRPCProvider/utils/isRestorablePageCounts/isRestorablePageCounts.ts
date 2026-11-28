/**
 * Only the counts Pages opens with are worth restoring. A filtered variant per
 * search term would grow the persisted cache without bound and put search text
 * on disk, and the age check drops variants for pins that have since changed.
 */
export function isRestorablePageCounts({
	queryKey,
	dataUpdatedAt,
	now,
	maxAgeMs,
}: {
	queryKey: readonly unknown[];
	dataUpdatedAt: number;
	now: number;
	maxAgeMs: number;
}): boolean {
	const input = (queryKey[1] as { input?: object } | undefined)?.input;
	const unfiltered = Object.keys(input ?? {}).every(
		(key) => key === "pinnedIds",
	);
	return unfiltered && now - dataUpdatedAt < maxAgeMs;
}
