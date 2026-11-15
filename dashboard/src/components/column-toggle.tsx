import { useState } from "react";
import { Columns3 } from "lucide-react";

import type { Column } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function readHidden(storageKey: string, fallback: string[]) {
	try {
		const stored = localStorage.getItem(storageKey);
		if (stored) return new Set<string>(JSON.parse(stored));
	} catch {
		// Blocked or corrupt storage just means the defaults.
	}
	return new Set(fallback);
}

/**
 * useColumnVisibility tracks which columns a table hides. The choice is a per-viewer
 * convenience, so it lives in localStorage and a failed write is simply not remembered.
 */
export function useColumnVisibility(
	storageKey: string,
	defaultHidden: string[] = [],
) {
	const key = `momobase:columns:${storageKey}`;
	const [hidden, setHidden] = useState(() => readHidden(key, defaultHidden));

	const toggle = (columnKey: string, visible: boolean) => {
		const next = new Set(hidden);
		if (visible) next.delete(columnKey);
		else next.add(columnKey);
		setHidden(next);
		try {
			localStorage.setItem(key, JSON.stringify([...next]));
		} catch {
			// Not persisted; the toggle still applies for this visit.
		}
	};

	return { hidden, toggle };
}

/** ColumnToggle is the menu that shows or hides a table's optional columns. */
export function ColumnToggle<T>({
	columns,
	hidden,
	onToggle,
}: {
	columns: Column<T>[];
	hidden: ReadonlySet<string>;
	onToggle: (key: string, visible: boolean) => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button variant="outline" size="sm">
						<Columns3 />
						Columns
					</Button>
				}
			/>
			<DropdownMenuContent align="end" className="w-44">
				<DropdownMenuGroup>
					<DropdownMenuLabel>Show columns</DropdownMenuLabel>
					{columns
						.filter((column) => !column.required)
						.map((column) => (
							<DropdownMenuCheckboxItem
								key={column.key}
								checked={!hidden.has(column.key)}
								onCheckedChange={(checked) =>
									onToggle(column.key, checked)
								}
							>
								{column.header}
							</DropdownMenuCheckboxItem>
						))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
