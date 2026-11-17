import { useState } from "react";
import { Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { toast } from "sonner";
import {
	AdminPermissions,
	type AdminUser,
	type AdminUserListQuery,
} from "momobase";

const userFacets = [
	{ field: "status", label: "Status", options: ["active", "inactive"] },
] as const;

import { DataTable, type DataColumn } from "@/components/data-table";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { formatDateTime, titleCase } from "@/lib/format";
import { keys } from "@/lib/query-keys";

/** Users manages administrator accounts and their status. */
export function Users() {
	const { client, me } = useAuth();
	const queryClient = useQueryClient();
	const paged = usePagedQuery(
		keys.users.list,
		(query: AdminUserListQuery) => client.users.list(query),
		{ filters: userFacets.map((facet) => facet.field) },
	);
	const [resetting, setResetting] = useState<AdminUser>();
	const [newPassword, setNewPassword] = useState("");
	const [reassigning, setReassigning] = useState<AdminUser>();
	const [nextRole, setNextRole] = useState("");

	const roles = useQuery({
		queryKey: keys.authz.roles(),
		queryFn: () => client.authz.roles(),
	});

	const changeRole = useMutation({
		mutationFn: () => client.users.changeRole(reassigning!.id, nextRole),
		onSuccess: async () => {
			// No session is revoked: permissions resolve from the role on every request, so
			// the change lands on the target's next call rather than their next sign-in.
			toast.success("Role changed — it applies on their next request");
			setReassigning(undefined);
			setNextRole("");
			await queryClient.invalidateQueries({ queryKey: keys.users.all });
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const changePassword = useMutation({
		mutationFn: () =>
			client.users.changePassword(resetting!.id, newPassword),
		onSuccess: () => {
			toast.success(
				"Password changed — the admin's existing sessions are invalidated",
			);
			setResetting(undefined);
			setNewPassword("");
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const changeStatus = useMutation({
		mutationFn: ({
			id,
			status,
		}: {
			id: string;
			status: "active" | "inactive";
		}) => client.users.changeStatus(id, status),
		onSuccess: async () => {
			toast.success("Status updated");
			await queryClient.invalidateQueries({ queryKey: keys.users.all });
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const columns: DataColumn<AdminUser>[] = [
		{
			id: "name",
			accessorFn: (r) => r.name,
			header: "Name",
			meta: { sortKey: "name" },
			cell: ({ row: { original: user } }) => (
				<span className="font-medium">{user.name}</span>
			),
		},
		{
			id: "email",
			accessorFn: (r) => r.email,
			header: "Email",
			meta: { sortKey: "email" },
			cell: ({ row: { original: user } }) => user.email,
		},
		{
			id: "role",
			accessorFn: (r) => r.role,
			header: "Role",
			cell: ({ row: { original: user } }) => titleCase(user.role),
		},
		{
			id: "status",
			accessorFn: (r) => r.status,
			header: "Status",
			cell: ({ row: { original: user } }) => (
				<StatusBadge status={user.status} />
			),
		},
		{
			id: "created",
			accessorFn: (r) => r.created_at,
			header: "Created",
			meta: { sortKey: "created_at" },
			cell: ({ row: { original: user } }) =>
				formatDateTime(user.created_at),
		},
		rowActionsColumn<AdminUser>((user) => [
			{
				label: "Change role",
				permission: AdminPermissions.usersUpdate,
				// Changing your own role is refused by the API — it is both a lockout risk
				// and a self-promotion path — so the item says so rather than 400ing.
				disabled: user.id === me?.id,
				onSelect: () => {
					setReassigning(user);
					setNextRole(user.role);
				},
			},
			{
				label: "Set password",
				permission: AdminPermissions.usersUpdate,
				onSelect: () => setResetting(user),
			},
			{
				label: user.status === "active" ? "Deactivate" : "Activate",
				destructive: user.status === "active",
				permission: AdminPermissions.usersUpdate,
				disabled: changeStatus.isPending,
				onSelect: () =>
					changeStatus.mutate({
						id: user.id,
						status:
							user.status === "active" ? "inactive" : "active",
					}),
			},
		]),
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>Administrators</CardTitle>
				<CardDescription>
					Console accounts and the roles that gate what they may
					change.
				</CardDescription>
				<CardAction>
					<GuardedAction
						permission={AdminPermissions.usersCreate}
						size="sm"
						nativeButton={false}
						render={<Link to="/users/new" />}
					>
						<Plus />
						New administrator
					</GuardedAction>
				</CardAction>
			</CardHeader>
			<CardContent>
				<DataTable
					tableId="users"
					list={paged.list}
					facets={userFacets}
					searchPlaceholder="Search name or email…"
					columns={columns}
					rows={paged.items}
					rowKey={(user) => user.id}
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

			<Dialog
				open={Boolean(reassigning)}
				onOpenChange={(open) => !open && setReassigning(undefined)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Change role</DialogTitle>
						<DialogDescription>
							{reassigning?.email} currently holds{" "}
							<strong>
								{titleCase(reassigning?.role ?? "")}
							</strong>
							. A new role applies on their next request; they
							stay signed in.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-2">
						<Label htmlFor="next-role">Role</Label>
						<Select
							value={nextRole}
							onValueChange={(role) => setNextRole(role ?? "")}
						>
							<SelectTrigger id="next-role">
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
									<SelectItem
										key={role.name}
										value={role.name}
									>
										{titleCase(role.name)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setReassigning(undefined)}
						>
							Cancel
						</Button>
						<Button
							onClick={() => changeRole.mutate()}
							disabled={
								changeRole.isPending ||
								!nextRole ||
								nextRole === reassigning?.role
							}
						>
							Change role
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={Boolean(resetting)}
				onOpenChange={(open) => !open && setResetting(undefined)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Set password</DialogTitle>
						<DialogDescription>
							Changing {resetting?.email}'s password revokes their
							active sessions.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-2">
						<Label htmlFor="new-password">New password</Label>
						<Input
							id="new-password"
							type="password"
							autoComplete="new-password"
							value={newPassword}
							onChange={(event) =>
								setNewPassword(event.target.value)
							}
						/>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setResetting(undefined)}
						>
							Cancel
						</Button>
						<Button
							onClick={() => changePassword.mutate()}
							disabled={changePassword.isPending || !newPassword}
						>
							Change password
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
