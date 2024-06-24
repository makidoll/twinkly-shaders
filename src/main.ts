import { Context, Hono } from "https://deno.land/x/hono@v3.10.0/mod.ts";
import { TweenManager } from "./tween-manager.ts";
import {
	Color,
	GnomeDarkStripesPattern,
	Twinkly,
	gnomeDarkStripes,
	lerpFrame,
} from "./twinkly.ts";
import { Easing } from "./easing-functions.ts";

const init = Deno.args.includes("--init");

const twinkly = new Twinkly("192.168.1.113");
await twinkly.initMovies(init);

if (init) {
	const offsetPerSecond = 3;

	// pattern.length / 3 doesnt divide so multiply to find a common denominator
	const seconds = GnomeDarkStripesPattern.length * 2 * offsetPerSecond;

	const frames: Color[][] = [];

	for (let time = 0; time < seconds; time += 1 / twinkly.frameRate) {
		let scaledTime = time * offsetPerSecond;
		let offset = Math.floor(scaledTime);
		let t = scaledTime % 1;

		const a = gnomeDarkStripes(twinkly.numberOfLeds, offset);
		const b = gnomeDarkStripes(twinkly.numberOfLeds, offset + 1);

		const frame = lerpFrame(a, b, t);

		frames.push(frame);
	}

	await twinkly.addMovie("Maki", "rgb_raw", twinkly.frameRate, frames);

	console.log("Finished uploading movies");
}

await twinkly.setMovie(0, false);

const tweenManager = new TweenManager();

let active = (await twinkly.getMode()) == "movie";

const opacityTweener = tweenManager.newTweener(
	async o => {
		await twinkly.setBrightness(o);
	},
	active ? 1 : 0,
);

setInterval(async () => {
	tweenManager.update();
}, 1000 / twinkly.frameRate);

const app = new Hono();

app.get("/api/active", async (c: Context) => {
	return c.json({ active });
});

app.post("/api/active", async (c: Context) => {
	try {
		const body = await c.req.json();
		if (body.active == null) throw new Error();

		active = body.active;
		opacityTweener.tween(active ? 1 : 0, 2000, Easing.Out);
	} catch (error) {}

	return c.json({ active });
});

Deno.serve({ port: Number(Deno.env.get("PORT") ?? 12345) }, app.fetch);
