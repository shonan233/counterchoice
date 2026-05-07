
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

//drawing style for notes (per instrument):
const INSTRUMENT_STYLE = {
	"cf": {fill:'#eb8', stroke:'#888'},
	"cp": {fill:'#ef0', stroke:'#aaa'},
};
const INSTRUMENT_STYLE_DEFAULT = {fill:'#eee', stroke:'#999'};

function noteStyle(note) {
	if (note.instrument in INSTRUMENT_STYLE) {
		return INSTRUMENT_STYLE[note.instrument];
	} else {
		return INSTRUMENT_STYLE_DEFAULT;
	}
}

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
			//overBeat (when inside the canavs)
			//overPitch (when inside the canvas)
			//overNote (when over a note)
		};

		//register event handlers:
		elt.addEventListener('mousedown', (evt) => {
			this.setMouse(evt);

			const mouse = this.mouse;

			if (evt.button === 0) {
				this.startLift();
			}
			
			evt.preventDefault();
			return false;
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

	//[create and] lift (start moving) a note:
	startLift() {
		const mouse = this.mouse;

		this.updateOver();

		let note;
		let remove;
		if ('overNote' in mouse) {
			note = mouse.overNote;
			remove = true; //remove if no movement
		} else {
			note = new Note("cf", mouse.overBeat, mouse.overPitch, 1);
			this.notes.push(note);
			remove = false; //never remove if just created
		}
		this.lifted = {
			note,
			newStart:note.start, newPitch:note.pitch,
			dBeat:note.start - this.xToBeat(this.mouse.x),
			dPitch:note.pitch - this.yToPitch(this.mouse.y),
			remove,
		};
		this.requestRedraw();

		// event handlers to deal with the rest of the drag
		// (installing on the window to deal with dragging outside the canvas)

		const moveListener = (evt) => {
			if (!('lifted' in this)) {
				//should generally not happen since this handler will be removed on button lift.
				//but, just in case:
				return;
			}

			this.setMouse(evt);

			const newStart = Math.round( this.xToBeat(this.mouse.x) + this.lifted.dBeat );
			const newPitch = Math.round( this.yToPitch(this.mouse.y) + this.lifted.dPitch );

			if (newStart !== this.lifted.newStart || newPitch !== this.lifted.newPitch) {
				this.lifted.newStart = newStart;
				this.lifted.newPitch = newPitch;
				this.lifted.remove = false; //if moved, don't delete
				this.updateOver();
				this.requestRedraw(); //<-- likely redundant because setMouse will call if mouse moved
			}
		};

		const upListener = (evt) => {
			//only care about the main button being released:
			if (evt.button !== 0) return;

			if ('lifted' in this) {
				//if moved outside the visible (or valid) region, mark note for removal:
				if (!this.liftHasValidDrop()) {
					this.lifted.remove = true;
				}

				//if note tagged for removal, remove it:
				if (this.lifted.remove) {
					const idx = this.notes.indexOf(this.lifted.note);
					console.log(idx);
					if (idx !== -1) {
						this.notes.splice(idx, 1);
					}
				} else {
					this.lifted.note.pitch = this.lifted.newPitch;
					this.lifted.note.start = this.lifted.newStart;

					//remove any other notes from same instrument with same start:
					this.notes = this.notes.filter( (note) => {
						return note.instrument !== this.lifted.note.instrument
						 || note.start !== this.lifted.note.start
						 || note === this.lifted.note;
					});
				}
				delete this.lifted;
				this.updateOver();
				this.requestRedraw();
			}

			window.removeEventListener('mouseup', upListener);
			window.removeEventListener('mousemove', moveListener);
			evt.preventDefault();
			return false;
		};


		//can't just use 'once' option for mouseup because multi-button mice exist :-/
		window.addEventListener('mouseup', upListener);
		window.addEventListener('mousemove', moveListener);
	}

	liftHasValidDrop() {
		if (!('lifted' in this)) return false;
		const lifted = this.lifted;
		const view = this.view;
		//must be within view:
		return view.beatMin < lifted.newStart + 1 && lifted.newStart < view.beatMax
		    && view.pitchMin < lifted.newPitch + 1 && lifted.newPitch <view.pitchMax
		//also must have valid values in general:
		    && 0 <= lifted.newStart
		    && 0 <= lifted.newPitch && lifted.newPitch <= 127;
	}

	//view transforms:
	beatToX(beat) {
		return (beat - this.view.beatMin) / (this.view.beatMax - this.view.beatMin) * this.canvas.width;
	}
	xToBeat(x) {
		return x / this.canvas.width * (this.view.beatMax - this.view.beatMin) + this.view.beatMin;
	}
	pitchToY(pitch) {
		const height = this.canvas.height;
		return height - (pitch - this.view.pitchMin) / (this.view.pitchMax - this.view.pitchMin) * this.canvas.height;
	}
	yToPitch(y) {
		const height = this.canvas.height;
		return (height - y) / height * (this.view.pitchMax - this.view.pitchMin) + this.view.pitchMin;
	}

	updateOver() {
		const mouse = this.mouse;

		delete mouse.overNote;
		delete mouse.overPitch;
		delete mouse.overBeat;

		if (!(isFinite(mouse.x) && isFinite(mouse.y))) return;

		mouse.overPitch = Math.floor(this.yToPitch(mouse.y));
		mouse.overBeat = Math.floor(this.xToBeat(mouse.x));

		for (const note of this.notes) {
			let x0 = this.beatToX(note.start);
			let x1 = this.beatToX(note.start + note.duration);
			let y0 = this.pitchToY(note.pitch + 1);
			let y1 = this.pitchToY(note.pitch);

			if (x0 <= mouse.x && mouse.x <= x1
			 && y0 <= mouse.y && mouse.y <= y1) {
				mouse.overNote = note;
			}
		}
	}

	redraw() {
		{ //make sure canvas pixels are the same size as display pixels:
			const style = getComputedStyle(this.canvas);

			this.canvas.width = Math.round(devicePixelRatio * parseFloat(style.width));
			this.canvas.height = Math.round(devicePixelRatio * parseFloat(style.height));
		}

		//update what the mouse is over:
		this.updateOver();

		const mouse = this.mouse;
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

		{ //highlight beat/measure
			if ('overPitch' in mouse) {
				const y0 = this.pitchToY(mouse.overPitch+1);
				const y1 = this.pitchToY(mouse.overPitch);
				ctx.fillStyle = '#ff02';
				ctx.fillRect(0,y0, width,y1-y0);
			}
			/* time alignment is not so tricky, so don't bother with this highlight:
			if ('overBeat' in mouse) {
				const x0 = this.beatToX(mouse.overBeat);
				const x1 = this.beatToX(mouse.overBeat+1);
				ctx.fillStyle = '#ff02';
				ctx.fillRect(x0,0, x1-x0,height);
			}
			*/
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
			ctx.lineWidth = 2*px;
			ctx.stroke();
		}

		//the notes themselves:
		for (const note of this.notes) {
			//draw lifted notes later:
			if (this.lifted && this.lifted.note === note) continue;

			const x0 = this.beatToX(note.start);
			const x1 = this.beatToX(note.start + note.duration);
			const y0 = this.pitchToY(note.pitch + 1);
			const y1 = this.pitchToY(note.pitch);

			const ns = noteStyle(note);

			ctx.fillStyle = ns.fill;
			ctx.fillRect(x0,y0, x1-x0, y1-y0);

			ctx.strokeStyle = ns.stroke;
			ctx.lineWidth = 2*px;
			ctx.strokeRect(x0,y0, x1-x0, y1-y0);
		}

		if (this.lifted) {
			const note = this.lifted.note;
			if (this.liftHasValidDrop()) {
				//draw drop location
				const x0 = this.beatToX(this.lifted.newStart);
				const x1 = this.beatToX(this.lifted.newStart + note.duration);
				const y0 = this.pitchToY(this.lifted.newPitch + 1);
				const y1 = this.pitchToY(this.lifted.newPitch);

				ctx.strokeStyle = "#000";
				ctx.lineWidth = 2*px;
				ctx.strokeRect(x0,y0, x1-x0, y1-y0);

				//note cancellation:
				for (const note2 of this.notes) {
					if (note2 === note) continue;
					if (note2.instrument !== note.instrument) continue;
					if (note2.start !== this.lifted.newStart) continue;

					const x0 = this.beatToX(note2.start);
					const x1 = this.beatToX(note2.start + note2.duration);
					const y0 = this.pitchToY(note2.pitch + 1);
					const y1 = this.pitchToY(note2.pitch);

					ctx.beginPath();
					ctx.moveTo(x0,y0); ctx.lineTo(x1,y1);
					ctx.moveTo(x0,y1); ctx.lineTo(x1,y0);

					ctx.strokeStyle = "#000";
					ctx.lineWidth = 2*px;
					ctx.stroke();
				}
			}
		} else {
			//note highlight:
			if ('overNote' in mouse) {
				const note = mouse.overNote;
				const x0 = this.beatToX(note.start);
				const x1 = this.beatToX(note.start + note.duration);
				const y0 = this.pitchToY(note.pitch + 1);
				const y1 = this.pitchToY(note.pitch);

				ctx.strokeStyle = '#ff0';
				ctx.lineWidth = 2*px;
				ctx.strokeRect(x0,y0, x1-x0, y1-y0);
			}
		}

		if (isFinite(mouse.x) && isFinite(mouse.y)) { //mouse cursor (DEBUG)
			ctx.beginPath();
			ctx.moveTo(mouse.x - 10, mouse.y - 10);
			ctx.lineTo(mouse.x + 10, mouse.y + 10);
			ctx.moveTo(mouse.x - 10, mouse.y + 10);
			ctx.lineTo(mouse.x + 10, mouse.y - 10);
			ctx.lineWidth = px;
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
