import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import type { PaymentMethod, ServiceType } from "momobase";

import { FormField, FormPage, FormSection } from "@/components/form-page";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { titleCase } from "@/lib/format";
import { keys } from "@/lib/query-keys";

const serviceLabels: Record<ServiceType, string> = {
	collection: "Collection",
	disbursement: "Disbursement",
};

/** NewRoute connects a provider account to a service and payment method. */
export function NewRoute() {
	const { client } = useAuth();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [form, setForm] = useState({
		service_type: "collection" as ServiceType,
		payment_method: "" as PaymentMethod | "",
		provider_account_id: "",
		priority: 1,
		active: true,
	});

	const accounts = useQuery({
		queryKey: keys.providers.list({ page: 1, perPage: 100 }),
		queryFn: () => client.providers.list({ page: 1, perPage: 100 }),
	});
	const runtimes = useQuery({
		queryKey: keys.system.runtime({ page: 1, perPage: 100 }),
		queryFn: () =>
			client.system.runtimeProviders({ page: 1, perPage: 100 }),
	});
	const activeAccounts = (accounts.data?.items ?? []).filter(
		(account) => account.active,
	);
	// Only methods the chosen account's running adapter declares for this service are
	// offered, so a route that could never execute is not creatable.
	const runtime = runtimes.data?.items.find(
		(item) => item.provider_account_id === form.provider_account_id,
	);
	const methods =
		runtime?.capabilities
			.filter(
				(capability) => capability.service_type === form.service_type,
			)
			.map((capability) => capability.payment_method) ?? [];

	const create = useMutation({
		mutationFn: () =>
			client.routes.create({
				...form,
				payment_method: form.payment_method as PaymentMethod,
			}),
		onSuccess: async () => {
			toast.success("Route created");
			await queryClient.invalidateQueries({ queryKey: keys.routes.all });
			void navigate("/routes");
		},
		onError: (error: Error) => toast.error(error.message),
	});

	return (
		<FormPage
			back={{ to: "/routes", label: "All routes" }}
			title="New route"
			description="The lowest-priority active route whose account is eligible wins."
			submitLabel="Create"
			submitting={create.isPending}
			invalid={!form.payment_method || !form.provider_account_id}
			onSubmit={() => create.mutate()}
		>
			<FormSection
				title="Match"
				description="The payments this route applies to."
			>
				<FormField label="Service" htmlFor="route-service">
					<Select
						items={serviceLabels}
						value={form.service_type}
						onValueChange={(value) =>
							setForm({
								...form,
								service_type:
									(value as ServiceType) ?? "collection",
								payment_method: "",
							})
						}
					>
						<SelectTrigger id="route-service" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="collection">
								Collection
							</SelectItem>
							<SelectItem value="disbursement">
								Disbursement
							</SelectItem>
						</SelectContent>
					</Select>
				</FormField>
				<FormField
					label="Payment method"
					htmlFor="route-method"
					hint="Only methods the chosen account supports for this service."
				>
					<Select
						items={Object.fromEntries(
							methods.map((method) => [
								method,
								titleCase(method),
							]),
						)}
						value={form.payment_method}
						onValueChange={(paymentMethod) =>
							setForm({
								...form,
								payment_method: paymentMethod as PaymentMethod,
							})
						}
						disabled={!form.provider_account_id}
					>
						<SelectTrigger id="route-method" className="w-full">
							<SelectValue
								placeholder={
									form.provider_account_id
										? "Select a supported method"
										: "Choose an account first"
								}
							/>
						</SelectTrigger>
						<SelectContent>
							{methods.map((method) => (
								<SelectItem key={method} value={method}>
									{titleCase(method)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FormField>
			</FormSection>
			<FormSection
				title="Destination"
				description="Which account serves matching payments, and in what order."
			>
				<FormField label="Provider account" htmlFor="route-account">
					<Select
						items={Object.fromEntries(
							activeAccounts.map((account) => [
								account.id,
								`${account.name} (${account.provider_code})`,
							]),
						)}
						value={form.provider_account_id}
						onValueChange={(id) =>
							setForm({
								...form,
								provider_account_id: id ?? "",
								payment_method: "",
							})
						}
					>
						<SelectTrigger id="route-account" className="w-full">
							<SelectValue
								placeholder={
									accounts.isPending
										? "Loading…"
										: "Select an account"
								}
							/>
						</SelectTrigger>
						<SelectContent>
							{activeAccounts.map((account) => (
								<SelectItem key={account.id} value={account.id}>
									{account.name} ({account.provider_code})
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FormField>
				<FormField
					label="Priority"
					htmlFor="route-priority"
					hint="Lower numbers are tried first."
				>
					<Input
						id="route-priority"
						type="number"
						min={1}
						value={form.priority}
						onChange={(event) =>
							setForm({
								...form,
								priority: Number(event.target.value) || 1,
							})
						}
					/>
				</FormField>
			</FormSection>
		</FormPage>
	);
}
