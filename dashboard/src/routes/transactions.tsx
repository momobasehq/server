import { useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

import { DataTable, type DataColumn } from "@/components/data-table";
import { PaginationControls } from "@/components/pagination-controls";
import { rowActionsColumn } from "@/components/row-actions";
import { StatusBadge } from "@/components/status-badge";
import { Timestamp } from "@/components/timestamp";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { formatAmount, titleCase } from "@/lib/format";
import { paymentMethods } from "@/lib/payment-methods";
import { keys } from "@/lib/query-keys";
import type {
	AdminTransaction,
	ServiceType,
	TransactionListQuery,
	TransactionStatus,
} from "momobase";

const statuses = [
	"pending",
	"processing",
	"succeeded",
	"failed",
	"unknown",
	"cancelled",
	"expired",
] as const satisfies readonly TransactionStatus[];

const facets = [
	{ field: "status", label: "Status", options: statuses },
	{
		field: "serviceType",
		label: "Service",
		options: ["collection", "disbursement"],
	},
	{ field: "paymentMethod", label: "Method", options: paymentMethods },
] as const;

/** transactionLink is a shareable URL that opens one transaction's details. */
function transactionLink(id: string) {
	return `${window.location.origin}${window.location.pathname}#/transactions/${encodeURIComponent(id)}`;
}

/** Polling cadence while live updates are on: fresh enough to watch a payment settle. */
const liveInterval = 5_000;

/** Service shows money's direction, in the same hues the overview charts use. */
export function Service({ type }: { type: ServiceType }) {
	const Icon = type === "collection" ? ArrowDownLeft : ArrowUpRight;
	return (
		<span className="inline-flex items-center gap-1.5">
			<Icon
				aria-hidden
				className={
					type === "collection"
						? "text-chart-1 size-4"
						: "text-chart-2 size-4"
				}
			/>
			{titleCase(type)}
		</span>
	);
}

/** signedAmount prefixes money in with + and money out with −. */
function signedAmount(tx: AdminTransaction) {
	const sign = tx.service_type === "collection" ? "+" : "−";
	return `${sign}${formatAmount(tx.amount, tx.currency)}`;
}

const columns: DataColumn<AdminTransaction>[] = [
	{
		id: "reference",
		accessorFn: (r) => r.reference,
		header: "Reference",
		enableHiding: false,
		cell: ({ row: { original: tx } }) => (
			<span className="font-medium">{tx.reference}</span>
		),
	},
	{
		id: "service",
		accessorFn: (r) => r.service_type,
		header: "Service",
		cell: ({ row: { original: tx } }) => <Service type={tx.service_type} />,
	},
	// Payment methods are free-form strings matched against routes, so this column
	// shows whatever the integrator sent rather than a known set of rails.
	{
		id: "method",
		accessorFn: (r) => r.payment_method,
		header: "Method",
		cell: ({ row: { original: tx } }) => <code>{tx.payment_method}</code>,
	},
	{
		id: "amount",
		accessorFn: (r) => r.amount,
		header: "Amount",
		meta: { align: "end", sortKey: "amount" },
		cell: ({ row: { original: tx } }) => (
			<span className="tabular-nums">{signedAmount(tx)}</span>
		),
	},
	{
		id: "provider_fee",
		accessorFn: (r) => r.provider_fee,
		header: "Provider fee",
		meta: { align: "end" },
		cell: ({ row: { original: tx } }) =>
			formatAmount(tx.provider_fee, tx.currency),
	},
	{
		id: "platform_fee",
		accessorFn: (r) => r.platform_fee,
		header: "Platform fee",
		meta: { align: "end" },
		cell: ({ row: { original: tx } }) =>
			formatAmount(tx.platform_fee, tx.currency),
	},
	{
		id: "account",
		accessorFn: (r) => r.customer_account,
		header: "Account",
		cell: ({ row: { original: tx } }) => (
			<code>{tx.customer_account || "—"}</code>
		),
	},
	{
		id: "country",
		accessorFn: (r) => r.country,
		header: "Country",
		cell: ({ row: { original: tx } }) => tx.country || "—",
	},
	{
		id: "status",
		accessorFn: (r) => r.status,
		header: "Status",
		meta: { sortKey: "status" },
		cell: ({ row: { original: tx } }) => <StatusBadge status={tx.status} />,
	},
	{
		id: "created",
		accessorFn: (r) => r.created_at,
		header: "Created",
		meta: { sortKey: "created_at" },
		cell: ({ row: { original: tx } }) => (
			<Timestamp value={tx.created_at} />
		),
	},
];

/** Transactions lists every payment the engine has recorded. */
export function Transactions() {
	const { client } = useAuth();
	const [live, setLive] = useState(false);
	const paged = usePagedQuery(
		keys.transactions.list,
		(query: TransactionListQuery) => client.transactions.list(query),
		{
			refetchInterval: live && liveInterval,
			filters: facets.map((facet) => facet.field),
		},
	);

	// Details open on their own page. The row travels as route state so the page can
	// render it at once instead of refetching what the table already holds.
	const navigate = useNavigate();
	const select = (tx: AdminTransaction) =>
		void navigate(`/transactions/${encodeURIComponent(tx.id)}`, {
			state: tx,
		});
	// Links copied before details became a page used ?tx=, so they still resolve.
	const [params] = useSearchParams();
	const legacyId = params.get("tx");

	const withActions = useMemo(
		() => [
			...columns,
			rowActionsColumn<AdminTransaction>((tx) => [
				{ label: "View details", onSelect: () => select(tx) },
				{
					label: "Copy link",
					onSelect: () =>
						void navigator.clipboard
							.writeText(transactionLink(tx.id))
							.then(() => toast.success("Link copied")),
				},
			]),
		],
		// select only navigates, so the columns never need rebuilding for it.
		[],
	);

	if (legacyId)
		return (
			<Navigate
				to={`/transactions/${encodeURIComponent(legacyId)}`}
				replace
			/>
		);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Transactions</CardTitle>
				<CardDescription>
					Collections and disbursements across every app.
				</CardDescription>
				<CardAction className="flex items-center gap-2">
					<Switch
						id="transactions-live"
						checked={live}
						onCheckedChange={setLive}
					/>
					<Label htmlFor="transactions-live">Live</Label>
				</CardAction>
			</CardHeader>
			<CardContent>
				<DataTable
					rows={paged.items}
					rowKey={(tx) => tx.id}
					loading={paged.loading}
					empty="No payments have been created yet."
					onRowClick={select}
					tableId="transactions"
					columns={withActions}
					list={paged.list}
					facets={facets}
					createdFilter
					searchPlaceholder="Search reference, account or ID…"
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
