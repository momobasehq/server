import { Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { toast } from "sonner";
import {
	AdminPermissions,
	type PaymentRoute,
	type PaymentRouteListQuery,
} from "momobase";

const routeFacets = [
	{
		field: "serviceType",
		label: "Service",
		options: ["collection", "disbursement"],
	},
	{ field: "paymentMethod", label: "Method", options: paymentMethods },
] as const;

import { DataTable, type DataColumn } from "@/components/data-table";
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
import { paymentMethods } from "@/lib/payment-methods";
import { keys } from "@/lib/query-keys";
import { titleCase } from "@/lib/format";

/** PaymentRoutes manages the routing table. */
export function PaymentRoutes() {
	const { client } = useAuth();
	const queryClient = useQueryClient();
	const paged = usePagedQuery(
		keys.routes.list,
		(query: PaymentRouteListQuery) => client.routes.list(query),
		{ filters: routeFacets.map((facet) => facet.field) },
	);

	const update = useMutation({
		mutationFn: ({
			id,
			priority,
			active,
		}: {
			id: string;
			priority: number;
			active: boolean;
		}) => client.routes.update(id, { priority, active }),
		onSuccess: async () => {
			toast.success("Route updated");
			await queryClient.invalidateQueries({ queryKey: keys.routes.all });
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const columns: DataColumn<PaymentRoute>[] = [
		{
			id: "service",
			accessorFn: (r) => r.service_type,
			header: "Service",
			cell: ({ row: { original: route } }) =>
				titleCase(route.service_type),
		},
		{
			id: "method",
			accessorFn: (r) => r.payment_method,
			header: "Method",
			cell: ({ row: { original: route } }) => (
				<code className="font-medium">{route.payment_method}</code>
			),
		},
		{
			id: "account",
			accessorFn: (r) => r.provider_name || r.provider_account_id,
			header: "Provider account",
			cell: ({ row: { original: route } }) => (
				<Link
					className="font-medium underline-offset-4 hover:underline"
					to={`/providers/${route.provider_account_id}`}
				>
					{route.provider_name || route.provider_account_id}
				</Link>
			),
		},
		{
			id: "priority",
			accessorFn: (r) => r.priority,
			header: "Priority",
			meta: { align: "end", sortKey: "priority" },
			cell: ({ row: { original: route } }) => route.priority,
		},
		{
			id: "active",
			accessorFn: (r) => (r.active ? "active" : "inactive"),
			header: "Status",
			cell: ({ row: { original: route } }) => (
				<StatusBadge status={route.active ? "active" : "inactive"} />
			),
		},
		rowActionsColumn<PaymentRoute>((route) => [
			{
				label: route.active ? "Disable" : "Enable",
				permission: AdminPermissions.routesUpdate,
				disabled: update.isPending,
				onSelect: () =>
					update.mutate({
						id: route.id,
						priority: route.priority,
						active: !route.active,
					}),
			},
		]),
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>Routes</CardTitle>
				<CardDescription>
					Which provider account serves each service and payment
					method.
				</CardDescription>
				<CardAction>
					<GuardedAction
						permission={AdminPermissions.routesCreate}
						size="sm"
						nativeButton={false}
						render={<Link to="/routes/new" />}
					>
						<Plus />
						New route
					</GuardedAction>
				</CardAction>
			</CardHeader>
			<CardContent>
				<DataTable
					tableId="routes"
					list={paged.list}
					facets={routeFacets}
					searchPlaceholder="Search method or provider account…"
					columns={columns}
					rows={paged.items}
					rowKey={(route) => route.id}
					loading={paged.loading}
					empty="No routes yet. A payment cannot be executed until one exists."
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
