import { Context, Hono } from "https://deno.land/x/hono@v3.10.0/mod.ts";
import { TweenManager } from "./tween-manager.ts";
import { Color, Twinkly, gnomeDarkStripes, lerpFrame } from "./twinkly.ts";
import { Easing } from "./easing-functions.ts";

const twinkly = new Twinkly("192.168.1.113");
await twinkly.initRealtime();

const offsetPerSecond = 3;

const startTime = Date.now() / 1000;

const tweenManager = new TweenManager();

let active = true;
let opacity = 1;
const opacityTweener = tweenManager.newTweener(o => {
	opacity = o;
}, 1);

const blankFrame = new Array<Color>(twinkly.numberOfLeds).fill({
	r: 0,
	g: 0,
	b: 0,
});

setInterval(async () => {
	tweenManager.update();

	if (opacity == 0) {
		await twinkly.sendFrame(blankFrame);
		return;
	}

	let time = Date.now() / 1000 - startTime;

	let scaledTime = time * offsetPerSecond;
	let offset = Math.floor(scaledTime);
	let t = scaledTime % 1;

	const a = gnomeDarkStripes(twinkly.numberOfLeds, offset);
	const b = gnomeDarkStripes(twinkly.numberOfLeds, offset + 1);

	const frame = lerpFrame(a, b, t);

	await twinkly.sendFrame(
		opacity == 1 ? frame : lerpFrame(blankFrame, frame, opacity),
	);
}, 1000 / twinkly.frameRate);

const app = new Hono();

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
