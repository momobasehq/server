import type { ChargeRule, ChargeSchedule } from "momobase";

import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";

export const zeroCharges: ChargeSchedule = {
	collection: { flat: 0, percentage: 0 },
	disbursement: { flat: 0, percentage: 0 },
};

/** Parses a non-negative whole number, clamping to max when one is given. */
function wholeNumber(raw: string, max?: number) {
	const value = Math.max(0, Math.trunc(Number(raw) || 0));
	return max === undefined ? value : Math.min(value, max);
}

function RuleField({
	id,
	label,
	rule,
	onChange,
}: {
	id: string;
	label: string;
	rule: ChargeRule;
	onChange: (rule: ChargeRule) => void;
}) {
	return (
		<div className="grid gap-2">
			<Label htmlFor={`${id}-flat`}>{label}</Label>
			<div className="grid grid-cols-2 gap-2">
				<InputGroup>
					<InputGroupInput
						id={`${id}-flat`}
						aria-label={`${label} flat fee`}
						type="number"
						min={0}
						step={1}
						value={rule.flat}
						onChange={(event) =>
							onChange({
								...rule,
								flat: wholeNumber(event.target.value),
							})
						}
					/>
					<InputGroupAddon align="inline-end">
						<InputGroupText>flat</InputGroupText>
					</InputGroupAddon>
				</InputGroup>
				<InputGroup>
					<InputGroupInput
						id={`${id}-percentage`}
						aria-label={`${label} percentage fee`}
						type="number"
						min={0}
						max={10_000}
						step={1}
						value={rule.percentage}
						onChange={(event) =>
							onChange({
								...rule,
								percentage: wholeNumber(
									event.target.value,
									10_000,
								),
							})
						}
					/>
					<InputGroupAddon align="inline-end">
						<InputGroupText>bps</InputGroupText>
					</InputGroupAddon>
				</InputGroup>
			</div>
		</div>
	);
}

/**
 * ChargeFields edits the complete per-service schedule expected by the API. It renders
 * the two rules as siblings so the surrounding grid can place them side by side.
 */
export function ChargeFields({
	id,
	value,
	onChange,
}: {
	id: string;
	value: ChargeSchedule;
	onChange: (value: ChargeSchedule) => void;
}) {
	return (
		<>
			<RuleField
				id={`${id}-collection`}
				label="Collections"
				rule={value.collection}
				onChange={(collection) => onChange({ ...value, collection })}
			/>
			<RuleField
				id={`${id}-disbursement`}
				label="Disbursements"
				rule={value.disbursement}
				onChange={(disbursement) =>
					onChange({ ...value, disbursement })
				}
			/>
		</>
	);
}

/** How charge values are read, for the heading of whatever section holds the fields. */
export const chargeHint =
	"Each fee is the flat amount plus the percentage. Flat values use minor units; percentages use basis points (300 = 3%).";
