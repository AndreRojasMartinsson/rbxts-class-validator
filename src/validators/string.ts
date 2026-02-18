import { ValidateBy } from "./primitives";

export function IsString(message = "must be a string") {
	return ValidateBy("IsString", (value) => (typeIs(value, "string") ? undefined : message));
}

export function MinLength(minLength: number, message = `must have length >= ${minLength}`) {
	return ValidateBy("MinLength", (value) => {
		if (!typeIs(value, "string")) return message;

		return value.size() >= minLength ? undefined : message;
	});
}

export function MaxLength(maxLength: number, message = `must have length <= ${maxLength}`) {
	return ValidateBy("MaxLength", (value) => {
		if (!typeIs(value, "string")) return message;

		return value.size() <= maxLength ? undefined : message;
	});
}
