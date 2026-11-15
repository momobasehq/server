import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/format";

type Variant =
	| "default"
	| "success"
	| "warning"
	| "info"
	| "destructive"
	| "outline";

/**
 * Maps every status string the API reports onto a tone: green settled-good, blue in
 * flight, amber needs a look, red failed, grey dormant. Unlisted values fall to grey.
 */
const variants: Record<string, Variant> = {
	succeeded: "success",
	active: "success",
	healthy: "success",
	up: "success",
	running: "success",
	pending: "info",
	processing: "info",
	unknown: "warning",
	degraded: "warning",
	half_open: "warning",
	failed: "destructive",
	expired: "destructive",
	disabled: "destructive",
	suspended: "destructive",
	revoked: "destructive",
	down: "destructive",
	open: "destructive",
	// A cancel is a deliberate outcome, not a fault, so it reads as dormant.
	cancelled: "outline",
	inactive: "outline",
	closed: "outline",
	stopped: "outline",
	// Sandbox is the one flagged, so test data is never mistaken for live money.
	sandbox: "warning",
	production: "default",
};

/** StatusBadge renders an API status consistently wherever it appears. */
export function StatusBadge({ status }: { status?: string }) {
	if (!status) return <span className="text-muted-foreground">—</span>;
	return (
		<Badge variant={variants[status.toLowerCase()] ?? "outline"}>
			{titleCase(status)}
		</Badge>
	);
}

/** Verb fragments in an audit action, checked in order, mapped to a tone. */
const actionTones: [RegExp, Variant][] = [
	[/delet|remov|revok|disabl|suspend|fail|deni/, "destructive"],
	[/creat|add|issu|grant|enabl|activat|seed/, "success"],
	[/updat|rotat|chang|edit|set|assign|renam/, "info"],
];

/**
 * ActionBadge tones an audit action by its verb. Actions are free-form strings, so
 * this is a heuristic and anything unmatched stays neutral rather than guessing.
 */
export function ActionBadge({ action }: { action: string }) {
	const verb = action.toLowerCase();
	const variant =
		actionTones.find(([pattern]) => pattern.test(verb))?.[1] ?? "outline";
	return (
		<Badge variant={variant} className="font-mono">
			{action}
		</Badge>
	);
}
