/**
 * ListKey is everything a list request sends: page, size, search, sort and filters.
 * Keying on all of it caches each filtered view apart from the others.
 */
export type ListKey = object;

/**
 * keys is the single source of query keys for the whole dashboard.
 *
 * Every key starts with its resource name so a mutation can invalidate by prefix —
 * `invalidateQueries({ queryKey: keys.apps.all })` catches every page of every app
 * list without the caller knowing which pages happen to be cached.
 */
export const keys = {
	me: ["me"] as const,
	system: {
		all: ["system"] as const,
		info: () => [...keys.system.all, "info"] as const,
		health: () => [...keys.system.all, "health"] as const,
		workers: (query: ListKey) => [...keys.system.all, "workers", query] as const,
		runtime: (query: ListKey) => [...keys.system.all, "runtime", query] as const,
	},
	authz: {
		all: ["authz"] as const,
		permissions: (audience?: string) =>
			[...keys.authz.all, "permissions", audience ?? "all"] as const,
		roles: () => [...keys.authz.all, "roles"] as const,
	},
	users: {
		all: ["users"] as const,
		list: (query: ListKey) => [...keys.users.all, "list", query] as const,
	},
	apps: {
		all: ["apps"] as const,
		list: (query: ListKey) => [...keys.apps.all, "list", query] as const,
		detail: (id: string) => [...keys.apps.all, "detail", id] as const,
		credentials: (id: string, query: ListKey) =>
			[...keys.apps.all, "credentials", id, query] as const,
	},
	providers: {
		all: ["providers"] as const,
		list: (query: ListKey) => [...keys.providers.all, "list", query] as const,
		detail: (id: string) => [...keys.providers.all, "detail", id] as const,
		registry: () => [...keys.providers.all, "registry"] as const,
		health: (query: ListKey) =>
			[...keys.providers.all, "health", query] as const,
		balances: (query: ListKey) =>
			[...keys.providers.all, "balances", query] as const,
	},
	routes: {
		all: ["routes"] as const,
		list: (query: ListKey) => [...keys.routes.all, "list", query] as const,
	},
	analytics: {
		all: ["analytics"] as const,
		transactions: (query: object) =>
			[...keys.analytics.all, "transactions", query] as const,
	},
	transactions: {
		all: ["transactions"] as const,
		list: (query: ListKey) => [...keys.transactions.all, "list", query] as const,
		detail: (id: string) => [...keys.transactions.all, "detail", id] as const,
	},
	audit: {
		all: ["audit"] as const,
		list: (query: ListKey) => [...keys.audit.all, "list", query] as const,
	},
} as const;
