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

/**
 * Validates that a value is exactly equal (`===`) to one of a fixed set of literal values.
 *
 * This is the "enum literal" validator for your system.
 *
 * - Works with `string | number | boolean` literals.
 * - Uses strict equality (`===`), so `"1"` will NOT match `1`, and `true` will NOT match `"true"`.
 * - Supports an optional custom error message as the final argument.
 *
 * ## Signature
 * ```ts
 * IsLiteral("a", "b", "c")
 * IsLiteral(1, 2, 3, "custom message")
 * IsLiteral(true, false)
 * ```
 *
 * The last argument is treated as a **message** only if it’s a string.
 * That means if your allowed literals include strings, it’s still unambiguous:
 * - The last string is always interpreted as the message.
 * - So you should include the message only when you actually want a message override.
 *
 * ## Default error messages
 * - One allowed value:
 *   - `must be <literal>`
 * - Multiple allowed values:
 *   - `must be one of <a>, <b>, <c>`
 *
 * `literalToString()` is used for nice formatting (e.g. quoting strings).
 *
 * ## Examples
 * ```ts
 * class Vehicle {
 *   @IsLiteral("car", "bike", "plane")
 *   kind!: "car" | "bike" | "plane";
 * }
 *
 * class Flags {
 *   @IsLiteral(true, false)
 *   enabled!: boolean;
 * }
 *
 * class HttpStatus {
 *   @IsLiteral(200, 201, 204, "must be a success status")
 *   status!: number;
 * }
 * ```
 *
 * ## Notes / gotchas
 * - This validator does not coerce. Pair it with coercers if you want flexible input:
 *   ```ts
 *   @Coerce.Number()
 *   @IsLiteral(0, 1)
 *   bit!: 0 | 1;
 *   ```
 */
export function IsLiteral<T extends readonly (string | number | boolean)[]>(...allowed: T) {
	const defaultMessage =
		allowed.size() === 1
			? `must be ${literalToString(allowed[0])}`
			: `must be one of ${allowed.map(literalToString).join(", ")}`;

	return ValidateBy("IsLiteral", (value) => {
		for (const a of allowed) {
			if (value === a) return undefined;
		}

		return defaultMessage;
	});
}

/**
 * Validates that a string matches a *template-literal-like* pattern.
 *
 * This lets you express constraints similar to TypeScript template literal types:
 * - `"user:${number}"`
 * - `"zone:${int}:${string}"`
 * - `"flag:${boolean}"`
 *
 * Provide a template containing `${...}` placeholders. The validator converts it into a
 * Lua string pattern, anchors it with `^` and `$`, and checks `value.match(pattern)`.
 *
 * ## Supported placeholders
 * - `${string}`  -> `(.+)` (one or more of any character)
 * - `${number}`  -> `([%-]?%d+%.?%d*)` (signed integer or decimal-ish)
 * - `${int}`     -> `([%-]?%d+)` (signed integer)
 * - `${boolean}` -> `((true)|(false)|(1)|(0))`
 *
 * Any unknown placeholder (e.g. `${uuid}`) is treated as a **literal** `${uuid}` in the template.
 *
 * ## Escaping
 * All non-placeholder text is escaped via `escapeLuaPattern(...)`, so characters like `.`, `+`, `(`, `)`
 * are treated literally.
 *
 * ## Examples
 * ```ts
 * class Keys {
 *   // "user:123", "user:-5", "user:42.5"
 *   @IsTemplateLiteral("user:${number}")
 *   userKey!: string;
 *
 *   // "zone:12:Downtown"
 *   @IsTemplateLiteral("zone:${int}:${string}")
 *   zoneKey!: string;
 *
 *   // "flag:true", "flag:0"
 *   @IsTemplateLiteral("flag:${boolean}")
 *   featureFlag!: string;
 * }
 * ```
 *
 * ## Example: custom error message
 * ```ts
 * class Routes {
 *   @IsTemplateLiteral("api/v1/${string}", "must look like api/v1/<something>")
 *   path!: string;
 * }
 * ```
 *
 * ## Notes / limitations
 * - `${string}` uses `(.+)`, so it is greedy. If you need stricter boundaries, introduce separators
 *   in your template (e.g. `"a:${string}:b"`).
 * - `${number}` pattern is permissive but not a perfect numeric grammar (e.g. it allows `1.`).
 *   Tighten it if you need strict decimals.
 * - This validator does not coerce — it only validates string shape.
 * - Non-string inputs fail immediately with the provided message.
 */
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
