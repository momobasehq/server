import type { PaymentMethod } from "momobase";

/**
 * Every payment method the API accepts, for filter menus. The SDK ships its own list
 * as a type-only export, so it is restated here and checked against PaymentMethod.
 */
export const paymentMethods = [
	"momo",
	"card",
	"bank_transfer",
	"wallet",
] as const satisfies readonly PaymentMethod[];
