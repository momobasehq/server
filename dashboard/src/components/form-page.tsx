import type { FormEvent, ReactNode } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** BackLink is the "All …" link every sub-page opens with. */
export function BackLink({ to, label }: { to: string; label: string }) {
	return (
		<Button
			variant="ghost"
			size="sm"
			nativeButton={false}
			render={<Link to={to} />}
			className="self-start"
		>
			<ArrowLeft />
			{label}
		</Button>
	);
}

interface FormPageProps {
	/** Where Cancel and the back link return to. */
	back: { to: string; label: string };
	title: ReactNode;
	description?: ReactNode;
	/** Header-side control, such as a secondary action. */
	action?: ReactNode;
	submitLabel: string;
	submitting: boolean;
	/** Blocks submission, e.g. while required fields are empty. */
	invalid?: boolean;
	/** Left-hand footer content, such as a selection count. */
	footer?: ReactNode;
	onSubmit: () => void;
	className?: string;
	children: ReactNode;
}

/**
 * FormPage is the full-page home for create and edit forms, which used to be dialogs.
 * A real form element means Enter submits, and a page means back, refresh and links
 * all work and a stray click outside no longer discards what was typed.
 */
export function FormPage({
	back,
	title,
	description,
	action,
	submitLabel,
	submitting,
	invalid,
	footer,
	onSubmit,
	className,
	children,
}: FormPageProps) {
	function submit(event: FormEvent) {
		event.preventDefault();
		if (!submitting && !invalid) onSubmit();
	}

	return (
		<div className={cn("flex w-full flex-col gap-4", className)}>
			<BackLink {...back} />
			<form onSubmit={submit}>
				{/* Visible overflow, or the sticky footer below would stick to the card itself. */}
				<Card className="overflow-visible">
					<CardHeader>
						<CardTitle>{title}</CardTitle>
						{description && (
							<CardDescription>{description}</CardDescription>
						)}
						{action && <CardAction>{action}</CardAction>}
					</CardHeader>
					<CardContent className="flex flex-col gap-6">
						{children}
					</CardContent>
					{/* Sticky so a long form, like a role's permission list, never hides its
					    submit button below the fold. */}
					<CardFooter className="bg-card sticky bottom-0 -mb-(--card-spacing) flex flex-wrap justify-end gap-2 border-t pb-(--card-spacing)">
						{footer && (
							<div className="text-muted-foreground me-auto">
								{footer}
							</div>
						)}
						<Button
							variant="outline"
							nativeButton={false}
							render={<Link to={back.to} />}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={submitting || invalid}>
							{submitting && <Loader2 className="animate-spin" />}
							{submitLabel}
						</Button>
					</CardFooter>
				</Card>
			</form>
		</div>
	);
}

/**
 * FormSection groups related fields: the heading sits beside them on wide screens and
 * above them on narrow ones, and the fields flow two to a row from small screens up.
 * Give a field `className={wide}` to span the full row.
 */
export function FormSection({
	title,
	description,
	children,
}: {
	title: string;
	description?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="grid gap-x-10 gap-y-4 border-t pt-6 first:border-t-0 first:pt-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
			<div className="flex flex-col gap-1">
				<h3 className="font-medium">{title}</h3>
				{description && (
					<p className="text-muted-foreground">{description}</p>
				)}
			</div>
			<div className="grid content-start gap-x-6 gap-y-5 sm:grid-cols-2">
				{children}
			</div>
		</section>
	);
}

/** Spans a FormSection field across both columns. */
export const wide = "sm:col-span-2";

/** FormField is a label over its control, the unit FormSection lays out. */
export function FormField({
	label,
	htmlFor,
	hint,
	className,
	children,
}: {
	label: string;
	htmlFor?: string;
	hint?: ReactNode;
	className?: string;
	children: ReactNode;
}) {
	return (
		<div className={cn("flex min-w-0 flex-col gap-2", className)}>
			<Label htmlFor={htmlFor}>{label}</Label>
			{children}
			{hint && <p className="text-muted-foreground">{hint}</p>}
		</div>
	);
}

/** Detail is one labelled value in a read-only record grid. */
export function Detail({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="min-w-0">
			<p className="text-muted-foreground">{label}</p>
			<div className="mt-1">{children}</div>
		</div>
	);
}
