import { DataTable, type DataColumn } from "@/components/data-table";
import { PaginationControls } from "@/components/pagination-controls";
import { StatusBadge } from "@/components/status-badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	AdminPermissions,
	type ProviderHealthSnapshot,
	type RuntimeProvider,
	type WorkerState,
} from "momobase";
import { Link } from "react-router";

import { useAuth } from "@/hooks/use-auth";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { formatDateTime, titleCase } from "@/lib/format";
import { keys } from "@/lib/query-keys";

const workerColumns: DataColumn<WorkerState>[] = [
	{
		id: "name",
		accessorFn: (r) => r.name,
		header: "Worker",
		cell: ({ row: { original: worker } }) => (
			<span className="font-medium">{titleCase(worker.name)}</span>
		),
	},
	{
		id: "configured",
		accessorFn: (r) => (r.configured ? "active" : "inactive"),
		header: "Configured",
		cell: ({ row: { original: worker } }) => (
			<StatusBadge status={worker.configured ? "active" : "inactive"} />
		),
	},
	{
		id: "state",
		accessorFn: (r) => r.state,
		header: "State",
		cell: ({ row: { original: worker } }) => (
			<StatusBadge status={worker.state} />
		),
	},
];

const healthColumns: DataColumn<ProviderHealthSnapshot>[] = [
	{
		id: "account",
		accessorFn: (r) => r.provider_name || r.provider_account_id,
		header: "Provider account",
		cell: ({ row: { original: row } }) => (
			<Link
				className="font-medium underline-offset-4 hover:underline"
				to={`/providers/${row.provider_account_id}`}
			>
				{row.provider_name || row.provider_account_id}
			</Link>
		),
	},
	{
		id: "status",
		accessorFn: (r) => r.status,
		header: "Status",
		cell: ({ row: { original: row } }) => <StatusBadge status={row.status} />,
	},
	{
		id: "circuit",
		accessorFn: (r) => r.circuit_state,
		header: "Circuit",
		cell: ({ row: { original: row } }) => (
			<StatusBadge status={row.circuit_state} />
		),
	},
	{
		id: "failures",
		accessorFn: (r) => r.consecutive_failures,
		header: "Failures",
		meta: { align: "end" },
		cell: ({ row: { original: row } }) => row.consecutive_failures,
	},
	{
		id: "latency",
		accessorFn: (r) => r.latency_ms,
		header: "Latency",
		meta: { align: "end" },
		cell: ({ row: { original: row } }) => `${row.latency_ms} ms`,
	},
	{
		id: "checked",
		accessorFn: (r) => r.last_checked_at,
		header: "Last checked",
		cell: ({ row: { original: row } }) => formatDateTime(row.last_checked_at),
	},
	{
		id: "error",
		accessorFn: (r) => r.last_error_message,
		header: "Last error",
		cell: ({ row: { original: row } }) => row.last_error_message || "—",
	},
];

const runtimeColumns: DataColumn<RuntimeProvider>[] = [
	{
		id: "code",
		accessorFn: (r) => r.provider_code,
		header: "Provider",
		cell: ({ row: { original: row } }) => <code>{row.provider_code}</code>,
	},
	{
		id: "account",
		accessorFn: (r) => r.provider_name || r.provider_account_id,
		header: "Account",
		cell: ({ row: { original: row } }) => (
			<Link
				className="font-medium underline-offset-4 hover:underline"
				to={`/providers/${row.provider_account_id}`}
			>
				{row.provider_name || row.provider_account_id}
			</Link>
		),
	},
	{
		id: "initialized",
		accessorFn: (r) => (r.initialized ? "active" : "inactive"),
		header: "Initialized",
		cell: ({ row: { original: row } }) => (
			<StatusBadge status={row.initialized ? "active" : "inactive"} />
		),
	},
	{
		id: "version",
		accessorFn: (r) => r.config_version,
		header: "Config",
		cell: ({ row: { original: row } }) => `v${row.config_version}`,
	},
	{
		id: "country",
		accessorFn: (r) => r.country,
		header: "Country",
		cell: ({ row: { original: row } }) => row.country,
	},
	{
		id: "currency",
		accessorFn: (r) => r.currency,
		header: "Currency",
		cell: ({ row: { original: row } }) => row.currency,
	},
	{
		id: "capabilities",
		accessorFn: (r) => r.capabilities.length,
		header: "Capabilities",
		meta: { align: "end" },
		cell: ({ row: { original: row } }) => row.capabilities.length,
	},
];

/** Operations shows worker state, provider health, and the loaded runtimes. */
export function Operations() {
	const { client, can } = useAuth();
	// Reaching this screen needs system:read; the provider sections need their own
	// permission, so a role with one and not the other sees only what it may.
	const showProviders = can(AdminPermissions.providersRead);
	const workers = usePagedQuery(keys.system.workers, (page) =>
		client.system.workers(page),
	);
	const health = usePagedQuery(
		keys.providers.health,
		(page) => client.providers.health(page),
		{ enabled: showProviders, param: "health" },
	);
	const runtime = usePagedQuery(
		keys.system.runtime,
		(page) => client.system.runtimeProviders(page),
		{ enabled: showProviders, param: "runtime" },
	);

	return (
		<div className="flex flex-col gap-4">
			<Card>
				<CardHeader>
					<CardTitle>Workers</CardTitle>
					<CardDescription>
						Background loops owned by the worker manager.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<DataTable
						tableId="workers"
						columns={workerColumns}
						rows={workers.items}
						rowKey={(worker) => worker.name}
						loading={workers.loading}
					/>
					<PaginationControls
						page={workers.page}
						perPage={workers.perPage}
						total={workers.total}
						count={workers.count}
						onPageChange={workers.setPage}
						onPerPageChange={workers.setPerPage}
						busy={workers.fetching}
					/>
				</CardContent>
			</Card>

			{showProviders && (
				<Card>
					<CardHeader>
						<CardTitle>Provider health</CardTitle>
						<CardDescription>
							The health probe's latest verdict, and each
							account's circuit breaker.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<DataTable
							tableId="provider-health"
							columns={healthColumns}
							rows={health.items}
							rowKey={(row) => row.provider_account_id}
							loading={health.loading}
							empty="No health snapshots recorded yet."
						/>
						<PaginationControls
							page={health.page}
							perPage={health.perPage}
							total={health.total}
							count={health.count}
							onPageChange={health.setPage}
							onPerPageChange={health.setPerPage}
							busy={health.fetching}
						/>
					</CardContent>
				</Card>
			)}

			{showProviders && (
				<Card>
					<CardHeader>
						<CardTitle>Runtime providers</CardTitle>
						<CardDescription>
							Adapters currently held in memory.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<DataTable
							tableId="runtime-providers"
							columns={runtimeColumns}
							rows={runtime.items}
							rowKey={(row) => row.provider_account_id}
							loading={runtime.loading}
							empty="No adapters are loaded."
						/>
						<PaginationControls
							page={runtime.page}
							perPage={runtime.perPage}
							total={runtime.total}
							count={runtime.count}
							onPageChange={runtime.setPage}
							onPerPageChange={runtime.setPerPage}
							busy={runtime.fetching}
						/>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
