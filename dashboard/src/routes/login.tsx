import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

/** Login authenticates an administrator with the password grant. */
export function Login() {
	const { signIn } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState<string>();
	const [busy, setBusy] = useState(false);

	async function submit(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError(undefined);
		try {
			await signIn(email, password);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Sign-in failed");
		} finally {
			setBusy(false);
		}
	}

	return (
		<main className="relative flex min-h-svh items-center justify-center p-6">
			<div className="absolute end-4 top-4">
				<ThemeToggle />
			</div>
			<Card className="w-full max-w-md bg-transparent shadow-none ring-0">
				<CardHeader className="justify-items-center text-center">
					<Logo className="mb-2 size-16" />
					<CardTitle className="text-xl">
						Sign in to Momobase
					</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={submit} className="flex flex-col gap-4">
						{error && (
							<Alert variant="destructive">
								<AlertTitle>Sign-in failed</AlertTitle>
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}
						<div className="flex flex-col gap-2">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								type="email"
								autoComplete="username"
								required
								value={email}
								onChange={(event) =>
									setEmail(event.target.value)
								}
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="password">Password</Label>
							<InputGroup>
								<InputGroupInput
									id="password"
									type={showPassword ? "text" : "password"}
									autoComplete="current-password"
									required
									value={password}
									onChange={(event) =>
										setPassword(event.target.value)
									}
								/>
								<InputGroupAddon align="inline-end">
									<InputGroupButton
										size="icon-xs"
										aria-label={
											showPassword
												? "Hide password"
												: "Show password"
										}
										aria-pressed={showPassword}
										onClick={() =>
											setShowPassword((shown) => !shown)
										}
									>
										{showPassword ? <EyeOff /> : <Eye />}
									</InputGroupButton>
								</InputGroupAddon>
							</InputGroup>
						</div>
						<Button type="submit" disabled={busy}>
							{busy && <Loader2 className="animate-spin" />}
							Sign in
						</Button>
						<p className="text-muted-foreground text-center">
							Registration is disabled. Please contact the
							administrator.
						</p>
					</form>
				</CardContent>
			</Card>
		</main>
	);
}
