import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppWindow, Search } from "lucide-react";
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
import { allNavItems } from "@/lib/navigation";
import { keys } from "@/lib/query-keys";

/** The API has no app search yet, so the palette matches within one large page. */
const appPage = { page: 1, perPage: 100 };

const shortcut = /mac|iphone|ipad/i.test(navigator.userAgent) ? "⌘K" : "Ctrl K";

/**
 * CommandPalette jumps to any screen or app from the keyboard, on ⌘K or Ctrl+K. It
 * offers only screens the administrator can open, the same filter the sidebar uses.
 */
export function CommandPalette() {
	const { client, can } = useAuth();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);

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

	// Fetched on first open, not on load, so the shortcut costs nothing until used.
	const apps = useQuery({
		queryKey: keys.apps.list(appPage),
		queryFn: () => client.apps.list(appPage),
		enabled: open && can(AdminPermissions.appsRead),
	});

	const go = (to: string) => {
		setOpen(false);
		void navigate(to);
	};

	return (
		<>
			<Button
				variant="outline"
				size="sm"
				onClick={() => setOpen(true)}
				aria-label="Search screens and apps"
			>
				<Search />
				<span className="hidden sm:inline">Search</span>
				<kbd className="text-muted-foreground hidden font-mono text-[10px] sm:inline">
					{shortcut}
				</kbd>
			</Button>
			<CommandDialog
				open={open}
				onOpenChange={setOpen}
				title="Go to"
				description="Type to filter screens and apps, then press Enter."
			>
				<Command>
					<CommandInput placeholder="Go to a screen or app…" />
					<CommandList>
						<CommandEmpty>
							{apps.isFetching
								? "Loading apps…"
								: "No matching screen or app."}
						</CommandEmpty>
						<CommandGroup heading="Screens">
							{allNavItems
								.filter((item) => can(item.permission))
								.map((item) => (
									<CommandItem
										key={item.to}
										value={`screen:${item.to}`}
										keywords={[item.label]}
										onSelect={() => go(item.to)}
									>
										<item.icon />
										{item.label}
									</CommandItem>
								))}
						</CommandGroup>
						{(apps.data?.items.length ?? 0) > 0 && (
							<CommandGroup heading="Apps">
								{apps.data?.items.map((app) => (
									// Keyed by id so two apps with one name stay distinct.
									<CommandItem
										key={app.id}
										value={`app:${app.id}`}
										keywords={[app.name]}
										onSelect={() => go(`/apps/${app.id}`)}
									>
										<AppWindow />
										{app.name}
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
