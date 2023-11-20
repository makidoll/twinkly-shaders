module.exports = {
	apps: [
		{
			name: "Twinkly Shaders",
			interpreter: "deno",
			interpreter_args: "run --allow-net --unstable",
			script: "main.ts",
		},
	],
};
