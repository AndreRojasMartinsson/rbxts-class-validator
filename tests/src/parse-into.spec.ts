import { Fact, Assert } from "@rbxts/runit";
import { Coerce, Transform, IsNumber, Min, parseInto, validate } from "../../src";

class PipelineDto {
	@Coerce.Number()
	@IsNumber()
	@Min(10) // must be >=10
	@Transform.Map((v) => (v as number) + 1000)
	public n!: number;
}

class ParseIntoDto {
	@Coerce.Number()
	@IsNumber()
	public n!: number;
}

class ValidationParseIntoTest {
	@Fact
	public validate_order_isCoerce_thenValidate_thenTransform() {
		const dto = new PipelineDto();

		// Start with string: should coerce -> validate -> transform
		const ok = parseInto(dto, { n: "10" });
		Assert.true(ok.ok);
		Assert.equal(1010, dto.n);
	}

	@Fact
	public transform_doesNotRunWhenValidationFails() {
		const dto = new PipelineDto();

		const res = parseInto(dto, { n: "9" }); // coerces to 9, fails Min(10)
		Assert.false(res.ok);

		// Crucial: parseInto should NOT have committed the staged value into dto.
		Assert.equal(undefined, (dto as unknown as { n?: number }).n);
	}

	@Fact
	public parseInto_rejectsUnknownKeys_beforeAnythingElse() {
		const dto = new ParseIntoDto();
		const res = parseInto(dto, { n: "1", extra: 123 });

		Assert.false(res.ok);
	}

	@Fact
	public validate_canMutateObject_whenCoercing() {
		// validate(obj) mutates the object (by design), unlike parseInto().
		const dto = new ParseIntoDto();
		(dto as unknown as { n: unknown }).n = "5";

		const errs = validate(dto);
		Assert.empty(errs);
		Assert.equal(5, dto.n);
	}
}

export = ValidationParseIntoTest;
