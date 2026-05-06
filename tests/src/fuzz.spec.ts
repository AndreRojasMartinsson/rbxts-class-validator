import { Assert, Fact } from "@rbxts/runit";
import {
	ArrayElements,
	ArrayMaxSize,
	ArrayMinSize,
	Coerce,
	DiscriminatedUnion,
	ExclusiveUnion,
	Intersect,
	IsArray,
	IsBoolean,
	IsInteger,
	IsLiteral,
	IsMap,
	IsNumber,
	IsOptional,
	IsReadonly,
	IsRecord,
	IsSet,
	IsString,
	IsTemplateLiteral,
	IsTuple,
	MapEntries,
	Max,
	MaxLength,
	Min,
	MinLength,
	parseInto,
	RecordEntries,
	SetElements,
	Transform,
	TupleLength,
	Union,
	validate,
} from "../../src";
import type { ValidationError } from "../../src";

const FUZZ_CASES = 512;
const FUZZ_SEED = 5329233;

type UnknownFactory = (rng: FuzzRng) => unknown;

class FuzzRng {
	public constructor(private state: number) {}

	public next(maxExclusive: number) {
		this.state = (this.state * 48271) % 2147483647;
		return this.state % maxExclusive;
	}

	public int(min: number, max: number) {
		return min + this.next(max - min + 1);
	}

	public bool() {
		return this.next(2) === 0;
	}
}

class PrimitiveFuzzDto {
	@IsString()
	@MinLength(2)
	@MaxLength(6)
	public s!: string;

	@IsNumber()
	@Min(-10)
	@Max(10)
	public n!: number;

	@IsInteger()
	public i!: number;

	@IsBoolean()
	public b!: boolean;
}

class ArrayFuzzDto {
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(4)
	@ArrayElements((value) => (typeIs(value, "number") ? undefined : "must be number"))
	public value!: unknown[];
}

class TupleFuzzDto {
	@IsTuple(
		(value) => (typeIs(value, "string") ? undefined : "must be string"),
		(value) => (typeIs(value, "number") ? undefined : "must be number"),
	)
	public value!: unknown[];
}

class TupleLengthFuzzDto {
	@TupleLength(3)
	public value!: unknown[];
}

class RecordFuzzDto {
	@IsRecord()
	@RecordEntries(
		(key) => (key.match("^[a-z_]+$")[0] ? undefined : "bad key"),
		(value) => (typeIs(value, "number") ? undefined : "must be number"),
	)
	public value!: Record<string, unknown>;
}

class MapFuzzDto {
	@IsMap()
	@MapEntries(
		(key) => (typeIs(key, "number") ? undefined : "key must be number"),
		(value) => (typeIs(value, "string") ? undefined : "value must be string"),
	)
	public value!: object;
}

class SetFuzzDto {
	@IsSet()
	@SetElements((element) => (typeIs(element, "string") ? undefined : "must be string"))
	public value!: object;
}

class LiteralFuzzDto {
	@IsLiteral("car", "bike")
	public kind!: unknown;

	@IsLiteral(0, 1)
	public bit!: unknown;

	@IsTemplateLiteral("user:${number}")
	public userKey!: unknown;

	@IsTemplateLiteral("item.${int}[${boolean}]:${string}")
	public complexKey!: unknown;
}

class UnionShapeA {
	@IsLiteral("a")
	public tag!: string;

	@IsString()
	@MinLength(1)
	public name!: string;
}

class UnionShapeB {
	@IsLiteral("b")
	public tag!: string;

	@IsNumber()
	@Min(0)
	public count!: number;
}

class UnionFuzzDto {
	@Union(UnionShapeA, UnionShapeB)
	public value!: unknown;
}

class DiscriminatedUnionFuzzDto {
	@DiscriminatedUnion("tag", {
		a: UnionShapeA,
		b: UnionShapeB,
	})
	public value!: unknown;
}

class AnyNameDto {
	@IsString()
	public name!: string;
}

class ShortNameDto {
	@IsString()
	@MaxLength(3)
	public name!: string;
}

class ExclusiveUnionFuzzDto {
	@ExclusiveUnion(AnyNameDto, ShortNameDto)
	public value!: unknown;
}

class IntersectFuzzDto {
	@Intersect(
		(value) => (typeIs(value, "table") ? undefined : "must be table"),
		(value) =>
			typeIs(value, "table") && (value as Record<string, unknown>).ok === true
				? undefined
				: "ok must be true",
		(value) =>
			typeIs(value, "table") && typeIs((value as Record<string, unknown>).name, "string")
				? undefined
				: "name must be string",
	)
	public value!: unknown;
}

class PipelineFuzzDto {
	@Coerce.Number()
	@IsInteger()
	@Min(-5)
	@Max(5)
	@Transform.Map((value) => (value as number) * 10)
	public count!: number;

	@Coerce.Boolean()
	@IsBoolean()
	public flag!: boolean;

	@IsOptional()
	@Coerce.Default("guest")
	@IsLiteral("guest", "admin")
	public role?: string;

	@IsArray()
	@ArrayMaxSize(4)
	@ArrayElements((value) => (typeIs(value, "number") ? undefined : "must be number"))
	@Transform.ArrayMap((value) => (value as number) + 1)
	public scores!: number[];
}

class ReadonlyFuzzDto {
	@Coerce.Readonly()
	@IsReadonly()
	public value!: object;
}

function hasPropertyError(errors: ValidationError[], property: string) {
	for (const err of errors) {
		if (err.property === property) return true;
	}

	return false;
}

function describeValue(value: unknown) {
	if (value === undefined) return "undefined";
	if (typeIs(value, "string")) return `"${value}"`;
	return tostring(value);
}

function formatErrorsForTest(errors: ValidationError[]) {
	const parts: string[] = [];
	for (const err of errors) {
		parts.push(`${err.property}: ${err.constraints.join(" | ")}`);
	}

	return parts.join("; ");
}

function assertSingleProperty(
	buildDto: () => object,
	property: string,
	value: unknown,
	expectedValid: boolean,
	label: string,
) {
	Assert.custom((fail) => {
		const dto = buildDto();
		(dto as Record<string, unknown>)[property] = value;

		const errors = validate(dto);
		if (expectedValid) {
			if (errors.size() !== 0) {
				fail(
					"valid",
					`${label}: ${property}=${describeValue(value)} produced ${formatErrorsForTest(errors)}`,
				);
			}
			return;
		}

		if (!hasPropertyError(errors, property)) {
			fail(
				"property error",
				`${label}: ${property}=${describeValue(value)} produced ${formatErrorsForTest(errors)}`,
			);
		}
	});
}

function randomAscii(rng: FuzzRng, minLength: number, maxLength: number) {
	const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_:-.[] ";
	let out = "";
	const length = rng.int(minLength, maxLength);

	for (let i = 0; i < length; i += 1) {
		const index = rng.int(1, chars.size());
		out += chars.sub(index, index);
	}

	return out;
}

function sparseArray(valueA: unknown, valueB: unknown) {
	const value = {} as Record<number, unknown>;
	value[1] = valueA;
	value[3] = valueB;
	return value as object;
}

function numericMap(valueA: unknown, valueB: unknown) {
	const value = {} as Record<number, unknown>;
	value[2] = valueA;
	value[8] = valueB;
	return value as object;
}

function randomNumber(rng: FuzzRng) {
	const edgeCases = [-100, -11, -10, -9, -5, -1.5, -1, 0, 1, 5, 9, 10, 11, 100];
	if (rng.next(4) === 0) return edgeCases[rng.next(edgeCases.size())];

	return rng.int(-200, 200) / rng.int(1, 5);
}

function randomUnknown(rng: FuzzRng) {
	const factories: UnknownFactory[] = [
		() => undefined,
		() => true,
		() => false,
		(innerRng) => randomNumber(innerRng),
		(innerRng) => randomAscii(innerRng, 0, 10),
		(innerRng) => [randomNumber(innerRng), randomNumber(innerRng)],
		(innerRng) => [randomAscii(innerRng, 1, 4), randomNumber(innerRng)],
		(innerRng) => ({ alpha: randomNumber(innerRng), beta: randomNumber(innerRng) }),
		(innerRng) => ({ Alpha: randomNumber(innerRng) }),
		() => sparseArray(1, 3),
		() => numericMap("a", "b"),
		() => ({ admin: true, mod: 1 }),
		() => ({ admin: "yes" }),
	];

	return factories[rng.next(factories.size())](rng);
}

function isIntegerValue(value: unknown) {
	if (!typeIs(value, "number")) return false;

	const numberValue = value as number;
	return math.floor(numberValue) === numberValue;
}

interface CollectionCase {
	readonly value: unknown;
	readonly label: string;
	readonly arrayOk: boolean;
	readonly tupleOk: boolean;
	readonly tupleLengthOk: boolean;
	readonly recordOk: boolean;
	readonly mapOk: boolean;
	readonly setOk: boolean;
}

function randomCollectionCase(rng: FuzzRng): CollectionCase {
	const numberArray = () => {
		const length = rng.int(1, 6);
		const value: number[] = [];
		for (let i = 0; i < length; i += 1) value.push(rng.int(-20, 20));

		return {
			value,
			label: `number array length ${length}`,
			arrayOk: length <= 4,
			tupleOk: false,
			tupleLengthOk: length === 3,
			recordOk: false,
			mapOk: false,
			setOk: false,
		};
	};

	const cases: (() => CollectionCase)[] = [
		() => ({
			value: undefined,
			label: "undefined",
			arrayOk: false,
			tupleOk: false,
			tupleLengthOk: false,
			recordOk: false,
			mapOk: false,
			setOk: false,
		}),
		() => ({
			value: {},
			label: "empty table",
			arrayOk: false,
			tupleOk: false,
			tupleLengthOk: false,
			recordOk: true,
			mapOk: true,
			setOk: true,
		}),
		numberArray,
		() => ({
			value: [1, "x", 3],
			label: "array with invalid element",
			arrayOk: false,
			tupleOk: false,
			tupleLengthOk: true,
			recordOk: false,
			mapOk: false,
			setOk: false,
		}),
		() => ({
			value: ["id", rng.int(-20, 20)],
			label: "valid tuple pair",
			arrayOk: false,
			tupleOk: true,
			tupleLengthOk: false,
			recordOk: false,
			mapOk: false,
			setOk: false,
		}),
		() => ({
			value: ["id"],
			label: "short tuple pair",
			arrayOk: false,
			tupleOk: false,
			tupleLengthOk: false,
			recordOk: false,
			mapOk: false,
			setOk: false,
		}),
		() => ({
			value: { alpha: rng.int(-20, 20), beta_value: rng.int(-20, 20) },
			label: "valid record",
			arrayOk: false,
			tupleOk: false,
			tupleLengthOk: false,
			recordOk: true,
			mapOk: false,
			setOk: false,
		}),
		() => ({
			value: { Alpha: rng.int(-20, 20) },
			label: "record with invalid key",
			arrayOk: false,
			tupleOk: false,
			tupleLengthOk: false,
			recordOk: false,
			mapOk: false,
			setOk: false,
		}),
		() => ({
			value: { alpha: "nope" },
			label: "record with invalid value",
			arrayOk: false,
			tupleOk: false,
			tupleLengthOk: false,
			recordOk: false,
			mapOk: false,
			setOk: false,
		}),
		() => ({
			value: numericMap("left", "right"),
			label: "valid numeric map",
			arrayOk: false,
			tupleOk: false,
			tupleLengthOk: false,
			recordOk: false,
			mapOk: true,
			setOk: false,
		}),
		() => ({
			value: numericMap("left", 12),
			label: "map with invalid value",
			arrayOk: false,
			tupleOk: false,
			tupleLengthOk: false,
			recordOk: false,
			mapOk: false,
			setOk: false,
		}),
		() => ({
			value: { admin: true, mod: 1 },
			label: "valid string set",
			arrayOk: false,
			tupleOk: false,
			tupleLengthOk: false,
			recordOk: false,
			mapOk: false,
			setOk: true,
		}),
		() => ({
			value: { admin: "yes" },
			label: "set with invalid marker",
			arrayOk: false,
			tupleOk: false,
			tupleLengthOk: false,
			recordOk: false,
			mapOk: false,
			setOk: false,
		}),
		() => ({
			value: sparseArray("left", "right"),
			label: "sparse numeric-key table",
			arrayOk: false,
			tupleOk: false,
			tupleLengthOk: false,
			recordOk: false,
			mapOk: true,
			setOk: false,
		}),
	];

	return cases[rng.next(cases.size())]();
}

interface LiteralCase {
	readonly value: unknown;
	readonly label: string;
	readonly kindOk: boolean;
	readonly bitOk: boolean;
	readonly userKeyOk: boolean;
	readonly complexKeyOk: boolean;
}

function randomLiteralCase(rng: FuzzRng): LiteralCase {
	const cases: (() => LiteralCase)[] = [
		() => ({
			value: "car",
			label: "literal car",
			kindOk: true,
			bitOk: false,
			userKeyOk: false,
			complexKeyOk: false,
		}),
		() => ({
			value: "bike",
			label: "literal bike",
			kindOk: true,
			bitOk: false,
			userKeyOk: false,
			complexKeyOk: false,
		}),
		() => ({
			value: "plane",
			label: "unknown literal",
			kindOk: false,
			bitOk: false,
			userKeyOk: false,
			complexKeyOk: false,
		}),
		() => ({
			value: rng.next(2),
			label: "bit literal",
			kindOk: false,
			bitOk: true,
			userKeyOk: false,
			complexKeyOk: false,
		}),
		() => ({
			value: 2,
			label: "invalid bit literal",
			kindOk: false,
			bitOk: false,
			userKeyOk: false,
			complexKeyOk: false,
		}),
		() => ({
			value: `user:${rng.int(-100, 100)}`,
			label: "valid integer user key",
			kindOk: false,
			bitOk: false,
			userKeyOk: true,
			complexKeyOk: false,
		}),
		() => ({
			value: `user:${rng.int(-100, 100)}.${rng.int(0, 99)}`,
			label: "valid decimal user key",
			kindOk: false,
			bitOk: false,
			userKeyOk: true,
			complexKeyOk: false,
		}),
		() => ({
			value: "user:abc",
			label: "invalid user key",
			kindOk: false,
			bitOk: false,
			userKeyOk: false,
			complexKeyOk: false,
		}),
		() => ({
			value: `item.${rng.int(-50, 50)}[${rng.bool() ? "true" : "0"}]:${randomAscii(rng, 1, 8)}`,
			label: "valid complex template",
			kindOk: false,
			bitOk: false,
			userKeyOk: false,
			complexKeyOk: true,
		}),
		() => ({
			value: "itemx12[true]:name",
			label: "complex template with unescaped dot",
			kindOk: false,
			bitOk: false,
			userKeyOk: false,
			complexKeyOk: false,
		}),
		() => ({
			value: "item.12[yes]:name",
			label: "complex template invalid boolean",
			kindOk: false,
			bitOk: false,
			userKeyOk: false,
			complexKeyOk: false,
		}),
		() => ({
			value: { definitely_invalid_literal_case: rng.int(1, 100) },
			label: "known invalid literal object",
			kindOk: false,
			bitOk: false,
			userKeyOk: false,
			complexKeyOk: false,
		}),
	];

	return cases[rng.next(cases.size())]();
}

interface UnionCase {
	readonly value: unknown;
	readonly label: string;
	readonly unionOk: boolean;
	readonly discriminatedOk: boolean;
	readonly exclusiveOk: boolean;
	readonly intersectOk: boolean;
}

function randomUnionCase(rng: FuzzRng): UnionCase {
	const longName = randomAscii(rng, 4, 8);
	const cases: (() => UnionCase)[] = [
		() => ({
			value: undefined,
			label: "undefined",
			unionOk: true,
			discriminatedOk: true,
			exclusiveOk: true,
			intersectOk: true,
		}),
		() => ({
			value: { tag: "a", name: randomAscii(rng, 1, 8) },
			label: "valid a variant",
			unionOk: true,
			discriminatedOk: true,
			exclusiveOk: false,
			intersectOk: false,
		}),
		() => ({
			value: { tag: "b", count: rng.int(0, 100) },
			label: "valid b variant",
			unionOk: true,
			discriminatedOk: true,
			exclusiveOk: false,
			intersectOk: false,
		}),
		() => ({
			value: { tag: "a", name: "" },
			label: "a variant with empty name",
			unionOk: false,
			discriminatedOk: false,
			exclusiveOk: false,
			intersectOk: false,
		}),
		() => ({
			value: { tag: "b", count: -1 },
			label: "b variant below min",
			unionOk: false,
			discriminatedOk: false,
			exclusiveOk: false,
			intersectOk: false,
		}),
		() => ({
			value: { tag: "a", name: "ok", extra: 1 },
			label: "variant with unknown key",
			unionOk: false,
			discriminatedOk: false,
			exclusiveOk: false,
			intersectOk: false,
		}),
		() => ({
			value: { name: longName },
			label: "exclusive single-match long name",
			unionOk: false,
			discriminatedOk: false,
			exclusiveOk: true,
			intersectOk: false,
		}),
		() => ({
			value: { name: randomAscii(rng, 1, 3) },
			label: "exclusive ambiguous short name",
			unionOk: false,
			discriminatedOk: false,
			exclusiveOk: false,
			intersectOk: false,
		}),
		() => ({
			value: { ok: true, name: randomAscii(rng, 1, 8) },
			label: "valid intersection",
			unionOk: false,
			discriminatedOk: false,
			exclusiveOk: false,
			intersectOk: true,
		}),
		() => ({
			value: { ok: false, name: "x" },
			label: "intersection false marker",
			unionOk: false,
			discriminatedOk: false,
			exclusiveOk: false,
			intersectOk: false,
		}),
		() => ({
			value: rng.bool() ? false : "not a matching union value",
			label: "known invalid union value",
			unionOk: false,
			discriminatedOk: false,
			exclusiveOk: false,
			intersectOk: false,
		}),
	];

	return cases[rng.next(cases.size())]();
}

interface CoercedNumber {
	readonly ok: boolean;
	readonly value?: number;
}

function coerceNumberForOracle(value: unknown): CoercedNumber {
	if (typeIs(value, "number")) return { ok: true, value };
	if (!typeIs(value, "string")) return { ok: false };

	const trimmed = value.gsub("^%s+", "")[0].gsub("%s+$", "")[0];
	const numberValue = tonumber(trimmed);
	return numberValue === undefined ? { ok: false } : { ok: true, value: numberValue };
}

interface CoercedBoolean {
	readonly ok: boolean;
	readonly value?: boolean;
}

function coerceBooleanForOracle(value: unknown): CoercedBoolean {
	if (typeIs(value, "boolean")) return { ok: true, value };
	if (!typeIs(value, "string")) return { ok: false };

	const normalized = value.lower().gsub("^%s+", "")[0].gsub("%s+$", "")[0];
	if (normalized === "true" || normalized === "1") return { ok: true, value: true };
	if (normalized === "false" || normalized === "0") return { ok: true, value: false };

	return { ok: false };
}

interface ScoresOracle {
	readonly ok: boolean;
	readonly value?: number[];
}

function scoreArrayForOracle(value: unknown): ScoresOracle {
	if (!typeIs(value, "table")) return { ok: false };

	let count = 0;
	for (const [key] of pairs(value as object)) {
		if (!typeIs(key, "number")) return { ok: false };
		const index = key as number;
		if (math.floor(index) !== index || index < 1) return { ok: false };
		count += 1;
	}

	if (count > 4) return { ok: false };

	const source = value as Record<number, unknown>;
	const mapped: number[] = [];
	for (let i = 1; i <= count; i += 1) {
		const element = source[i];
		if (!typeIs(element, "number")) return { ok: false };
		mapped.push((element as number) + 1);
	}

	return { ok: true, value: mapped };
}

interface PipelineCase {
	readonly plain: Record<string, unknown>;
	readonly label: string;
	readonly ok: boolean;
	readonly count?: number;
	readonly flag?: boolean;
	readonly role?: string;
	readonly scores?: number[];
}

function randomPipelineCase(rng: FuzzRng): PipelineCase {
	const plain = {} as Record<string, unknown>;
	const includeCount = rng.next(8) !== 0;
	const includeFlag = rng.next(8) !== 0;
	const includeRole = rng.next(3) !== 0;
	const includeScores = rng.next(8) !== 0;
	const includeUnknown = rng.next(12) === 0;

	if (includeCount) {
		plain.count =
			rng.next(3) === 0
				? tostring(rng.int(-8, 8))
				: rng.next(3) === 0
					? ` ${rng.int(-8, 8)} `
					: randomUnknown(rng);
	}

	if (includeFlag) {
		const boolValues: unknown[] = [true, false, "true", "false", " TRUE ", " 0 ", "yes", 1];
		plain.flag = boolValues[rng.next(boolValues.size())];
	}

	if (includeRole) {
		const roleValues: unknown[] = ["guest", "admin", "owner", 1, false];
		plain.role = roleValues[rng.next(roleValues.size())];
	}

	if (includeScores) {
		const scoreCases: UnknownFactory[] = [
			(innerRng) => {
				const value: number[] = [];
				const length = innerRng.int(0, 5);
				for (let i = 0; i < length; i += 1) value.push(innerRng.int(-10, 10));
				return value;
			},
			() => [1, "x", 3],
			() => sparseArray(1, 2),
			() => ({ alpha: 1 }),
			() => "not-array",
		];
		plain.scores = scoreCases[rng.next(scoreCases.size())](rng);
	}

	if (includeUnknown) plain.extra = randomUnknown(rng);

	const count = coerceNumberForOracle(plain.count);
	const flag = coerceBooleanForOracle(plain.flag);
	const roleValue = plain.role === undefined ? "guest" : plain.role;
	const roleOk = roleValue === "guest" || roleValue === "admin";
	const scores = scoreArrayForOracle(plain.scores);
	const countOk =
		count.ok &&
		count.value !== undefined &&
		math.floor(count.value) === count.value &&
		count.value >= -5 &&
		count.value <= 5;
	const ok = !includeUnknown && countOk && flag.ok && roleOk && scores.ok;

	return {
		plain,
		label: `pipeline count=${describeValue(plain.count)} flag=${describeValue(plain.flag)} role=${describeValue(plain.role)} scores=${describeValue(plain.scores)} unknown=${includeUnknown}`,
		ok,
		count: ok ? (count.value as number) * 10 : undefined,
		flag: ok ? (flag.value as boolean) : undefined,
		role: ok ? (roleValue as string) : undefined,
		scores: ok ? scores.value : undefined,
	};
}

function seedPipelineTarget(dto: PipelineFuzzDto) {
	dto.count = 999;
	dto.flag = false;
	dto.role = "sentinel";
	dto.scores = [-1];
}

function assertPipelineUnchanged(dto: PipelineFuzzDto) {
	Assert.equal(999, dto.count);
	Assert.equal(false, dto.flag);
	Assert.equal("sentinel", dto.role);
	Assert.equal(-1, dto.scores[0]);
	Assert.equal(1, dto.scores.size());
}

function assertDeepFrozen(value: unknown, seen = new Set<object>()) {
	if (!typeIs(value, "table")) return;

	const objectValue = value as object;
	if (seen.has(objectValue)) return;
	seen.add(objectValue);

	Assert.true(table.isfrozen(objectValue));

	for (const [key, child] of pairs(objectValue)) {
		assertDeepFrozen(key, seen);
		assertDeepFrozen(child, seen);
	}
}

function validLiteralDto() {
	const dto = new LiteralFuzzDto();
	dto.kind = "car";
	dto.bit = 0;
	dto.userKey = "user:1";
	dto.complexKey = "item.1[true]:name";
	return dto;
}

function nestedTable(rng: FuzzRng) {
	const value = {
		id: rng.int(1, 100),
		child: {
			name: randomAscii(rng, 1, 8),
			values: [rng.int(1, 10), rng.int(1, 10)],
		},
	};

	return value;
}

function cyclicTable() {
	const value = {} as Record<string, unknown>;
	value.self = value;
	value.child = { parent: value };
	return value;
}

class ValidatorFuzzTest {
	@Fact
	public primitiveValidators_matchOracleForGeneratedValues() {
		const rng = new FuzzRng(FUZZ_SEED);

		for (let i = 0; i < FUZZ_CASES; i += 1) {
			const value = randomUnknown(rng);

			assertSingleProperty(
				() => {
					const dto = new PrimitiveFuzzDto();
					dto.s = "valid";
					dto.n = 0;
					dto.i = 0;
					dto.b = true;
					return dto;
				},
				"s",
				value,
				typeIs(value, "string") && value.size() >= 2 && value.size() <= 6,
				"string validator oracle",
			);

			assertSingleProperty(
				() => {
					const dto = new PrimitiveFuzzDto();
					dto.s = "valid";
					dto.n = 0;
					dto.i = 0;
					dto.b = true;
					return dto;
				},
				"n",
				value,
				typeIs(value, "number") && (value as number) >= -10 && (value as number) <= 10,
				"number bounds oracle",
			);

			assertSingleProperty(
				() => {
					const dto = new PrimitiveFuzzDto();
					dto.s = "valid";
					dto.n = 0;
					dto.i = 0;
					dto.b = true;
					return dto;
				},
				"i",
				value,
				isIntegerValue(value),
				"integer validator oracle",
			);

			assertSingleProperty(
				() => {
					const dto = new PrimitiveFuzzDto();
					dto.s = "valid";
					dto.n = 0;
					dto.i = 0;
					dto.b = true;
					return dto;
				},
				"b",
				value,
				typeIs(value, "boolean"),
				"boolean validator oracle",
			);
		}
	}

	@Fact
	public collectionValidators_matchOracleForGeneratedTables() {
		const rng = new FuzzRng(FUZZ_SEED + 1);

		for (let i = 0; i < FUZZ_CASES; i += 1) {
			const testCase = randomCollectionCase(rng);

			assertSingleProperty(
				() => new ArrayFuzzDto(),
				"value",
				testCase.value,
				testCase.arrayOk,
				testCase.label,
			);
			assertSingleProperty(
				() => new TupleFuzzDto(),
				"value",
				testCase.value,
				testCase.tupleOk,
				testCase.label,
			);
			assertSingleProperty(
				() => new TupleLengthFuzzDto(),
				"value",
				testCase.value,
				testCase.tupleLengthOk,
				testCase.label,
			);
			assertSingleProperty(
				() => new RecordFuzzDto(),
				"value",
				testCase.value,
				testCase.recordOk,
				testCase.label,
			);
			assertSingleProperty(
				() => new MapFuzzDto(),
				"value",
				testCase.value,
				testCase.mapOk,
				testCase.label,
			);
			assertSingleProperty(
				() => new SetFuzzDto(),
				"value",
				testCase.value,
				testCase.setOk,
				testCase.label,
			);
		}
	}

	@Fact
	public literalAndTemplateValidators_matchOracleForGeneratedValues() {
		const rng = new FuzzRng(FUZZ_SEED + 2);

		for (let i = 0; i < FUZZ_CASES; i += 1) {
			const testCase = randomLiteralCase(rng);

			assertSingleProperty(
				() => validLiteralDto(),
				"kind",
				testCase.value,
				testCase.kindOk,
				testCase.label,
			);
			assertSingleProperty(
				() => validLiteralDto(),
				"bit",
				testCase.value,
				testCase.bitOk,
				testCase.label,
			);
			assertSingleProperty(
				() => validLiteralDto(),
				"userKey",
				testCase.value,
				testCase.userKeyOk,
				testCase.label,
			);
			assertSingleProperty(
				() => validLiteralDto(),
				"complexKey",
				testCase.value,
				testCase.complexKeyOk,
				testCase.label,
			);
		}
	}

	@Fact
	public unionValidators_matchOracleForGeneratedShapes() {
		const rng = new FuzzRng(FUZZ_SEED + 3);

		for (let i = 0; i < FUZZ_CASES; i += 1) {
			const testCase = randomUnionCase(rng);

			assertSingleProperty(
				() => new UnionFuzzDto(),
				"value",
				testCase.value,
				testCase.unionOk,
				testCase.label,
			);
			assertSingleProperty(
				() => new DiscriminatedUnionFuzzDto(),
				"value",
				testCase.value,
				testCase.discriminatedOk,
				testCase.label,
			);
			assertSingleProperty(
				() => new ExclusiveUnionFuzzDto(),
				"value",
				testCase.value,
				testCase.exclusiveOk,
				testCase.label,
			);
			assertSingleProperty(
				() => new IntersectFuzzDto(),
				"value",
				testCase.value,
				testCase.intersectOk,
				testCase.label,
			);
		}
	}

	@Fact
	public parseIntoPipeline_fuzzesCoerceValidateTransformAndAtomicCommit() {
		const rng = new FuzzRng(FUZZ_SEED + 4);

		for (let i = 0; i < FUZZ_CASES; i += 1) {
			const testCase = randomPipelineCase(rng);

			Assert.appendFailedMessage(testCase.label, () => {
				const dto = new PipelineFuzzDto();
				seedPipelineTarget(dto);

				const result = parseInto(dto, testCase.plain);
				Assert.equal(testCase.ok, result.ok);

				if (!testCase.ok) {
					assertPipelineUnchanged(dto);
					return;
				}

				Assert.equal(testCase.count, dto.count);
				Assert.equal(testCase.flag, dto.flag);
				Assert.equal(testCase.role, dto.role);
				Assert.defined(testCase.scores);
				Assert.equal(testCase.scores.size(), dto.scores.size());

				for (let index = 0; index < testCase.scores.size(); index += 1) {
					Assert.equal(testCase.scores[index], dto.scores[index]);
				}
			});
		}
	}

	@Fact
	public readonlyCoercion_deepFreezesGeneratedTablesAndRejectsScalars() {
		const rng = new FuzzRng(FUZZ_SEED + 5);

		for (let i = 0; i < FUZZ_CASES; i += 1) {
			const value =
				i % 17 === 0 ? cyclicTable() : rng.next(3) === 0 ? randomUnknown(rng) : nestedTable(rng);
			const expectedValid = value === undefined || typeIs(value, "table");

			Assert.appendFailedMessage(`readonly: ${describeValue(value)}`, () => {
				const dto = new ReadonlyFuzzDto();
				const result = parseInto(dto, { value });
				Assert.equal(expectedValid, result.ok);

				if (expectedValid) {
					assertDeepFrozen(dto.value);
				}
			});
		}
	}
}

export = ValidatorFuzzTest;
