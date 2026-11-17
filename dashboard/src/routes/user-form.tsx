import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { toast } from "sonner";

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

/** NewUser creates an administrator account. */
export function NewUser() {
	const { client } = useAuth();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [form, setForm] = useState({
		name: "",
		email: "",
		password: "",
		role: "",
	});
	// Roles come from the server, so a role an operator created is assignable here
	// without a client release.
	const roles = useQuery({
		queryKey: keys.authz.roles(),
		queryFn: () => client.authz.roles(),
	});

	const create = useMutation({
		mutationFn: () => client.users.create(form),
		onSuccess: async (user) => {
			toast.success(`Created ${user.email}`);
			await queryClient.invalidateQueries({ queryKey: keys.users.all });
			void navigate("/users");
		},
		onError: (error: Error) => toast.error(error.message),
	});

	return (
		<FormPage
			back={{ to: "/users", label: "All administrators" }}
			title="New administrator"
			description="The password is set once here and can be changed later."
			submitLabel="Create"
			submitting={create.isPending}
			invalid={!form.email || !form.password || !form.role}
			onSubmit={() => create.mutate()}
		>
			<FormSection
				title="Account"
				description="Who the administrator is and how they sign in."
			>
				<FormField label="Name" htmlFor="user-name">
					<Input
						id="user-name"
						autoComplete="off"
						value={form.name}
						onChange={(e) =>
							setForm({ ...form, name: e.target.value })
						}
					/>
				</FormField>
				<FormField label="Email" htmlFor="user-email">
					<Input
						id="user-email"
						type="email"
						autoComplete="off"
						value={form.email}
						onChange={(e) =>
							setForm({ ...form, email: e.target.value })
						}
					/>
				</FormField>
				{/* new-password keeps the browser from filling in the operator's own login. */}
				<FormField label="Password" htmlFor="user-password">
					<Input
						id="user-password"
						type="password"
						autoComplete="new-password"
						value={form.password}
						onChange={(e) =>
							setForm({ ...form, password: e.target.value })
						}
					/>
				</FormField>
			</FormSection>
			<FormSection
				title="Access"
				description="The role decides what this administrator may read and change."
			>
				<FormField label="Role" htmlFor="user-role">
					<Select
						items={Object.fromEntries(
							(roles.data?.items ?? []).map((role) => [
								role.name,
								titleCase(role.name),
							]),
						)}
						value={form.role}
						onValueChange={(role) =>
							setForm({ ...form, role: role ?? "" })
						}
					>
						<SelectTrigger id="user-role" className="w-full">
							<SelectValue
								placeholder={
									roles.isPending
										? "Loading…"
										: "Select a role"
								}
							/>
						</SelectTrigger>
						<SelectContent>
							{(roles.data?.items ?? []).map((role) => (
								<SelectItem key={role.name} value={role.name}>
									{titleCase(role.name)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FormField>
			</FormSection>
		</FormPage>
	);
}
