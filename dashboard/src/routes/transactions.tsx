import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { ColumnToggle, useColumnVisibility } from "@/components/column-toggle";
import { DataTable, type DataColumn } from "@/components/data-table";
import { PaginationControls } from "@/components/pagination-controls";
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
import type { AdminTransaction, ServiceType } from "momobase";

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
		header: "Reference",
		enableHiding: false,
		cell: ({ row: { original: tx } }) => (
			<span className="font-medium">{tx.reference}</span>
		),
	},
	{
		id: "service",
		header: "Service",
		cell: ({ row: { original: tx } }) => <Service type={tx.service_type} />,
	},
	// Payment methods are free-form strings matched against routes, so this column
	// shows whatever the integrator sent rather than a known set of rails.
	{
		id: "method",
		header: "Method",
		cell: ({ row: { original: tx } }) => <code>{tx.payment_method}</code>,
	},
	{
		id: "amount",
		header: "Amount",
		meta: { align: "end" },
		cell: ({ row: { original: tx } }) => (
			<span className="tabular-nums">{signedAmount(tx)}</span>
		),
	},
	{
		id: "provider_fee",
		header: "Provider fee",
		meta: { align: "end" },
		cell: ({ row: { original: tx } }) =>
			formatAmount(tx.provider_fee, tx.currency),
	},
	{
		id: "platform_fee",
		header: "Platform fee",
		meta: { align: "end" },
		cell: ({ row: { original: tx } }) =>
			formatAmount(tx.platform_fee, tx.currency),
	},
	{
		id: "account",
		header: "Account",
		cell: ({ row: { original: tx } }) => (
			<code>{tx.customer_account || "—"}</code>
		),
	},
	{
		id: "country",
		header: "Country",
		cell: ({ row: { original: tx } }) => tx.country || "—",
	},
	{
		id: "status",
		header: "Status",
		cell: ({ row: { original: tx } }) => <StatusBadge status={tx.status} />,
	},
	{
		id: "created",
		header: "Created",
		cell: ({ row: { original: tx } }) => <Timestamp value={tx.created_at} />,
	},
];

/** Transactions lists every payment the engine has recorded. */
export function Transactions() {
	const { client } = useAuth();
	const [live, setLive] = useState(false);
	const paged = usePagedQuery(
		keys.transactions.list,
		(page) => client.transactions.list(page),
		{ refetchInterval: live && liveInterval },
	);
	const [selected, setSelected] = useState<AdminTransaction>();
	const visibility = useColumnVisibility("transactions");

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
					columns={columns}
					rows={paged.items}
					rowKey={(tx) => tx.id}
					loading={paged.loading}
					empty="No payments have been created yet."
					onRowClick={setSelected}
					{...visibility}
					toolbar={(table) => <ColumnToggle table={table} />}
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
				transaction={selected}
				onClose={() => setSelected(undefined)}
			/>
		</Card>
	);
}

function TransactionDialog({
	transaction,
	onClose,
}: {
	transaction?: AdminTransaction;
	onClose: () => void;
}) {
	return (
		<Dialog
			open={Boolean(transaction)}
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
