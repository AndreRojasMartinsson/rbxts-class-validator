import { ValidateBy } from "./primitives";

export function IsNumber(message = "must be a number") {
	return ValidateBy("IsNumber", (value) => (typeIs(value, "number") ? undefined : message));
}

export function IsInteger(message = "must be a integer") {
	return ValidateBy("IsInteger", (value) => {
		if (!typeIs(value, "number")) return message;

		const n = value as number;
		return math.floor(n) === n ? undefined : message;
	});
}

export function Min(min: number, message = `must be >= ${min}`) {
	return ValidateBy("Min", (value) => {
		if (!typeIs(value, "number")) return message;

		return (value as number) >= min ? undefined : message;
	});
}

export function Max(max: number, message = `must be <= ${max}`) {
	return ValidateBy("Max", (value) => {
		if (!typeIs(value, "number")) return message;

		return (value as number) <= max ? undefined : message;
	});
}
