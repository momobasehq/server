import { formatDateTime, formatRelative } from "@/lib/format";

/** Timestamp shows how long ago something happened, with the exact time on hover. */
export function Timestamp({ value }: { value?: string }) {
	if (!value) return <span className="text-muted-foreground">—</span>;
	return (
		<time dateTime={value} title={formatDateTime(value)}>
			{formatRelative(value)}
		</time>
	);
}
