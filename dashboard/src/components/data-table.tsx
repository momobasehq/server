import type { ReactNode } from "react";

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

/** Column describes one column of a DataTable. */
export interface Column<T> {
	/** Stable identifier, also used as the React key. */
	key: string;
	/** Header label. */
	header: ReactNode;
	/** Renders the cell for one row. */
	cell: (row: T) => ReactNode;
	/** Right-aligns numeric columns. */
	align?: "start" | "end";
	/** Keeps the column out of the visibility toggle, for identifying columns. */
	required?: boolean;
}

interface DataTableProps<T> {
	columns: Column<T>[];
	rows: T[];
	rowKey: (row: T) => string;
	loading?: boolean;
	/** Shown instead of rows when the result set is empty. */
	empty?: ReactNode;
	/** Makes each populated row an accessible action. */
	onRowClick?: (row: T) => void;
	/** Column keys to leave out, from useColumnVisibility. */
	hidden?: ReadonlySet<string>;
	/** Adds a checkbox column. Keys are rowKey values; the caller owns the set. */
	selection?: {
		selected: ReadonlySet<string>;
		onChange: (next: Set<string>) => void;
		/** Rows that cannot take the bulk action get a disabled box. */
		selectable?: (row: T) => boolean;
	};
}

/**
 * DataTable renders a list response as a table. It is a composition of shadcn/ui's
 * Table parts rather than a component of its own, so it inherits the theme and every
 * screen's tables stay identical without a shared abstraction to maintain.
 */
export function DataTable<T>({
	columns: allColumns,
	rows,
	rowKey,
	loading,
	empty,
	onRowClick,
	hidden,
	selection,
}: DataTableProps<T>) {
	const visible = hidden
		? allColumns.filter((column) => !hidden.has(column.key))
		: allColumns;
	const columns = selection
		? [selectColumn(rows, rowKey, selection), ...visible]
		: visible;
	return (
		// Wide tables scroll inside their own container rather than the page.
		<div className="w-full overflow-x-auto">
			<Table>
				<TableHeader>
					<TableRow>
						{columns.map((column) => (
							<TableHead
								key={column.key}
								className={
									column.align === "end"
										? "text-end"
										: undefined
								}
							>
								{column.header}
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{loading && rows.length === 0
						? Array.from({ length: 5 }, (_, index) => (
								<TableRow key={`skeleton-${index}`}>
									{columns.map((column) => (
										<TableCell key={column.key}>
											<Skeleton className="h-4 w-full" />
										</TableCell>
									))}
								</TableRow>
							))
						: rows.map((row) => (
								<TableRow
									key={rowKey(row)}
									role={onRowClick ? "button" : undefined}
									tabIndex={onRowClick ? 0 : undefined}
									className={
										onRowClick
											? "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
											: undefined
									}
									onClick={
										onRowClick
											? () => onRowClick(row)
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
														onRowClick(row);
													}
												}
											: undefined
									}
								>
									{columns.map((column) => (
										<TableCell
											key={column.key}
											className={
												column.align === "end"
													? "text-end"
													: undefined
											}
										>
											{column.cell(row)}
										</TableCell>
									))}
								</TableRow>
							))}
					{!loading && rows.length === 0 && (
						<TableRow>
							<TableCell
								colSpan={columns.length}
								className="text-muted-foreground py-8 text-center"
							>
								{empty ?? "Nothing to show yet."}
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</div>
	);
}

/**
 * selectColumn builds the checkbox column. The header box covers the current page
 * only, since rows on other pages are not on screen to be checked.
 */
function selectColumn<T>(
	rows: T[],
	rowKey: (row: T) => string,
	{
		selected,
		onChange,
		selectable = () => true,
	}: NonNullable<DataTableProps<T>["selection"]>,
): Column<T> {
	const keys = rows.filter(selectable).map(rowKey);
	const checked = keys.filter((key) => selected.has(key)).length;
	const set = (key: string, on: boolean) => {
		const next = new Set(selected);
		if (on) next.add(key);
		else next.delete(key);
		onChange(next);
	};
	return {
		key: "__select",
		required: true,
		header: (
			<Checkbox
				aria-label="Select all on this page"
				checked={keys.length > 0 && checked === keys.length}
				indeterminate={checked > 0 && checked < keys.length}
				disabled={keys.length === 0}
				onCheckedChange={(on) =>
					onChange(
						on
							? new Set([...selected, ...keys])
							: new Set(
									[...selected].filter(
										(key) => !keys.includes(key),
									),
								),
					)
				}
			/>
		),
		cell: (row) => (
			<Checkbox
				aria-label="Select row"
				checked={selected.has(rowKey(row))}
				disabled={!selectable(row)}
				onCheckedChange={(on) => set(rowKey(row), on)}
				// A checkbox inside a clickable row must not also open the row.
				onClick={(event) => event.stopPropagation()}
				onKeyDown={(event) => event.stopPropagation()}
			/>
		),
	};
}
