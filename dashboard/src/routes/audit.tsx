import { DataTable, type Column } from "@/components/data-table";
import { PaginationControls } from "@/components/pagination-controls";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { formatDateTime, titleCase } from "@/lib/format";
import { keys } from "@/lib/query-keys";
import type { AuditLog } from "momobase";

/** Party stacks an entity or actor type over its ID, cut to prefix and tail; hover shows it whole. */
function Party({ type, id }: { type: string; id?: string }) {
	const short =
		id && id.length > 16
			? `${id.slice(0, id.indexOf("_") + 1)}…${id.slice(-6)}`
			: id;
	return (
		<div className="flex flex-col">
			<span>{titleCase(type)}</span>
			{id && (
				<code className="text-muted-foreground" title={id}>
					{short}
				</code>
			)}
		</div>
	);
}

const columns: Column<AuditLog>[] = [
	{
		key: "action",
		header: "Action",
		cell: (log) => <code className="font-medium">{log.action}</code>,
	},
	{
		key: "entity",
		header: "Entity",
		cell: (log) => (
			<Party type={log.entity_type || "—"} id={log.entity_id} />
		),
	},
	{
		key: "actor",
		header: "Actor",
		cell: (log) => (
			<Party type={log.actor_type || "system"} id={log.actor_id} />
		),
	},
	{
		key: "ip",
		header: "IP",
		cell: (log) => <code>{log.ip_address || "—"}</code>,
	},
	{
		key: "at",
		header: "When",
		cell: (log) => formatDateTime(log.created_at),
	},
];

/** Audit lists administrative and system actions. */
export function Audit() {
	const { client } = useAuth();
	const paged = usePagedQuery(keys.audit.list, (page) =>
		client.transactions.auditLogs(page),
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Audit log</CardTitle>
				<CardDescription>
					Every administrative and system action, most recent first.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<DataTable
					columns={columns}
					rows={paged.items}
					rowKey={(log) => log.id}
					loading={paged.loading}
					empty="No actions recorded yet."
				/>
				<PaginationControls
					page={paged.page}
					perPage={paged.perPage}
					total={paged.total}
					count={paged.count}
					onPageChange={paged.setPage}
					busy={paged.fetching}
				/>
			</CardContent>
		</Card>
	);
}
