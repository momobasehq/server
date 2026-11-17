import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router";
import { AdminPermissions, type PermissionCode } from "momobase";

import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { allNavItems } from "@/lib/navigation";
import { ApiTester } from "@/routes/api-tester";
import { AppDetail } from "@/routes/app-detail";
import { EditApp, NewApp } from "@/routes/app-form";
import { Apps } from "@/routes/apps";
import { Audit } from "@/routes/audit";
import { Login } from "@/routes/login";
import { NoAccess } from "@/routes/no-access";
import { Operations } from "@/routes/operations";
import { Overview } from "@/routes/overview";
import { PaymentRoutes } from "@/routes/payment-routes";
import { Providers } from "@/routes/providers";
import { ProviderDetail } from "@/routes/provider-detail";
import { ConfigureProvider, NewProvider } from "@/routes/provider-form";
import { EditRole, NewRole } from "@/routes/role-form";
import { Roles } from "@/routes/roles";
import { NewRoute } from "@/routes/route-form";
import { TransactionDetail } from "@/routes/transaction-detail";
import { Transactions } from "@/routes/transactions";
import { NewUser } from "@/routes/user-form";
import { Users } from "@/routes/users";

/**
 * Sub-pages that are reached from a list rather than the nav: detail views and the
 * create/edit forms. Each is gated on the permission its action needs, and static
 * segments like "new" outrank the ":id" routes beside them.
 */
const subPages: {
	path: string;
	permission: PermissionCode;
	element: ReactElement;
}[] = [
	{
		path: "transactions/:transactionId",
		permission: AdminPermissions.transactionsRead,
		element: <TransactionDetail />,
	},
	{
		path: "apps/new",
		permission: AdminPermissions.appsCreate,
		element: <NewApp />,
	},
	{
		path: "apps/:appId",
		permission: AdminPermissions.appsRead,
		element: <AppDetail />,
	},
	{
		path: "apps/:appId/edit",
		permission: AdminPermissions.appsUpdate,
		element: <EditApp />,
	},
	{
		path: "providers/new",
		permission: AdminPermissions.providersCreate,
		element: <NewProvider />,
	},
	{
		path: "providers/:providerId",
		permission: AdminPermissions.providersRead,
		element: <ProviderDetail />,
	},
	{
		path: "providers/:providerId/configure",
		permission: AdminPermissions.providersUpdate,
		element: <ConfigureProvider />,
	},
	{
		path: "routes/new",
		permission: AdminPermissions.routesCreate,
		element: <NewRoute />,
	},
	{
		path: "users/new",
		permission: AdminPermissions.usersCreate,
		element: <NewUser />,
	},
	{
		path: "roles/new",
		permission: AdminPermissions.rolesCreate,
		element: <NewRole />,
	},
	{
		path: "roles/:roleName/edit",
		permission: AdminPermissions.rolesUpdate,
		element: <EditRole />,
	},
];

/** The screen each navigable path renders, keyed to match lib/navigation. */
const screens: Record<string, ReactElement> = {
	"/": <Overview />,
	"/transactions": <Transactions />,
	"/apps": <Apps />,
	"/providers": <Providers />,
	"/routes": <PaymentRoutes />,
	"/users": <Users />,
	"/roles": <Roles />,
	"/operations": <Operations />,
	"/audit": <Audit />,
	"/api-tester": <ApiTester />,
};

/**
 * Guard renders a screen only when the administrator holds its permission.
 *
 * Hiding the nav item is not enough on its own: routes live in the URL hash, so any
 * path can be typed directly. This is presentation, not enforcement — every endpoint
 * behind these screens is still gated server-side.
 */
function Guard({
	permission,
	children,
}: {
	permission: PermissionCode;
	children: ReactElement;
}) {
	const { can } = useAuth();
	return can(permission) ? children : <NoAccess />;
}

/** App gates the route table on an authenticated session and its permissions. */
export function App() {
	const { signedIn, restoring, can } = useAuth();

	// Rendering the login form while a stored session is still being revalidated would
	// flash sign-in at someone who is already signed in.
	if (restoring) {
		return (
			<div className="flex min-h-svh items-center justify-center p-6">
				<Skeleton className="h-32 w-full max-w-sm" />
			</div>
		);
	}

	if (!signedIn) return <Login />;

	// The overview needs system:read, so it cannot be assumed as the landing screen. A
	// role without it lands on its first permitted screen instead, and a role with no
	// read permissions at all lands on the fallback rather than a failing dashboard.
	const landing = allNavItems.find(
		(item) => item.to !== "/" && can(item.permission),
	)?.to;

	return (
		<Routes>
			<Route element={<AppShell />}>
				<Route
					index
					element={
						can(AdminPermissions.systemRead) ? (
							<Overview />
						) : landing ? (
							<Navigate to={landing} replace />
						) : (
							<NoAccess />
						)
					}
				/>
				{allNavItems
					.filter((item) => item.to !== "/")
					.map((item) => (
						<Route
							key={item.to}
							path={item.to.replace(/^\//, "")}
							element={
								<Guard permission={item.permission}>
									{screens[item.to] ?? <NoAccess />}
								</Guard>
							}
						/>
					))}
				{subPages.map((page) => (
					<Route
						key={page.path}
						path={page.path}
						element={
							<Guard permission={page.permission}>
								{page.element}
							</Guard>
						}
					/>
				))}
				{/* An unknown hash route lands on the fallback rather than a blank page. */}
				<Route path="*" element={<NoAccess />} />
			</Route>
		</Routes>
	);
}
