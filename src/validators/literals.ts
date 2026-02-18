import { slice } from "../helpers";
import { Placeholder } from "../types";
import { ValidateBy } from "./primitives";

function literalToString(v: unknown) {
	if (typeIs(v, "string")) return `"${v}"`;
	return tostring(v);
}

function escapeLuaPattern(s: string) {
	// Escape Lua pattern magic chars: ( ) . % + - * ? [ ^ $
	return (s as string).gsub("([%(%)%.%%%+%-%*%?%[%^%$])", "%%%1")[0];
}

export function IsLiteral<T extends readonly (string | number | boolean)[]>(
	...args: [...allowed: T, message?: string]
) {
	const last = args[args.size() - 1] as unknown;

	const hasMessage = typeIs(last, "string");
	const message = (hasMessage ? last : undefined) as string | undefined;

	const allowed = (hasMessage ? slice(args, 0, args.size() - 1) : args) as unknown as T;

	const defaultMessage =
		allowed.size() === 1
			? `must be ${literalToString(allowed[0])}`
			: `must be one of ${allowed.map(literalToString).join(", ")}`;

	return ValidateBy("IsLiteral", (value) => {
		for (const a of allowed) {
			if (value === a) return undefined;
		}

		return message ?? defaultMessage;
	});
}

export function IsTemplateLiteral(template: string, message = `must match template ${template}`) {
	let pattern = "^";
	let i = 1;

	while (i <= template.size()) {
		const rest = template.sub(i);
		const openIdx = rest.find("${")[0];
		if (openIdx === undefined) {
			pattern += escapeLuaPattern(template.sub(i));
			break;
		}

		const absOpen = i + (openIdx as number) - 1;
		pattern += escapeLuaPattern(template.sub(i, absOpen - 1));

		const closeStart = template.find("}", absOpen + 2)[0];
		if (closeStart === undefined) {
			pattern += escapeLuaPattern(template.sub(absOpen));
			break;
		}

		const token = template.sub(absOpen + 2, (closeStart as number) - 1) as Placeholder;

		if (token === "string") pattern += "(.+)";
		else if (token === "number") pattern += "([%-]?%d+%.?%d*)";
		else if (token === "int") pattern += "([%-]?%d+)";
		else if (token === "boolean") pattern += "((true)|(false)|(1)|(0))";
		else {
			pattern += escapeLuaPattern("${" + token + "}");
		}

		i = (closeStart as number) + 1;
	}

	pattern += "$";

	return ValidateBy("IsTemplateLiteral", (value) => {
		if (!typeIs(value, "string")) return message;

		const matches = value.match(pattern);
		return matches.size() > 0 ? undefined : message;
	});
}
