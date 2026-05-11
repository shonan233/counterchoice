import { useEffect, useState, useRef, useMemo } from "react";

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


//data that is actually being edited:
export interface Step {
	index: number; //index of the step (not actually used in Notes component)
	measure: unknown; //label of the measure (only strict-equality compared)
}

export interface Pitch {
	name: string; //name, a string
	midi: number; //midi note number, 0 <= midi <= 127
}

export interface Instrument {
	noteBit: number; //play this note (at most one per step)
	positiveBit: number; //show only patterns with some note in this set
	negativeBit: number; //don't show patterns with this note
	possibleBit: number; //display this cell as appearing in *some* possible pattern
	//drawing style:
	fill: string;
	stroke: string;
}

//thing that handles notes UI actions:
export interface UIState {
	mouse : {
		x: number;
		y: number;
		//we have if over the canvas:
		step? : number;
		pitch? : number;
	};
	//TODO: remember listener functions so they can be un-registered
	//TODO: lift object that tracks current note editing
}

export default function Notes({className} : {className?:string}) {

	const [steps, setSteps] = useState< Step[] >([
		{ index:0, measure:0 },
		{ index:1, measure:0 },
		{ index:2, measure:0 },
		{ index:3, measure:0 },
		{ index:4, measure:1 },
		{ index:5, measure:1 },
		{ index:6, measure:1 },
		{ index:7, measure:1 },
	]);
	const [pitches, setPitches] = useState< Pitch[] >([
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
	]);
	//This will likely never be changed and so could be a global constant and not state:
	const [instruments, setInstruments] = useState< Record< string, Instrument > >({
		"cf":{
			noteBit:(1<<0),
			positiveBit:(1<<1),
			negativeBit:(1<<2),
			possibleBit:(1<<3),
			fill:'#eb8', stroke:'#888',
		},
		"cp":{
			noteBit:(1<<4),
			positiveBit:(1<<5),
			negativeBit:(1<<6),
			possibleBit:(1<<7),
			fill:'#ef0', stroke:'#aaa',
		},
	});

	const [grid, setGrid] = useState< Uint8Array >(
		setNotesInGrid({steps, pitches, instruments},
			new Uint8Array(steps.length * pitches.length),
			"cf",
			[ "C2", "D2", "E2", "F2", "G2", "A2", "B2", "C3" ]
		)
	);
	
	const canvasRef = useRef(null);
	const uiRef = useRef< UIState >({
		mouse: { x:NaN, y:NaN }
	});

	const pendingRef = useRef(false);

	//get all the parameters together to actually call redraw (far below)
	function doRedraw() {
		//console.log(new Error(`and here's a stack trace`)); //DEBUG
		const ctx = canvasRef.current?.getContext('2d', {
			alpha:false,
			colorSpace:"srgb", //srgb is the default, also
			colorType:"unorm8", //unorm8 is the default, also
			//optimization hints:
			desynchronized:false,
			willReadFrequently:false,
		});

		redraw({
			canvas:canvasRef.current,
			ctx,
			ui:uiRef.current,
			pitches, steps, grid, instruments
		});
	}

	function requestRedraw() {
		if (pendingRef.current) return;
		pendingRef.current = true;
		window.requestAnimationFrame( () => {
			doRedraw();
			pendingRef.current = false;
		} );
	}

	function doSetMouse(evt) {
		setMouse({canvas:canvasRef.current, ui:uiRef.current, requestRedraw}, evt);
	}

	//[create and] lift (start moving) a note:
	function startLift() {
		const ui = uiRef.current;
		const canvas = canvasRef.current;

		updateOver({ui,canvas,steps,pitches});

		//nothing to lift:
		if (!('step' in ui.mouse && 'pitch' in ui.mouse)) return;

		const idx = ui.mouse.step * pitches.length + ui.mouse.pitch;

		//TODO: idea of current instrument for editing
		const bit = instruments["cf"].noteBit;

		ui.lifted = {
			//current lifted note location:
			step:ui.mouse.step,
			pitch:ui.mouse.pitch,
			beginStep:ui.mouse.step,
			beginPitch:ui.mouse.pitch,
			//current lifted note bit:
			bit,
			//offset from (fractional) step/pitch mouse position to note origin:
			dStep:ui.mouse.step - xToStep({canvas,steps}, ui.mouse.x),
			dPitch:ui.mouse.pitch - yToPitch({canvas,pitches}, ui.mouse.y),
			remove:((bit & grid[idx]) !== 0), //mark stitches that already exist and don't get moved for removal
		};
		requestRedraw();

		// event handlers to deal with the rest of the drag
		// (installing on the window to deal with dragging outside the canvas)

		const mousemove = (evt) => {
			if (!('lifted' in ui)) {
				//should generally not happen since this handler will be removed on button lift.
				//but, just in case:
				return;
			}

			doSetMouse(evt);

			const newStep = Math.round( xToStep({canvas, steps}, ui.mouse.x) + ui.lifted.dStep );
			const newPitch = Math.round( yToPitch({canvas, pitches}, ui.mouse.y) + ui.lifted.dPitch );

			if (newStep !== ui.lifted.step || newPitch !== ui.lifted.pitch) {
				ui.lifted.step = newStep;
				ui.lifted.pitch = newPitch;
				ui.lifted.remove = false; //if moved, don't delete
				requestRedraw(); //<-- likely redundant because setMouse will call if mouse moved
			}
		};

		const mouseup = (evt) => {
			//only care about the main button being released:
			if (evt.button !== 0) return;

			if ('lifted' in ui) {
				const lifted = ui.lifted;
				const newGrid = new Uint8Array(grid);
				
				//remove note from where it started:
				newGrid[lifted.beginStep * pitches.length + lifted.beginPitch] &= ~bit;

				//if it isn't marked for removal and has a valid place in the grid...
				if (!lifted.remove
				 && 0 <= lifted.step && lifted.step < steps.length
				 && 0 <= lifted.pitch && lifted.pitch < pitches.length) {
					//...put it in the grid:
					// (and cancel everything else in this column)
					for (let p = 0; p < pitches.length; ++p) {
						if (p === lifted.pitch) {
							newGrid[lifted.step * pitches.length + p] |= lifted.bit;
						} else {
							newGrid[lifted.step * pitches.length + p] &= ~lifted.bit;
						}
					}
				}

				//let react know the state has changed:
				setGrid(newGrid);

				delete ui.lifted;
				requestRedraw();
			}

			window.removeEventListener('mouseup', mouseup);
			window.removeEventListener('mousemove', mousemove);
			evt.preventDefault();
			return false;
		};

		//can't just use 'once' option for mouseup because multi-button mice exist :-/
		window.addEventListener('mouseup', mouseup);
		window.addEventListener('mousemove', mousemove);
	}


	//This effect gets the drawing context for the canvas + triggers a redraw(?!?!?!)
	useEffect(() => {
		doRedraw(); //force redraw, don't wait for repaint

		//hook canvas

		//watch for canvas resizes:
		const observer = new ResizeObserver( requestRedraw );
		observer.observe(canvasRef.current);

		//mouse events:
		const mousemove = (evt) => {
			doSetMouse(evt);
		};
		const mousedown = (evt) => {
			doSetMouse(evt);
			const mouse = uiRef.current.mouse;

			if (evt.button === 0) {
				startLift();
			}
			
			evt.preventDefault();
			return false;
		};


		//remember the canvas we installed the listeners on:
		const canvas = canvasRef.current;
		canvas?.addEventListener('mousemove', mousemove);
		canvas?.addEventListener('mousedown', mousedown);

		return () => {
			//cleanup hooks
			observer.disconnect();

			canvas?.removeEventListener('mousemove', mousemove);
			canvas?.removeEventListener('mousedown', mousedown);
		};
	}, [canvasRef,pitches,steps,grid]);

	return (
		<canvas ref={canvasRef} className={className}>
		Just something.
		</canvas>
	);
}

//set the notes played by an instrument to a given array.
//the array must not be longer than this.steps.
//each array entry must be:
// - null / undefined (no note is played on this step)
// - a midi note number that appears in this.pitches
// - a note name string that appears in this.pitches
//returns copy of input grid with the notes set
function setNotesInGrid({steps, pitches, instruments}, gridIn, instrument, notes) {
	if (!(instrument in instruments)) {
		throw new Error(`Cannot set notes for instrument '${instrument}', this instrument does not exist.`);
	}
	if (notes.length > steps.length) {
		throw new Error(`Trying to set ${notes.length}, but only have ${steps.length} steps.`);
	}

	const toPitch = (n) => {
		switch(typeof n) {
			case "undefined":
				return -1; //index that doesn't exist in pitches
			case "number":
				for (let p = 0; p < pitches.length; ++p) {
					if (pitches[p].midi === n) return p;
				}
				throw new Error(`Midi note number ${n} not found in pitches array.`);
			case "string":
				for (let p = 0; p < pitches.length; ++p) {
					if (pitches[p].name === n) return p;
				}
				throw new Error(`Pitch with name ${n} not found in pitches array.`);
			default:
				throw new Error(`Don't know how to look up note of type ${typeof n}.`);
		}
	};

	const grid = new Uint8Array(gridIn);

	const bit = instruments[instrument].noteBit;

	for (let s = 0; s < steps.length; ++s) {
		const tp = toPitch(notes[s]);
		for (let p = 0; p < pitches.length; ++p) {
			if (p === tp) {
				grid[s * pitches.length + p] |= bit;
			} else {
				grid[s * pitches.length + p] &= ~bit;
			}
		}
	}

	return grid;
}


function stepToX({steps, canvas}, step) {
	return step / steps.length * canvas.width;
}
function xToStep({steps, canvas}, x) {
	return x / canvas.width * steps.length;
}
function pitchToY({canvas, pitches}, pitch) {
	const height = canvas.height;
	return height - pitch / pitches.length * height;
}
function yToPitch({canvas, pitches}, y) {
	const height = canvas.height;
	return (height - y) / height * pitches.length;
}

function setMouse({canvas, ui, requestRedraw}, evt) {
	const rect = canvas.getBoundingClientRect();
	const style = getComputedStyle(canvas);

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

	if (ui.mouse.x !== x || ui.mouse.y !== y) {
		ui.mouse.x = x;
		ui.mouse.y = y;
		requestRedraw();
	}
}

function updateOver({ui,canvas,steps,pitches}) {
	delete ui.mouse.pitch;
	delete ui.mouse.step;

	if (!(isFinite(ui.mouse.x) && isFinite(ui.mouse.y))) return;

	ui.mouse.step = Math.floor(xToStep({canvas, steps}, ui.mouse.x));
	ui.mouse.pitch = Math.floor(yToPitch({canvas, pitches}, ui.mouse.y));
}


function redraw(
	{canvas, ctx, ui, pitches, steps, grid, instruments} : {
		canvas : HTMLCanvasElement,
		ctx : CanvasRenderingContext2D,
		ui : UIState,
		pitches : Pitch[],
		steps : Step[],
		grid : Uint8Array,
		instruments : Record< string, Instrument >
	}) {

	{ //make sure canvas pixels are the same size as display pixels:
		const style = getComputedStyle(canvas);

		canvas.width = Math.round(devicePixelRatio * parseFloat(style.width));
		canvas.height = Math.round(devicePixelRatio * parseFloat(style.height));
	}
	
	//update what the mouse is over:
	updateOver({ui,canvas,steps,pitches});

	const width = canvas.width;
	const height = canvas.height;
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
		for (let p = 0; p < pitches.length; ++p) {
			const y0 = pitchToY({canvas, pitches}, p+1);
			const y1 = pitchToY({canvas, pitches}, p);
			ctx.fillStyle = PITCH_FILL[pitches[p].midi % PITCH_FILL.length];
			ctx.fillRect(0,y0, width, (y1-y0));
		}

		//dividing lines:
		ctx.beginPath();
		for (let p = 0; p <= pitches.length; ++p) {
			const y = pitchToY({canvas, pitches}, p);
			ctx.moveTo(0,y);
			ctx.lineTo(width,y);
		}
		ctx.strokeStyle = PITCH_STROKE;
		ctx.lineWidth = px; //one layout pixel wide
		ctx.stroke();
	}

	{ //highlight beat/measure
		if ('pitch' in ui.mouse) {
			const y0 = pitchToY({canvas, pitches}, ui.mouse.pitch+1);
			const y1 = pitchToY({canvas, pitches}, ui.mouse.pitch);
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
			return (s === 0 || s == steps.length || steps[s-1].measure !== steps[s].measure);
		};
		//beat lines:
		ctx.beginPath();
		for (let s = 0; s <= steps.length; ++s) {
			if (!measureLineBefore(s)) {
				const x = stepToX({canvas, steps}, s);
				ctx.moveTo(x,0);
				ctx.lineTo(x,height);
			}
		}
		ctx.strokeStyle = BEAT_STROKE;
		ctx.lineWidth = px;
		ctx.stroke();
		//measure lines:
		ctx.beginPath();
		for (let s = 0; s <= steps.length; ++s) {
			if (measureLineBefore(s)) {
				const x = stepToX({canvas, steps},s);
				ctx.moveTo(x,0);
				ctx.lineTo(x,height);
			}
		}
		ctx.strokeStyle = MEASURE_STROKE;
		ctx.lineWidth = 2*px;
		ctx.stroke();
	}

	//the notes themselves:
	for (let s = 0; s < steps.length; ++s) {
		const x0 = stepToX({canvas, steps}, s);
		const x1 = stepToX({canvas, steps}, s+1);
		for (let p = 0; p < pitches.length; ++p) {
			const bits = grid[s * pitches.length + p];
			//list of instruments for which this is a played note:
			let playing = [];
			for (const instr of Object.values(instruments)) {
				if (bits & instr.noteBit) {
					playing.push(instr);
				}
			}
			if (playing.length === 0) {
				//no notes :-)
			} else if (playing.length === 1) {
				const y0 = pitchToY({canvas, pitches}, p+1);
				const y1 = pitchToY({canvas, pitches}, p);

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


	if ('lifted' in ui) {
		const lifted = ui.lifted;
		//if it's over a valid place in the grid, draw it:
		if (0 <= lifted.step && lifted.step < steps.length
		 && 0 <= lifted.pitch && lifted.pitch < pitches.length) {
			//draw drop location
			const x0 = stepToX({canvas,steps},lifted.step);
			const x1 = stepToX({canvas,steps},lifted.step + 1);
			const y0 = pitchToY({canvas,pitches},lifted.pitch + 1);
			const y1 = pitchToY({canvas,pitches},lifted.pitch);

			ctx.strokeStyle = "#000";
			ctx.lineWidth = 2*px;
			ctx.strokeRect(x0,y0, x1-x0, y1-y0);

			//note cancellation:
			for (let p = 0; p < pitches.length; ++p) {
				//only mark other notes from the same instrument in the same column:
				if (!(grid[lifted.step * pitches.length + p] & lifted.bit)) continue;

				const y0 = pitchToY({canvas,pitches},p + 1);
				const y1 = pitchToY({canvas,pitches},p);

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
		if (('step' in ui.mouse) && ('pitch' in ui.mouse)) {
			const x0 = stepToX({canvas,steps},ui.mouse.step);
			const x1 = stepToX({canvas,steps},ui.mouse.step + 1);
			const y0 = pitchToY({canvas,pitches},ui.mouse.pitch + 1);
			const y1 = pitchToY({canvas,pitches},ui.mouse.pitch);

			ctx.strokeStyle = '#ff0';
			ctx.lineWidth = 2*px;
			ctx.strokeRect(x0,y0, x1-x0, y1-y0);
		}
	}


	if (isFinite(ui.mouse.x) && isFinite(ui.mouse.y)) { //ui.mouse cursor (DEBUG)
		ctx.beginPath();
		ctx.moveTo(ui.mouse.x - 10, ui.mouse.y - 10);
		ctx.lineTo(ui.mouse.x + 10, ui.mouse.y + 10);
		ctx.moveTo(ui.mouse.x - 10, ui.mouse.y + 10);
		ctx.lineTo(ui.mouse.x + 10, ui.mouse.y - 10);
		ctx.lineWidth = px;
		ctx.strokeStyle = "#000";
		ctx.stroke();
	}



}
