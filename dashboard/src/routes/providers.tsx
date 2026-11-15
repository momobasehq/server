import { useState } from "react";
import { Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { toast } from "sonner";

import { DataTable, type DataColumn } from "@/components/data-table";
import { ChargeFields, zeroCharges } from "@/components/charge-fields";
import {
	CountrySelect,
	CurrencySelect,
	Flag,
} from "@/components/country-select";
import { GuardedAction } from "@/components/guarded-action";
import { PaginationControls } from "@/components/pagination-controls";
import { rowActionsColumn } from "@/components/row-actions";
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
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
	AdminPermissions,
	type ChargeSchedule,
	type ProviderAccount,
} from "momobase";

import { useAuth } from "@/hooks/use-auth";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { formatAmount, formatDateTime } from "@/lib/format";
import { keys } from "@/lib/query-keys";

interface ProviderForm {
	provider_code: string;
	name: string;
	environment: "sandbox" | "production";
	country: string;
	currency: string;
	charges: ChargeSchedule;
	config: string;
}

/** CreateAccountDialog registers a provider account for a registered provider code. */
function CreateAccountDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { client } = useAuth();
	const queryClient = useQueryClient();
	const [form, setForm] = useState<ProviderForm>({
		provider_code: "",
		name: "",
		environment: "sandbox",
		country: "UG",
		currency: "UGX",
		charges: zeroCharges,
		config: '{\n  "webhook_secret": ""\n}',
	});

	// Provider codes come only from the running server's registry. A client-side preset
	// map would silently exclude every out-of-tree adapter, which is the whole point of
	// a pluggable provider interface.
	const registry = useQuery({
		queryKey: keys.providers.registry(),
		queryFn: () => client.providers.registry(),
	});

	const create = useMutation({
		mutationFn: () => {
			let config: Record<string, unknown>;
			try {
				config = JSON.parse(form.config) as Record<string, unknown>;
			} catch {
				throw new Error("Configuration must be valid JSON");
			}
			return client.providers.createAccount({
				provider_code: form.provider_code,
				name: form.name,
				environment: form.environment,
				country: form.country,
				currency: form.currency,
				charges: form.charges,
				config,
			});
		},
		onSuccess: async (account) => {
			toast.success(`Created ${account.name}`);
			onOpenChange(false);
			await queryClient.invalidateQueries({
				queryKey: keys.providers.all,
			});
		},
		onError: (error: Error) => toast.error(error.message),
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>New provider account</DialogTitle>
					<DialogDescription>
						Accounts are created inactive. Activate one after
						testing its configuration.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-5 md:grid-cols-2">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="provider-code">
								Provider
							</FieldLabel>
							<Select
								value={form.provider_code}
								onValueChange={(code) =>
									setForm({ ...form, provider_code: code ?? "" })
								}
							>
								<SelectTrigger id="provider-code">
									<SelectValue
										placeholder={
											registry.isPending
												? "Loading…"
												: "Select a registered provider"
										}
									/>
								</SelectTrigger>
								<SelectContent>
									{(registry.data?.providers ?? []).map(
										(code) => (
											<SelectItem key={code} value={code}>
												{code}
											</SelectItem>
										),
									)}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor="provider-name">Name</FieldLabel>
							<Input
								id="provider-name"
								value={form.name}
								onChange={(e) =>
									setForm({ ...form, name: e.target.value })
								}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="provider-environment">
								Environment
							</FieldLabel>
							<Select
								value={form.environment}
								onValueChange={(env) =>
									setForm({
										...form,
										environment: env ?? "sandbox",
									})
								}
							>
								<SelectTrigger id="provider-environment">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="sandbox">Sandbox</SelectItem>
									<SelectItem value="production">
										Production
									</SelectItem>
								</SelectContent>
							</Select>
						</Field>
						<FieldGroup className="grid grid-cols-2 gap-3">
							<Field>
								<FieldLabel htmlFor="provider-country">
									Country
								</FieldLabel>
								<CountrySelect
									id="provider-country"
									value={form.country}
									onChange={(country) => setForm({ ...form, country })}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="provider-currency">
									Currency
								</FieldLabel>
								<CurrencySelect
									id="provider-currency"
									value={form.currency}
									onChange={(currency) => setForm({ ...form, currency })}
								/>
							</Field>
						</FieldGroup>
						<ChargeFields
							id="new-provider-charges"
							value={form.charges}
							onChange={(charges) => setForm({ ...form, charges })}
						/>
					</FieldGroup>
					<Field className="h-full">
						<FieldLabel htmlFor="provider-config">
							Configuration (JSON)
						</FieldLabel>
						<Textarea
							id="provider-config"
							className="min-h-40 flex-1 font-mono"
							value={form.config}
							onChange={(event) =>
								setForm({ ...form, config: event.target.value })
							}
						/>
						<FieldDescription>
							One flat provider-owned object, encrypted at rest.
							Must include a long random{" "}
							<code>webhook_secret</code>.
						</FieldDescription>
					</Field>
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
							!form.provider_code ||
							!form.name ||
							form.country.length !== 2 ||
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

/**
 * ConfigureDialog edits an existing account's location, fees, and encrypted configuration.
 *
 * The two are separate API calls because they reload the runtime differently: a config
 * change rebuilds the adapter and rolls the row back if the reload fails, so sending
 * both together would make a rejected config also lose a valid country edit.
 */
function ConfigureDialog({
	account,
	onClose,
}: {
	account?: ProviderAccount;
	onClose: () => void;
}) {
	const { client } = useAuth();
	const queryClient = useQueryClient();
	const [settings, setSettings] = useState({
		country: "UG",
		currency: "UGX",
		charges: zeroCharges,
	});
	const [config, setConfig] = useState("");
	const [loaded, setLoaded] = useState<string>();
	// Seed the fields the first time a given account opens the dialog. The stored config
	// is encrypted and never returned, so the box starts empty: submitting replaces it.
	if (account && loaded !== account.id) {
		setLoaded(account.id);
		setSettings({
			country: account.country,
			currency: account.currency,
			charges: account.charges,
		});
		setConfig("");
	}

	async function refresh() {
		await queryClient.invalidateQueries({ queryKey: keys.providers.all });
	}

	const saveSettings = useMutation({
		mutationFn: () =>
			client.providers.updateSettings(account!.id, settings),
		onSuccess: async () => {
			toast.success("Provider settings updated");
			await refresh();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const saveConfig = useMutation({
		mutationFn: () => {
			let parsed: Record<string, unknown>;
			try {
				parsed = JSON.parse(config) as Record<string, unknown>;
			} catch {
				throw new Error("Configuration must be valid JSON");
			}
			return client.providers.updateConfig(account!.id, parsed);
		},
		onSuccess: async () => {
			toast.success("Configuration updated and the runtime reloaded");
			setConfig("");
			await refresh();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const balance = useMutation({
		mutationFn: (country: string) =>
			client.providers.balance(account!.id, country || undefined),
		onSuccess: (result) =>
			toast.success(
				`Available ${formatAmount(result.available, result.currency)}`,
			),
		onError: (error: Error) => toast.error(error.message),
	});

	return (
		<Dialog
			open={Boolean(account)}
			onOpenChange={(open) => !open && onClose()}
		>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>{account?.name}</DialogTitle>
					<DialogDescription>
						<code>{account?.provider_code}</code> · config v
						{account?.config_version}
					</DialogDescription>
				</DialogHeader>

				<Tabs defaultValue="settings">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="settings">Settings</TabsTrigger>
						<TabsTrigger value="configuration">
							Configuration
						</TabsTrigger>
					</TabsList>
					<TabsContent value="settings">
						<FieldGroup>
							<FieldGroup className="grid grid-cols-2 gap-3">
								<Field>
									<FieldLabel htmlFor="edit-country">
										Country
									</FieldLabel>
									<CountrySelect
										id="edit-country"
										value={settings.country}
										onChange={(country) => setSettings({ ...settings, country })}
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor="edit-currency">
										Currency
									</FieldLabel>
									<CurrencySelect
										id="edit-currency"
										value={settings.currency}
										onChange={(currency) => setSettings({ ...settings, currency })}
									/>
								</Field>
							</FieldGroup>
							<ChargeFields
								id="edit-provider-charges"
								value={settings.charges}
								onChange={(charges) =>
									setSettings({ ...settings, charges })
								}
							/>
							<GuardedAction
								permission={AdminPermissions.providersUpdate}
								className="self-start"
								disabled={
									saveSettings.isPending ||
									settings.country.length !== 2 ||
									settings.currency.length !== 3
								}
								onClick={() => saveSettings.mutate()}
							>
								Save settings
							</GuardedAction>
						</FieldGroup>
					</TabsContent>
					<TabsContent value="configuration">
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="edit-config">
									Replacement configuration (JSON)
								</FieldLabel>
								<Textarea
									id="edit-config"
									rows={9}
									className="font-mono"
									value={config}
									onChange={(event) =>
										setConfig(event.target.value)
									}
									placeholder={
										'{\n  "api_user": "…",\n  "api_key": "…",\n  "webhook_secret": "…"\n}'
									}
								/>
								<FieldDescription>
									The stored flat object is encrypted and
									never returned. Saving replaces it outright
									and reloads the adapter.
								</FieldDescription>
							</Field>
							<GuardedAction
								permission={AdminPermissions.providersUpdate}
								className="self-start"
								disabled={
									saveConfig.isPending || !config.trim()
								}
								onClick={() => saveConfig.mutate()}
							>
								Replace configuration
							</GuardedAction>
						</FieldGroup>
					</TabsContent>
				</Tabs>

				<DialogFooter>
					<Button
						variant="outline"
						disabled={balance.isPending}
						onClick={() => balance.mutate(account?.country ?? "")}
					>
						Query balance
					</Button>
					<Button onClick={onClose}>Done</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** Providers manages provider accounts, their activation, and their balances. */
export function Providers() {
	const { client, can } = useAuth();
	const queryClient = useQueryClient();
	const paged = usePagedQuery(keys.providers.list, (page) =>
		client.providers.list(page),
	);
	// Balances are their own permission, which read_only does not hold, so the card is
	// hidden rather than left to fail — and its query never fires.
	const showBalances = can(AdminPermissions.balancesRead);
	const balances = usePagedQuery(
		keys.providers.balances,
		(page) => client.providers.activeBalances(page),
		{ enabled: showBalances, param: "balances" },
	);
	const [creating, setCreating] = useState(false);
	const [configuring, setConfiguring] = useState<ProviderAccount>();

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
				onSelect: () => setConfiguring(account),
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
							onClick={() => setCreating(true)}
						>
							<Plus />
							New account
						</GuardedAction>
					</CardAction>
				</CardHeader>
				<CardContent>
					<DataTable
						tableId="providers"
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

			<CreateAccountDialog open={creating} onOpenChange={setCreating} />
			<ConfigureDialog
				account={configuring}
				onClose={() => setConfiguring(undefined)}
			/>
		</div>
	);
}
