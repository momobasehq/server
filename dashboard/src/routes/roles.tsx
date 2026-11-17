import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import {
	AdminPermissions,
	PermissionWildcard,
	type Role,
} from "momobase";

import { DataTable, type DataColumn } from "@/components/data-table";
import { rowActionsColumn } from "@/components/row-actions";
import { GuardedAction } from "@/components/guarded-action";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { titleCase } from "@/lib/format";
import { keys } from "@/lib/query-keys";

/** Roles lists roles and edits the permissions each one grants. */
export function Roles() {
	const { client } = useAuth();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const roles = useQuery({
		queryKey: keys.authz.roles(),
		queryFn: () => client.authz.roles(),
	});

	const remove = useMutation({
		mutationFn: (name: string) => client.authz.deleteRole(name),
		onSuccess: async () => {
			toast.success("Role deleted");
			await queryClient.invalidateQueries({ queryKey: keys.authz.all });
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const columns: DataColumn<Role>[] = [
		{
			id: "name",
			accessorFn: (r) => r.name,
			header: "Role",
			cell: ({ row: { original: role } }) => (
				<span className="flex items-center gap-2 font-medium">
					{titleCase(role.name)}
					{/* System roles are seeded and re-synchronised on every start, which is how a
              permission added by a new release reaches super_admin. Editing one would
              be reverted, so it is refused rather than silently undone. */}
					{role.system && (
						<Badge variant="outline">
							<Lock />
							System
						</Badge>
					)}
				</span>
			),
		},
		{
			id: "description",
			accessorFn: (r) => r.description,
			header: "Description",
			cell: ({ row: { original: role } }) => role.description || "—",
		},
		{
			id: "permissions",
			accessorFn: (r) => r.permissions.length,
			header: "Permissions",
			cell: ({ row: { original: role } }) =>
				role.permissions.some(
					(permission) => permission.code === PermissionWildcard,
				) ? (
					<span>Everything, including future permissions</span>
				) : (
					<span>{role.permissions.length}</span>
				),
		},
		rowActionsColumn<Role>((role) => [
			{
				label: "Edit",
				permission: AdminPermissions.rolesUpdate,
				disabled: role.system,
				onSelect: () =>
					void navigate(`/roles/${encodeURIComponent(role.name)}/edit`),
			},
			{
				label: "Delete",
				destructive: true,
				permission: AdminPermissions.rolesDelete,
				disabled: role.system || remove.isPending,
				onSelect: () => remove.mutate(role.name),
			},
		]),
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>Roles</CardTitle>
				<CardDescription>
					What each role of administrator may do. Seeded roles are
					read-only; create one to grant a different set.
				</CardDescription>
				<CardAction>
					<GuardedAction
						permission={AdminPermissions.rolesCreate}
						size="sm"
						nativeButton={false}
						render={<Link to="/roles/new" />}
					>
						<Plus />
						New role
					</GuardedAction>
				</CardAction>
			</CardHeader>
			<CardContent>
				<DataTable
					tableId="roles"
					columns={columns}
					rows={roles.data?.items ?? []}
					rowKey={(role) => role.id}
					loading={roles.isPending}
				/>
			</CardContent>
		</Card>
	);
}
