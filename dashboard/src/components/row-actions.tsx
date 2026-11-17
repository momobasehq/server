import { MoreHorizontal } from "lucide-react";
import type { RowData } from "@tanstack/react-table";
import type { PermissionCode } from "momobase";
import { toast } from "sonner";

import type { DataColumn } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";

/** RowAction is one entry in a row's actions menu. */
export interface RowAction {
	label: string;
	onSelect: () => void;
	/** Disables the item, naming the permission, when the admin lacks it. */
	permission?: PermissionCode;
	disabled?: boolean;
	/** Destructive items sit apart, below a separator, in red. */
	destructive?: boolean;
}

/**
 * rowActionsColumn is the guide's trailing ⋯ menu. Every row gets "Copy ID" first,
 * since IDs are what support threads and API lookups ask for.
 */
export function rowActionsColumn<T extends RowData>(
	actions: (row: T) => RowAction[],
): DataColumn<T> {
	return {
		id: "actions",
		header: "",
		enableHiding: false,
		enableSorting: false,
		meta: { align: "end" },
		cell: ({ row }) => (
			<RowActions id={row.id} actions={actions(row.original)} />
		),
	};
}

function RowActions({ id, actions }: { id: string; actions: RowAction[] }) {
	const { can } = useAuth();
	const safe = actions.filter((action) => !action.destructive);
	const destructive = actions.filter((action) => action.destructive);

	const item = (action: RowAction) => {
		const allowed = !action.permission || can(action.permission);
		return (
			<DropdownMenuItem
				key={action.label}
				variant={action.destructive ? "destructive" : "default"}
				disabled={!allowed || action.disabled}
				onClick={action.onSelect}
				// Disabled items show no tooltip, so the reason rides in the title.
				title={
					allowed
						? undefined
						: `Requires the ${action.permission} permission.`
				}
			>
				{action.label}
			</DropdownMenuItem>
		);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Row actions"
						// The menu lives inside rows that may open a dialog on click.
						onClick={(event) => event.stopPropagation()}
						onKeyDown={(event) => event.stopPropagation()}
					>
						<MoreHorizontal />
					</Button>
				}
			/>
			<DropdownMenuContent
				align="end"
				className="min-w-40"
				// React events bubble through the portal back to the row's click handler.
				onClick={(event) => event.stopPropagation()}
			>
				<DropdownMenuGroup>
					<DropdownMenuLabel>Actions</DropdownMenuLabel>
					<DropdownMenuItem
						onClick={() =>
							void navigator.clipboard
								.writeText(id)
								.then(() => toast.success("ID copied"))
						}
					>
						Copy ID
					</DropdownMenuItem>
					{safe.map(item)}
				</DropdownMenuGroup>
				{destructive.length > 0 && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							{destructive.map(item)}
						</DropdownMenuGroup>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
