import { generatePuzzle, Difficulty, DIFFICULTIES, Puzzle } from "../../src/puzzle/Generator.ts";
import { Tile, tileFromId, isJoker, compareTiles, compareTilesByColor, COLORS } from "../../src/puzzle/Tile.ts";
import { analyzeSet, evaluateArrangement } from "../../src/puzzle/Rules.ts";
import { sfx, setSoundEnabled } from "./sound.ts";
import { confetti } from "./confetti.ts";
import { store, HistoryEntry, SavedGame } from "./storage.ts";
import {
    computePoints, penaltyFactor, summarize, renderChart, Metric, DIFFICULTY_LABEL, MULTIPLIER,
    accuracy, formatDate, isOptimal,
} from "./stats.ts";

type Target = { kind: "set"; index: number } | { kind: "new" } | { kind: "rack" };

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
}

const ui = {
    app: byId("app"),
    table: byId("table"),
    rack: byId("rack"),
    totalScore: byId("total-score"),
    scoreChip: byId("score-chip"),
    puzzleId: byId("puzzle-id"),
    counter: byId("placed-counter"),
    difficulty: byId("difficulty"),
    btnNew: byId<HTMLButtonElement>("btn-new"),
    btnCheck: byId<HTMLButtonElement>("btn-check"),
    btnReset: byId<HTMLButtonElement>("btn-reset"),
    btnGiveUp: byId<HTMLButtonElement>("btn-giveup"),
    btnSort: byId<HTMLButtonElement>("btn-sort"),
    btnStats: byId<HTMLButtonElement>("btn-stats"),
    btnSound: byId<HTMLButtonElement>("btn-sound"),
    btnHelp: byId<HTMLButtonElement>("btn-help"),
    btnInstall: byId<HTMLButtonElement>("btn-install"),
    resultDialog: byId<HTMLDialogElement>("result-dialog"),
    resultContent: byId("result-content"),
    statsDialog: byId<HTMLDialogElement>("stats-dialog"),
    helpDialog: byId<HTMLDialogElement>("help-dialog"),
    toast: byId("toast"),
    loading: byId("loading"),
    confetti: byId<HTMLCanvasElement>("confetti"),
};

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const settings = store.settings();
let history: HistoryEntry[] = store.history();
let game: SavedGame | null = null;
let boardIds = new Set<number>();
let selected: number | null = null;
let rackSort: "value" | "color" = "value";
let displayedScore = 0;
let statsFilter: Difficulty | "all" = "all";
let statsMetric: Metric = "points";
/** the "better solution exists" dialog is open */
let betterPending = false;

// ---------------------------------------------------------------- puzzles

interface Request {
    seed: number;
    difficulty: Difficulty;
    resolve: (p: Puzzle) => void;
    reject: (e: unknown) => void;
}

let worker: Worker | null | undefined;
let requestId = 0;
const pending = new Map<number, Request>();

/** Generates the puzzle on the main thread. */
function generateHere(request: Request) {
    try {
        request.resolve(generatePuzzle(request.seed, request.difficulty));
    } catch (e) {
        request.reject(e);
    }
}

function getWorker(): Worker | null {
    if (worker !== undefined) return worker;
    try {
        worker = new Worker("worker.js");
        worker.onmessage = event => {
            const request = pending.get(event.data.id);
            if (!request) return;
            pending.delete(event.data.id);
            if (event.data.puzzle) request.resolve(event.data.puzzle);
            else request.reject(new Error(event.data.error));
        };
        worker.onerror = () => {
            // fall back to generating on the main thread
            worker = null;
            pending.forEach(generateHere);
            pending.clear();
        };
    } catch {
        worker = null;
    }
    return worker;
}

function createPuzzle(seed: number, difficulty: Difficulty): Promise<Puzzle> {
    return new Promise((resolve, reject) => {
        const request = { seed, difficulty, resolve, reject };
        const w = getWorker();
        if (!w) {
            generateHere(request);
            return;
        }
        const id = ++requestId;
        pending.set(id, request);
        w.postMessage({ id, seed, difficulty });
    });
}

function randomSeed(): number {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return 100000 + (buffer[0] % 900000);
}

/** Puzzles generated ahead of time, so that the next one is ready when it is asked for. */
const prefetched = new Map<Difficulty, Promise<Puzzle>>();

/** Generates the next puzzle of a difficulty in the background (extreme puzzles take a moment). */
function prefetch(difficulty: Difficulty) {
    if (prefetched.has(difficulty) || !getWorker()) return;
    const promise = createPuzzle(randomSeed(), difficulty);
    promise.catch(() => prefetched.delete(difficulty));
    prefetched.set(difficulty, promise);
}

async function nextPuzzle(difficulty: Difficulty): Promise<Puzzle> {
    const ready = prefetched.get(difficulty);
    prefetched.delete(difficulty);
    try {
        return await (ready || createPuzzle(randomSeed(), difficulty));
    } catch {
        // generation failed for this seed: another seed will do
        return await createPuzzle(randomSeed(), difficulty);
    }
}

let puzzleRequest = 0;

async function newPuzzle() {
    closeDialog(ui.resultDialog);
    const request = ++puzzleRequest;
    const difficulty = settings.difficulty;
    // the spinner only shows for the newest request: an older one may finish later
    const loadingTimer = setTimeout(() => {
        if (request === puzzleRequest) ui.loading.hidden = false;
    }, 150);
    let puzzle: Puzzle;
    try {
        puzzle = await nextPuzzle(difficulty);
    } catch {
        clearTimeout(loadingTimer);
        if (request !== puzzleRequest) return;
        ui.loading.hidden = true;
        toast("Could not create a puzzle. Please try again.", "error");
        return;
    }
    clearTimeout(loadingTimer);
    // a newer request (another difficulty was chosen meanwhile) has taken over
    if (request !== puzzleRequest) return;
    ui.loading.hidden = true;
    startGame({
        puzzle,
        sets: puzzle.board.map(set => set.slice()),
        rack: puzzle.hand.slice(),
        penalties: 0,
        startedAt: Date.now(),
        finished: false,
    }, true);
}

function startGame(saved: SavedGame, deal: boolean) {
    game = saved;
    if (settings.difficulty !== saved.puzzle.difficulty) {
        settings.difficulty = saved.puzzle.difficulty;
        saveSettings();
    }
    setRadio(ui.difficulty, "difficulty", settings.difficulty);
    boardIds = new Set(([] as number[]).concat(...saved.puzzle.board));
    selected = null;
    saveGame();
    render({ deal });
    if (deal) sfx.deal(saved.puzzle.hand.length + boardIds.size);
    prefetch(settings.difficulty);
}

function saveGame() {
    store.saveGame(game);
}

// ---------------------------------------------------------------- rendering

const JOKER_FACE = `<svg class="joker-face" viewBox="0 0 32 32" aria-hidden="true">
<circle cx="16" cy="16" r="12.5" fill="none" stroke="currentColor" stroke-width="2.4"/>
<circle cx="11.5" cy="13" r="1.9" fill="currentColor"/><circle cx="20.5" cy="13" r="1.9" fill="currentColor"/>
<path d="M10 18.5c1.6 3 3.6 4.4 6 4.4s4.4-1.4 6-4.4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
</svg>`;

function tileElement(tile: Tile, standsFor?: number): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tile";
    button.dataset.id = String(tile.id);
    if (isJoker(tile)) {
        button.classList.add("joker");
        button.innerHTML = JOKER_FACE + (standsFor ? `<span class="stands-for">${standsFor}</span>` : "");
        button.setAttribute("aria-label", "Joker" + (standsFor ? " as " + standsFor : ""));
    } else {
        button.classList.add("c-" + COLORS[tile.color]);
        button.innerHTML = `<span class="num">${tile.value}</span><span class="pip" aria-hidden="true"></span>`;
        button.setAttribute("aria-label", COLORS[tile.color] + " " + tile.value);
    }
    if (!boardIds.has(tile.id)) button.classList.add("own");
    if (selected === tile.id) {
        button.classList.add("selected");
        button.setAttribute("aria-pressed", "true");
    }
    return button;
}

/** The "+" target shown in a set while a tile is selected. A real button so that
 *  assistive tools (screen readers, Voice Access "show numbers") can target it. */
function slotElement(index: number): HTMLButtonElement {
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "slot";
    slot.setAttribute("aria-label", `Add to set ${index + 1}`);
    slot.title = `Add to set ${index + 1}`;
    slot.textContent = "+";
    return slot;
}

interface RenderOptions {
    deal?: boolean;
    /** positions of tiles before the change, for the move animation */
    before?: Map<number, DOMRect>;
    /** sets to highlight after rendering */
    highlight?: { index: number; className: string }[];
}

function render(options: RenderOptions = {}) {
    if (!game) return;
    const g = game;
    // drag copies that are not part of the current drag must never stay on screen
    document.querySelectorAll(".tile.ghost:not(.returning)").forEach(ghost => {
        if (!drag || ghost !== drag.ghost) ghost.remove();
    });
    ui.app.classList.toggle("finished", g.finished);
    ui.app.classList.toggle("has-selection", selected !== null);

    // table
    ui.table.replaceChildren();
    let dealIndex = 0;
    g.sets.forEach((ids, index) => {
        const tiles = ids.map(tileFromId);
        const meld = analyzeSet(tiles);
        const ordered = meld ? meld.tiles : tiles.slice().sort(compareTiles);
        const set = document.createElement("div");
        set.className = "set " + (meld ? "valid " + meld.kind : "invalid");
        set.dataset.drop = "set";
        set.dataset.index = String(index);
        set.tabIndex = 0;
        set.setAttribute("role", "group");
        set.setAttribute("aria-label", `Set ${index + 1}: ` + (meld ? "valid " + meld.kind : "not valid"));
        ordered.forEach((tile, k) => {
            const t = tileElement(tile, meld && isJoker(tile) ? meld.values[k] : undefined);
            if (options.deal) t.style.setProperty("--deal", String(dealIndex++));
            set.append(t);
        });
        if (selected !== null && !ids.includes(selected)) set.append(slotElement(index));
        ui.table.append(set);
    });
    const zone = document.createElement("button");
    zone.type = "button";
    zone.className = "new-set";
    zone.dataset.drop = "new";
    zone.innerHTML = `<span class="plus" aria-hidden="true">+</span><span>New set</span>`;
    ui.table.append(zone);

    // rack
    ui.rack.replaceChildren();
    const rackTiles = g.rack.map(tileFromId).sort(rackSort === "value" ? compareTiles : compareTilesByColor);
    rackTiles.forEach(tile => {
        const t = tileElement(tile);
        if (options.deal) t.style.setProperty("--deal", String(dealIndex++));
        ui.rack.append(t);
    });
    if (rackTiles.length === 0) {
        const empty = document.createElement("span");
        empty.className = "rack-empty";
        empty.textContent = "All tiles placed!";
        ui.rack.append(empty);
    }
    if (options.deal && !reducedMotion()) {
        ui.app.classList.remove("dealing");
        void ui.app.offsetWidth;
        ui.app.classList.add("dealing");
        setTimeout(() => ui.app.classList.remove("dealing"), 1600);
    }

    // header info
    ui.puzzleId.textContent = `#${g.puzzle.seed} · ${DIFFICULTY_LABEL[g.puzzle.difficulty]}`;
    const placed = g.puzzle.hand.length - g.rack.length;
    ui.counter.textContent = g.finished
        ? "Finished. Try a new puzzle!"
        : `${placed} of ${g.puzzle.hand.length} rack tiles placed`;
    ui.btnCheck.disabled = g.finished;
    ui.btnReset.disabled = g.finished;
    ui.btnGiveUp.querySelector(".label")!.textContent = g.finished ? "Result" : "Give up";
    ui.btnGiveUp.title = g.finished ? "Show the result and an optimal solution" : "Give up and show an optimal solution";
    ui.btnSort.textContent = rackSort === "value" ? "Sort by color" : "Sort by number";

    if (options.before) animateMoves(options.before);
    if (options.highlight) {
        options.highlight.forEach(h => {
            const set = ui.table.querySelector(`.set[data-index="${h.index}"]`);
            if (set) restartAnimation(set, h.className);
        });
    }
}

function restartAnimation(element: Element, className: string) {
    element.classList.remove(className);
    void (element as HTMLElement).offsetWidth;
    element.classList.add(className);
    element.addEventListener("animationend", () => element.classList.remove(className), { once: true });
}

function tilePositions(): Map<number, DOMRect> {
    const positions = new Map<number, DOMRect>();
    document.querySelectorAll<HTMLElement>("#table .tile, #rack .tile").forEach(t => {
        positions.set(Number(t.dataset.id), t.getBoundingClientRect());
    });
    return positions;
}

/** FLIP animation: tiles glide from where they were to where they are now. */
function animateMoves(before: Map<number, DOMRect>) {
    if (reducedMotion()) return;
    document.querySelectorAll<HTMLElement>("#table .tile, #rack .tile").forEach(t => {
        const old = before.get(Number(t.dataset.id));
        if (!old) return;
        const now = t.getBoundingClientRect();
        const dx = old.left - now.left;
        const dy = old.top - now.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        t.animate(
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
            { duration: 320, easing: "cubic-bezier(.2, .9, .3, 1.15)" },
        );
    });
}

// ---------------------------------------------------------------- moves

function locate(id: number): Target | null {
    if (!game) return null;
    if (game.rack.includes(id)) return { kind: "rack" };
    const index = game.sets.findIndex(set => set.includes(id));
    return index >= 0 ? { kind: "set", index } : null;
}

function targetOf(element: Element | null): Target | null {
    const drop = element && element.closest<HTMLElement>("[data-drop]");
    if (!drop) return null;
    if (drop.dataset.drop === "rack") return { kind: "rack" };
    if (drop.dataset.drop === "new") return { kind: "new" };
    return { kind: "set", index: Number(drop.dataset.index) };
}

function canMove(id: number, target: Target): boolean {
    if (!game || game.finished) return false;
    const from = locate(id);
    if (!from) return false;
    if (target.kind === "rack") return !boardIds.has(id) && from.kind !== "rack";
    if (target.kind === "set" && from.kind === "set" && from.index === target.index) return false;
    if (target.kind === "new" && from.kind === "set" && game.sets[from.index].length === 1) return false;
    return true;
}

/** Moves a tile; returns false if the move isn't allowed. */
function moveTile(id: number, target: Target, before?: Map<number, DOMRect>): boolean {
    if (!game || !canMove(id, target)) return false;
    const g = game;
    const from = locate(id) as Target;
    const positions = before || tilePositions();
    const wasValid = target.kind === "set" ? analyzeSet(g.sets[target.index].map(tileFromId)) !== null : false;

    if (from.kind === "rack") g.rack.splice(g.rack.indexOf(id), 1);
    else if (from.kind === "set") g.sets[from.index].splice(g.sets[from.index].indexOf(id), 1);

    let destination: number[] | null = null;
    if (target.kind === "rack") {
        g.rack.push(id);
    } else if (target.kind === "new") {
        destination = [id];
        g.sets.push(destination);
    } else {
        destination = g.sets[target.index];
        destination.push(id);
    }
    g.sets = g.sets.filter(set => set.length > 0);
    selected = null;
    saveGame();

    const highlight: { index: number; className: string }[] = [];
    if (destination) {
        const index = g.sets.indexOf(destination);
        const nowValid = analyzeSet(destination.map(tileFromId)) !== null;
        if (nowValid && !wasValid) {
            highlight.push({ index, className: "just-valid" });
            sfx.validSet();
        }
    }
    sfx.drop();
    render({ before: positions, highlight });
    return true;
}

function moveSelectedTo(target: Target) {
    if (selected === null) return;
    if (!moveTile(selected, target)) {
        sfx.deny();
        if (target.kind === "rack") toast("Tiles from the table can't go to your rack.");
    }
}

// ---------------------------------------------------------------- drag and drop

interface DragState {
    id: number;
    pointerId: number;
    source: HTMLElement;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    x: number;
    y: number;
    ghost: HTMLElement | null;
    target: Target | null;
    targetElement: HTMLElement | null;
    /** the edges of the table only scroll after the pointer has been away from them */
    scrollUpArmed: boolean;
    scrollDownArmed: boolean;
}

let drag: DragState | null = null;
let suppressClick = false;
let scrollFrame = 0;

const tableArea = document.querySelector(".table-area") as HTMLElement;

function onPointerDown(event: PointerEvent) {
    if (drag && drag.ghost) {
        // another finger touches while a tile is dragged: put the dragged tile back
        cancelDrag();
        return;
    }
    if (!game || game.finished || event.button !== 0) return;
    const source = (event.target as Element).closest<HTMLElement>("#table .tile, #rack .tile");
    if (!source) return;
    const rect = source.getBoundingClientRect();
    drag = {
        id: Number(source.dataset.id),
        pointerId: event.pointerId,
        source,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        x: event.clientX,
        y: event.clientY,
        ghost: null,
        target: null,
        targetElement: null,
        scrollUpArmed: false,
        scrollDownArmed: false,
    };
}

function onPointerMove(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (event.pointerType === "mouse" && event.buttons === 0) {
        // the button was released outside of the window
        cancelDrag();
        return;
    }
    if (!drag.ghost) {
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
        startDrag(drag);
    }
    event.preventDefault();
    drag.x = event.clientX;
    drag.y = event.clientY;
    positionGhost(drag);
    updateTarget(drag);
    if (!scrollFrame && autoScrollSpeed(drag) !== 0) scrollFrame = requestAnimationFrame(autoScroll);
}

function updateTarget(state: DragState) {
    const under = document.elementFromPoint(state.x, state.y);
    const target = targetOf(under);
    const targetElement = under ? under.closest<HTMLElement>("[data-drop]") : null;
    if (targetElement !== state.targetElement) {
        if (state.targetElement) state.targetElement.classList.remove("drop-ok", "drop-denied");
        state.targetElement = targetElement;
        if (targetElement && target) {
            targetElement.classList.add(canMove(state.id, target) ? "drop-ok" : "drop-denied");
        }
    }
    state.target = target;
}

/**
 * Scroll speed in pixels per frame when a tile is dragged close to the top or bottom of the table
 * (or above it), so that sets out of sight can be reached.
 */
function autoScrollSpeed(state: DragState): number {
    const area = tableArea.getBoundingClientRect();
    const zone = Math.min(64, area.height / 4);
    const top = area.top + zone;
    const bottom = area.bottom - zone;
    if (state.y >= top) state.scrollUpArmed = true;
    if (state.y <= bottom) state.scrollDownArmed = true;
    if (state.y < top && state.scrollUpArmed) return -Math.ceil(16 * Math.min(1, (top - state.y) / zone));
    if (state.y > bottom && state.y <= area.bottom && state.scrollDownArmed) {
        return Math.ceil(16 * Math.min(1, (state.y - bottom) / zone));
    }
    return 0;
}

function autoScroll() {
    scrollFrame = 0;
    if (!drag || !drag.ghost) return;
    const speed = autoScrollSpeed(drag);
    if (speed === 0) return;
    const before = tableArea.scrollTop;
    tableArea.scrollTop += speed;
    // At the boundary nothing moves: stop until the next pointer move rearms the loop.
    if (tableArea.scrollTop === before) return;
    updateTarget(drag);
    scrollFrame = requestAnimationFrame(autoScroll);
}

function stopAutoScroll() {
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
}

function startDrag(state: DragState) {
    selected = null;
    ui.app.classList.remove("has-selection");
    document.querySelectorAll(".tile.selected").forEach(t => t.classList.remove("selected"));
    document.querySelectorAll(".slot").forEach(s => s.remove());
    const rect = state.source.getBoundingClientRect();
    const ghost = state.source.cloneNode(true) as HTMLElement;
    ghost.classList.add("ghost");
    ghost.style.width = rect.width + "px";
    ghost.style.height = rect.height + "px";
    document.body.append(ghost);
    state.ghost = ghost;
    state.source.classList.add("lifted");
    ui.app.classList.add("dragging");
    sfx.pick();
}

function positionGhost(state: DragState) {
    if (!state.ghost) return;
    state.ghost.style.transform = `translate(${state.x - state.offsetX}px, ${state.y - state.offsetY}px) rotate(-4deg) scale(1.12)`;
}

/** Ends a drag without moving the tile: it flies back to where it came from. */
function cancelDrag() {
    const state = drag;
    drag = null;
    stopAutoScroll();
    if (!state || !state.ghost) return;
    ui.app.classList.remove("dragging");
    if (state.targetElement) state.targetElement.classList.remove("drop-ok", "drop-denied");
    flyBack(state, state.ghost);
}

function flyBack(state: DragState, ghost: HTMLElement) {
    const home = state.source.getBoundingClientRect();
    ghost.classList.add("returning");
    ghost.style.transform = `translate(${home.left}px, ${home.top}px)`;
    setTimeout(() => {
        ghost.remove();
        state.source.classList.remove("lifted");
    }, reducedMotion() ? 0 : 220);
}

function onPointerUp(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const state = drag;
    drag = null;
    stopAutoScroll();
    if (!state.ghost) return; // a click, handled by onClick
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
    ui.app.classList.remove("dragging");
    if (state.targetElement) state.targetElement.classList.remove("drop-ok", "drop-denied");
    const ghost = state.ghost;
    const target = event.type === "pointerup" ? state.target : null;
    if (target && canMove(state.id, target)) {
        const positions = tilePositions();
        positions.set(state.id, ghost.getBoundingClientRect());
        ghost.remove();
        moveTile(state.id, target, positions);
        return;
    }
    if (target) {
        sfx.deny();
        if (target.kind === "rack") toast("Tiles from the table can't go to your rack.");
    }
    flyBack(state, ghost);
}

function onClick(event: MouseEvent) {
    if (suppressClick) {
        suppressClick = false;
        return;
    }
    if (!game || game.finished) return;
    const target = event.target as Element;
    const tile = target.closest<HTMLElement>("#table .tile, #rack .tile");
    if (tile) {
        const id = Number(tile.dataset.id);
        selected = selected === id ? null : id;
        if (selected !== null) sfx.pick();
        render();
        return;
    }
    if (selected !== null) {
        const drop = targetOf(target);
        if (drop) moveSelectedTo(drop);
    }
}

function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && selected !== null) {
        selected = null;
        render();
        return;
    }
    if ((event.key === "Enter" || event.key === " ") && selected !== null) {
        const active = document.activeElement as HTMLElement | null;
        if (active && active.matches("[data-drop]")) {
            event.preventDefault();
            moveSelectedTo(targetOf(active) as Target);
        }
    }
}

// ---------------------------------------------------------------- checking and scoring

function check() {
    if (!game || game.finished) return;
    const g = game;
    selected = null;
    const evaluation = evaluateArrangement(g.sets.map(set => set.map(tileFromId)), Array.from(boardIds));
    if (!evaluation.valid) {
        g.penalties++;
        saveGame();
        sfx.fail();
        render({ highlight: evaluation.invalidSets.map(index => ({ index, className: "shake" })) });
        const count = evaluation.invalidSets.length;
        toast(count === 1 ? "One set is not valid yet." : `${count} sets are not valid yet.`, "error");
        return;
    }
    if (evaluation.placed >= g.puzzle.optimum) {
        finish(evaluation.placed, false);
    } else {
        render();
        sfx.partial();
        showBetterExists(evaluation.placed);
    }
}

function showBetterExists(placed: number) {
    if (!game) return;
    const optimum = game.puzzle.optimum;
    const missing = optimum - placed;
    ui.resultContent.innerHTML = `
        <div class="result-hero partial">
            <div class="medal" aria-hidden="true">🤔</div>
            <h2 id="result-title">Valid, but there is a better solution</h2>
            <p>You placed <strong>${placed}</strong> ${placed === 1 ? "tile" : "tiles"}. It is possible to place
            <strong>${optimum}</strong>, that is ${missing} more.</p>
        </div>
        <div class="result-actions">
            <button class="btn ghost" type="button" data-action="finish">Finish &amp; show solution</button>
            <button class="btn primary" type="button" data-action="retry">Keep trying</button>
        </div>
        <p class="fineprint">Trying again costs 20 % of the points.</p>`;
    betterPending = true;
    openDialog(ui.resultDialog);
}

function finish(placed: number, gaveUp: boolean) {
    if (!game || game.finished) return;
    const g = game;
    const points = gaveUp ? 0 : computePoints(g.puzzle.difficulty, placed, g.puzzle.optimum, g.penalties);
    const entry: HistoryEntry = {
        time: Date.now(),
        difficulty: g.puzzle.difficulty,
        seed: g.puzzle.seed,
        placed: gaveUp ? 0 : placed,
        optimum: g.puzzle.optimum,
        points,
        penalties: g.penalties,
        durationMs: Date.now() - g.startedAt,
        gaveUp,
    };
    history.push(entry);
    store.saveHistory(history);
    g.finished = true;
    selected = null;
    saveGame();
    render();
    showResult(entry);
    setScore(summarize(history).total, true);
}

function solutionMarkup(puzzle: Puzzle): string {
    const own = new Set(puzzle.hand);
    return puzzle.solution.map(set => {
        const tiles = set.map(tileFromId);
        const meld = analyzeSet(tiles);
        return `<div class="mini-set">${tiles.map((t, k) => {
            const ownClass = own.has(t.id) ? " own" : "";
            if (isJoker(t)) return `<span class="mini joker${ownClass}" title="Joker">J<sub>${meld ? meld.values[k] : ""}</sub></span>`;
            return `<span class="mini c-${COLORS[t.color]}${ownClass}" title="${COLORS[t.color]} ${t.value}">${t.value}<span class="pip"></span></span>`;
        }).join("")}</div>`;
    }).join("");
}

function showResult(entry: HistoryEntry, celebrate = true) {
    if (!game) return;
    const optimal = isOptimal(entry);
    const summary = summarize(history);
    let medal: string;
    let title: string;
    let text: string;
    if (entry.gaveUp) {
        medal = "💡";
        title = "Here is an optimal solution";
        text = `It places <strong>${entry.optimum}</strong> ${entry.optimum === 1 ? "tile" : "tiles"} from your rack.`;
    } else if (optimal) {
        medal = entry.penalties === 0 ? "🏆" : "🎉";
        title = entry.penalties === 0 ? "Perfect! That's optimal." : "Optimal solution found!";
        text = `You placed all <strong>${entry.placed}</strong> tiles that can be placed.`;
    } else {
        medal = "👍";
        title = "Good effort";
        text = `You placed <strong>${entry.placed}</strong> of <strong>${entry.optimum}</strong> possible tiles.`;
    }
    const factor = penaltyFactor(entry.penalties);
    const details = entry.gaveUp ? "" : [
        `<li><span>Difficulty</span><span>${DIFFICULTY_LABEL[entry.difficulty]} ×${MULTIPLIER[entry.difficulty]}</span></li>`,
        `<li><span>Accuracy</span><span>${accuracy(entry)} %</span></li>`,
        entry.penalties ? `<li><span>Penalties</span><span>${entry.penalties} (×${factor.toFixed(2).replace(/0$/, "")})</span></li>` : "",
        optimal && summary.currentStreak > 1 ? `<li><span>Optimal streak</span><span>🔥 ${summary.currentStreak}</span></li>` : "",
    ].join("");
    ui.resultContent.innerHTML = `
        <div class="result-hero ${optimal ? "success" : entry.gaveUp ? "gaveup" : "partial"}">
            <div class="medal" aria-hidden="true">${medal}</div>
            <h2 id="result-title">${title}</h2>
            <p>${text}</p>
            <div class="points">+<span id="result-points">0</span> <small>points</small></div>
        </div>
        <ul class="result-details">${details}</ul>
        <div class="solution">
            <h3>${optimal ? "Another way to do it" : "Optimal solution"}</h3>
            <p class="fineprint">Tiles from your rack are highlighted.</p>
            <div class="solution-sets">${solutionMarkup(game.puzzle)}</div>
        </div>
        <div class="result-actions">
            <button class="btn ghost" type="button" data-action="close">Look at the table</button>
            <button class="btn primary" type="button" data-action="next">Next puzzle</button>
        </div>`;
    openDialog(ui.resultDialog);
    countUp(byId("result-points"), 0, entry.points, celebrate ? 900 : 0);
    if (optimal && celebrate) {
        sfx.success();
        const medalElement = ui.resultContent.querySelector(".medal");
        const rect = medalElement ? medalElement.getBoundingClientRect() : null;
        confetti(ui.confetti, rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : undefined);
    }
}

function onResultAction(event: MouseEvent) {
    const button = (event.target as Element).closest<HTMLElement>("[data-action]");
    if (!button || !game) return;
    switch (button.dataset.action) {
        case "retry":
            closeDialog(ui.resultDialog); // the close handler counts the penalty
            break;
        case "finish": {
            betterPending = false;
            const evaluation = evaluateArrangement(game.sets.map(set => set.map(tileFromId)), Array.from(boardIds));
            closeDialog(ui.resultDialog);
            finish(evaluation.placed, false);
            break;
        }
        case "close":
            closeDialog(ui.resultDialog);
            break;
        case "next":
            newPuzzle();
            break;
    }
}

function giveUp() {
    if (!game) return;
    if (!game.finished) {
        finish(0, true);
        return;
    }
    // after the end the button shows the result again
    const last = history[history.length - 1];
    if (last && last.seed === game.puzzle.seed) showResult(last, false);
}

function reset() {
    if (!game || game.finished) return;
    const positions = tilePositions();
    game.sets = game.puzzle.board.map(set => set.slice());
    game.rack = game.puzzle.hand.slice();
    selected = null;
    saveGame();
    sfx.deal(6);
    render({ before: positions });
}

// ---------------------------------------------------------------- score, toasts, dialogs

function setScore(total: number, animate: boolean) {
    if (animate && total !== displayedScore) {
        countUp(ui.totalScore, displayedScore, total, 1000);
        restartAnimation(ui.scoreChip, "bump");
    } else {
        ui.totalScore.textContent = total.toLocaleString();
    }
    displayedScore = total;
}

function countUp(element: HTMLElement, from: number, to: number, duration: number) {
    if (reducedMotion()) {
        element.textContent = to.toLocaleString();
        return;
    }
    const start = performance.now();
    const step = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        element.textContent = Math.round(from + (to - from) * eased).toLocaleString();
        if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

let toastTimer: number | undefined;
function toast(message: string, kind: "info" | "error" = "info") {
    ui.toast.textContent = message;
    ui.toast.className = "toast show " + kind;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (ui.toast.className = "toast"), 2600);
}

function openDialog(dialog: HTMLDialogElement) {
    if (!dialog.open) dialog.showModal();
}

function closeDialog(dialog: HTMLDialogElement) {
    if (dialog.open) dialog.close();
}

// ---------------------------------------------------------------- statistics

function renderStats() {
    const summary = summarize(history);
    const tiles = [
        { label: "Total score", value: summary.total.toLocaleString() },
        { label: "Puzzles", value: String(summary.played) },
        { label: "Optimal", value: summary.optimalRate + " %" },
        { label: "Streak", value: `${summary.currentStreak} <small>best ${summary.bestStreak}</small>` },
    ];
    byId("stat-tiles").innerHTML = tiles.map(t =>
        `<div class="stat-tile"><div class="stat-label">${t.label}</div><div class="stat-value">${t.value}</div></div>`).join("");

    const numbers: number[] = [];
    const entries: HistoryEntry[] = [];
    history.forEach((entry, i) => {
        if (statsFilter === "all" || entry.difficulty === statsFilter) {
            entries.push(entry);
            numbers.push(i + 1);
        }
    });
    (document.querySelector(".chart-title .legend") as HTMLElement).hidden = entries.length === 0;
    byId("chart-title").textContent = statsMetric === "points" ? "Points per puzzle" : "Accuracy per puzzle (tiles placed vs. optimum)";
    setRadio(byId("stats-filter"), "filter", statsFilter);
    setRadio(byId("stats-metric"), "metric", statsMetric);
    renderChart(byId("chart"), byId("chart-tooltip"), entries, numbers, statsMetric);

    const rows = entries.slice(-100).reverse().map((e, k) => {
        const number = numbers[numbers.length - 1 - k];
        return `<tr><td>#${number}</td><td>${formatDate(e.time)}</td><td>${DIFFICULTY_LABEL[e.difficulty]}</td>
            <td class="num">${e.gaveUp ? "–" : e.placed + " / " + e.optimum}</td><td class="num">${accuracy(e)} %</td>
            <td class="num">${e.points}</td></tr>`;
    }).join("");
    byId("history-table").innerHTML = `<thead><tr><th>Puzzle</th><th>Date</th><th>Level</th><th class="num">Placed</th>
        <th class="num">Accuracy</th><th class="num">Points</th></tr></thead><tbody>${rows ||
        `<tr><td colspan="6">No finished puzzles yet.</td></tr>`}</tbody>`;
}

function openStats() {
    openDialog(ui.statsDialog);
    renderStats();
}

function setRadio(group: HTMLElement, key: string, value: string) {
    group.querySelectorAll<HTMLElement>("[role=radio]").forEach(button => {
        const on = button.dataset[key] === value;
        button.setAttribute("aria-checked", String(on));
        button.classList.toggle("active", on);
    });
}

// ---------------------------------------------------------------- settings

function saveSettings() {
    store.saveSettings(settings);
}

function updateSoundButton() {
    ui.btnSound.setAttribute("aria-pressed", String(settings.sound));
    ui.btnSound.classList.toggle("muted", !settings.sound);
}

function setDifficulty(difficulty: Difficulty) {
    settings.difficulty = difficulty;
    saveSettings();
    setRadio(ui.difficulty, "difficulty", difficulty);
    if (!game || game.finished || game.puzzle.difficulty !== difficulty) newPuzzle();
}

// ---------------------------------------------------------------- PWA

let installPrompt: (Event & { prompt: () => Promise<void> }) | null = null;

function setupPwa() {
    window.addEventListener("beforeinstallprompt", event => {
        event.preventDefault();
        installPrompt = event as Event & { prompt: () => Promise<void> };
        ui.btnInstall.hidden = false;
    });
    ui.btnInstall.addEventListener("click", async () => {
        if (!installPrompt) return;
        ui.btnInstall.hidden = true;
        await installPrompt.prompt();
        installPrompt = null;
    });
    // the production build contains sw.js; the development server has none, so registering fails there
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("sw.js").catch(() => undefined);
        });
    }
}

// ---------------------------------------------------------------- start

function init() {
    if (!DIFFICULTIES.includes(settings.difficulty)) settings.difficulty = "easy";
    setSoundEnabled(settings.sound);
    updateSoundButton();
    setRadio(ui.difficulty, "difficulty", settings.difficulty);
    setScore(summarize(history).total, false);

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointermove", onPointerMove, { passive: false });
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("blur", cancelDrag);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) cancelDrag();
    });
    ui.app.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    // keep the page from scrolling while a tile is dragged on touch screens
    document.addEventListener("touchmove", event => {
        if (drag && drag.ghost) event.preventDefault();
    }, { passive: false });

    ui.btnCheck.addEventListener("click", check);
    ui.btnReset.addEventListener("click", reset);
    ui.btnGiveUp.addEventListener("click", giveUp);
    ui.btnNew.addEventListener("click", () => newPuzzle());
    ui.btnSort.addEventListener("click", () => {
        const positions = tilePositions();
        rackSort = rackSort === "value" ? "color" : "value";
        render({ before: positions });
    });
    ui.btnStats.addEventListener("click", openStats);
    ui.scoreChip.addEventListener("click", openStats);
    ui.btnHelp.addEventListener("click", () => openDialog(ui.helpDialog));
    ui.btnSound.addEventListener("click", () => {
        settings.sound = !settings.sound;
        setSoundEnabled(settings.sound);
        saveSettings();
        updateSoundButton();
        sfx.pick();
    });
    ui.difficulty.addEventListener("click", event => {
        const button = (event.target as Element).closest<HTMLElement>("[data-difficulty]");
        if (button) setDifficulty(button.dataset.difficulty as Difficulty);
    });
    byId("stats-filter").addEventListener("click", event => {
        const button = (event.target as Element).closest<HTMLElement>("[data-filter]");
        if (!button) return;
        statsFilter = button.dataset.filter as Difficulty | "all";
        renderStats();
    });
    byId("stats-metric").addEventListener("click", event => {
        const button = (event.target as Element).closest<HTMLElement>("[data-metric]");
        if (!button) return;
        statsMetric = button.dataset.metric as Metric;
        renderStats();
    });
    byId("btn-reset-history").addEventListener("click", () => {
        if (!confirm("Delete your whole score history?")) return;
        history = [];
        store.saveHistory(history);
        setScore(0, false);
        renderStats();
    });
    ui.resultDialog.addEventListener("click", onResultAction);
    document.querySelectorAll<HTMLDialogElement>("dialog").forEach(dialog => {
        dialog.addEventListener("click", event => {
            if ((event.target as Element).closest("[data-close]")) {
                dialog.close();
                return;
            }
            // a click on the backdrop
            if (event.target !== dialog) return;
            const box = dialog.getBoundingClientRect();
            const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
            if (!inside) dialog.close();
        });
    });
    // leaving the "better solution exists" dialog in any way means trying again
    ui.resultDialog.addEventListener("close", () => {
        if (betterPending && game && !game.finished) {
            game.penalties++;
            saveGame();
        }
        betterPending = false;
    });
    let resizeTimer: number | undefined;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
            if (ui.statsDialog.open) renderStats();
        }, 150);
    });
    setupPwa();

    const saved = store.game();
    if (saved && saved.puzzle && !saved.finished && DIFFICULTIES.includes(saved.puzzle.difficulty)) {
        startGame(saved, true);
    } else {
        newPuzzle();
    }
    if (!settings.seenHelp) {
        openDialog(ui.helpDialog);
        settings.seenHelp = true;
        saveSettings();
    }
}

init();
