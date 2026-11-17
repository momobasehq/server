import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AppWindow, Receipt, Search } from "lucide-react";
import { useNavigate } from "react-router";
import { AdminPermissions } from "momobase";

import { Button } from "@/components/ui/button";
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { useAuth } from "@/hooks/use-auth";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { allNavItems } from "@/lib/navigation";
import { keys } from "@/lib/query-keys";

const shortcut = /mac|iphone|ipad/i.test(navigator.userAgent) ? "⌘K" : "Ctrl K";

/** Few enough results to scan; the full lists are a screen away. */
const resultLimit = 5;

/** Transactions need a longer term: a short one matches most references. */
const minTransactionTerm = 3;

/**
 * CommandPalette jumps to any screen, app or transaction from the keyboard, on ⌘K or
 * Ctrl+K. Screens match locally; apps and transactions are searched on the server,
 * and only for an administrator who may read them.
 */
export function CommandPalette() {
	const { client, can } = useAuth();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [term, setTerm] = useState("");
	const search = useDebouncedValue(term.trim());

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (
				event.key.toLowerCase() === "k" &&
				(event.metaKey || event.ctrlKey)
			) {
				event.preventDefault();
				setOpen((current) => !current);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	const appQuery = { q: search, perPage: resultLimit };
	const apps = useQuery({
		queryKey: keys.apps.list(appQuery),
		queryFn: () => client.apps.list(appQuery),
		enabled: open && search !== "" && can(AdminPermissions.appsRead),
		placeholderData: keepPreviousData,
	});
	const transactionQuery = { q: search, perPage: resultLimit };
	const transactions = useQuery({
		queryKey: keys.transactions.list(transactionQuery),
		queryFn: () => client.transactions.list(transactionQuery),
		enabled:
			open &&
			search.length >= minTransactionTerm &&
			can(AdminPermissions.transactionsRead),
		placeholderData: keepPreviousData,
	});

	const needle = term.trim().toLowerCase();
	const screens = allNavItems.filter(
		(item) =>
			can(item.permission) &&
			(!needle || item.label.toLowerCase().includes(needle)),
	);
	// Stale results from an earlier term are hidden once the term is cleared.
	const appItems = search ? (apps.data?.items ?? []) : [];
	const transactionItems =
		search.length >= minTransactionTerm
			? (transactions.data?.items ?? [])
			: [];
	const searching = apps.isFetching || transactions.isFetching;

	const changeOpen = (next: boolean) => {
		setOpen(next);
		if (!next) setTerm("");
	};

	const go = (to: string) => {
		changeOpen(false);
		void navigate(to);
	};

	return (
		<>
			<Button
				variant="outline"
				size="sm"
				onClick={() => setOpen(true)}
				aria-label="Search screens, apps and transactions"
			>
				<Search />
				<span className="hidden sm:inline">Search</span>
				<kbd className="text-muted-foreground hidden font-mono text-[10px] sm:inline">
					{shortcut}
				</kbd>
			</Button>
			<CommandDialog
				open={open}
				onOpenChange={changeOpen}
				title="Go to"
				description="Type to find a screen, app or transaction, then press Enter."
			>
				{/* Results already come filtered from the server, so cmdk must not
				    filter them again against its own idea of a match. */}
				<Command shouldFilter={false}>
					<CommandInput
						placeholder="Go to a screen, app or transaction…"
						value={term}
						onValueChange={setTerm}
					/>
					<CommandList>
						<CommandEmpty>
							{searching ? "Searching…" : "Nothing matches."}
						</CommandEmpty>
						{screens.length > 0 && (
							<CommandGroup heading="Screens">
								{screens.map((item) => (
									<CommandItem
										key={item.to}
										value={`screen:${item.to}`}
										onSelect={() => go(item.to)}
									>
										<item.icon />
										{item.label}
									</CommandItem>
								))}
							</CommandGroup>
						)}
						{appItems.length > 0 && (
							<CommandGroup heading="Apps">
								{appItems.map((app) => (
									// Keyed by id so two apps with one name stay distinct.
									<CommandItem
										key={app.id}
										value={`app:${app.id}`}
										onSelect={() => go(`/apps/${app.id}`)}
									>
										<AppWindow />
										{app.name}
									</CommandItem>
								))}
							</CommandGroup>
						)}
						{transactionItems.length > 0 && (
							<CommandGroup heading="Transactions">
								{transactionItems.map((tx) => (
									<CommandItem
										key={tx.id}
										value={`tx:${tx.id}`}
										onSelect={() =>
											go(
												`/transactions?tx=${encodeURIComponent(tx.id)}`,
											)
										}
									>
										<Receipt />
										<span className="truncate">
											{tx.reference}
										</span>
										<span className="text-muted-foreground ms-auto">
											{tx.status}
										</span>
									</CommandItem>
								))}
							</CommandGroup>
						)}
					</CommandList>
				</Command>
			</CommandDialog>
		</>
	);
}
