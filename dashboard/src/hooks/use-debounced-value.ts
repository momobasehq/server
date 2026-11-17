import { useEffect, useState } from "react";

/**
 * useDebouncedValue trails value by delay milliseconds, so typing into a search box
 * sends one request when the typist pauses rather than one per keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 300) {
	const [settled, setSettled] = useState(value);
	useEffect(() => {
		const timer = setTimeout(() => setSettled(value), delay);
		return () => clearTimeout(timer);
	}, [value, delay]);
	return settled;
}
