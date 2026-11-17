import { Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { DataTable, type DataColumn } from "@/components/data-table";
import { Flag } from "@/components/country-select";
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
import {
	AdminPermissions,
	type ProviderAccount,
	type ProviderAccountListQuery,
} from "momobase";

const providerFacets = [
	{ field: "environment", label: "Environment", options: ["sandbox", "production"] },
] as const;

import { useAuth } from "@/hooks/use-auth";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { formatAmount, formatDateTime } from "@/lib/format";
import { keys } from "@/lib/query-keys";

/** Providers manages provider accounts, their activation, and their balances. */
export function Providers() {
	const { client, can } = useAuth();
	const queryClient = useQueryClient();
	const paged = usePagedQuery(
		keys.providers.list,
		(query: ProviderAccountListQuery) => client.providers.list(query),
		{ filters: providerFacets.map((facet) => facet.field) },
	);
	// Balances are their own permission, which read_only does not hold, so the card is
	// hidden rather than left to fail — and its query never fires.
	const showBalances = can(AdminPermissions.balancesRead);
	const balances = usePagedQuery(
		keys.providers.balances,
		(page) => client.providers.activeBalances(page),
		{ enabled: showBalances, param: "balances" },
	);
	const navigate = useNavigate();

	async function refresh() {
		await queryClient.invalidateQueries({ queryKey: keys.providers.all });
	}

	const toggle = useMutation({
		mutationFn: ({ id, active }: { id: string; active: boolean }) =>
			active
				? client.providers.deactivate(id)
				: client.providers.activate(id),
		onSuccess: async () => {
			toast.success("Provider account updated");
			await refresh();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const test = useMutation({
		mutationFn: (id: string) => client.providers.test(id),
		onSuccess: () => toast.success("Configuration passed its health check"),
		onError: (error: Error) => toast.error(error.message),
	});

	const columns: DataColumn<ProviderAccount>[] = [
		{
			id: "name",
			accessorFn: (r) => r.name,
			header: "Name",
			meta: { sortKey: "name" },
			cell: ({ row: { original: account } }) => (
				<Link
					className="font-medium underline-offset-4 hover:underline"
					to={`/providers/${account.id}`}
				>
					{account.name}
				</Link>
			),
		},
		{
			id: "code",
			accessorFn: (r) => r.provider_code,
			header: "Provider",
			meta: { sortKey: "provider_code" },
			cell: ({ row: { original: account } }) => (
				<code>{account.provider_code}</code>
			),
		},
		{
			id: "environment",
			accessorFn: (r) => r.environment,
			header: "Environment",
			cell: ({ row: { original: account } }) => (
				<StatusBadge status={account.environment} />
			),
		},
		{
			id: "country",
			accessorFn: (r) => r.country,
			header: "Country",
			cell: ({ row: { original: account } }) => (
				<span className="flex items-center gap-2">
					<Flag code={account.country} />
					{account.country}
				</span>
			),
		},
		{
			id: "currency",
			accessorFn: (r) => r.currency,
			header: "Currency",
			cell: ({ row: { original: account } }) => account.currency,
		},
		{
			id: "active",
			accessorFn: (r) => (r.active ? "active" : "inactive"),
			header: "Status",
			cell: ({ row: { original: account } }) => (
				<StatusBadge status={account.active ? "active" : "inactive"} />
			),
		},
		{
			id: "version",
			accessorFn: (r) => r.config_version,
			header: "Config",
			cell: ({ row: { original: account } }) => `v${account.config_version}`,
		},
		{
			id: "updated",
			accessorFn: (r) => r.updated_at,
			header: "Updated",
			meta: { sortKey: "updated_at" },
			cell: ({ row: { original: account } }) =>
				formatDateTime(account.updated_at),
		},
		rowActionsColumn<ProviderAccount>((account) => [
			{
				label: "Test connection",
				permission: AdminPermissions.providersTest,
				disabled: test.isPending,
				onSelect: () => test.mutate(account.id),
			},
			{
				label: "Configure",
				permission: AdminPermissions.providersUpdate,
				onSelect: () =>
					void navigate(`/providers/${account.id}/configure`),
			},
			{
				label: account.active ? "Deactivate" : "Activate",
				destructive: account.active,
				permission: AdminPermissions.providersUpdate,
				disabled: toggle.isPending,
				onSelect: () =>
					toggle.mutate({ id: account.id, active: account.active }),
			},
		]),
	];

	return (
		<div className="flex flex-col gap-4">
			<Card>
				<CardHeader>
					<CardTitle>Provider accounts</CardTitle>
					<CardDescription>
						Configured adapters and the country and currency each
						one serves.
					</CardDescription>
					<CardAction>
						<GuardedAction
							permission={AdminPermissions.providersCreate}
							size="sm"
							nativeButton={false}
							render={<Link to="/providers/new" />}
						>
							<Plus />
							New account
						</GuardedAction>
					</CardAction>
				</CardHeader>
				<CardContent>
					<DataTable
						tableId="providers"
						list={paged.list}
						facets={providerFacets}
						searchPlaceholder="Search name, code or ID…"
						columns={columns}
						rows={paged.items}
						rowKey={(account) => account.id}
						loading={paged.loading}
						empty="No provider accounts yet. Register one to start routing payments."
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

			{showBalances && (
				<Card>
					<CardHeader>
						<CardTitle>Balances</CardTitle>
						<CardDescription>
							Live balances for every active provider account.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<DataTable
							tableId="balances"
							columns={[
								{
									id: "provider",
									accessorFn: (r) => r.provider_code ?? r.provider_account_id,
									header: "Provider",
									cell: ({ row: { original: row } }) => (
										<code>
											{row.provider_code ??
												row.provider_account_id}
										</code>
									),
								},
								{
									id: "country",
									accessorFn: (r) => r.country,
									header: "Country",
									cell: ({ row: { original: row } }) => row.country,
								},
								{
									id: "status",
									accessorFn: (r) => r.status,
									header: "Status",
									cell: ({ row: { original: row } }) => (
										<StatusBadge status={row.status} />
									),
								},
								{
									id: "available",
									accessorFn: (r) => r.balance?.available,
									header: "Available",
									meta: { align: "end" },
									cell: ({ row: { original: row } }) =>
										row.balance
											? formatAmount(
													row.balance.available,
													row.balance.currency,
												)
											: "—",
								},
								{
									id: "ledger",
									accessorFn: (r) => r.balance?.ledger,
									header: "Ledger",
									meta: { align: "end" },
									cell: ({ row: { original: row } }) =>
										row.balance
											? formatAmount(
													row.balance.ledger,
													row.balance.currency,
												)
											: "—",
								},
								{
									id: "error",
									accessorFn: (r) => r.error,
									header: "Error",
									cell: ({ row: { original: row } }) => row.error ?? "—",
								},
							]}
							rows={balances.items}
							rowKey={(row) =>
								`${row.provider_account_id}-${row.country}`
							}
							loading={balances.loading}
							empty="No active provider accounts to query."
						/>
						<PaginationControls
							page={balances.page}
							perPage={balances.perPage}
							total={balances.total}
							count={balances.count}
							onPageChange={balances.setPage}
							onPerPageChange={balances.setPerPage}
							busy={balances.fetching}
						/>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
