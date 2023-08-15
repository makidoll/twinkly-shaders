import axios, { AxiosResponse } from "axios";
import { randomBytes } from "crypto";
import * as udp from "dgram";

interface Color {
	r: number;
	g: number;
	b: number;
	w?: number;
}

class RealtimeTwinkly {
	private authToken: string;
	private authTokenBuffer: Buffer;

	public numberOfLeds: number;
	public bytesPerLed: number;
	public frameRate: number;

	private udpClient: udp.Socket;

	constructor(public readonly ip: string) {}

	// https://xled-docs.readthedocs.io/en/latest/rest_api.html

	private errors = {
		1000: "OK",
		1001: "Error",
		1101: "Invalid argument value",
		1102: "Error",
		1103: "Error - value too long? Or missing required object key?",
		1104: "Error - malformed JSON on input?",
		1105: "Invalid argument key",
		1107: "Ok?",
		1108: "Ok?",
		1205: "Error with firmware upgrade - SHA1SUM does not match",
	};

	private handleError(res: AxiosResponse) {
		const code = res.data.code;
		if (code != 1000) {
			throw new Error(code + ": " + this.errors[code]);
		}
	}

	private async getInfo() {
		const res = await axios("http://" + this.ip + "/xled/v1/gestalt", {
			method: "GET",
		});

		this.handleError(res);

		this.numberOfLeds = res.data.number_of_led;
		this.bytesPerLed = res.data.bytes_per_led;
		this.frameRate = res.data.frame_rate;
		// res.data.measured_frame_rate;

		return res.data;
	}

	private async loginAndVerify() {
		const loginRes = await axios("http://" + this.ip + "/xled/v1/login", {
			method: "POST",
			data: {
				challenge: randomBytes(256).toString("hex"),
			},
		});

		this.handleError(loginRes);

		this.authToken = loginRes.data.authentication_token;
		this.authTokenBuffer = Buffer.from(this.authToken, "base64");

		const verifyRes = await axios("http://" + this.ip + "/xled/v1/verify", {
			method: "POST",
			headers: {
				"X-Auth-Token": this.authToken,
			},
			data: {
				"challenge-response": loginRes.data["challenge-response"],
			},
		});

		this.handleError(verifyRes);
	}

	private async setMode(mode: string) {
		const res = await axios("http://" + this.ip + "/xled/v1/led/mode", {
			method: "POST",
			headers: {
				"X-Auth-Token": this.authToken,
			},
			data: {
				mode,
			},
		});
		this.handleError(res);
		return res.data;
	}

	private async sendFrameFragment(fragment: number, frame: Uint8Array) {
		if (frame.length > 900) {
			throw new Error(
				"Can't send frame fragment bigger than 900 in length",
			);
		}

		// https://xled-docs.readthedocs.io/en/latest/protocol_details.html#version-3

		const header = Buffer.alloc(this.authTokenBuffer.length + 4);

		header.writeUInt8(0x03);
		header.fill(this.authTokenBuffer, 1);
		header.writeUInt8(0x00, this.authTokenBuffer.length + 1);
		header.writeUInt8(0x00, this.authTokenBuffer.length + 2);
		header.writeUInt8(fragment, this.authTokenBuffer.length + 3);

		const data = Buffer.alloc(header.length + frame.length);
		data.fill(header);
		data.fill(frame, header.length);

		this.udpClient.send(data, 7777, this.ip, error => {
			if (error) {
				console.warn(error);
			}
		});
	}

	async init() {
		await this.loginAndVerify();
		await this.getInfo();
		await this.setMode("rt");

		if (this.udpClient) this.udpClient.close();
		this.udpClient = udp.createSocket("udp4");
	}

	private async sendFrameArray(frame: Uint8Array) {
		// seperate into arrays of 900

		let fragment = 0;
		const fragmentSize = 900;

		for (let i = 0; i < frame.length; i += fragmentSize) {
			const fragmentedFrame = frame.slice(i, i + fragmentSize);
			this.sendFrameFragment(fragment, fragmentedFrame);
			fragment++;
		}
	}

	async sendFrame(frame: Color[]) {
		const frameArray = new Uint8Array(this.numberOfLeds * this.bytesPerLed);

		for (let i = 0; i < frame.length; i++) {
			const color = frame[i];

			if (this.bytesPerLed == 3) {
				frameArray[i * 3 + 0] = color.r;
				frameArray[i * 3 + 1] = color.g;
				frameArray[i * 3 + 2] = color.b;
			} else if (this.bytesPerLed == 4) {
				frameArray[i * 4 + 0] = color.w ?? 0;
				frameArray[i * 4 + 1] = color.r;
				frameArray[i * 4 + 2] = color.g;
				frameArray[i * 4 + 3] = color.b;
			} else {
				throw new Error(
					"Don't know how to handle " +
						this.bytesPerLed +
						" bytes per led",
				);
			}
		}

		this.sendFrameArray(frameArray);
	}
}

const GnomeDarkStripesColors = [
	{ r: 0x24, g: 0x1f, b: 0x31 },
	{ r: 0x30, g: 0x22, b: 0x3b },
	{ r: 0x4e, g: 0x25, b: 0x4a },
	{ r: 0x56, g: 0x24, b: 0x4b },
	{ r: 0x5f, g: 0x24, b: 0x4c },
	{ r: 0x67, g: 0x23, b: 0x4d },
	{ r: 0x70, g: 0x23, b: 0x4e },
	{ r: 0x92, g: 0x1f, b: 0x48 },
	{ r: 0xaf, g: 0x24, b: 0x38 },
	{ r: 0xb3, g: 0x29, b: 0x31 },
	{ r: 0xb8, g: 0x2e, b: 0x2a },
	{ r: 0xbc, g: 0x33, b: 0x23 },
	{ r: 0xc1, g: 0x38, b: 0x1d },
	{ r: 0xc6, g: 0x46, b: 0x00 },
	{ r: 0xe6, g: 0x61, b: 0x00 },
];

// gamma correct
for (let i = 0; i < GnomeDarkStripesColors.length; i++) {
	GnomeDarkStripesColors[i] = {
		r: Math.pow(GnomeDarkStripesColors[i].r / 255, 2.2) * 255,
		g: Math.pow(GnomeDarkStripesColors[i].g / 255, 2.2) * 255,
		b: Math.pow(GnomeDarkStripesColors[i].b / 255, 2.2) * 255,
	};
}

function gnomeDarkStripes(size: number, offset: number = 0) {
	// it should mirror
	// the first and last 2's add up to 4 when mirrored
	const c = GnomeDarkStripesColors;
	// prettier-ignore
	const pattern = [
		// 2, 4
		c[0], c[0],
		c[1], c[1], c[1], c[1],
		// 1, 1, 1, 1
		c[2],c[3],c[4],c[5],
		// 4, 4
		c[6],c[6],c[6],c[6],
		c[7],c[7],c[7],c[7],
		// 1, 1, 1, 1
		c[8],c[9],c[10],c[11],
		// 4, 4, 2
		c[12],c[12],c[12],c[12],
		c[13],c[13],c[13],c[13],
		c[14],c[14],
	];

	const frame: Color[] = [];

	for (let forIndex = 0; forIndex < size; forIndex++) {
		const i = forIndex + offset;

		let patternIndex = i % pattern.length;

		if ((i / pattern.length) % 2 >= 1) {
			patternIndex = pattern.length - 1 - patternIndex;
		}

		frame.push(pattern[patternIndex]);
	}

	return frame;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function lerpFrame(a: Color[], b: Color[], t: number) {
	const length = Math.min(a.length, b.length);

	let out: Color[] = [];

	for (let i = 0; i < length; i++) {
		out.push({
			r: lerp(a[i].r, b[i].r, t),
			g: lerp(a[i].g, b[i].g, t),
			b: lerp(a[i].b, b[i].b, t),
			w: a[i].w != null && b[i].w != null ? lerp(a[i].b, b[i].b, t) : 0,
		});
	}

	return out;
}

(async () => {
	const twinkly = new RealtimeTwinkly("192.168.1.113");
	await twinkly.init();

	const offsetPerSecond = 3;

	const startTime = Date.now() / 1000;

	setInterval(async () => {
		let time = Date.now() / 1000 - startTime;

		let scaledTime = time * offsetPerSecond;
		let offset = Math.floor(scaledTime);
		let t = scaledTime % 1;

		const a = gnomeDarkStripes(twinkly.numberOfLeds, offset);
		const b = gnomeDarkStripes(twinkly.numberOfLeds, offset + 1);

		await twinkly.sendFrame(lerpFrame(a, b, t));
	}, 1000 / twinkly.frameRate);
})();
