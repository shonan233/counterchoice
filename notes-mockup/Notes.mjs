
/*
 * A piano-roll style notes editor in a javascript canvas.
 *
 */

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

		//This is editing a grid of notes. The grid axes are steps (horizontal) and pitches (vertical):

		//steps of the pattern, with indices, measure labels, and maybe someday durations:
		this.steps = [
			{ index:0, measure:0 },
			{ index:1, measure:0 },
			{ index:2, measure:0 },
			{ index:3, measure:0 },
			{ index:4, measure:1 },
			{ index:5, measure:1 },
			{ index:6, measure:1 },
			{ index:7, measure:1 },
		];

		//allowed pitches, with displayed names and midi note #'s:
		this.pitches = [
			{name:"C2", midi:48},
			{name:"D2", midi:50},
			{name:"E2", midi:52},
			{name:"F2", midi:53},
			{name:"G2", midi:55},
			{name:"A2", midi:57},
			{name:"B2", midi:59},
			{name:"C3", midi:60},
			{name:"D3", midi:62},
			{name:"E3", midi:64},
			{name:"F3", midi:65},
			{name:"G3", midi:67},
			{name:"A3", midi:69},
			{name:"B3", midi:71},
			{name:"C4", midi:72},
		];

		//the primary representation of the information in the grid is a rectangular bitfield.
		//the cell corresponding to step s and pitch p is:
		// this.grid[ s * this.pitches.length + p ]
		this.grid = new Uint8Array(this.steps.length * this.pitches.length);

		//there are two instruments, each of which uses certain bits of the grid bitfield:
		this.instruments = {
			"cf":{
				noteBit:(1<<0), //play this note (at most one per step)
				positiveBit:(1<<1), //show only patterns with 
				negativeBit:(1<<2), //don't show patterns with this note
				possibleBit:(1<<3), //display this cell as appearing in *some* possible pattern
				//drawing style:
				fill:'#eb8', stroke:'#888',
			},
			"cp":{
				noteBit:(1<<4),
				positiveBit:(1<<5),
				negativeBit:(1<<6),
				possibleBit:(1<<7),
				//drawing style:
				fill:'#ef0', stroke:'#aaa',
			},
		};

		//some example data:
		this.setNotes("cf", [ "C2", "D2", "E2", "F2", "G2", "A2", "B2", "C3" ]);

		//mouse position and hover info:
		this.mouse = {
			x:NaN,
			y:NaN,
			//overStep (when inside the canavs)
			//overPitch (when inside the canvas)
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

		//Testing:
		//console.log(this.getNotes("cf", {format:"name"})); //DEBUG
		//console.log(this.getNotes("cf", {format:"midi"})); //DEBUG
	}

	//------ public interface -----
	//set the notes played by an instrument to a given array.
	//the array must not be longer than this.steps.
	//each array entry must be:
	// - null / undefined (no note is played on this step)
	// - a midi note number that appears in this.pitches
	// - a note name string that appears in this.pitches
	setNotes(instrument, notes) {
		if (!(instrument in this.instruments)) {
			throw new Error(`Cannot set notes for instrument '${instrument}', this instrument does not exist.`);
		}
		if (notes.length > this.steps.length) {
			throw new Error(`Trying to set ${notes.length}, but only have ${this.steps.length} steps.`);
		}

		const toPitch = (n) => {
			switch(typeof n) {
				case "undefined":
					return -1; //index that doesn't exist in pitches
				case "number":
					for (let p = 0; p < this.pitches.length; ++p) {
						if (this.pitches[p].midi === n) return p;
					}
					throw new Error(`Midi note number ${n} not found in pitches array.`);
				case "string":
					for (let p = 0; p < this.pitches.length; ++p) {
						if (this.pitches[p].name === n) return p;
					}
					throw new Error(`Pitch with name ${n} not found in pitches array.`);
				default:
					throw new Error(`Don't know how to look up note of type ${typeof n}.`);
			}
		};

		const bit = this.instruments[instrument].noteBit;

		for (let s = 0; s < this.steps.length; ++s) {
			const tp = toPitch(notes[s]);
			for (let p = 0; p < this.pitches.length; ++p) {
				if (p === tp) {
					this.grid[s * this.pitches.length + p] |= bit;
				} else {
					this.grid[s * this.pitches.length + p] &= ~bit;
				}
			}
		}

	}

	//get the notes selected for an instrument as an array.
	//array entries will be midi note numbers (format:midi) or note name strings (format:name) from the pitches array
	getNotes(instrument, {format} = {format:"midi"}) {
		if (!(instrument in this.instruments)) {
			throw new Error(`Cannot set notes for instrument '${instrument}', this instrument does not exist.`);
		}
		let fromPitch;
		if (format === "midi") {
			fromPitch = (p) => this.pitches[p].midi;
		} else if (format === "name") {
			fromPitch = (p) => this.pitches[p].name;
		} else {
			throw new Error(`Cannot extract notes in unknown format '${format}'.`);
		}

		const bit = this.instruments[instrument].noteBit;

		const out = [];
		for (let s = 0; s < this.steps.length; ++s) {
			let note = null;
			for (let p = 0; p < this.pitches.length; ++p) {
				if (this.grid[s * this.pitches.length + p] & bit) {
					note = fromPitch(p);
				}
			}
			out.push(note);
		}
		return out;
	}



	//------ internals ------

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

		//nothing to lift:
		if (!('overStep' in mouse && 'overPitch' in mouse)) return;

		const idx = mouse.overStep * this.pitches.length + mouse.overPitch;

		//TODO: idea of current instrument for editing
		const bit = this.instruments["cf"].noteBit;

		this.lifted = {
			//current lifted note location:
			step:mouse.overStep,
			pitch:mouse.overPitch,
			//offset from (fractional) step/pitch mouse position to note origin:
			dStep:mouse.overStep - this.xToStep(this.mouse.x),
			dPitch:mouse.overPitch - this.yToPitch(this.mouse.y),
			bit, //bit to set on drop
			remove:((bit & this.grid[idx]) !== 0), //mark stitches that already exist and don't get moved for removal
		};

		//remove lifted note from the grid: (if it existed)
		this.grid[idx] &= ~bit;

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

			const newStep = Math.round( this.xToStep(this.mouse.x) + this.lifted.dStep );
			const newPitch = Math.round( this.yToPitch(this.mouse.y) + this.lifted.dPitch );

			if (newStep !== this.lifted.step || newPitch !== this.lifted.pitch) {
				this.lifted.step = newStep;
				this.lifted.pitch = newPitch;
				this.lifted.remove = false; //if moved, don't delete
				this.updateOver();
				this.requestRedraw(); //<-- likely redundant because setMouse will call if mouse moved
			}
		};

		const upListener = (evt) => {
			//only care about the main button being released:
			if (evt.button !== 0) return;

			if ('lifted' in this) {
				const lifted = this.lifted;
				//if it isn't marked for removal and has a valid place in the grid...
				if (!lifted.remove
				 && 0 <= lifted.step && lifted.step < this.steps.length
				 && 0 <= lifted.pitch && lifted.pitch < this.pitches.length) {
					//...put it in the grid:
					// (and cancel everything else in this column)
					for (let p = 0; p < this.pitches.length; ++p) {
						if (p === lifted.pitch) {
							this.grid[lifted.step * this.pitches.length + p] |= lifted.bit;
						} else {
							this.grid[lifted.step * this.pitches.length + p] &= ~lifted.bit;
						}
					}
				}
				delete this.lifted;
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

	//view transforms:
	stepToX(step) {
		return step / this.steps.length * this.canvas.width;
	}
	xToStep(x) {
		return x / this.canvas.width * this.steps.length;
	}
	pitchToY(pitch) {
		const height = this.canvas.height;
		return height - pitch / this.pitches.length * height;
	}
	yToPitch(y) {
		const height = this.canvas.height;
		return (height - y) / height * this.pitches.length;
	}

	updateOver() {
		const mouse = this.mouse;

		delete mouse.overPitch;
		delete mouse.overStep;

		if (!(isFinite(mouse.x) && isFinite(mouse.y))) return;

		const step = Math.floor(this.xToStep(mouse.x));
		const pitch = Math.floor(this.yToPitch(mouse.y));

		//if (0 <= step && step < this.steps.length && 0 <= pitch && pitch < this.pitches.length) {
		mouse.overStep = step;
		mouse.overPitch = pitch;
		//}
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
			//backgrounds:
			for (let p = 0; p < this.pitches.length; ++p) {
				const y0 = this.pitchToY(p+1);
				const y1 = this.pitchToY(p);
				ctx.fillStyle = PITCH_FILL[this.pitches[p].midi % PITCH_FILL.length];
				ctx.fillRect(0,y0, width, (y1-y0));
			}

			//dividing lines:
			ctx.beginPath();
			for (let p = 0; p <= this.pitches.length; ++p) {
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

		{ //step / measure lines:
			//helper to decide whether the division before step is a beat or measure line:
			const measureLineBefore = (s) => {
				return (s === 0 || s == this.steps.length || this.steps[s-1].measure !== this.steps[s].measure);
			};
			//beat lines:
			ctx.beginPath();
			for (let s = 0; s <= this.steps.length; ++s) {
				if (!measureLineBefore(s)) {
					const x = this.stepToX(s);
					ctx.moveTo(x,0);
					ctx.lineTo(x,height);
				}
			}
			ctx.strokeStyle = BEAT_STROKE;
			ctx.lineWidth = px;
			ctx.stroke();
			//measure lines:
			ctx.beginPath();
			for (let s = 0; s <= this.steps.length; ++s) {
				if (measureLineBefore(s)) {
					const x = this.stepToX(s);
					ctx.moveTo(x,0);
					ctx.lineTo(x,height);
				}
			}
			ctx.strokeStyle = MEASURE_STROKE;
			ctx.lineWidth = 2*px;
			ctx.stroke();
		}

		//the notes themselves:
		for (let s = 0; s < this.steps.length; ++s) {
			const x0 = this.stepToX(s);
			const x1 = this.stepToX(s+1);
			for (let p = 0; p < this.pitches.length; ++p) {
				const bits = this.grid[s * this.pitches.length + p];
				//list of instruments for which this is a played note:
				let playing = [];
				for (const instr of Object.values(this.instruments)) {
					if (bits & instr.noteBit) {
						playing.push(instr);
					}
				}
				if (playing.length === 0) {
					//no notes :-)
				} else if (playing.length === 1) {
					const y0 = this.pitchToY(p+1);
					const y1 = this.pitchToY(p);

					ctx.fillStyle = playing[0].fill;
					ctx.fillRect(x0,y0, x1-x0, y1-y0);

					ctx.strokeStyle = playing[0].stroke;
					ctx.lineWidth = 2*px;
					ctx.strokeRect(x0,y0, x1-x0, y1-y0);
				} else if (playing.length === 2) {
					//TODO
				} else {
					//TODO
				}
			}
		}

		if (this.lifted) {
			const lifted = this.lifted;
			//if it's over a valid place in the grid, draw it:
			if (0 <= lifted.step && lifted.step < this.steps.length
			 && 0 <= lifted.pitch && lifted.pitch < this.pitches.length) {
				//draw drop location
				const x0 = this.stepToX(lifted.step);
				const x1 = this.stepToX(lifted.step + 1);
				const y0 = this.pitchToY(lifted.pitch + 1);
				const y1 = this.pitchToY(lifted.pitch);

				ctx.strokeStyle = "#000";
				ctx.lineWidth = 2*px;
				ctx.strokeRect(x0,y0, x1-x0, y1-y0);

				//note cancellation:
				for (let p = 0; p < this.pitches.length; ++p) {
					//only mark other notes from the same instrument in the same column:
					if (!(this.grid[lifted.step * this.pitches.length + p] & lifted.bit)) continue;

					const y0 = this.pitchToY(p + 1);
					const y1 = this.pitchToY(p);

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
			if (('overStep' in mouse) && ('overPitch' in mouse)) {
				const x0 = this.stepToX(mouse.overStep);
				const x1 = this.stepToX(mouse.overStep + 1);
				const y0 = this.pitchToY(mouse.overPitch + 1);
				const y1 = this.pitchToY(mouse.overPitch);

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
