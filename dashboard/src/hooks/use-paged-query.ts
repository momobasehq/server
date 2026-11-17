import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import type { ListOptions, PaginatedData } from "momobase";

import type { ListKey } from "@/lib/query-keys";

const defaultPerPage = 20;

/** Created-at windows the date filter offers, in milliseconds back from now. */
export const createdRanges = {
	"24h": 24 * 60 * 60 * 1000,
	"7d": 7 * 24 * 60 * 60 * 1000,
	"30d": 30 * 24 * 60 * 60 * 1000,
} as const;

export type CreatedRange = keyof typeof createdRanges;

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
	/** SDK filter fields this list exposes, e.g. `status`. Each is kept in the URL. */
	filters?: readonly string[];
}

/** ListSort is the server-side sort: an SDK sort field and its direction. */
export interface ListSort {
	field: string;
	desc: boolean;
}

/** ListState is the server-side search, sort and filters a DataTable drives. */
export interface ListState {
	search: string;
	setSearch: (value: string) => void;
	sort?: ListSort;
	setSort: (sort?: ListSort) => void;
	filters: Record<string, string[]>;
	setFilter: (field: string, values: string[]) => void;
	created?: CreatedRange;
	setCreated: (range?: CreatedRange) => void;
	/** Clears search and every filter, keeping the sort. */
	reset: () => void;
	/** True when search, a filter or a date range narrows the list. */
	narrowed: boolean;
}

/** Caps a hand-edited URL so it cannot ask the API for an unbounded page. */
const maxPerPage = 100;

/** readInt parses a positive integer search param, or returns undefined. */
function readInt(value: string | null) {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
}

/** Rounds now down to the minute, so the `from` a range sends — and the query key it
 * is part of — changes once a minute rather than on every render. */
function rangeStart(range: CreatedRange) {
	const minute = 60 * 1000;
	return new Date(
		Math.floor(Date.now() / minute) * minute - createdRanges[range],
	);
}

/**
 * usePagedQuery wires a list endpoint to page, search, sort and filter state, all of it
 * in the URL so a reload or a shared link reopens the same view.
 *
 * `keepPreviousData` is the point: without it every page change unmounts the table
 * back to a skeleton, so paging through transactions flickers. With it the previous
 * page stays on screen, dimmed, until the next one resolves.
 */
export function usePagedQuery<T, Q extends ListOptions = ListOptions>(
	queryKey: (query: ListKey) => readonly unknown[],
	fetcher: (query: Q) => Promise<PaginatedData<T>>,
	{
		perPage: initialPerPage = defaultPerPage,
		enabled = true,
		refetchInterval = false,
		param,
		filters: filterFields = [],
	}: PagedQueryOptions = {},
) {
	const [params, setParams] = useSearchParams();
	const name = (field: string) => (param ? `${param}_${field}` : field);
	const page = readInt(params.get(name("page"))) ?? 1;
	const perPage = Math.min(
		readInt(params.get(name("per_page"))) ?? initialPerPage,
		maxPerPage,
	);
	const search = params.get(name("q")) ?? "";
	const sortField = params.get(name("sort"));
	const sort: ListSort | undefined = sortField
		? { field: sortField, desc: params.get(name("order")) === "desc" }
		: undefined;
	const filters: Record<string, string[]> = {};
	for (const field of filterFields) {
		const raw = params.get(name(field));
		if (raw) filters[field] = raw.split(",").filter(Boolean);
	}
	const createdParam = params.get(name("created"));
	const created =
		createdParam && createdParam in createdRanges
			? (createdParam as CreatedRange)
			: undefined;

	// Defaults are deleted rather than written, so an untouched table keeps a clean
	// URL. Anything but a page change sends the viewer back to page 1, where the
	// narrowed or reordered list starts.
	const update = (changes: Record<string, string | undefined>) =>
		setParams(
			(current) => {
				const next = new URLSearchParams(current);
				for (const [field, value] of Object.entries(changes)) {
					if (value) next.set(name(field), value);
					else next.delete(name(field));
				}
				if (!("page" in changes)) next.delete(name("page"));
				return next;
			},
			// Paging and filtering are browsing, not navigation: Back should leave the screen.
			{ replace: true },
		);

	const request = {
		page,
		perPage,
		...(search && { q: search }),
		...(sort && { sort: sort.field, order: sort.desc ? "desc" : "asc" }),
		...(created && { createdAfter: rangeStart(created).toISOString() }),
		...filters,
	};
	const query = useQuery({
		queryKey: queryKey(request),
		// The URL is untyped, so the request is too; the server rejects what it cannot use.
		queryFn: () => fetcher(request as unknown as Q),
		placeholderData: keepPreviousData,
		enabled,
		refetchInterval,
	});

	const list: ListState = {
		search,
		setSearch: (value) => update({ q: value.trim() || undefined }),
		sort,
		setSort: (next) =>
			update({
				sort: next?.field,
				order: next?.desc ? "desc" : undefined,
			}),
		filters,
		setFilter: (field, values) =>
			update({ [field]: values.length ? values.join(",") : undefined }),
		created,
		setCreated: (range) => update({ created: range }),
		reset: () =>
			update({
				q: undefined,
				created: undefined,
				...Object.fromEntries(
					filterFields.map((field) => [field, undefined]),
				),
			}),
		narrowed: Boolean(search || created) || Object.keys(filters).length > 0,
	};

	return {
		page,
		perPage,
		setPage: (value: number) =>
			update({ page: value === 1 ? undefined : String(value) }),
		setPerPage: (size: number) =>
			update({
				per_page: size === initialPerPage ? undefined : String(size),
			}),
		list,
		items: query.data?.items ?? [],
		total: query.data?.total ?? 0,
		count: query.data?.count ?? 0,
		loading: query.isPending && enabled,
		/** True while a different page is in flight but the old one is still shown. */
		fetching: query.isFetching,
		error: query.error,
	};
}
