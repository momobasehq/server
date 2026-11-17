import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import type { App, ChargeSchedule } from "momobase";

import {
	ChargeFields,
	chargeHint,
	zeroCharges,
} from "@/components/charge-fields";
import { CurrencySelect } from "@/components/country-select";
import {
	BackLink,
	FormField,
	FormPage,
	FormSection,
	wide,
} from "@/components/form-page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { keys } from "@/lib/query-keys";

const environments = ["sandbox", "production"] as const;
// Passed to the Select so its trigger shows the label, not the raw value.
const environmentLabels: Record<(typeof environments)[number], string> = {
	sandbox: "Sandbox",
	production: "Production",
};

interface AppDetails {
	name: string;
	description: string;
	currency: string;
	charges: ChargeSchedule;
}

/**
 * AppFields are the settings shared by creating and editing an app. Creation also picks
 * an environment, which cannot change later, so it arrives as an extra field.
 */
function AppFields({
	prefix,
	value,
	onChange,
	environment,
}: {
	prefix: string;
	value: AppDetails;
	onChange: (value: AppDetails) => void;
	environment?: ReactNode;
}) {
	return (
		<>
			<FormSection
				title="Details"
				description="How the app appears to operators, and the currency it is billed in."
			>
				<FormField label="Name" htmlFor={`${prefix}-name`}>
					<Input
						id={`${prefix}-name`}
						value={value.name}
						onChange={(e) =>
							onChange({ ...value, name: e.target.value })
						}
					/>
				</FormField>
				<FormField label="Currency" htmlFor={`${prefix}-currency`}>
					<CurrencySelect
						id={`${prefix}-currency`}
						value={value.currency}
						onChange={(currency) =>
							onChange({ ...value, currency })
						}
					/>
				</FormField>
				{environment}
				<FormField
					label="Description"
					htmlFor={`${prefix}-description`}
					className={wide}
				>
					<Textarea
						id={`${prefix}-description`}
						value={value.description}
						onChange={(e) =>
							onChange({ ...value, description: e.target.value })
						}
					/>
				</FormField>
			</FormSection>
			<FormSection title="Transaction charges" description={chargeHint}>
				<ChargeFields
					id={`${prefix}-charges`}
					value={value.charges}
					onChange={(charges) => onChange({ ...value, charges })}
				/>
			</FormSection>
		</>
	);
}

const incomplete = (details: AppDetails) =>
	!details.name || details.currency.length !== 3;

/** NewApp registers an integrating application, then opens it to issue credentials. */
export function NewApp() {
	const { client } = useAuth();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [details, setDetails] = useState<AppDetails>({
		name: "",
		description: "",
		currency: "UGX",
		charges: zeroCharges,
	});
	const [environment, setEnvironment] =
		useState<(typeof environments)[number]>("sandbox");

	const create = useMutation({
		mutationFn: () => client.apps.create({ ...details, environment }),
		onSuccess: async (app) => {
			toast.success(`Created ${app.name}`);
			await queryClient.invalidateQueries({ queryKey: keys.apps.all });
			void navigate(`/apps/${app.id}`);
		},
		onError: (error: Error) => toast.error(error.message),
	});

	return (
		<FormPage
			back={{ to: "/apps", label: "All apps" }}
			title="New app"
			description="Apps create and query payments through the public API."
			submitLabel="Create"
			submitting={create.isPending}
			invalid={incomplete(details)}
			onSubmit={() => create.mutate()}
		>
			<AppFields
				prefix="app"
				value={details}
				onChange={setDetails}
				environment={
					<FormField
						label="Environment"
						htmlFor="app-environment"
						hint="Fixed once the app is created."
					>
						<Select
							items={environmentLabels}
							value={environment}
							onValueChange={(value) =>
								setEnvironment(
									(value as (typeof environments)[number]) ??
										"sandbox",
								)
							}
						>
							<SelectTrigger
								id="app-environment"
								className="w-full"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{environments.map((value) => (
									<SelectItem key={value} value={value}>
										{environmentLabels[value]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</FormField>
				}
			/>
		</FormPage>
	);
}

/** EditApp changes an app's name, description, currency and fees. */
export function EditApp() {
	const { appId = "" } = useParams();
	const { client } = useAuth();
	const app = useQuery({
		queryKey: keys.apps.detail(appId),
		queryFn: () => client.apps.get(appId),
		enabled: Boolean(appId),
	});

	if (app.isError) {
		return (
			<div className="flex flex-col gap-4">
				<BackLink to="/apps" label="All apps" />
				<Alert variant="destructive">
					<AlertTitle>App unavailable</AlertTitle>
					<AlertDescription>{app.error.message}</AlertDescription>
				</Alert>
			</div>
		);
	}
	if (!app.data) return <Skeleton className="h-96 w-full" />;
	// Keyed so the form seeds once from the loaded app and a background refetch never
	// overwrites what is being typed.
	return <EditAppForm key={app.data.id} app={app.data} />;
}

function EditAppForm({ app }: { app: App }) {
	const { client } = useAuth();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [details, setDetails] = useState<AppDetails>({
		name: app.name,
		description: app.description ?? "",
		currency: app.currency,
		charges: app.charges ?? zeroCharges,
	});

	const save = useMutation({
		mutationFn: () => client.apps.update(app.id, details),
		onSuccess: async () => {
			toast.success("App updated");
			await queryClient.invalidateQueries({ queryKey: keys.apps.all });
			void navigate(`/apps/${app.id}`);
		},
		onError: (error: Error) => toast.error(error.message),
	});

	return (
		<FormPage
			back={{ to: `/apps/${app.id}`, label: app.name }}
			title={`Edit ${app.name}`}
			description="Changes apply only to future transactions."
			submitLabel="Save"
			submitting={save.isPending}
			invalid={incomplete(details)}
			onSubmit={() => save.mutate()}
		>
			<AppFields
				prefix="edit-app"
				value={details}
				onChange={setDetails}
			/>
		</FormPage>
	);
}
