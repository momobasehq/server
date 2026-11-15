import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import type { PaginatedData } from "momobase";

import type { Page } from "@/lib/query-keys";

const defaultPerPage = 20;

export interface PagedQueryOptions {
	/** Initial page size; the viewer can change it through PaginationControls. */
	perPage?: number;
	/** When false the query never runs, so a section the caller has hidden for want of a
	 * permission does not fire a request that is certain to 403 and toast. */
	enabled?: boolean;
	/** Polls the current page every this many milliseconds; false or omitted never polls. */
	refetchInterval?: number | false;
	/** Prefixes this table's URL params, so a screen with several tables keeps each
	 * one's place apart. The screen's main table leaves it unset. */
	param?: string;
}

/** Caps a hand-edited URL so it cannot ask the API for an unbounded page. */
const maxPerPage = 100;

/** readInt parses a positive integer search param, or returns undefined. */
function readInt(value: string | null) {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
}

/**
 * usePagedQuery wires a list endpoint to page state.
 *
 * `keepPreviousData` is the point: without it every page change unmounts the table
 * back to a skeleton, so paging through transactions flickers. With it the previous
 * page stays on screen, dimmed, until the next one resolves.
 */
export function usePagedQuery<T>(
	queryKey: (page: Page) => readonly unknown[],
	fetcher: (page: Page) => Promise<PaginatedData<T>>,
	{
		perPage: initialPerPage = defaultPerPage,
		enabled = true,
		refetchInterval = false,
		param,
	}: PagedQueryOptions = {},
) {
	// Page state lives in the URL so a reload or a shared link keeps the viewer's place.
	// Defaults are left out of it, so an untouched table keeps a clean URL.
	const [params, setParams] = useSearchParams();
	const pageParam = param ? `${param}_page` : "page";
	const perPageParam = param ? `${param}_per_page` : "per_page";
	const page = readInt(params.get(pageParam)) ?? 1;
	const perPage = Math.min(
		readInt(params.get(perPageParam)) ?? initialPerPage,
		maxPerPage,
	);
	const update = (next: { page?: number; perPage?: number }) =>
		setParams(
			(current) => {
				const updated = new URLSearchParams(current);
				const write = (name: string, value: number, fallback: number) =>
					value === fallback
						? updated.delete(name)
						: updated.set(name, String(value));
				if (next.page !== undefined) write(pageParam, next.page, 1);
				if (next.perPage !== undefined)
					write(perPageParam, next.perPage, initialPerPage);
				return updated;
			},
			// Paging is browsing, not navigation: Back should leave the screen.
			{ replace: true },
		);
	const setPage = (value: number) => update({ page: value });
	const slice: Page = { page, perPage };
	const query = useQuery({
		queryKey: queryKey(slice),
		queryFn: () => fetcher(slice),
		placeholderData: keepPreviousData,
		enabled,
		refetchInterval,
	});
	// The old page number can point past the end at a larger size, so start over.
	const setPerPage = (size: number) => update({ perPage: size, page: 1 });

	return {
		page,
		perPage,
		setPage,
		setPerPage,
		items: query.data?.items ?? [],
		total: query.data?.total ?? 0,
		count: query.data?.count ?? 0,
		loading: query.isPending && enabled,
		/** True while a different page is in flight but the old one is still shown. */
		fetching: query.isFetching,
		error: query.error,
	};
}
