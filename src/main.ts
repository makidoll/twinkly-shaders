import { Context, Hono } from "https://deno.land/x/hono@v3.10.0/mod.ts";
import { Easing } from "./easing-functions.ts";
import { TweenManager } from "./tween-manager.ts";
import {
	Color,
	GnomeDarkStripesPattern,
	Twinkly,
	gnomeDarkStripes,
	lerpFrame,
	randomHexString,
} from "./twinkly.ts";

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

let currentlySettingBrightness = false;
let currentlySettingBrightnessReqId: string;

const opacityTweener = tweenManager.newTweener(
	async o => {
		if (currentlySettingBrightness) {
			return;
		}
		// only set brightness if we're able to
		try {
			currentlySettingBrightness = true;
			await twinkly.setBrightness(o);
		} catch (e) {
		} finally {
			currentlySettingBrightness = false;
		}
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

		const time = 2000;
		opacityTweener.tween(active ? 1 : 0, time, Easing.Out);

		// make sure we send a final request to ensure
		let reqId = randomHexString(8);
		currentlySettingBrightnessReqId = reqId;

		const ensureBrightness = async () => {
			if (currentlySettingBrightnessReqId != reqId) {
				// already transitioning to something else
				return;
			}
			// TODO: should cancel other req
			await twinkly.setBrightness(active ? 1 : 0);
		};

		setTimeout(ensureBrightness, time);
		setTimeout(ensureBrightness, time * 1.5);
	} catch (error) {}

	return c.json({ active });
});

Deno.serve({ port: Number(Deno.env.get("PORT") ?? 12345) }, app.fetch);
