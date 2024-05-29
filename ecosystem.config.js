module.exports = {
	apps: [
		{
			name: "Twinkly Shaders",
			interpreter: "deno",
			interpreter_args: "run -A --unstable-net",
			script: "src/main.ts",
		},
	],
};
