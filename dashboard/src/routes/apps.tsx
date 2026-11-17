import { Plus } from "lucide-react";
import { Link, useNavigate } from "react-router";
import {
	AdminPermissions,
	type App,
	type AppListQuery,
} from "momobase";

const appFacets = [
	{ field: "status", label: "Status", options: ["active", "disabled", "suspended"] },
	{ field: "environment", label: "Environment", options: ["sandbox", "production"] },
] as const;

import { DataTable, type DataColumn } from "@/components/data-table";
import { CurrencyFlag } from "@/components/country-select";
import { GuardedAction } from "@/components/guarded-action";
import { PaginationControls } from "@/components/pagination-controls";
import { rowActionsColumn } from "@/components/row-actions";
import { StatusBadge } from "@/components/status-badge";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { formatDateTime } from "@/lib/format";
import { keys } from "@/lib/query-keys";

/** Apps lists integrating applications and links to their credentials. */
export function Apps() {
	const navigate = useNavigate();
	const { client } = useAuth();
	const paged = usePagedQuery(
		keys.apps.list,
		(query: AppListQuery) => client.apps.list(query),
		{ filters: appFacets.map((facet) => facet.field) },
	);

	const columns: DataColumn<App>[] = [
		{
			id: "name",
			accessorFn: (r) => r.name,
			header: "Name",
			// Underlined unconditionally: with hover-only underline this read as plain text,
			// so the detail page — and every credential on it — looked like it did not exist.
			meta: { sortKey: "name" },
			cell: ({ row: { original: app } }) => (
				<Link
					to={`/apps/${app.id}`}
					className="font-medium underline underline-offset-4"
				>
					{app.name}
				</Link>
			),
		},
		{
			id: "environment",
			accessorFn: (r) => r.environment,
			header: "Environment",
			cell: ({ row: { original: app } }) => (
				<StatusBadge status={app.environment} />
			),
		},
		{
			id: "currency",
			accessorFn: (r) => r.currency,
			header: "Currency",
			cell: ({ row: { original: app } }) => (
				<span className="flex items-center gap-2">
					<CurrencyFlag code={app.currency} />
					{app.currency}
				</span>
			),
		},
		{
			id: "status",
			accessorFn: (r) => r.status,
			header: "Status",
			meta: { sortKey: "status" },
			cell: ({ row: { original: app } }) => <StatusBadge status={app.status} />,
		},
		{
			id: "description",
			accessorFn: (r) => r.description,
			header: "Description",
			cell: ({ row: { original: app } }) => app.description || "—",
		},
		{
			id: "created",
			accessorFn: (r) => r.created_at,
			header: "Created",
			meta: { sortKey: "created_at" },
			cell: ({ row: { original: app } }) => formatDateTime(app.created_at),
		},
		// Status, credentials, and the tester all live on the detail page, so the menu
		// offers one unambiguous way in rather than a partial set of actions.
		rowActionsColumn<App>((app) => [
			{ label: "Manage", onSelect: () => void navigate(`/apps/${app.id}`) },
		]),
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>Apps</CardTitle>
				<CardDescription>
					Systems that create payments through the public API.
				</CardDescription>
				<CardAction>
					<GuardedAction
						permission={AdminPermissions.appsCreate}
						size="sm"
						nativeButton={false}
						render={<Link to="/apps/new" />}
					>
						<Plus />
						New app
					</GuardedAction>
				</CardAction>
			</CardHeader>
			<CardContent>
				<DataTable
					tableId="apps"
					list={paged.list}
					facets={appFacets}
					createdFilter
					searchPlaceholder="Search name, description or ID…"
					columns={columns}
					rows={paged.items}
					rowKey={(app) => app.id}
					loading={paged.loading}
				/>
				<PaginationControls
					page={paged.page}
					perPage={paged.perPage}
					total={paged.total}
					count={paged.count}
					onPageChange={paged.setPage}
					onPerPageChange={paged.setPerPage}
					busy={paged.fetching}
				/>
			</CardContent>
		</Card>
	);
}
