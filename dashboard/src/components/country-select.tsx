import CountryList from "country-list-with-dial-code-and-flag";
import flags from "country-list-with-dial-code-and-flag/dist/flag-svg";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const countries = CountryList.getAll({ withSecondary: false }).sort((a, b) =>
	a.name.localeCompare(b.name),
);
const countryNames = new Map(countries.map((c) => [c.code, c.name]));

// ISO 4217 codes open with the issuer's country code (UGX → UG, EUR → EU), so that
// flag wins; shared codes like XOF fall back to the first country that uses them.
const currencies = new Map<string, { name: string; flag: string }>();
for (const country of countries) {
	const code = country.currencyCode;
	if (code && !currencies.has(code)) {
		const issuer = code.slice(0, 2);
		currencies.set(code, {
			name: country.currency,
			flag: issuer in flags ? issuer : country.code,
		});
	}
}
const currencyCodes = [...currencies.keys()].sort();

function Flag({ code }: { code: string }) {
	const svg = flags[code];
	return svg ? (
		<img
			alt=""
			className="h-3 w-4.5 shrink-0 object-cover ring-1 ring-foreground/10"
			src={`data:image/svg+xml,${encodeURIComponent(svg)}`}
		/>
	) : null;
}

interface SelectProps {
	id: string;
	value: string;
	onChange: (value: string) => void;
}

/** CountrySelect picks an ISO 3166-1 alpha-2 code; a placeholder makes it clearable. */
export function CountrySelect({
	id,
	value,
	onChange,
	placeholder,
}: SelectProps & { placeholder?: string }) {
	return (
		<Select
			value={value || null}
			onValueChange={(code) => onChange(code ?? "")}
		>
			<SelectTrigger id={id} className="w-full">
				<SelectValue>
					{(code: string | null) =>
						code ? (
							<>
								<Flag code={code} />
								{countryNames.get(code) ?? code}
							</>
						) : (
							placeholder
						)
					}
				</SelectValue>
			</SelectTrigger>
			<SelectContent className="w-auto min-w-(--anchor-width)">
				{placeholder && (
					<SelectItem value={null}>{placeholder}</SelectItem>
				)}
				{countries.map((country) => (
					<SelectItem key={country.code} value={country.code}>
						<Flag code={country.code} />
						{country.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

/** CurrencySelect picks an ISO 4217 code, flagged by the country that issues it. */
export function CurrencySelect({ id, value, onChange }: SelectProps) {
	return (
		<Select value={value} onValueChange={(code) => onChange(code ?? "")}>
			<SelectTrigger id={id} className="w-full">
				<SelectValue>
					{(code: string) => (
						<>
							<Flag code={currencies.get(code)?.flag ?? ""} />
							{code}
						</>
					)}
				</SelectValue>
			</SelectTrigger>
			<SelectContent className="w-auto min-w-(--anchor-width)">
				{currencyCodes.map((code) => (
					<SelectItem key={code} value={code}>
						<Flag code={currencies.get(code)!.flag} />
						{code}
						<span className="text-muted-foreground">
							{currencies.get(code)!.name}
						</span>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
