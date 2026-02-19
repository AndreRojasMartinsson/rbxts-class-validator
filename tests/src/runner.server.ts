import { instrument, istanbul } from "@rbxts/coverage";
import { TestRunner } from "@rbxts/runit";
import { HttpService, ReplicatedStorage } from "@rbxts/services";

instrument([ReplicatedStorage.WaitForChild("lib")]);

function createCoverage() {
	const report = istanbul();
	const [json] = HttpService.JSONEncode(report).gsub(
		'"ReplicatedStorage/Library/([^"]+)"',
		'"out/%1.luau"',
	);

	const coverage = new Instance("StringValue");

	coverage.Name = "__cov";
	coverage.Parent = ReplicatedStorage;
	coverage.Value = json;
}

async function run() {
	const runner = new TestRunner(ReplicatedStorage.WaitForChild("tests"));

	try {
		await runner.run({ colors: true });

		createCoverage();
	} catch {
		error("Failed to run tests");
	}
}

void run();
