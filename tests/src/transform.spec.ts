import { Fact, Assert } from "@rbxts/runit";
import { Transform, IsString, IsNumber, Coerce, parseInto, validate } from "../../src";

class TransformDto {
	@IsString()
	@Transform.Trim()
	@Transform.Lowercase()
	public name!: string;

	@Coerce.Number()
	@IsNumber()
	@Transform.Map((v) => (v as number) + 1)
	public level!: number;

	@Transform.ArrayMap((v) => (v as number) * 2)
	public nums!: number[];
}

class TransformTest {
	@Fact
	public trimAndLowercase_runsAfterValidation() {
		const dto = new TransformDto();
		const res = parseInto(dto, { name: "  HeLLo  ", level: 1, nums: [1, 2] });

		Assert.true(res.ok);
		Assert.equal("hello", dto.name);
	}

	@Fact
	public transformMap_runsAfterCoerceAndValidation() {
		const dto = new TransformDto();
		const res = parseInto(dto, { name: "ok", level: "9", nums: [1] });

		Assert.true(res.ok);
		Assert.equal(10, dto.level); // "9" -> 9 -> +1 => 10
	}

	@Fact
	public arrayMap_rejectsNonTables_string() {
		const dto = new TransformDto();
		dto.name = "ok" as never;
		dto.level = 1 as never;
		dto.nums = "not-a-table" as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
		Assert.equal("nums", errs[0].property);
	}

	@Fact
	public arrayMap_rejectsNonTables_number() {
		const dto = new TransformDto();
		dto.name = "ok" as never;
		dto.level = 1 as never;
		dto.nums = 123 as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
		Assert.equal("nums", errs[0].property);
	}

	@Fact
	public arrayMap_mapsArrayValues() {
		const dto = new TransformDto();
		const res = parseInto(dto, { name: "ok", level: 1, nums: [2, 3, 4] });

		Assert.true(res.ok);
		Assert.equal(4, dto.nums[0]);
		Assert.equal(6, dto.nums[1]);
		Assert.equal(8, dto.nums[2]);
	}
}

export = TransformTest;
