import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import {
	AdminPermissions,
	type ChargeSchedule,
	type ProviderAccount,
} from "momobase";

import {
	ChargeFields,
	chargeHint,
	zeroCharges,
} from "@/components/charge-fields";
import { CountrySelect, CurrencySelect } from "@/components/country-select";
import {
	BackLink,
	FormField,
	FormPage,
	FormSection,
	wide,
} from "@/components/form-page";
import { GuardedAction } from "@/components/guarded-action";
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
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { formatAmount } from "@/lib/format";
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

const environmentLabels = { sandbox: "Sandbox", production: "Production" };

function parseConfig(text: string) {
	try {
		return JSON.parse(text) as Record<string, unknown>;
	} catch {
		throw new Error("Configuration must be valid JSON");
	}
}

/** NewProvider registers a provider account for a registered provider code. */
export function NewProvider() {
	const { client } = useAuth();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
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
	// map would silently exclude every out-of-tree adapter.
	const registry = useQuery({
		queryKey: keys.providers.registry(),
		queryFn: () => client.providers.registry(),
	});

	const create = useMutation({
		mutationFn: () =>
			client.providers.createAccount({
				provider_code: form.provider_code,
				name: form.name,
				environment: form.environment,
				country: form.country,
				currency: form.currency,
				charges: form.charges,
				config: parseConfig(form.config),
			}),
		onSuccess: async (account) => {
			toast.success(`Created ${account.name}`);
			await queryClient.invalidateQueries({
				queryKey: keys.providers.all,
			});
			void navigate(`/providers/${account.id}`);
		},
		onError: (error: Error) => toast.error(error.message),
	});

	return (
		<FormPage
			back={{ to: "/providers", label: "All provider accounts" }}
			title="New provider account"
			description="Accounts are created inactive. Activate one after testing its configuration."
			submitLabel="Create"
			submitting={create.isPending}
			invalid={
				!form.provider_code ||
				!form.name ||
				form.country.length !== 2 ||
				form.currency.length !== 3
			}
			onSubmit={() => create.mutate()}
		>
			<FormSection
				title="Account"
				description="The adapter this account runs and the market it serves."
			>
				<FormField label="Provider" htmlFor="provider-code">
					<Select
						value={form.provider_code}
						onValueChange={(code) =>
							setForm({ ...form, provider_code: code ?? "" })
						}
					>
						<SelectTrigger id="provider-code" className="w-full">
							<SelectValue
								placeholder={
									registry.isPending
										? "Loading…"
										: "Select a registered provider"
								}
							/>
						</SelectTrigger>
						<SelectContent>
							{(registry.data?.providers ?? []).map((code) => (
								<SelectItem key={code} value={code}>
									{code}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FormField>
				<FormField label="Name" htmlFor="provider-name">
					<Input
						id="provider-name"
						value={form.name}
						onChange={(e) =>
							setForm({ ...form, name: e.target.value })
						}
					/>
				</FormField>
				<FormField
					label="Environment"
					htmlFor="provider-environment"
					className={wide}
				>
					<Select
						items={environmentLabels}
						value={form.environment}
						onValueChange={(env) =>
							setForm({ ...form, environment: env ?? "sandbox" })
						}
					>
						<SelectTrigger
							id="provider-environment"
							className="w-full sm:w-1/2"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="sandbox">Sandbox</SelectItem>
							<SelectItem value="production">
								Production
							</SelectItem>
						</SelectContent>
					</Select>
				</FormField>
				<LocationFields
					prefix="provider"
					value={form}
					onChange={(location) => setForm({ ...form, ...location })}
				/>
			</FormSection>
			<FormSection title="Transaction charges" description={chargeHint}>
				<ChargeFields
					id="new-provider-charges"
					value={form.charges}
					onChange={(charges) => setForm({ ...form, charges })}
				/>
			</FormSection>
			<FormSection
				title="Configuration"
				description={
					<>
						One flat provider-owned object, encrypted at rest. Must
						include a long random <code>webhook_secret</code>.
					</>
				}
			>
				<FormField
					label="Configuration (JSON)"
					htmlFor="provider-config"
					className={wide}
				>
					<Textarea
						id="provider-config"
						rows={8}
						className="font-mono"
						value={form.config}
						onChange={(event) =>
							setForm({ ...form, config: event.target.value })
						}
					/>
				</FormField>
			</FormSection>
		</FormPage>
	);
}

/** ConfigureProvider loads an account and hands it to the settings and config forms. */
export function ConfigureProvider() {
	const { providerId = "" } = useParams();
	const { client } = useAuth();
	const account = useQuery({
		queryKey: keys.providers.detail(providerId),
		queryFn: () => client.providers.get(providerId),
		enabled: Boolean(providerId),
	});

	if (account.isError) {
		return (
			<div className="flex flex-col gap-4">
				<BackLink to="/providers" label="All provider accounts" />
				<Alert variant="destructive">
					<AlertTitle>Provider account unavailable</AlertTitle>
					<AlertDescription>{account.error.message}</AlertDescription>
				</Alert>
			</div>
		);
	}
	if (!account.data) return <Skeleton className="h-96 w-full" />;
	return <ConfigureForms key={account.data.id} account={account.data} />;
}

/**
 * ConfigureForms edits an account's location and fees, and separately replaces its
 * encrypted configuration.
 *
 * The two are separate API calls because they reload the runtime differently: a config
 * change rebuilds the adapter and rolls the row back if the reload fails, so sending
 * both together would make a rejected config also lose a valid country edit.
 */
function ConfigureForms({ account }: { account: ProviderAccount }) {
	const { client } = useAuth();
	const queryClient = useQueryClient();
	const [settings, setSettings] = useState({
		country: account.country,
		currency: account.currency,
		charges: account.charges,
	});
	// The stored config is encrypted and never returned, so the box starts empty:
	// submitting replaces it.
	const [config, setConfig] = useState("");

	async function refresh() {
		await queryClient.invalidateQueries({ queryKey: keys.providers.all });
	}

	const saveSettings = useMutation({
		mutationFn: () => client.providers.updateSettings(account.id, settings),
		onSuccess: async () => {
			toast.success("Provider settings updated");
			await refresh();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const saveConfig = useMutation({
		mutationFn: () =>
			client.providers.updateConfig(account.id, parseConfig(config)),
		onSuccess: async () => {
			toast.success("Configuration updated and the runtime reloaded");
			setConfig("");
			await refresh();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const balance = useMutation({
		mutationFn: () =>
			client.providers.balance(account.id, account.country || undefined),
		onSuccess: (result) =>
			toast.success(
				`Available ${formatAmount(result.available, result.currency)}`,
			),
		onError: (error: Error) => toast.error(error.message),
	});

	return (
		<div className="flex w-full flex-col gap-4">
			<BackLink to={`/providers/${account.id}`} label={account.name} />
			<Card>
				<CardHeader>
					<CardTitle>Configure {account.name}</CardTitle>
					<CardDescription>
						<code>{account.provider_code}</code> · config v
						{account.config_version}. Settings and configuration
						save separately, because a configuration change reloads
						the adapter.
					</CardDescription>
					<CardAction>
						<Button
							variant="outline"
							size="sm"
							disabled={balance.isPending}
							onClick={() => balance.mutate()}
						>
							Query balance
						</Button>
					</CardAction>
				</CardHeader>
				<CardContent className="flex flex-col gap-6">
					<form
						className="flex flex-col gap-6"
						onSubmit={(event) => {
							event.preventDefault();
							saveSettings.mutate();
						}}
					>
						<FormSection
							title="Location"
							description="Where the account operates."
						>
							<LocationFields
								prefix="edit"
								value={settings}
								onChange={(location) =>
									setSettings({ ...settings, ...location })
								}
							/>
						</FormSection>
						<FormSection
							title="Transaction charges"
							description={chargeHint}
						>
							<ChargeFields
								id="edit-provider-charges"
								value={settings.charges}
								onChange={(charges) =>
									setSettings({ ...settings, charges })
								}
							/>
							<div className={`flex justify-end ${wide}`}>
								<GuardedAction
									permission={
										AdminPermissions.providersUpdate
									}
									type="submit"
									disabled={
										saveSettings.isPending ||
										settings.country.length !== 2 ||
										settings.currency.length !== 3
									}
								>
									Save settings
								</GuardedAction>
							</div>
						</FormSection>
					</form>

					<form
						className="flex flex-col gap-6 border-t pt-6"
						onSubmit={(event) => {
							event.preventDefault();
							if (config.trim()) saveConfig.mutate();
						}}
					>
						<FormSection
							title="Configuration"
							description="The stored flat object is encrypted and never returned. Saving replaces it outright and reloads the adapter."
						>
							<FormField
								label="Replacement configuration (JSON)"
								htmlFor="edit-config"
								className={wide}
							>
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
							</FormField>
							<div className={`flex justify-end ${wide}`}>
								<GuardedAction
									permission={
										AdminPermissions.providersUpdate
									}
									type="submit"
									disabled={
										saveConfig.isPending || !config.trim()
									}
								>
									Replace configuration
								</GuardedAction>
							</div>
						</FormSection>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}

/** LocationFields are the country and currency pair both provider forms edit. */
function LocationFields({
	prefix,
	value,
	onChange,
}: {
	prefix: string;
	value: { country: string; currency: string };
	onChange: (value: { country: string; currency: string }) => void;
}) {
	return (
		<>
			<FormField label="Country" htmlFor={`${prefix}-country`}>
				<CountrySelect
					id={`${prefix}-country`}
					value={value.country}
					onChange={(country) => onChange({ ...value, country })}
				/>
			</FormField>
			<FormField label="Currency" htmlFor={`${prefix}-currency`}>
				<CurrencySelect
					id={`${prefix}-currency`}
					value={value.currency}
					onChange={(currency) => onChange({ ...value, currency })}
				/>
			</FormField>
		</>
	);
}
