import { Assert, Fact } from "@rbxts/runit";
import {
	Coerce,
	IsBoolean,
	IsInteger,
	IsNumber,
	IsOptional,
	IsString,
	parseInto,
	validate,
} from "../src/index";

class CoercionDto {
	@Coerce.String()
	@IsString()
	s!: string;

	@Coerce.Number()
	@IsNumber()
	n!: number;

	@Coerce.Number()
	@IsInteger()
	i!: number;

	@Coerce.Boolean()
	@IsBoolean()
	b!: boolean;
}

class DefaultDto {
	@IsOptional()
	@Coerce.Default("en")
	@IsString()
	lang?: string;

	@IsOptional()
	@Coerce.Default(() => new Map<string, number>())
	public counts?: Map<string, number>;
}

class ReadonlyDto {
	@Coerce.Readonly()
	public data!: { nested: { arr: number[] } };
}

class CoercionTest {
	private assertStringCoerceOk(input: unknown, expected: string) {
		const dto = new CoercionDto();
		dto.s = input as never;
		dto.n = 1 as never;
		dto.i = 1 as never;
		dto.b = true as never;

		const errs = validate(dto);
		Assert.empty(errs);

		Assert.equal(expected, dto.s);
	}

	private assertNumberCoerceOk(input: unknown, expected: number) {
		const dto = new CoercionDto();
		dto.s = "x" as never;
		dto.n = input as never;
		dto.i = 1 as never;
		dto.b = true as never;

		const errs = validate(dto);
		Assert.empty(errs);

		Assert.equal(expected, dto.n);
	}

	private assertBooleanCoerceOk(input: unknown, expected: boolean) {
		const dto = new CoercionDto();
		dto.s = "x" as never;
		dto.n = 1.5 as never;
		dto.i = 1 as never;
		dto.b = input as never;

		const errs = validate(dto);
		Assert.empty(errs);

		Assert.equal(expected, dto.b);
	}

	///

	@Fact
	public stringCoerce_ok_string() {
		this.assertStringCoerceOk("hello", "hello");
	}

	@Fact
	public stringCoerce_ok_number() {
		this.assertStringCoerceOk(123, "123");
	}

	@Fact
	public stringCoerce_ok_boolean() {
		this.assertStringCoerceOk(true, "true");
	}

	@Fact
	public stringCoerce_rejectsTables() {
		const dto = new CoercionDto();
		dto.s = {} as never;
		dto.n = 1 as never;
		dto.i = 1 as never;
		dto.b = true as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
		Assert.equal("s", errs[0].property);
	}
	// --- Number coerce cases (formerly @Theory) ---

	@Fact
	public numberCoerce_ok_number() {
		this.assertNumberCoerceOk(10, 10);
	}

	@Fact
	public numberCoerce_ok_trimmedString() {
		this.assertNumberCoerceOk(" 10 ", 10);
	}

	@Fact
	public numberCoerce_ok_decimalString() {
		this.assertNumberCoerceOk("10.5", 10.5);
	}

	@Fact
	public numberCoerce_rejectsNonNumericString() {
		const dto = new CoercionDto();
		dto.s = "x" as never;
		dto.n = "nope" as never;
		dto.i = "nahuh" as never;
		dto.b = true as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
		Assert.equal("i", errs[0].property);
		Assert.equal("n", errs[1].property);
	}

	// --- Boolean coerce cases (formerly @Theory) ---

	@Fact
	public booleanCoerce_ok_true() {
		this.assertBooleanCoerceOk(true, true);
	}

	@Fact
	public booleanCoerce_ok_false() {
		this.assertBooleanCoerceOk(false, false);
	}

	@Fact
	public booleanCoerce_ok_stringTrue() {
		this.assertBooleanCoerceOk("true", true);
	}

	@Fact
	public booleanCoerce_ok_stringTrueUpperTrim() {
		this.assertBooleanCoerceOk(" TRUE ", true);
	}

	@Fact
	public booleanCoerce_ok_stringOne() {
		this.assertBooleanCoerceOk("1", true);
	}

	@Fact
	public booleanCoerce_ok_stringFalse() {
		this.assertBooleanCoerceOk("false", false);
	}

	@Fact
	public booleanCoerce_ok_stringZeroTrim() {
		this.assertBooleanCoerceOk(" 0 ", false);
	}

	@Fact
	public booleanCoerce_rejectsUnknownString() {
		const dto = new CoercionDto();
		dto.s = "x" as never;
		dto.n = 1 as never;
		dto.i = 1 as never;
		dto.b = "yes" as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
		Assert.equal("b", errs[0].property);
	}

	// --- Default ---

	@Fact
	public default_appliesOnlyWhenOptionalAndNil() {
		const dto = new DefaultDto();
		const res = parseInto(dto, {});

		Assert.true(res.ok);
		Assert.equal("en", dto.lang);
		Assert.defined(dto.counts);
	}

	@Fact
	public default_doesNotOverrideProvidedValue() {
		const dto = new DefaultDto();
		const res = parseInto(dto, { lang: "sv" });

		Assert.true(res.ok);
		Assert.equal("sv", dto.lang);
	}

	// --- Readonly ---

	@Fact
	public readonly_deepFreezesAndPreventsMutation() {
		const dto = new ReadonlyDto();
		const res = parseInto(dto, { data: { nested: { arr: [1, 2, 3] } } });

		Assert.true(res.ok);

		// Mutating a frozen table should throw in Luau.
		Assert.throws(() => {
			(dto.data.nested.arr as unknown as number[])[0] = 999;
		});
	}
}

export = CoercionTest;
