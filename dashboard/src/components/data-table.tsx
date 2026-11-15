import { type ReactNode } from "react";
import {
	columnVisibilityFeature,
	rowSelectionFeature,
	tableFeatures,
	useTable,
	type ColumnDef,
	type ColumnVisibilityState,
	type OnChangeFn,
	type ReactTable,
	type RowData,
	type RowSelectionState,
} from "@tanstack/react-table";

import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

/**
 * Only the features these tables use, so the rest of TanStack Table is tree-shaken.
 * There is no sorting, filtering or pagination feature on purpose: lists are paged
 * on the server, and those would act on one loaded page while looking global.
 */
export const features = tableFeatures({
	columnVisibilityFeature,
	rowSelectionFeature,
	columnMeta: {} as {
		/** Right-aligns numeric columns. */
		align?: "start" | "end";
	},
});

export type Features = typeof features;

/** DataColumn is one column definition for a DataTable of T. */
// `any` value: each cell renders from row.original, so no column declares an accessor type.
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
	/** Controlled visibility, from useColumnVisibility. */
	columnVisibility?: ColumnVisibilityState;
	onColumnVisibilityChange?: OnChangeFn<ColumnVisibilityState>;
	/** Controlled selection, keyed by rowKey; pair with selectColumn(). */
	rowSelection?: RowSelectionState;
	onRowSelectionChange?: OnChangeFn<RowSelectionState>;
	/** Rows that cannot take the bulk action get a disabled box. */
	canSelect?: (row: T) => boolean;
	/** Renders above the table with the instance, e.g. a ColumnToggle. */
	toolbar?: (table: DataTableInstance<T>) => ReactNode;
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
	columnVisibility,
	onColumnVisibilityChange,
	rowSelection,
	onRowSelectionChange,
	canSelect,
	toolbar,
}: DataTableProps<T>) {
	const table = useTable({
		features,
		columns,
		data: rows,
		getRowId: rowKey,
		enableRowSelection: canSelect
			? (row) => canSelect(row.original)
			: true,
		state: {
			...(columnVisibility && { columnVisibility }),
			...(rowSelection && { rowSelection }),
		},
		onColumnVisibilityChange,
		onRowSelectionChange,
	});
	const visibleCount = table.getVisibleLeafColumns().length;

	return (
		<div className="flex flex-col gap-2">
			{toolbar && (
				<div className="flex items-center gap-2">{toolbar(table)}</div>
			)}
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
										{header.isPlaceholder ? null : (
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
							: table.getRowModel().rows.map((row) => (
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
															event.key === "Enter" ||
															event.key === " "
														) {
															event.preventDefault();
															onRowClick(row.original);
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
						{!loading && rows.length === 0 && (
							<TableRow>
								<TableCell
									colSpan={visibleCount}
									className="text-muted-foreground py-8 text-center"
								>
									{empty ?? "Nothing to show yet."}
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
		</div>
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
