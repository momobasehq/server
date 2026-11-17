import { useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { usePagedQuery } from "@/hooks/use-paged-query";
import {
	formatAmount,
	formatDateTime,
	titleCase,
} from "@/lib/format";
import { keys } from "@/lib/query-keys";
import {
	PaymentMethods,
	type AdminTransaction,
	type ServiceType,
	type TransactionListQuery,
	type TransactionStatus,
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
	{ field: "paymentMethod", label: "Method", options: PaymentMethods },
] as const;

/** transactionLink is a shareable URL that opens one transaction's details. */
function transactionLink(id: string) {
	return `${window.location.origin}${window.location.pathname}#/transactions?tx=${encodeURIComponent(id)}`;
}

/** Polling cadence while live updates are on: fresh enough to watch a payment settle. */
const liveInterval = 5_000;

/** Service shows money's direction, in the same hues the overview charts use. */
function Service({ type }: { type: ServiceType }) {
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
		cell: ({ row: { original: tx } }) => <Timestamp value={tx.created_at} />,
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

	// The open transaction lives in the URL, so a copied link reopens it. A row on the
	// current page opens at once; any other is fetched by ID.
	const [params, setParams] = useSearchParams();
	const selectedId = params.get("tx") ?? undefined;
	const onPage = paged.items.find((tx) => tx.id === selectedId);
	const fetched = useQuery({
		queryKey: keys.transactions.detail(selectedId ?? ""),
		queryFn: () => client.transactions.get(selectedId ?? ""),
		enabled: Boolean(selectedId) && !onPage,
	});
	const selected = onPage ?? fetched.data;
	const select = (tx?: AdminTransaction) =>
		setParams((current) => {
			const next = new URLSearchParams(current);
			if (tx) next.set("tx", tx.id);
			else next.delete("tx");
			return next;
		});

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
		// select only writes the URL, so the columns never need rebuilding for it.
		[],
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
			<TransactionDialog
				open={Boolean(selectedId)}
				transaction={selected}
				onClose={() => select(undefined)}
			/>
		</Card>
	);
}

function TransactionDialog({
	open,
	transaction,
	onClose,
}: {
	/** Open while the URL names a transaction, even before it has loaded. */
	open: boolean;
	transaction?: AdminTransaction;
	onClose: () => void;
}) {
	return (
		<Dialog
			open={open}
			onOpenChange={(open) => !open && onClose()}
		>
			<DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>
						{transaction?.reference ?? "Transaction details"}
					</DialogTitle>
					<DialogDescription>
						Complete values captured on the transaction record. Fees
						are the immutable amounts computed when it was created.
					</DialogDescription>
				</DialogHeader>

				{transaction && (
					<div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
						<Detail label="Status">
							<StatusBadge status={transaction.status} />
						</Detail>
						<Detail label="Service">
							<Service type={transaction.service_type} />
						</Detail>
						<Detail label="Payment method">
							<code>{transaction.payment_method}</code>
						</Detail>
						<Detail label="Amount">
							{formatAmount(
								transaction.amount,
								transaction.currency,
							)}
						</Detail>
						<Detail label="Provider fee">
							{formatAmount(
								transaction.provider_fee,
								transaction.currency,
							)}
						</Detail>
						<Detail label="Platform fee">
							{formatAmount(
								transaction.platform_fee,
								transaction.currency,
							)}
						</Detail>
						<Detail label="Currency">
							<code>{transaction.currency}</code>
						</Detail>
						<Detail label="Country">
							<code>{transaction.country || "—"}</code>
						</Detail>
						<Detail label="Reference">
							<code className="break-all">
								{transaction.reference}
							</code>
						</Detail>
						<Detail label="Transaction ID">
							<code className="break-all">{transaction.id}</code>
						</Detail>
						<Detail label="App ID">
							<code className="break-all">
								{transaction.app_id}
							</code>
						</Detail>
						<Detail label="Idempotency key">
							<code className="break-all">
								{transaction.idempotency_key}
							</code>
						</Detail>
						<Detail label="Selected route">
							<code className="break-all">
								{transaction.selected_route_id || "—"}
							</code>
						</Detail>
						<Detail label="Provider account">
							{transaction.selected_provider_account_id ? (
								<Link
									className="break-all font-mono underline-offset-4 hover:underline"
									to={`/providers/${transaction.selected_provider_account_id}`}
									onClick={onClose}
								>
									{transaction.selected_provider_account_id}
								</Link>
							) : (
								"—"
							)}
						</Detail>
						<Detail label="Provider reference">
							<code className="break-all">
								{transaction.provider_reference || "—"}
							</code>
						</Detail>
						<Detail label="Customer account">
							<code className="break-all">
								{transaction.customer_account || "—"}
							</code>
						</Detail>
						<Detail label="Customer name">
							{transaction.customer_name || "—"}
						</Detail>
						<Detail label="Customer email">
							<span className="break-all">
								{transaction.customer_email || "—"}
							</span>
						</Detail>
						<Detail label="Description">
							<span className="whitespace-pre-wrap">
								{transaction.description || "—"}
							</span>
						</Detail>
						<Detail label="Reconciliation attempts">
							{transaction.reconciliation_attempts}
						</Detail>
						<Detail label="Last reconciled">
							{formatDateTime(transaction.last_reconciled_at)}
						</Detail>
						<Detail label="Next reconciliation">
							{formatDateTime(transaction.next_reconcile_at)}
						</Detail>
						<Detail label="Created">
							{formatDateTime(transaction.created_at)}
						</Detail>
						<Detail label="Last updated">
							{formatDateTime(transaction.updated_at)}
						</Detail>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="min-w-0">
			<p className="text-muted-foreground">{label}</p>
			<div className="mt-1">{children}</div>
		</div>
	);
}
