
/*
 * A piano-roll style notes editor in a javascript canvas.
 *
 */

// Each note has an:
// instrument (arbitrary value),
// start (in beats),
// pitch (midi note #),
// and duration (in beats)
export class Note {
	constructor(instrument, start, pitch, duration = 1) {
		//(no constraints on instrument)

		//start must be a number:
		if (typeof start !== "number") {
			throw new Error(`Note's start should be a number, got '${typeof start}'.`);
		}
		//could probably also constrain to be finite, but let's not get too picky.

		//pitch should be a midi note #:
		// (at some point, should probably also parse textual note values)
		if (typeof pitch !== "number") {
			throw new Error(`Note cannot be constructed from value of type '${typeof pitch}'.`);
		}
		if (pitch !== Math.round(pitch) || pitch < 0 || pitch > 127) {
			throw new Error(`Number ${pitch} is not a midi note number (integer, [0,127]).`);
		}

		//duration must be a non-negative number:
		if (typeof duration !== "number") {
			throw new Error(`Note's duration should be a number, got '${typeof duration}'.`);
		}
		if (!isFinite(duration) || duration < 0) {
			throw new Error(`Note's duration should be non-negative (got '${duration}').`);
		}

		//parameters look valid; construct the note:
		this.instrument = instrument;
		this.start = start;
		this.pitch = pitch;
		this.duration = duration;
	}
}

//fill styles used for note lane backgrounds:
const WHITE_KEY_FILL = "#f0f0f0";
const BLACK_KEY_FILL = "#e0e0e0";
const PITCH_FILL = [
	WHITE_KEY_FILL,
		BLACK_KEY_FILL,
	WHITE_KEY_FILL,
		BLACK_KEY_FILL,
	WHITE_KEY_FILL,
	WHITE_KEY_FILL,
		BLACK_KEY_FILL,
	WHITE_KEY_FILL,
		BLACK_KEY_FILL,
	WHITE_KEY_FILL,
		BLACK_KEY_FILL,
	WHITE_KEY_FILL,
];

//stroke style for note lane dividing line:
const PITCH_STROKE = "#cccccc";

//stroke style for beat line:
const BEAT_STROKE = "#cccccc";

//stroke style for measure line:
const MEASURE_STROKE = "#bbbbbb";

export default class Notes {
	constructor(elt) {
		if (typeof elt !== "object") {
			throw new Error(`Notes class must be constructed with an object as a parameter.`);
		}
		if (elt.tagName !== "CANVAS") {
			throw new Error(`Notes class must be attached to a 'CANVAS', got a '${elt.tagName}'`);
		}

		//associate with a canvas element:
		this.canvas = elt;
		this.ctx = this.canvas.getContext('2d', {
			alpha:false,
			colorSpace:"srgb", //srgb is the default, also
			colorType:"unorm8", //unorm8 is the default, also
			//optimization hints:
			desynchronized:false,
			willReadFrequently:false,
		});

		//actual data: (internally as midi note numbers)
		this.bpm = 120; //disco :-)
		this.measureBeats = 4;
		this.notes = [
			new Note("cf", 0, 48, 1),
			new Note("cf", 1, 50, 1),
			new Note("cf", 2, 52, 1),
			new Note("cf", 3, 53, 1),
			new Note("cf", 4, 55, 1),
			new Note("cf", 5, 57, 1),
			new Note("cf", 6, 59, 1),
			new Note("cf", 7, 60, 1),
		];

		//view bounds:
		this.view = {
			//horizontal axis, in beats:
			beatMin:0,
			beatMax:8,
			//vertical axis, in pitches (midi note #'s)
			pitchMin:48,
			pitchMax:48 + 12*2,
			//NOTE: vertical axis might be non-linear if doing scale elision.
		};

		//mouse position and hover info:
		this.mouse = {
			x:NaN,
			y:NaN,
		};

		//register event handlers:
		elt.addEventListener('mousedown', (evt) => {
			this.mousedown(evt);
		});
		elt.addEventListener('mouseup', (evt) => {
			this.mouseup(evt);
		});
		elt.addEventListener('mousemove', (evt) => {
			this.setMouse(evt);
		});
		elt.addEventListener('mouseenter', (evt) => {
			this.setMouse(evt);
		});
		elt.addEventListener('mouseleave', (evt) => {
			this.mouse.x = NaN;
			this.mouse.y = NaN;
			this.requestRedraw();
		});

		{ //trigger redraw on size changes:
			const observer = new ResizeObserver( () => {
				this.requestRedraw();
			} );
			observer.observe(this.canvas);
		}

		//do an eager redraw right now:
		this.redraw();

		window.NOTES = this; //DEBUG
	}

	setMouse(evt) {
		const rect = this.canvas.getBoundingClientRect();
		const style = getComputedStyle(this.canvas);

		//mouse position, relative to content area:
		let x = evt.clientX - rect.left;
		let y = evt.clientY - rect.top;

		if (style.boxSizing === 'border-box') {
			//rect already was content area
		} else { //assume 'content-box', the default
			x -= parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
			y -= parseFloat(style.paddingTop) + parseFloat(style.borderTopWidth);
		}

		//convert to device pixels:
		x *= devicePixelRatio;
		y *= devicePixelRatio;

		if (!this.mouse || this.mouse.x !== x || this.mouse.y !== y) {
			this.mouse.x = x;
			this.mouse.y = y;
			this.requestRedraw();
		}
	}

	//view transforms:
	beatToX(beat) {
		return (beat - this.view.beatMin) / (this.view.beatMax - this.view.beatMin) * this.canvas.width;
	}
	xToBeat(x) {
		return x / this.canvas.width * (this.view.beatMax - this.view.beatMin) + this.beatMin;
	}
	pitchToY(pitch) {
		const height = this.canvas.height;
		return height - (pitch - this.view.pitchMin) / (this.view.pitchMax - this.view.pitchMin) * this.canvas.height;
	}
	yToPitch(y) {
		const height = this.canvas.height;
		return (height - y) / height * (this.view.pitchMax - this.view.pitchMin) + this.view.pitchMin;
	}

	redraw() {
		{ //make sure canvas pixels are the same size as display pixels:
			const style = getComputedStyle(this.canvas);

			this.canvas.width = Math.round(devicePixelRatio * parseFloat(style.width));
			this.canvas.height = Math.round(devicePixelRatio * parseFloat(style.height));
		}

		const ctx = this.ctx;
		const width = this.canvas.width;
		const height = this.canvas.height;
		const px = devicePixelRatio;

		//transform matrix: upper left origin, 1 device pixel per step in X and Y.
		ctx.setTransform(1,0, 0,1, 0,0);

		//erase all previous drawing: (redundant since we're about to draw background; but can be a good hint to discard the old canvas)
		ctx.clearRect(0,0, width,height);

		//background:
		ctx.fillStyle = '#eee';
		ctx.fillRect(0,0, width,height);

		{ //note lanes:
			const min = Math.floor(this.view.pitchMin);
			const max = Math.floor(this.view.pitchMax);

			//backgrounds:
			for (let p = min; p <= max; p += 1) {
				const y0 = this.pitchToY(p+1);
				const y1 = this.pitchToY(p);
				ctx.fillStyle = PITCH_FILL[p % PITCH_FILL.length];
				ctx.fillRect(0,y0, width, (y1-y0));
			}

			//dividing lines:
			ctx.beginPath();
			for (let p = min; p <= max; p += 1) {
				const y = this.pitchToY(p);
				ctx.moveTo(0,y);
				ctx.lineTo(width,y);
			}
			ctx.strokeStyle = PITCH_STROKE;
			ctx.lineWidth = px; //one layout pixel wide
			ctx.stroke();
		}

		{ //beat / measure lines:
			const min = Math.ceil( this.view.beatMin );
			const max = Math.floor( this.view.beatMax );
			//beat lines:
			ctx.beginPath();
			for (let b = min; b <= max; b += 1) {
				if (b % this.measureBeats !== 0) {
					const x = this.beatToX(b);
					ctx.moveTo(x,0);
					ctx.lineTo(x,height);
				}
			}
			ctx.strokeStyle = BEAT_STROKE;
			ctx.lineWidth = px;
			ctx.stroke();
			//measure lines:
			ctx.beginPath();
			for (let b = min; b <= max; b += 1) {
				if (b % this.measureBeats === 0) {
					const x = this.beatToX(b);
					ctx.moveTo(x,0);
					ctx.lineTo(x,height);
				}
			}
			ctx.strokeStyle = MEASURE_STROKE;
			ctx.lineWidth =2 * px;
			ctx.stroke();

		}

		if (this.mouse) { //mouse cursor (DEBUG)
			ctx.beginPath();
			ctx.moveTo(this.mouse.x - 10, this.mouse.y - 10);
			ctx.lineTo(this.mouse.x + 10, this.mouse.y + 10);
			ctx.moveTo(this.mouse.x - 10, this.mouse.y + 10);
			ctx.lineTo(this.mouse.x + 10, this.mouse.y - 10);
			ctx.strokeWidth = px;
			ctx.strokeStyle = "#000";
			ctx.stroke();
		}

	}

	requestRedraw() {
		if (this.redrawPending) return;
		this.redrawPending = true;
		window.requestAnimationFrame( () => {
			this.redraw();
			delete this.redrawPending;
		} );
	}
};
