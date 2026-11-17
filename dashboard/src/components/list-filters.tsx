import { useEffect, useRef, useState } from "react";
import { CalendarRange, ListFilter, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { CreatedRange, ListState } from "@/hooks/use-paged-query";
import { titleCase } from "@/lib/format";

/** Facet is one server-side filter a toolbar offers, with the values it can take. */
export interface Facet {
	/** The SDK filter field, e.g. `status`; it must be in usePagedQuery's `filters`. */
	field: string;
	label: string;
	options: readonly string[];
}

/**
 * SearchBox sends its text to the server once typing pauses. It keeps its own draft so
 * keystrokes stay instant, and follows the URL when a Reset clears it from outside.
 */
export function SearchBox({
	list,
	placeholder = "Search…",
}: {
	list: ListState;
	placeholder?: string;
}) {
	const [draft, setDraft] = useState(list.search);
	const settled = useDebouncedValue(draft);
	const sent = useRef(list.search);

	useEffect(() => {
		if (settled.trim() === sent.current) return;
		sent.current = settled.trim();
		list.setSearch(settled);
	}, [settled, list]);

	useEffect(() => {
		// An outside change (Reset, Back) wins over a stale draft.
		if (list.search !== sent.current) {
			sent.current = list.search;
			setDraft(list.search);
		}
	}, [list.search]);

	return (
		<Input
			type="search"
			placeholder={placeholder}
			aria-label={placeholder.replace(/…$/, "")}
			value={draft}
			onChange={(event) => setDraft(event.target.value)}
			className="h-7 max-w-xs"
		/>
	);
}

/** FacetFilter is a dropdown of checkable values; checking several matches any of them. */
export function FacetFilter({ list, facet }: { list: ListState; facet: Facet }) {
	const selected = list.filters[facet.field] ?? [];
	const toggle = (value: string, on: boolean) =>
		list.setFilter(
			facet.field,
			on
				? [...selected, value]
				: selected.filter((current) => current !== value),
		);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button variant="outline" size="sm" className="border-dashed">
						<ListFilter />
						{facet.label}
						{selected.length > 0 && (
							<Badge variant="secondary">{selected.length}</Badge>
						)}
					</Button>
				}
			/>
			<DropdownMenuContent align="start" className="min-w-44">
				<DropdownMenuGroup>
					<DropdownMenuLabel>{facet.label}</DropdownMenuLabel>
					{facet.options.map((option) => (
						<DropdownMenuCheckboxItem
							key={option}
							checked={selected.includes(option)}
							onCheckedChange={(on) => toggle(option, on)}
						>
							{titleCase(option)}
						</DropdownMenuCheckboxItem>
					))}
				</DropdownMenuGroup>
				{selected.length > 0 && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() => list.setFilter(facet.field, [])}
						>
							Clear
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

const rangeLabels: Record<CreatedRange | "any", string> = {
	any: "Any time",
	"24h": "Last 24 hours",
	"7d": "Last 7 days",
	"30d": "Last 30 days",
};

/** CreatedFilter limits a list to rows created within a recent window. */
export function CreatedFilter({ list }: { list: ListState }) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button variant="outline" size="sm" className="border-dashed">
						<CalendarRange />
						{rangeLabels[list.created ?? "any"]}
					</Button>
				}
			/>
			<DropdownMenuContent align="start" className="min-w-44">
				<DropdownMenuGroup>
					<DropdownMenuLabel>Created</DropdownMenuLabel>
					<DropdownMenuRadioGroup
						value={list.created ?? "any"}
						onValueChange={(value) =>
							list.setCreated(
								value === "any" ? undefined : (value as CreatedRange),
							)
						}
					>
						{Object.entries(rangeLabels).map(([value, label]) => (
							<DropdownMenuRadioItem key={value} value={value}>
								{label}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** ResetFilters clears search, filters and the date range in one step. */
export function ResetFilters({ list }: { list: ListState }) {
	if (!list.narrowed) return null;
	return (
		<Button variant="ghost" size="sm" onClick={list.reset}>
			Reset
			<X />
		</Button>
	);
}
