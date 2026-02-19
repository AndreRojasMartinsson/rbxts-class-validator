import { Fact, Assert } from "@rbxts/runit";
import {
	IsArray,
	ArrayMinSize,
	ArrayMaxSize,
	ArrayElements,
	IsTuple,
	TupleLength,
	Nested,
	IsNumber,
	Min,
	validate,
	parseInto,
	WithFrom,
} from "../../src";

class EngineDto extends WithFrom(class {}) {
	@IsNumber()
	@Min(1)
	public hp!: number;
}

class ObjectDto {
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(3)
	@ArrayElements((v) => (typeIs(v, "number") ? undefined : "must be number"), "bad elements")
	public nums!: unknown[];

	@IsTuple(
		(v) => (typeIs(v, "string") ? undefined : "must be string"),
		(v) => (typeIs(v, "number") ? undefined : "must be number"),
	)
	public pair!: unknown[];

	@TupleLength(3)
	public rgb!: unknown[];

	@Nested()
	public engine!: EngineDto;
}

class ObjectValidatorsTest {
	@Fact
	public arrayValidators_passValidArray() {
		const dto = new ObjectDto();
		const res = parseInto(dto, {
			nums: [1, 2],
			pair: ["x", 1],
			rgb: [255, 0, 10],
			engine: { hp: 200 },
		});
		Assert.true(res.ok);
		Assert.empty(validate(dto));
	}

	@Fact
	public arrayValidators_rejectBadElement() {
		const dto = new ObjectDto();
		dto.nums = [1, "x", 3] as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
		Assert.equal("nums", errs[0].property);
	}

	@Fact
	public tupleValidator_rejectsWrongLength() {
		const dto = new ObjectDto();
		dto.pair = ["x"] as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
		Assert.equal("pair", errs[2].property);
		Assert.equal("x", (errs[2].value as unknown[])[0]);
	}

	@Fact
	public tupleValidator_reportsElementErrors() {
		const dto = new ObjectDto();
		dto.pair = ["x", "nope"] as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
		Assert.equal("pair", errs[2].property);
	}

	@Fact
	public tupleLength_onlyEnforcesLength_len3_ok() {
		const dto = new ObjectDto();
		dto.rgb = [0, 0, 0] as never;

		const errs = validate(dto);
		Assert.equal(2, errs.size());
		Assert.equal("nums", errs[0].property);
		Assert.equal("pair", errs[1].property);
	}

	@Fact
	public tupleLength_onlyEnforcesLength_len2_fail() {
		const dto = new ObjectDto();
		dto.rgb = [0, 0] as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
	}

	@Fact
	public tupleLength_onlyEnforcesLength_len4_fail() {
		const dto = new ObjectDto();
		dto.rgb = [0, 0, 0, 0] as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
	}

	@Fact
	public nested_runsValidateOnChild() {
		const dto = new ObjectDto();
		const engine = EngineDto.from({
			hp: 1,
		}).await()[1] as EngineDto;

		engine.hp = 0;

		dto.pair = ["", 5];
		dto.rgb = [0, 0, 0];
		dto.engine = engine;
		dto.nums = [1, 2];

		const errs = validate(dto);
		Assert.notEmpty(errs);
		Assert.equal("engine", errs[0].property);
	}
}

export = ObjectValidatorsTest;
