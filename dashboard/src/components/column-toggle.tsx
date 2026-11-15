import { useState } from "react";
import { Columns3 } from "lucide-react";
import type {
	ColumnVisibilityState,
	OnChangeFn,
	RowData,
} from "@tanstack/react-table";

import type { DataTableInstance } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function readVisibility(storageKey: string): ColumnVisibilityState {
	try {
		const stored = localStorage.getItem(storageKey);
		if (stored) return JSON.parse(stored) as ColumnVisibilityState;
	} catch {
		// Blocked or corrupt storage just means every column shows.
	}
	return {};
}

/**
 * useColumnVisibility holds a table's column visibility. The choice is a per-viewer
 * convenience, so it lives in localStorage and a failed write is simply not remembered.
 */
export function useColumnVisibility(storageKey: string) {
	const key = `momobase:columns:${storageKey}`;
	const [columnVisibility, setVisibility] = useState(() =>
		readVisibility(key),
	);

	const onColumnVisibilityChange: OnChangeFn<ColumnVisibilityState> = (
		updater,
	) => {
		const next =
			typeof updater === "function" ? updater(columnVisibility) : updater;
		setVisibility(next);
		try {
			localStorage.setItem(key, JSON.stringify(next));
		} catch {
			// Not persisted; the toggle still applies for this visit.
		}
	};

	return { columnVisibility, onColumnVisibilityChange };
}

/** ColumnToggle is the guide's menu for showing or hiding a table's columns. */
export function ColumnToggle<T extends RowData>({ table }: { table: DataTableInstance<T> }) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button variant="outline" size="sm" className="ms-auto">
						<Columns3 />
						Columns
					</Button>
				}
			/>
			<DropdownMenuContent align="end" className="w-44">
				<DropdownMenuGroup>
					<DropdownMenuLabel>Show columns</DropdownMenuLabel>
					{table
						.getAllColumns()
						.filter((column) => column.getCanHide())
						.map((column) => (
							<DropdownMenuCheckboxItem
								key={column.id}
								checked={column.getIsVisible()}
								onCheckedChange={(value) =>
									column.toggleVisibility(!!value)
								}
							>
								{typeof column.columnDef.header === "string"
									? column.columnDef.header
									: column.id}
							</DropdownMenuCheckboxItem>
						))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
