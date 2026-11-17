import { useState } from "react";
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import type { RowSelectionState } from "@tanstack/react-table";
import { ArrowLeft, Copy, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import {
	DataTable,
	selectColumn,
	type DataColumn,
} from "@/components/data-table";
import { ServiceMixChart } from "@/components/analytics-charts";
import {
	AnalyticsFilters,
	defaultRange,
	toQuery,
	type AnalyticsRange,
} from "@/components/analytics-filters";
import { AppTester } from "@/components/app-tester";
import { GuardedAction } from "@/components/guarded-action";
import { PaginationControls } from "@/components/pagination-controls";
import { rowActionsColumn } from "@/components/row-actions";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	AdminPermissions,
	type AppCredential,
	type ChargeRule,
	type CreatedCredential,
	type CredentialListQuery,
} from "momobase";

const credentialFacets = [
	{ field: "status", label: "Status", options: ["active", "revoked"] },
] as const;

import { useAuth } from "@/hooks/use-auth";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { formatDateTime } from "@/lib/format";
import { keys } from "@/lib/query-keys";

/**
 * SecretDialog shows a client secret exactly once.
 *
 * The API returns the plaintext only on creation and rotation — it is stored hashed —
 * so this is the single moment it can be copied. Leaving the page loses it for good,
 * which the copy is explicit about rather than leaving the operator to find out later.
 */
function SecretDialog({
	created,
	onClose,
}: {
	created?: CreatedCredential;
	onClose: () => void;
}) {
	async function copy() {
		if (!created) return;
		try {
			await navigator.clipboard.writeText(created.client_secret);
			toast.success("Client secret copied");
		} catch {
			toast.error(
				"Copying failed — select the value and copy it manually",
			);
		}
	}

	return (
		<Dialog
			open={Boolean(created)}
			onOpenChange={(open) => !open && onClose()}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Client secret</DialogTitle>
					<DialogDescription>
						Copy it now — it is stored hashed and cannot be shown
						again.
					</DialogDescription>
				</DialogHeader>
				<Alert>
					<TriangleAlert />
					<AlertTitle>Shown once</AlertTitle>
					<AlertDescription>
						Leaving this page discards the secret. Rotate the
						credential to issue a new one.
					</AlertDescription>
				</Alert>
				<div className="flex flex-col gap-2">
					<Label htmlFor="client-id">Client ID</Label>
					<Input
						id="client-id"
						readOnly
						value={created?.credential.client_id ?? ""}
					/>
					<Label htmlFor="client-secret">Client secret</Label>
					<div className="flex gap-2">
						<Input
							id="client-secret"
							readOnly
							value={created?.client_secret ?? ""}
							className="font-mono"
						/>
						<Button
							variant="outline"
							size="icon"
							onClick={() => void copy()}
							aria-label="Copy client secret"
						>
							<Copy />
						</Button>
					</div>
				</div>
				<DialogFooter>
					<Button onClick={onClose}>Done</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** AppDetail shows one app and manages its API credentials. */
export function AppDetail() {
	const { appId = "" } = useParams();
	const { client, can } = useAuth();
	const queryClient = useQueryClient();
	const [created, setCreated] = useState<CreatedCredential>();
	// The tester mounts only when its tab opens, so it reads the last secret from here.
	const [issued, setIssued] = useState<CreatedCredential>();
	const [naming, setNaming] = useState(false);
	const [name, setName] = useState("");
	const [scopes, setScopes] = useState<string[]>([]);

	// Scopes come from the server's app-audience catalogue, and the server validates
	// against the same list — so a scope that cannot work is no longer typeable.
	const catalogue = useQuery({
		queryKey: keys.authz.permissions("app"),
		queryFn: () => client.authz.permissions("app"),
		enabled: naming,
	});

	// Credentials are their own permission, so the card is hidden for a role that may
	// read apps but not their credentials.
	const showCredentials = can(AdminPermissions.credentialsRead);
	const [range, setRange] = useState<AnalyticsRange>(defaultRange);
	const showAnalytics = can(AdminPermissions.transactionsRead);
	const analytics = useQuery({
		queryKey: keys.analytics.transactions({ ...toQuery(range), appId }),
		queryFn: () =>
			client.analytics.transactions({ ...toQuery(range), appId }),
		enabled: showAnalytics && Boolean(appId),
		placeholderData: keepPreviousData,
	});

	const app = useQuery({
		queryKey: keys.apps.detail(appId),
		queryFn: () => client.apps.get(appId),
		enabled: Boolean(appId),
	});
	const paged = usePagedQuery(
		(query) => keys.apps.credentials(appId, query),
		(query: CredentialListQuery) => client.apps.credentials(appId, query),
		{
			enabled: showCredentials && Boolean(appId),
			filters: credentialFacets.map((facet) => facet.field),
		},
	);

	async function refreshCredentials() {
		await queryClient.invalidateQueries({ queryKey: keys.apps.all });
	}

	const changeStatus = useMutation({
		mutationFn: (status: "active" | "disabled" | "suspended") =>
			client.apps.changeStatus(appId, status),
		onSuccess: async () => {
			toast.success("Status updated");
			await queryClient.invalidateQueries({ queryKey: keys.apps.all });
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const create = useMutation({
		mutationFn: () =>
			client.apps.createCredential(appId, {
				name: name || undefined,
				scopes: scopes.length ? scopes.join(" ") : undefined,
			}),
		onSuccess: async (result) => {
			setNaming(false);
			setName("");
			setScopes([]);
			setCreated(result);
			await refreshCredentials();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const rotate = useMutation({
		mutationFn: (credentialId: string) =>
			client.apps.rotateCredential(appId, credentialId),
		onSuccess: async (result) => {
			setCreated(result);
			await refreshCredentials();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const revoke = useMutation({
		mutationFn: (credentialId: string) =>
			client.apps.revokeCredential(appId, credentialId),
		onSuccess: async () => {
			toast.success("Credential revoked");
			await refreshCredentials();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const [selected, setSelected] = useState<RowSelectionState>({});
	const [confirmingBulk, setConfirmingBulk] = useState(false);
	// Only what is on screen and still active counts, so a stale selection from another
	// page or an already-revoked row is never acted on.
	const revocable = paged.items.filter(
		(credential) =>
			credential.status === "active" && selected[credential.id],
	);

	// One at a time, stopping at the first failure: the admin rate limiter is per
	// address, and a burst of parallel calls would trip it for every dashboard user.
	const revokeMany = useMutation({
		mutationFn: async (ids: string[]) => {
			let done = 0;
			try {
				for (const id of ids) {
					await client.apps.revokeCredential(appId, id);
					done++;
				}
			} finally {
				if (done > 0 && done < ids.length)
					toast.warning(
						`Revoked ${done} of ${ids.length} credentials before an error.`,
					);
				setSelected({});
				setConfirmingBulk(false);
				await refreshCredentials();
			}
			return done;
		},
		onSuccess: (done) =>
			toast.success(`Revoked ${done} credential${done === 1 ? "" : "s"}`),
	});

	// Selection exists only for those who may revoke; for others there is no bulk action.
	const canRevoke = can(AdminPermissions.credentialsUpdate);
	const columns: DataColumn<AppCredential>[] = [
		...(canRevoke ? [selectColumn<AppCredential>()] : []),
		{
			id: "name",
			accessorFn: (r) => r.name,
			header: "Name",
			meta: { sortKey: "name" },
			cell: ({ row: { original: credential } }) => credential.name || "—",
		},
		{
			id: "client_id",
			accessorFn: (r) => r.client_id,
			header: "Client ID",
			cell: ({ row: { original: credential } }) => (
				<code>{credential.client_id}</code>
			),
		},
		{
			id: "scopes",
			accessorFn: (r) => r.scopes,
			header: "Scopes",
			cell: ({ row: { original: credential } }) => (
				<code>{credential.scopes || "—"}</code>
			),
		},
		{
			id: "status",
			accessorFn: (r) => r.status,
			header: "Status",
			meta: { sortKey: "status" },
			cell: ({ row: { original: credential } }) => (
				<StatusBadge status={credential.status} />
			),
		},
		{
			id: "used",
			accessorFn: (r) => r.last_used_at,
			header: "Last used",
			meta: { sortKey: "last_used_at" },
			cell: ({ row: { original: credential } }) =>
				formatDateTime(credential.last_used_at),
		},
		rowActionsColumn<AppCredential>((credential) => [
			{
				label: "Rotate secret",
				permission: AdminPermissions.credentialsUpdate,
				disabled: rotate.isPending || credential.status !== "active",
				onSelect: () => rotate.mutate(credential.id),
			},
			{
				label: "Revoke",
				destructive: true,
				permission: AdminPermissions.credentialsUpdate,
				disabled: revoke.isPending || credential.status !== "active",
				onSelect: () => revoke.mutate(credential.id),
			},
		]),
	];

	return (
		<div className="flex flex-col gap-4">
			<Button
				variant="ghost"
				size="sm"
				render={<Link to="/apps" />}
				className="self-start"
			>
				<ArrowLeft />
				All apps
			</Button>

			<Card>
				<CardHeader>
					<CardTitle>
						{app.data?.name ?? <Skeleton className="h-5 w-40" />}
					</CardTitle>
					<CardDescription>
						{app.data?.description || "No description."}
					</CardDescription>
					<CardAction>
						<GuardedAction
							permission={AdminPermissions.appsUpdate}
							variant="outline"
							size="sm"
							nativeButton={false}
							render={<Link to={`/apps/${appId}/edit`} />}
						>
							Edit
						</GuardedAction>
					</CardAction>
				</CardHeader>
				<CardContent className="flex-row flex-wrap items-end gap-6">
					<div>
						<p className="text-muted-foreground">Environment</p>
						<StatusBadge status={app.data?.environment} />
					</div>
					<div>
						<p className="text-muted-foreground">Status</p>
						<StatusBadge status={app.data?.status} />
					</div>
					<div>
						<p className="text-muted-foreground">Currency</p>
						<code>{app.data?.currency ?? "—"}</code>
					</div>
					<div>
						<p className="text-muted-foreground">Collection fee</p>
						<span>
							{formatCharge(app.data?.charges.collection)}
						</span>
					</div>
					<div>
						<p className="text-muted-foreground">
							Disbursement fee
						</p>
						<span>
							{formatCharge(app.data?.charges.disbursement)}
						</span>
					</div>
					<div>
						<p className="text-muted-foreground">App ID</p>
						<code>{appId}</code>
					</div>
					{/* Suspended is distinct from disabled on the API, so both are offered rather
              than collapsed into one toggle that cannot express the difference. */}
					<div className="ms-auto flex gap-2">
						{app.data?.status === "active" ? (
							<>
								<GuardedAction
									permission={AdminPermissions.appsUpdate}
									variant="outline"
									size="sm"
									disabled={changeStatus.isPending}
									onClick={() =>
										changeStatus.mutate("suspended")
									}
								>
									Suspend
								</GuardedAction>
								<GuardedAction
									permission={AdminPermissions.appsUpdate}
									variant="destructive"
									size="sm"
									disabled={changeStatus.isPending}
									onClick={() =>
										changeStatus.mutate("disabled")
									}
								>
									Disable
								</GuardedAction>
							</>
						) : (
							<GuardedAction
								permission={AdminPermissions.appsUpdate}
								size="sm"
								disabled={changeStatus.isPending || !app.data}
								onClick={() => changeStatus.mutate("active")}
							>
								Activate
							</GuardedAction>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Tabs rather than a stack: the page now carries four unrelated concerns, and
          scrolling past credentials to reach the tester made both harder to find. */}
			<Tabs defaultValue="analytics">
				<TabsList>
					<TabsTrigger value="analytics">Analytics</TabsTrigger>
					<TabsTrigger value="credentials">Credentials</TabsTrigger>
					<TabsTrigger value="testing">Testing</TabsTrigger>
				</TabsList>

				<TabsContent
					value="analytics"
					className="flex flex-col gap-4 pt-3"
				>
					{showAnalytics ? (
						<>
							{/* The app is fixed by the page, so its selector is suppressed; range and
                  provider still apply. */}
							<AnalyticsFilters
								range={range}
								onChange={setRange}
								showApp={false}
							/>
							<ServiceMixChart
								data={analytics.data}
								loading={analytics.isPending}
								title="This app's payments"
								description="Collections and disbursements created by this app alone."
							/>
						</>
					) : (
						<p className="text-muted-foreground">
							Requires the transactions:read permission.
						</p>
					)}
				</TabsContent>

				<TabsContent value="credentials" className="pt-3">
					{showCredentials && (
						<Card>
							<CardHeader>
								<CardTitle>Credentials</CardTitle>
								<CardDescription>
									Client credentials this app uses to obtain
									access tokens.
								</CardDescription>
								<CardAction className="flex gap-2">
									{revocable.length > 0 && (
										<GuardedAction
											permission={
												AdminPermissions.credentialsUpdate
											}
											variant="destructive"
											size="sm"
											onClick={() =>
												setConfirmingBulk(true)
											}
										>
											Revoke {revocable.length}
										</GuardedAction>
									)}
									<GuardedAction
										permission={
											AdminPermissions.credentialsCreate
										}
										size="sm"
										onClick={() => setNaming(true)}
									>
										<Plus />
										New credential
									</GuardedAction>
								</CardAction>
							</CardHeader>
							<CardContent>
								<DataTable
									tableId="credentials"
									list={paged.list}
									facets={credentialFacets}
									searchPlaceholder="Search name or client ID…"
									columns={columns}
									rows={paged.items}
									rowKey={(credential) => credential.id}
									loading={paged.loading}
									empty="This app has no credentials yet."
									rowSelection={selected}
									onRowSelectionChange={setSelected}
									canSelect={(credential) =>
										credential.status === "active"
									}
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
					)}
				</TabsContent>

				<TabsContent value="testing" className="pt-3">
					{can(AdminPermissions.appsTest) ? (
						<AppTester
							clientId={issued?.credential.client_id}
							clientSecret={issued?.client_secret}
						/>
					) : (
						<p className="text-muted-foreground">
							Requires the apps:test permission.
						</p>
					)}
				</TabsContent>
			</Tabs>

			<Dialog
				open={confirmingBulk}
				onOpenChange={(open) =>
					!revokeMany.isPending && setConfirmingBulk(open)
				}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Revoke {revocable.length} credential
							{revocable.length === 1 ? "" : "s"}?
						</DialogTitle>
						<DialogDescription>
							Anything signing in with these stops working at
							once. This cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<ul className="text-muted-foreground list-inside list-disc">
						{revocable.map((credential) => (
							<li key={credential.id}>
								{credential.name || credential.client_id}
							</li>
						))}
					</ul>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setConfirmingBulk(false)}
							disabled={revokeMany.isPending}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={() =>
								revokeMany.mutate(
									revocable.map(
										(credential) => credential.id,
									),
								)
							}
							disabled={revokeMany.isPending}
						>
							{revokeMany.isPending ? "Revoking…" : "Revoke"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={naming} onOpenChange={setNaming}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>New credential</DialogTitle>
						<DialogDescription>
							The client secret is shown once, immediately after
							creation.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-2">
						<Label htmlFor="credential-name">Name</Label>
						<Input
							id="credential-name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="Checkout service"
						/>
					</div>
					<div className="flex flex-col gap-2">
						<Label>Scopes</Label>
						{catalogue.isPending ? (
							<Skeleton className="h-20 w-full" />
						) : (
							(catalogue.data?.items ?? []).map((permission) => (
								<label
									key={permission.id}
									className="flex items-start gap-2"
								>
									<Checkbox
										checked={scopes.includes(
											permission.code,
										)}
										onCheckedChange={(checked) =>
											setScopes((current) =>
												checked === true
													? [
															...current,
															permission.code,
														]
													: current.filter(
															(held) =>
																held !==
																permission.code,
														),
											)
										}
									/>
									<span>
										<code>{permission.code}</code>
										<span className="text-muted-foreground">
											{" "}
											— {permission.description}
										</span>
									</span>
								</label>
							))
						)}
						<p className="text-muted-foreground">
							Leaving all unselected issues the server's default
							scopes.
						</p>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setNaming(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={() => create.mutate()}
							disabled={create.isPending}
						>
							Create
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<SecretDialog
				created={created}
				onClose={() => {
					setIssued(created);
					setCreated(undefined);
				}}
			/>
		</div>
	);
}

function formatCharge(rule?: ChargeRule) {
	if (!rule) return "—";
	return rule.type === "percentage"
		? `${rule.value / 100}%`
		: `${rule.value} minor units`;
}
