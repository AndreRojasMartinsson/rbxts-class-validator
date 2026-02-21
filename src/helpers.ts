import { Reflect } from "@flamework/core";
import { validate } from "./validation";

export function slice<T>(arr: T[], start = 0, end_ = arr.size()): T[] {
	const result: defined[] = [];

	const length = arr.size();

	if (start < 0) start = length + start;
	if (end_ < 0) end_ = length + end_;

	start = math.max(start, 0);
	end_ = math.min(end_, length);

	for (let i = start; i < end_; i++) {
		result.push(arr[i] as defined);
	}

	return result as T[];
}

export function isEmptyTable(value: object): boolean {
	let count = 0;

	for (const _ of pairs(value)) {
		count++;
	}

	return count === 0;
}

/** Format nested validation errors into a short string */
export function formatErrors(errs: ReturnType<typeof validate>) {
	// errs is ValidationError[]
	// Keep it compact: "prop: msg1|msg2; prop2: msg"
	const parts: string[] = [];
	for (const e of errs) {
		parts.push(`${e.property}: ${e.constraints.join(" | ")}`);
	}
	return parts.join("; ");
}

export function isArrayLikeTable(t: object) {
	if (!typeIs(t, "table")) return false;

	let count = 0;

	for (const [k] of pairs(t as unknown as object)) {
		if (!typeIs(k, "number")) return false;
		const n = k as number;
		if (math.floor(n) !== n) return false;
		if (n < 1) return false;
		count += 1;
	}

	for (let i = 1; i <= count; i += 1) {
		if ((t as unknown as Record<number, unknown>)[i] === undefined) return false;
	}

	return true;
}

export function isNonArrayTable(value: unknown): value is object {
	return typeIs(value, "table") && !isArrayLikeTable(value as object);
}

export function getAllowedKeys(obj: object) {
	// "declared properties" for the class
	const props = Reflect.getProperties(obj);
	const allowed = new Set<string>();
	for (const p of props) allowed.add(p);
	return allowed;
}
