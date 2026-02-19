import { Fact, Assert } from "@rbxts/runit";
import { IsString, MinLength, MaxLength, IsNumber, IsInteger, Min, Max, validate } from "../../src";

class StringDto {
	@IsString()
	@MinLength(3)
	@MaxLength(5)
	public s!: string;
}

class NumberDto {
	@IsNumber()
	@Min(0)
	@Max(10)
	public n!: number;

	@IsInteger()
	public i!: number;
}

class PrimitiveValidatorsTest {
	// --- stringLengthBounds (formerly @Theory) ---

	@Fact
	public stringLengthBounds_ok_abc() {
		const dto = new StringDto();
		dto.s = "abc" as never;

		const errs = validate(dto);
		Assert.empty(errs);
	}

	@Fact
	public stringLengthBounds_fail_tooShort_ab() {
		const dto = new StringDto();
		dto.s = "ab" as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
	}

	@Fact
	public stringLengthBounds_fail_tooLong_abcdef() {
		const dto = new StringDto();
		dto.s = "abcdef" as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
	}

	// --- numberMinMax (formerly @Theory) ---

	@Fact
	public numberMinMax_ok_0() {
		const dto = new NumberDto();
		dto.n = 0 as never;
		dto.i = 1 as never;

		const errs = validate(dto);
		Assert.empty(errs);
	}

	@Fact
	public numberMinMax_ok_10() {
		const dto = new NumberDto();
		dto.n = 10 as never;
		dto.i = 1 as never;

		const errs = validate(dto);
		Assert.empty(errs);
	}

	@Fact
	public numberMinMax_fail_belowMin_minus1() {
		const dto = new NumberDto();
		dto.n = -1 as never;
		dto.i = 1 as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
	}

	@Fact
	public numberMinMax_fail_aboveMax_11() {
		const dto = new NumberDto();
		dto.n = 11 as never;
		dto.i = 1 as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
	}

	// --- integerValidator (formerly @Theory) ---

	@Fact
	public integerValidator_ok_0() {
		const dto = new NumberDto();
		dto.n = 0 as never;
		dto.i = 0 as never;

		const errs = validate(dto);
		Assert.empty(errs);
	}

	@Fact
	public integerValidator_ok_10() {
		const dto = new NumberDto();
		dto.n = 0 as never;
		dto.i = 10 as never;

		const errs = validate(dto);
		Assert.empty(errs);
	}

	@Fact
	public integerValidator_ok_minus3() {
		const dto = new NumberDto();
		dto.n = 0 as never;
		dto.i = -3 as never;

		const errs = validate(dto);
		Assert.empty(errs);
	}

	@Fact
	public integerValidator_fail_decimal_1_5() {
		const dto = new NumberDto();
		dto.n = 0 as never;
		dto.i = 1.5 as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
	}

	@Fact
	public isString_rejectsNonString() {
		const dto = new StringDto();
		dto.s = 123 as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
		Assert.equal("s", errs[0].property);
	}
}

export = PrimitiveValidatorsTest;
