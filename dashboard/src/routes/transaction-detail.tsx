import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "react-router";
import type { AdminTransaction } from "momobase";

import { BackLink, Detail } from "@/components/form-page";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { formatAmount, formatDateTime } from "@/lib/format";
import { keys } from "@/lib/query-keys";
import { Service } from "@/routes/transactions";

/** TransactionDetail shows every value captured on one transaction record. */
export function TransactionDetail() {
	const { transactionId = "" } = useParams();
	const { client } = useAuth();
	// The list passes the clicked row along, so a transaction opened from the table
	// renders at once while a pasted link fetches it by ID.
	const passed = useLocation().state as AdminTransaction | null;
	const query = useQuery({
		queryKey: keys.transactions.detail(transactionId),
		queryFn: () => client.transactions.get(transactionId),
		enabled: Boolean(transactionId),
		placeholderData: passed?.id === transactionId ? passed : undefined,
	});
	const transaction = query.data;

	return (
		<div className="flex flex-col gap-4">
			<BackLink to="/transactions" label="All transactions" />

			{query.isError ? (
				<Alert variant="destructive">
					<AlertTitle>Transaction unavailable</AlertTitle>
					<AlertDescription>{query.error.message}</AlertDescription>
				</Alert>
			) : (
				<Card>
					<CardHeader>
						<CardTitle>
							{transaction?.reference ?? (
								<Skeleton className="h-5 w-40" />
							)}
						</CardTitle>
						<CardDescription>
							Complete values captured on the transaction record.
							Fees are the immutable amounts computed when it was
							created.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{transaction ? (
							<Fields transaction={transaction} />
						) : (
							<Skeleton className="h-64 w-full" />
						)}
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function Fields({ transaction }: { transaction: AdminTransaction }) {
	return (
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
				{formatAmount(transaction.amount, transaction.currency)}
			</Detail>
			<Detail label="Provider fee">
				{formatAmount(transaction.provider_fee, transaction.currency)}
			</Detail>
			<Detail label="Platform fee">
				{formatAmount(transaction.platform_fee, transaction.currency)}
			</Detail>
			<Detail label="Currency">
				<code>{transaction.currency}</code>
			</Detail>
			<Detail label="Country">
				<code>{transaction.country || "—"}</code>
			</Detail>
			<Detail label="Reference">
				<code className="break-all">{transaction.reference}</code>
			</Detail>
			<Detail label="Transaction ID">
				<code className="break-all">{transaction.id}</code>
			</Detail>
			<Detail label="App ID">
				<code className="break-all">{transaction.app_id}</code>
			</Detail>
			<Detail label="Idempotency key">
				<code className="break-all">{transaction.idempotency_key}</code>
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
	);
}
