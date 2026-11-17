import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import type { Permission, Role } from "momobase";

import {
	BackLink,
	FormField,
	FormPage,
	FormSection,
	wide,
} from "@/components/form-page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { titleCase } from "@/lib/format";
import { keys } from "@/lib/query-keys";

const back = { to: "/roles", label: "All roles" };

/** Groups permissions by the resource before the colon, which is how operators read them. */
function byResource(permissions: Permission[]) {
	const groups = new Map<string, Permission[]>();
	for (const permission of permissions) {
		const resource = permission.code.split(":")[0] ?? permission.code;
		groups.set(resource, [...(groups.get(resource) ?? []), permission]);
	}
	return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/** NewRole creates a role from a name and a permission set. */
export function NewRole() {
	return <RoleForm />;
}

/**
 * EditRole replaces an existing role's description and permissions. The API has no
 * single-role read, so the role is found in the (short, unpaginated) role list.
 */
export function EditRole() {
	const { roleName = "" } = useParams();
	const { client } = useAuth();
	const roles = useQuery({
		queryKey: keys.authz.roles(),
		queryFn: () => client.authz.roles(),
	});
	const role = roles.data?.items.find((item) => item.name === roleName);

	if (roles.isPending) return <Skeleton className="h-96 w-full" />;
	// System roles are re-synchronised on every start, so an edit would be silently
	// reverted; the list disables Edit for them and a typed URL lands here.
	if (!role || role.system) {
		return (
			<div className="flex flex-col gap-4">
				<BackLink {...back} />
				<Alert variant="destructive">
					<AlertTitle>Role cannot be edited</AlertTitle>
					<AlertDescription>
						{roles.error?.message ??
							(role
								? "System roles are read-only."
								: `No role named “${roleName}”.`)}
					</AlertDescription>
				</Alert>
			</div>
		);
	}
	return <RoleForm key={role.name} role={role} />;
}

function RoleForm({ role }: { role?: Role }) {
	const { client } = useAuth();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [description, setDescription] = useState(role?.description ?? "");
	const [selected, setSelected] = useState<string[]>(
		role?.permissions.map((permission) => permission.code) ?? [],
	);

	// Only administrative permissions can be held by a role; app-audience codes belong
	// to credentials, and the server refuses them here.
	const catalogue = useQuery({
		queryKey: keys.authz.permissions("admin"),
		queryFn: () => client.authz.permissions("admin"),
	});

	const save = useMutation({
		mutationFn: () =>
			role
				? client.authz.updateRole(role.name, {
						description,
						permissions: selected,
					})
				: client.authz.createRole({
						name,
						description,
						permissions: selected,
					}),
		onSuccess: async () => {
			toast.success(role ? `Updated ${role.name}` : `Created ${name}`);
			await queryClient.invalidateQueries({ queryKey: keys.authz.all });
			void navigate("/roles");
		},
		onError: (error: Error) => toast.error(error.message),
	});

	function toggle(code: string, checked: boolean) {
		setSelected((current) =>
			checked
				? [...current, code]
				: current.filter((held) => held !== code),
		);
	}

	return (
		<FormPage
			back={back}
			title={role ? `Edit ${titleCase(role.name)}` : "New role"}
			description="A role grants exactly the permissions selected here. Administrators holding it gain them on their next request, without signing in again."
			submitLabel={role ? "Save" : "Create"}
			submitting={save.isPending}
			invalid={!role && !name}
			footer={`${selected.length} selected`}
			onSubmit={() => save.mutate()}
		>
			<FormSection
				title="Details"
				description="A role's name is its identity, because administrators refer to it by name, so it cannot be changed later."
			>
				{!role && (
					<FormField label="Name" htmlFor="role-name">
						<Input
							id="role-name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="support"
						/>
					</FormField>
				)}
				<FormField
					label="Description"
					htmlFor="role-description"
					className={role ? wide : undefined}
				>
					<Input
						id="role-description"
						value={description}
						onChange={(event) => setDescription(event.target.value)}
						placeholder="Read transactions and reissue credentials"
					/>
				</FormField>
			</FormSection>

			<FormSection
				title="Permissions"
				description="Grouped by the resource they act on. Nothing is granted unless it is ticked here."
			>
				{catalogue.isPending ? (
					<Skeleton className={`h-40 w-full ${wide}`} />
				) : (
					byResource(catalogue.data?.items ?? []).map(
						([resource, permissions]) => (
							<fieldset
								key={resource}
								className="flex min-w-0 flex-col gap-2"
							>
								<legend className="mb-2 font-medium">
									{titleCase(resource)}
								</legend>
								{permissions.map((permission) => (
									<label
										key={permission.id}
										className="flex items-start gap-2"
									>
										<Checkbox
											checked={selected.includes(
												permission.code,
											)}
											onCheckedChange={(checked) =>
												toggle(
													permission.code,
													checked === true,
												)
											}
										/>
										<span className="min-w-0">
											<code>{permission.code}</code>
											<span className="text-muted-foreground">
												{" "}
												— {permission.description}
											</span>
										</span>
									</label>
								))}
							</fieldset>
						),
					)
				)}
			</FormSection>
		</FormPage>
	);
}
