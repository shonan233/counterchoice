import { useEffect, useRef } from "react";
import { PITCHES, type Note } from "./util";

// stable reference for a "no notes" default prop:
const EMPTY_NOTES: Note[] = [];

// data that is actually being edited:
interface Step {
  index: number; // index of the step (not actually used in Notes component)
  measure: unknown; // label of the measure (only strict-equality compared)
}
interface Instrument {
  noteBit: number; // play this note (at most one per step)
  positiveBit: number; // show only patterns with some note in this set
  negativeBit: number; // don't show patterns with this note
  possibleBit: number; // display this cell as appearing in *some* possible pattern
  // drawing style:
  fill: string;
  stroke: string;
}

// thing that handles notes UI actions:
interface UIState {
  mouse: {
    x: number;
    y: number;
    // set if over the canvas:
    step?: number;
    pitch?: number;
  };
  lifted?: {
    step: number;
    pitch: number;
    beginStep: number;
    beginPitch: number;
    bit: number;
    dStep: number;
    dPitch: number;
    remove: boolean;
  };
}

// fill styles used for note lane backgrounds:
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

// stroke style for note lane dividing line:
const PITCH_STROKE = "#cccccc";

// stroke style for beat line:
const BEAT_STROKE = "#cccccc";

// stroke style for measure line:
const MEASURE_STROKE = "#bbbbbb";

const STEPS: Step[] = [
  { index: 0, measure: 0 },
  { index: 1, measure: 0 },
  { index: 2, measure: 0 },
  { index: 3, measure: 0 },
  { index: 4, measure: 1 },
  { index: 5, measure: 1 },
  { index: 6, measure: 1 },
  { index: 7, measure: 1 },
];

const INSTRUMENTS: Record<string, Instrument> = {
  cf: {
    noteBit: 1 << 0,
    positiveBit: 1 << 1,
    negativeBit: 1 << 2,
    possibleBit: 1 << 3,
    fill: "#eb8",
    stroke: "#888",
  },
  cp: {
    noteBit: 1 << 4,
    positiveBit: 1 << 5,
    negativeBit: 1 << 6,
    possibleBit: 1 << 7,
    fill: "#57b0f4",
    stroke: "#888",
  },
};

// build a grid from cf and cp index arrays.
// out-of-range indices (e.g. -1 for "no note") are ignored.
function buildGrid(cf: Note[], cp: Note[]): Uint8Array {
  const grid = new Uint8Array(STEPS.length * PITCHES.length);
  const cfBit = INSTRUMENTS.cf.noteBit;
  const cpBit = INSTRUMENTS.cp.noteBit;
  for (let s = 0; s < STEPS.length; ++s) {
    if (s < cf.length && cf[s] >= 0 && cf[s] < PITCHES.length) {
      grid[s * PITCHES.length + cf[s]] |= cfBit;
    }
    if (s < cp.length && cp[s] >= 0 && cp[s] < PITCHES.length) {
      grid[s * PITCHES.length + cp[s]] |= cpBit;
    }
  }
  return grid;
}

// extract cf pitch indices from a grid; -1 means "no note in this step".
function gridToCf(grid: Uint8Array): Note[] {
  const bit = INSTRUMENTS.cf.noteBit;
  const out: Note[] = [];
  for (let s = 0; s < STEPS.length; ++s) {
    let idx: Note = -1 as Note;
    for (let p = 0; p < PITCHES.length; ++p) {
      if (grid[s * PITCHES.length + p] & bit) {
        idx = p as Note;
      }
    }
    out.push(idx);
  }
  return out;
}

// coordinate helpers (step/pitch <-> canvas device pixels)
function stepToX(width: number, step: number) {
  return (step / STEPS.length) * width;
}
function xToStep(width: number, x: number) {
  return (x / width) * STEPS.length;
}
function pitchToY(height: number, pitch: number) {
  return height - (pitch / PITCHES.length) * height;
}
function yToPitch(height: number, y: number) {
  return ((height - y) / height) * PITCHES.length;
}

function setMousePos(
  canvas: HTMLCanvasElement,
  ui: UIState,
  evt: MouseEvent,
  requestRedraw: () => void,
) {
  const rect = canvas.getBoundingClientRect();
  const style = getComputedStyle(canvas);

  // mouse position, relative to content area:
  let x = evt.clientX - rect.left;
  let y = evt.clientY - rect.top;

  if (style.boxSizing === "border-box") {
    // rect already was content area
  } else {
    // assume 'content-box', the default
    x -= parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
    y -= parseFloat(style.paddingTop) + parseFloat(style.borderTopWidth);
  }

  // convert to device pixels:
  x *= devicePixelRatio;
  y *= devicePixelRatio;

  if (ui.mouse.x !== x || ui.mouse.y !== y) {
    ui.mouse.x = x;
    ui.mouse.y = y;
    requestRedraw();
  }
}

function updateOver(canvas: HTMLCanvasElement, ui: UIState) {
  delete ui.mouse.pitch;
  delete ui.mouse.step;

  if (!(isFinite(ui.mouse.x) && isFinite(ui.mouse.y))) return;

  ui.mouse.step = Math.floor(xToStep(canvas.width, ui.mouse.x));
  ui.mouse.pitch = Math.floor(yToPitch(canvas.height, ui.mouse.y));
}

// size canvas backing store to its CSS box in device pixels:
function resizeCanvasToDisplay(canvas: HTMLCanvasElement) {
  const style = getComputedStyle(canvas);
  canvas.width = Math.round(devicePixelRatio * parseFloat(style.width));
  canvas.height = Math.round(devicePixelRatio * parseFloat(style.height));
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  ctx.fillStyle = "#eee";
  ctx.fillRect(0, 0, width, height);
}

function drawPitchLanes(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
) {
  const width = canvas.width;
  const height = canvas.height;

  // backgrounds:
  for (let p = 0; p < PITCHES.length; ++p) {
    const y0 = pitchToY(height, p + 1);
    const y1 = pitchToY(height, p);
    ctx.fillStyle = PITCH_FILL[PITCHES[p].midi % PITCH_FILL.length];
    ctx.fillRect(0, y0, width, y1 - y0);
  }

  // dividing lines:
  ctx.beginPath();
  for (let p = 0; p <= PITCHES.length; ++p) {
    const y = pitchToY(height, p);
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.strokeStyle = PITCH_STROKE;
  ctx.lineWidth = devicePixelRatio; // one layout pixel wide
  ctx.stroke();
}

function drawHoverRowHighlight(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  ui: UIState,
) {
  if (ui.mouse.pitch === undefined) return;
  const y0 = pitchToY(canvas.height, ui.mouse.pitch + 1);
  const y1 = pitchToY(canvas.height, ui.mouse.pitch);
  ctx.fillStyle = "#ff02";
  ctx.fillRect(0, y0, canvas.width, y1 - y0);
}

function drawBeatAndMeasureLines(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
) {
  const width = canvas.width;
  const height = canvas.height;
  const px = devicePixelRatio;

  // helper to decide whether the division before step is a beat or measure line:
  const measureLineBefore = (s: number) =>
    s === 0 || s === STEPS.length || STEPS[s - 1].measure !== STEPS[s].measure;

  // beat lines:
  ctx.beginPath();
  for (let s = 0; s <= STEPS.length; ++s) {
    if (!measureLineBefore(s)) {
      const x = stepToX(width, s);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
  }
  ctx.strokeStyle = BEAT_STROKE;
  ctx.lineWidth = px;
  ctx.stroke();

  // measure lines:
  ctx.beginPath();
  for (let s = 0; s <= STEPS.length; ++s) {
    if (measureLineBefore(s)) {
      const x = stepToX(width, s);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
  }
  ctx.strokeStyle = MEASURE_STROKE;
  ctx.lineWidth = 2 * px;
  ctx.stroke();
}

function drawGridNotes(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  grid: Uint8Array,
) {
  const width = canvas.width;
  const height = canvas.height;
  const px = devicePixelRatio;

  for (let s = 0; s < STEPS.length; ++s) {
    const x0 = stepToX(width, s);
    const x1 = stepToX(width, s + 1);
    for (let p = 0; p < PITCHES.length; ++p) {
      const bits = grid[s * PITCHES.length + p];
      // list of instruments for which this is a played note:
      const playing: Instrument[] = [];
      for (const instr of Object.values(INSTRUMENTS)) {
        if (bits & instr.noteBit) {
          playing.push(instr);
        }
      }
      if (playing.length === 0) {
        // no notes
      } else if (playing.length === 1) {
        const y0 = pitchToY(height, p + 1);
        const y1 = pitchToY(height, p);

        ctx.fillStyle = playing[0].fill;
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

        ctx.strokeStyle = playing[0].stroke;
        ctx.lineWidth = 2 * px;
        ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      } else if (playing.length === 2) {
        const y0 = pitchToY(height, p + 1);
        const y1 = pitchToY(height, p);
        const w = x1 - x0;
        const h = y1 - y0;

        // base fill in the first instrument's color
        ctx.fillStyle = playing[0].fill;
        ctx.fillRect(x0, y0, w, h);

        // overlay 45 degree stripes of the second color, clipped to the cell
        const stripeW = 6 * px;
        const period = stripeW * 2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, y0, w, h);
        ctx.clip();
        ctx.fillStyle = playing[1].fill;
        for (let off = -h; off < w + stripeW; off += period) {
          ctx.beginPath();
          ctx.moveTo(x0 + off, y0);
          ctx.lineTo(x0 + off + stripeW, y0);
          ctx.lineTo(x0 + off + stripeW + h, y1);
          ctx.lineTo(x0 + off + h, y1);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();

        ctx.strokeStyle = playing[0].stroke;
        ctx.lineWidth = 2 * px;
        ctx.strokeRect(x0, y0, w, h);
      }
    }
  }
}

function drawLiftedOverlay(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  grid: Uint8Array,
  lifted: NonNullable<UIState["lifted"]>,
) {
  // only draw if dropped over a valid place in the grid:
  if (
    !(
      0 <= lifted.step &&
      lifted.step < STEPS.length &&
      0 <= lifted.pitch &&
      lifted.pitch < PITCHES.length
    )
  ) {
    return;
  }

  const width = canvas.width;
  const height = canvas.height;
  const px = devicePixelRatio;

  // draw drop location
  const x0 = stepToX(width, lifted.step);
  const x1 = stepToX(width, lifted.step + 1);
  const y0 = pitchToY(height, lifted.pitch + 1);
  const y1 = pitchToY(height, lifted.pitch);

  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2 * px;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

  // note cancellation: mark other notes from the same instrument in the same column
  for (let p = 0; p < PITCHES.length; ++p) {
    if (!(grid[lifted.step * PITCHES.length + p] & lifted.bit)) continue;

    const cy0 = pitchToY(height, p + 1);
    const cy1 = pitchToY(height, p);

    ctx.beginPath();
    ctx.moveTo(x0, cy0);
    ctx.lineTo(x1, cy1);
    ctx.moveTo(x0, cy1);
    ctx.lineTo(x1, cy0);

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2 * px;
    ctx.stroke();
  }
}

function drawHoverCell(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  ui: UIState,
) {
  if (ui.mouse.pitch === undefined || ui.mouse.step === undefined) return;
  const x0 = stepToX(canvas.width, ui.mouse.step);
  const x1 = stepToX(canvas.width, ui.mouse.step + 1);
  const y0 = pitchToY(canvas.height, ui.mouse.pitch + 1);
  const y1 = pitchToY(canvas.height, ui.mouse.pitch);

  ctx.strokeStyle = "#ff0";
  ctx.lineWidth = 2 * devicePixelRatio;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
}

// DEBUG: draws an X marker at the cursor position
function drawCursorMarker(ctx: CanvasRenderingContext2D, ui: UIState) {
  if (!(isFinite(ui.mouse.x) && isFinite(ui.mouse.y))) return;
  ctx.beginPath();
  ctx.moveTo(ui.mouse.x - 10, ui.mouse.y - 10);
  ctx.lineTo(ui.mouse.x + 10, ui.mouse.y + 10);
  ctx.moveTo(ui.mouse.x - 10, ui.mouse.y + 10);
  ctx.lineTo(ui.mouse.x + 10, ui.mouse.y - 10);
  ctx.lineWidth = devicePixelRatio;
  ctx.strokeStyle = "#000";
  ctx.stroke();
}

function redraw(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  ui: UIState,
  grid: Uint8Array,
) {
  resizeCanvasToDisplay(canvas);
  updateOver(canvas, ui);

  // transform matrix: upper left origin, 1 device pixel per unit.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // erase previous drawing (redundant given drawBackground, but a hint to discard the old canvas)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground(ctx, canvas.width, canvas.height);
  drawPitchLanes(ctx, canvas);
  drawHoverRowHighlight(ctx, canvas, ui);
  drawBeatAndMeasureLines(ctx, canvas);
  drawGridNotes(ctx, canvas, grid);

  if (ui.lifted !== undefined) {
    drawLiftedOverlay(ctx, canvas, grid, ui.lifted);
  } else {
    drawHoverCell(ctx, canvas, ui);
  }

  drawCursorMarker(ctx, ui);
}

export interface NotesProps {
  className?: string;
  cf?: Note[];
  cp?: Note[];
  editable?: boolean;
  onChange?: (updated: Note[]) => void;
}

export default function Notes({
  className,
  cf = EMPTY_NOTES,
  cp = EMPTY_NOTES,
  editable,
  onChange,
}: NotesProps) {
  const grid = buildGrid(cf, cp);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uiRef = useRef<UIState>({ mouse: { x: NaN, y: NaN } });

  // mirror `grid` into a ref so the drag handlers always read the latest grid
  // without forcing the canvas-setup effect to re-run.
  const gridRef = useRef(grid);
  const requestRedrawRef = useRef(() => {});
  useEffect(() => {
    gridRef.current = grid;
    requestRedrawRef.current();
  }, [grid]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", {
      alpha: false,
      // srgb is the default, also
      colorSpace: "srgb",
      // unorm8 is the default, also
      colorType: "unorm8",
      // optimization hints:
      desynchronized: false,
      willReadFrequently: false,
    } as CanvasRenderingContext2DSettings);
    if (!ctx) return;

    let pending = false;
    const requestRedraw = () => {
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(() => {
        redraw(canvas, ctx, uiRef.current, gridRef.current);
        pending = false;
      });
    };
    requestRedrawRef.current = requestRedraw;

    // force initial redraw, don't wait for repaint
    redraw(canvas, ctx, uiRef.current, gridRef.current);

    // [create and] lift (start moving) a note:
    const startLift = () => {
      const ui = uiRef.current;
      updateOver(canvas, ui);

      // nothing to lift:
      if (ui.mouse.step === undefined || ui.mouse.pitch === undefined) return;

      const idx = ui.mouse.step * PITCHES.length + ui.mouse.pitch;

      // TODO: idea of current instrument for editing
      const instrument = "cf";
      const bit = INSTRUMENTS[instrument].noteBit;

      ui.lifted = {
        // current lifted note location:
        step: ui.mouse.step,
        pitch: ui.mouse.pitch,
        beginStep: ui.mouse.step,
        beginPitch: ui.mouse.pitch,
        // current lifted note bit:
        bit,
        // offset from (fractional) step/pitch mouse position to note origin:
        dStep: ui.mouse.step - xToStep(canvas.width, ui.mouse.x),
        dPitch: ui.mouse.pitch - yToPitch(canvas.height, ui.mouse.y),
        // mark notes that already exist and don't get moved for removal:
        remove: (bit & gridRef.current[idx]) !== 0,
      };
      requestRedraw();

      // event handlers for the rest of the drag
      // (on the window, to keep tracking outside the canvas)
      const onLiftMove = (evt: MouseEvent) => {
        if (ui.lifted === undefined) {
          // shouldn't happen since this is removed on mouseup, but just in case:
          return;
        }

        setMousePos(canvas, ui, evt, requestRedraw);

        const newStep = Math.round(
          xToStep(canvas.width, ui.mouse.x) + ui.lifted.dStep,
        );
        const newPitch = Math.round(
          yToPitch(canvas.height, ui.mouse.y) + ui.lifted.dPitch,
        );

        if (newStep !== ui.lifted.step || newPitch !== ui.lifted.pitch) {
          ui.lifted.step = newStep;
          ui.lifted.pitch = newPitch;
          ui.lifted.remove = false; // if moved, don't delete
          requestRedraw(); // likely redundant — setMousePos already requested one
        }
      };

      const onLiftUp = (evt: MouseEvent) => {
        // only care about the main button being released:
        if (evt.button !== 0) return;

        if (ui.lifted !== undefined) {
          const lifted = ui.lifted;
          const newGrid = new Uint8Array(gridRef.current);

          // remove note from where it started:
          newGrid[lifted.beginStep * PITCHES.length + lifted.beginPitch] &=
            ~bit;

          // if it isn't marked for removal and has a valid place in the grid...
          if (
            !lifted.remove &&
            0 <= lifted.step &&
            lifted.step < STEPS.length &&
            0 <= lifted.pitch &&
            lifted.pitch < PITCHES.length
          ) {
            // ...put it in the grid (and cancel everything else in this column):
            for (let p = 0; p < PITCHES.length; ++p) {
              if (p === lifted.pitch) {
                newGrid[lifted.step * PITCHES.length + p] |= lifted.bit;
              } else {
                newGrid[lifted.step * PITCHES.length + p] &= ~lifted.bit;
              }
            }
          }

          onChange?.(gridToCf(newGrid));
          ui.lifted = undefined;
          requestRedraw();
        }

        window.removeEventListener("mouseup", onLiftUp);
        window.removeEventListener("mousemove", onLiftMove);
        evt.preventDefault();
      };

      // can't just use 'once' option for mouseup because multi-button mice exist :-/
      window.addEventListener("mouseup", onLiftUp);
      window.addEventListener("mousemove", onLiftMove);
    };

    const onMouseMove = (evt: MouseEvent) => {
      setMousePos(canvas, uiRef.current, evt, requestRedraw);
    };
    const onMouseDown = (evt: MouseEvent) => {
      setMousePos(canvas, uiRef.current, evt, requestRedraw);
      if (evt.button === 0) startLift();
      evt.preventDefault();
    };

    const observer = new ResizeObserver(requestRedraw);
    observer.observe(canvas);

    if (editable) {
      canvas.addEventListener("mousemove", onMouseMove);
      canvas.addEventListener("mousedown", onMouseDown);
    }

    return () => {
      requestRedrawRef.current = () => {};
      observer.disconnect();
      if (editable) {
        canvas.removeEventListener("mousemove", onMouseMove);
        canvas.removeEventListener("mousedown", onMouseDown);
      }
    };
  }, [editable, onChange]);

  return <canvas ref={canvasRef} className={className} />;
}
