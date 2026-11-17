import { useMemo, useState, type ReactNode } from "react";
import {
	columnFilteringFeature,
	columnVisibilityFeature,
	createFilteredRowModel,
	createSortedRowModel,
	globalFilteringFeature,
	rowSelectionFeature,
	rowSortingFeature,
	sortFn_alphanumeric,
	sortFn_basic,
	sortFn_datetime,
	sortFn_text,
	tableFeatures,
	useTable,
	type ColumnDef,
	type OnChangeFn,
	type ReactTable,
	type Row,
	type RowData,
	type RowSelectionState,
	type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { ColumnToggle, useColumnVisibility } from "@/components/column-toggle";
import {
	CreatedFilter,
	FacetFilter,
	ResetFilters,
	SearchBox,
	type Facet,
} from "@/components/list-filters";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { ListState } from "@/hooks/use-paged-query";
import { cn } from "@/lib/utils";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

/**
 * contains matches a search term anywhere in a cell's raw value, case-insensitively.
 * Values are stringified so numbers, dates and enums are searchable alike.
 */
function contains<TFeatures extends typeof base, T extends RowData>(
	row: Row<TFeatures, T>,
	columnId: string,
	term: string,
) {
	const value = row.getValue(columnId);
	return (
		value != null &&
		String(value).toLowerCase().includes(term.trim().toLowerCase())
	);
}

const base = {
	// Global search runs through the column filter pipeline, so both are needed.
	columnFilteringFeature,
	columnVisibilityFeature,
	globalFilteringFeature,
	rowSelectionFeature,
	rowSortingFeature,
};

/**
 * The shadcn data-table guide's feature set. A table given a `list` runs search, sort
 * and filters on the server; without one they act on the loaded page only, hence its
 * "Filter rows" rather than "Search".
 */
export const features = tableFeatures({
	...base,
	filteredRowModel: createFilteredRowModel(),
	sortedRowModel: createSortedRowModel(),
	filterFns: { contains },
	sortFns: {
		alphanumeric: sortFn_alphanumeric,
		basic: sortFn_basic,
		datetime: sortFn_datetime,
		text: sortFn_text,
	},
	columnMeta: {} as {
		/** Right-aligns numeric columns. */
		align?: "start" | "end";
		/** The SDK sort field for this column. With a `list`, only these columns sort. */
		sortKey?: string;
	},
});

export type Features = typeof features;

/** DataColumn is one column definition for a DataTable of T. Columns with an
 * accessorFn are sortable and searchable; display-only columns are neither. */
// `any` value: accessors return mixed types, and cells render from row.original.
export type DataColumn<T extends RowData> = ColumnDef<Features, T, any>;

export type DataTableInstance<T extends RowData> = ReactTable<Features, T>;

interface DataTableProps<T extends RowData> {
	columns: DataColumn<T>[];
	rows: T[];
	rowKey: (row: T) => string;
	loading?: boolean;
	/** Shown instead of rows when the result set is empty. */
	empty?: ReactNode;
	/** Makes each populated row an accessible action. */
	onRowClick?: (row: T) => void;
	/** Remembers this table's column visibility across visits under this name. */
	tableId?: string;
	/** Controlled selection, keyed by rowKey; pair with selectColumn(). */
	rowSelection?: RowSelectionState;
	onRowSelectionChange?: OnChangeFn<RowSelectionState>;
	/** Rows that cannot take the bulk action get a disabled box. */
	canSelect?: (row: T) => boolean;
	/** Extra toolbar controls, beside search and the Columns menu. */
	toolbar?: ReactNode;
	/** Server-side search, sort and filters from usePagedQuery. */
	list?: ListState;
	/** Filters the toolbar offers; needs `list`. */
	facets?: readonly Facet[];
	/** Offers a created-at window; needs `list`. */
	createdFilter?: boolean;
	searchPlaceholder?: string;
}

/**
 * DataTable renders a list response as a TanStack table over shadcn/ui's Table parts,
 * following shadcn's data-table guide, so every screen's tables stay identical.
 */
export function DataTable<T extends RowData>({
	columns,
	rows,
	rowKey,
	loading,
	empty,
	onRowClick,
	tableId,
	rowSelection,
	onRowSelectionChange,
	canSelect,
	toolbar,
	list,
	facets = [],
	createdFilter,
	searchPlaceholder,
}: DataTableProps<T>) {
	const [globalFilter, setGlobalFilter] = useState("");
	const visibility = useColumnVisibility(tableId);
	// On the server only declared sort fields work, so other columns stop offering it.
	const tableColumns = useMemo(
		() =>
			list
				? columns.map((column) => ({
						...column,
						enableSorting: Boolean(column.meta?.sortKey),
					}))
				: columns,
		[columns, list],
	);
	const sortColumn = list?.sort
		? columns.find((column) => column.meta?.sortKey === list.sort?.field)
				?.id
		: undefined;
	const sorting: SortingState =
		list?.sort && sortColumn
			? [{ id: sortColumn, desc: list.sort.desc }]
			: [];
	const onSortingChange: OnChangeFn<SortingState> = (updater) => {
		const [next] =
			typeof updater === "function" ? updater(sorting) : updater;
		const field = next
			? columns.find((column) => column.id === next.id)?.meta?.sortKey
			: undefined;
		list?.setSort(field ? { field, desc: next.desc } : undefined);
	};
	const table = useTable({
		features,
		columns: tableColumns,
		data: rows,
		getRowId: rowKey,
		globalFilterFn: "contains",
		manualSorting: Boolean(list),
		manualFiltering: Boolean(list),
		...(list && { onSortingChange }),
		enableRowSelection: canSelect ? (row) => canSelect(row.original) : true,
		state: {
			globalFilter,
			...(list && { sorting }),
			columnVisibility: visibility.columnVisibility,
			...(rowSelection && { rowSelection }),
		},
		onGlobalFilterChange: setGlobalFilter,
		onColumnVisibilityChange: visibility.onColumnVisibilityChange,
		onRowSelectionChange,
	});
	const visibleCount = table.getVisibleLeafColumns().length;
	const shown = table.getRowModel().rows;

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-2">
				{list ? (
					<>
						<SearchBox
							list={list}
							placeholder={searchPlaceholder}
						/>
						{facets.map((facet) => (
							<FacetFilter
								key={facet.field}
								list={list}
								facet={facet}
							/>
						))}
						{createdFilter && <CreatedFilter list={list} />}
						<ResetFilters list={list} />
					</>
				) : (
					<Input
						placeholder="Filter rows…"
						aria-label="Filter rows"
						value={globalFilter}
						onChange={(event) =>
							setGlobalFilter(event.target.value)
						}
						className="h-7 max-w-xs"
					/>
				)}
				{toolbar}
				<ColumnToggle table={table} />
			</div>
			{/* Wide tables scroll inside their own container rather than the page. */}
			<div className="w-full overflow-x-auto">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((group) => (
							<TableRow key={group.id}>
								{group.headers.map((header) => (
									<TableHead
										key={header.id}
										className={alignClass(
											header.column.columnDef.meta?.align,
										)}
									>
										{header.isPlaceholder ? null : header.column.getCanSort() ? (
											<SortButton
												align={
													header.column.columnDef.meta
														?.align
												}
												sorted={header.column.getIsSorted()}
												onClick={() =>
													header.column.toggleSorting(
														header.column.getIsSorted() ===
															"asc",
													)
												}
											>
												<table.FlexRender
													header={header}
												/>
											</SortButton>
										) : (
											<table.FlexRender header={header} />
										)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{loading && rows.length === 0
							? Array.from({ length: 5 }, (_, index) => (
									<TableRow key={`skeleton-${index}`}>
										{Array.from(
											{ length: visibleCount },
											(_, cell) => (
												<TableCell key={cell}>
													<Skeleton className="h-4 w-full" />
												</TableCell>
											),
										)}
									</TableRow>
								))
							: shown.map((row) => (
									<TableRow
										key={row.id}
										data-state={
											row.getIsSelected()
												? "selected"
												: undefined
										}
										role={onRowClick ? "button" : undefined}
										tabIndex={onRowClick ? 0 : undefined}
										className={
											onRowClick
												? "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
												: undefined
										}
										onClick={
											onRowClick
												? () => onRowClick(row.original)
												: undefined
										}
										onKeyDown={
											onRowClick
												? (event) => {
														if (
															event.key ===
																"Enter" ||
															event.key === " "
														) {
															event.preventDefault();
															onRowClick(
																row.original,
															);
														}
													}
												: undefined
										}
									>
										{row.getVisibleCells().map((cell) => (
											<TableCell
												key={cell.id}
												className={alignClass(
													cell.column.columnDef.meta
														?.align,
												)}
											>
												<table.FlexRender cell={cell} />
											</TableCell>
										))}
									</TableRow>
								))}
						{!loading && shown.length === 0 && (
							<TableRow>
								<TableCell
									colSpan={visibleCount}
									className="text-muted-foreground py-8 text-center"
								>
									{rows.length > 0 || list?.narrowed
										? "No rows match this filter."
										: (empty ?? "Nothing to show yet.")}
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}

/** SortButton is the guide's sortable header: label plus the current direction. */
function SortButton({
	align,
	sorted,
	onClick,
	children,
}: {
	align?: "start" | "end";
	sorted: false | "asc" | "desc";
	onClick: () => void;
	children: ReactNode;
}) {
	const Icon =
		sorted === "asc"
			? ArrowUp
			: sorted === "desc"
				? ArrowDown
				: ArrowUpDown;
	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={onClick}
			// Pulled into the cell's padding so the label lines up with the values below.
			className={cn("h-7 px-2", align === "end" ? "-me-2" : "-ms-2")}
		>
			{children}
			<Icon className={sorted ? undefined : "text-muted-foreground"} />
		</Button>
	);
}

function alignClass(align?: "start" | "end") {
	return align === "end" ? "text-end" : undefined;
}

/**
 * selectColumn is the guide's checkbox column. The header box covers the current page
 * only, since rows on other pages are not on screen to be checked.
 */
export function selectColumn<T extends RowData>(): DataColumn<T> {
	return {
		id: "select",
		enableHiding: false,
		enableSorting: false,
		header: ({ table }) => (
			<Checkbox
				aria-label="Select all on this page"
				checked={table.getIsAllPageRowsSelected()}
				indeterminate={table.getIsSomePageRowsSelected()}
				onCheckedChange={(value) =>
					table.toggleAllPageRowsSelected(!!value)
				}
			/>
		),
		cell: ({ row }) => (
			<Checkbox
				aria-label="Select row"
				checked={row.getIsSelected()}
				disabled={!row.getCanSelect()}
				onCheckedChange={(value) => row.toggleSelected(!!value)}
				// A checkbox inside a clickable row must not also open the row.
				onClick={(event) => event.stopPropagation()}
				onKeyDown={(event) => event.stopPropagation()}
			/>
		),
	};
}
