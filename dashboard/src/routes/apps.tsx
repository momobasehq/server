import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Plus } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { AdminPermissions, type App, type ChargeSchedule } from "momobase";

import { DataTable, type DataColumn } from "@/components/data-table";
import { ChargeFields, zeroCharges } from "@/components/charge-fields";
import { CurrencyFlag, CurrencySelect } from "@/components/country-select";
import { GuardedAction } from "@/components/guarded-action";
import { PaginationControls } from "@/components/pagination-controls";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
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
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { formatDateTime, titleCase } from "@/lib/format";
import { keys } from "@/lib/query-keys";

const environments = ["sandbox", "production"] as const;

interface AppForm {
	name: string;
	description: string;
	environment: (typeof environments)[number];
	currency: string;
	charges: ChargeSchedule;
}

/** CreateAppDialog registers a new integrating application. */
function CreateAppDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { client } = useAuth();
	const queryClient = useQueryClient();
	const [form, setForm] = useState<AppForm>({
		name: "",
		description: "",
		environment: "sandbox",
		currency: "UGX",
		charges: zeroCharges,
	});

	const create = useMutation({
		mutationFn: () => client.apps.create(form),
		onSuccess: async (app) => {
			toast.success(`Created ${app.name}`);
			onOpenChange(false);
			setForm({
				name: "",
				description: "",
				environment: "sandbox",
				currency: "UGX",
				charges: zeroCharges,
			});
			await queryClient.invalidateQueries({ queryKey: keys.apps.all });
		},
		onError: (error: Error) => toast.error(error.message),
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>New app</DialogTitle>
					<DialogDescription>
						Apps create and query payments through the public API.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-3">
					<div className="flex flex-col gap-2">
						<Label htmlFor="app-name">Name</Label>
						<Input
							id="app-name"
							value={form.name}
							onChange={(e) =>
								setForm({ ...form, name: e.target.value })
							}
						/>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="app-currency">Currency</Label>
						<CurrencySelect
							id="app-currency"
							value={form.currency}
							onChange={(currency) => setForm({ ...form, currency })}
						/>
					</div>
					<ChargeFields
						id="new-app-charges"
						value={form.charges}
						onChange={(charges) => setForm({ ...form, charges })}
					/>
					<div className="flex flex-col gap-2">
						<Label htmlFor="app-description">Description</Label>
						<Textarea
							id="app-description"
							value={form.description}
							onChange={(e) =>
								setForm({
									...form,
									description: e.target.value,
								})
							}
						/>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="app-environment">Environment</Label>
						<Select
							value={form.environment}
							onValueChange={(value) =>
								setForm({
									...form,
									environment:
										(value as (typeof environments)[number]) ??
										"sandbox",
								})
							}
						>
							<SelectTrigger id="app-environment">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{environments.map((environment) => (
									<SelectItem
										key={environment}
										value={environment}
									>
										{titleCase(environment)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						onClick={() => create.mutate()}
						disabled={
							create.isPending ||
							!form.name ||
							form.currency.length !== 3
						}
					>
						Create
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** Apps lists integrating applications and links to their credentials. */
export function Apps() {
	const { client } = useAuth();
	const paged = usePagedQuery(keys.apps.list, (page) =>
		client.apps.list(page),
	);
	const [creating, setCreating] = useState(false);

	const columns: DataColumn<App>[] = [
		{
			id: "name",
			header: "Name",
			// Underlined unconditionally: with hover-only underline this read as plain text,
			// so the detail page — and every credential on it — looked like it did not exist.
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
			header: "Environment",
			cell: ({ row: { original: app } }) => (
				<StatusBadge status={app.environment} />
			),
		},
		{
			id: "currency",
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
			header: "Status",
			cell: ({ row: { original: app } }) => <StatusBadge status={app.status} />,
		},
		{
			id: "description",
			header: "Description",
			cell: ({ row: { original: app } }) => app.description || "—",
		},
		{
			id: "created",
			header: "Created",
			cell: ({ row: { original: app } }) => formatDateTime(app.created_at),
		},
		{
			id: "actions",
			header: "",
			meta: { align: "end" },
			// Status, credentials, and the tester all live on the detail page, so the list
			// offers one unambiguous way in rather than a partial set of actions.
			cell: ({ row: { original: app } }) => (
				<Button
					variant="outline"
					size="sm"
					render={<Link to={`/apps/${app.id}`} />}
				>
					Manage
					<ChevronRight />
				</Button>
			),
		},
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
						onClick={() => setCreating(true)}
					>
						<Plus />
						New app
					</GuardedAction>
				</CardAction>
			</CardHeader>
			<CardContent>
				<DataTable
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
			<CreateAppDialog open={creating} onOpenChange={setCreating} />
		</Card>
	);
}
