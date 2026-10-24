/** Scoring, summary statistics and the progress chart. */

import { Difficulty } from "../../src/puzzle/Generator.ts";
import { HistoryEntry } from "./storage.ts";

export const MULTIPLIER: { [d in Difficulty]: number } = { easy: 1, medium: 2, hard: 3, extreme: 5 };
export const DIFFICULTY_LABEL: { [d in Difficulty]: string } = { easy: "Easy", medium: "Medium", hard: "Hard", extreme: "Extreme" };

/** Each penalty (invalid check or "keep trying") costs 20 % of the points, down to 25 %. */
export function penaltyFactor(penalties: number): number {
    return Math.max(0.25, 1 - 0.2 * penalties);
}

export function computePoints(difficulty: Difficulty, placed: number, optimum: number, penalties: number): number {
    const share = optimum > 0 ? Math.min(1, placed / optimum) : 1;
    const bonus = placed >= optimum ? 50 : 0;
    return Math.round(MULTIPLIER[difficulty] * (100 * share + bonus) * penaltyFactor(penalties));
}

export function isOptimal(entry: HistoryEntry): boolean {
    return !entry.gaveUp && entry.placed >= entry.optimum;
}

export function accuracy(entry: HistoryEntry): number {
    if (entry.gaveUp) return 0;
    return entry.optimum > 0 ? Math.round((100 * Math.min(entry.placed, entry.optimum)) / entry.optimum) : 100;
}

export interface Summary {
    total: number;
    played: number;
    optimalRate: number;
    currentStreak: number;
    bestStreak: number;
}

export function summarize(history: HistoryEntry[]): Summary {
    let total = 0;
    let optimal = 0;
    let streak = 0;
    let bestStreak = 0;
    for (const entry of history) {
        total += entry.points;
        if (isOptimal(entry)) {
            optimal++;
            streak++;
            bestStreak = Math.max(bestStreak, streak);
        } else {
            streak = 0;
        }
    }
    return {
        total,
        played: history.length,
        optimalRate: history.length ? Math.round((100 * optimal) / history.length) : 0,
        currentStreak: streak,
        bestStreak,
    };
}

export type Metric = "points" | "accuracy";

const SVG_NS = "http://www.w3.org/2000/svg";
const AVERAGE_WINDOW = 10;

function svg<K extends keyof SVGElementTagNameMap>(name: K, attrs: { [key: string]: string | number }): SVGElementTagNameMap[K] {
    const el = document.createElementNS(SVG_NS, name);
    for (const key in attrs) el.setAttribute(key, String(attrs[key]));
    return el;
}

function niceMax(value: number): number {
    if (value <= 0) return 100;
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
        if (step * magnitude >= value) return step * magnitude;
    }
    return 10 * magnitude;
}

export function compactNumber(value: number): string {
    if (Math.abs(value) >= 10000) return (value / 1000).toFixed(0) + "K";
    if (Math.abs(value) >= 1000) return (value / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(Math.round(value));
}

export function formatDate(time: number): string {
    return new Date(time).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Renders the progress chart: one dot per finished puzzle plus the moving average.
 * @param numbers the puzzle numbers (position in the full history) of the entries
 */
export function renderChart(container: HTMLElement, tooltip: HTMLElement, entries: HistoryEntry[], numbers: number[], metric: Metric) {
    container.replaceChildren();
    tooltip.hidden = true;
    if (entries.length === 0) {
        const empty = document.createElement("p");
        empty.className = "chart-empty";
        empty.textContent = "No finished puzzles yet. Your progress will show up here.";
        container.append(empty);
        return;
    }
    const width = Math.max(280, container.clientWidth || 600);
    const height = 240;
    const margin = { top: 14, right: 46, bottom: 28, left: 40 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;

    const values = entries.map(e => (metric === "points" ? e.points : accuracy(e)));
    const averages = values.map((_, i) => {
        const from = Math.max(0, i - AVERAGE_WINDOW + 1);
        const slice = values.slice(from, i + 1);
        return slice.reduce((a, b) => a + b, 0) / slice.length;
    });
    const yMax = metric === "accuracy" ? 100 : niceMax(Math.max(...values));
    const n = entries.length;
    const x = (i: number) => margin.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const y = (v: number) => margin.top + plotH - (v / yMax) * plotH;

    const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, width, height, role: "img", class: "chart-svg" });
    root.setAttribute("aria-label", (metric === "points" ? "Points" : "Accuracy") + " per puzzle with moving average");

    // grid and y axis
    const ticks = 4;
    for (let t = 0; t <= ticks; t++) {
        const v = (yMax / ticks) * t;
        const gy = y(v);
        root.append(svg("line", { x1: margin.left, x2: width - margin.right, y1: gy, y2: gy, class: t === 0 ? "axis" : "grid" }));
        const label = svg("text", { x: margin.left - 8, y: gy + 4, "text-anchor": "end", class: "tick" });
        label.textContent = metric === "accuracy" ? v + "%" : compactNumber(v);
        root.append(label);
    }
    // x axis ticks: puzzle numbers
    const xTicks = Math.min(n, 6);
    const used = new Set<number>();
    for (let t = 0; t < xTicks; t++) {
        const i = xTicks === 1 ? 0 : Math.round((t / (xTicks - 1)) * (n - 1));
        if (used.has(i)) continue;
        used.add(i);
        const label = svg("text", { x: x(i), y: height - 8, "text-anchor": "middle", class: "tick" });
        label.textContent = "#" + numbers[i];
        root.append(label);
    }

    // moving average line
    if (n > 1) {
        const d = averages.map((v, i) => (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
        root.append(svg("path", { d, class: "avg-line" }));
        const endLabel = svg("text", { x: x(n - 1) + 8, y: y(averages[n - 1]) + 4, class: "end-label" });
        endLabel.textContent = metric === "accuracy" ? Math.round(averages[n - 1]) + "%" : compactNumber(averages[n - 1]);
        root.append(endLabel);
    }

    // dots
    const dots = values.map((v, i) => {
        const dot = svg("circle", { cx: x(i), cy: y(v), r: n > 60 ? 3 : 4, class: "dot" + (entries[i].gaveUp ? " gave-up" : "") });
        root.append(dot);
        return dot;
    });

    // hover layer
    const cross = svg("line", { x1: 0, x2: 0, y1: margin.top, y2: margin.top + plotH, class: "crosshair" });
    cross.style.display = "none";
    const focus = svg("circle", { cx: 0, cy: 0, r: 6, class: "dot focus" });
    focus.style.display = "none";
    root.append(cross, focus);
    const hit = svg("rect", { x: margin.left - 10, y: 0, width: plotW + 20, height, fill: "transparent" });
    root.append(hit);

    function show(i: number) {
        const e = entries[i];
        cross.setAttribute("x1", String(x(i)));
        cross.setAttribute("x2", String(x(i)));
        cross.style.display = "";
        focus.setAttribute("cx", String(x(i)));
        focus.setAttribute("cy", String(y(values[i])));
        focus.style.display = "";
        dots.forEach((dot, k) => dot.classList.toggle("dimmed", k !== i));
        tooltip.innerHTML = "";
        const head = document.createElement("div");
        head.className = "tt-head";
        head.textContent = `Puzzle #${numbers[i]} · ${DIFFICULTY_LABEL[e.difficulty]}`;
        const date = document.createElement("div");
        date.className = "tt-muted";
        date.textContent = formatDate(e.time);
        const rows = document.createElement("dl");
        const add = (label: string, value: string, key?: string) => {
            const dt = document.createElement("dt");
            if (key) {
                const swatch = document.createElement("span");
                swatch.className = "key " + key;
                dt.append(swatch);
            }
            dt.append(label);
            const dd = document.createElement("dd");
            dd.textContent = value;
            rows.append(dt, dd);
        };
        add(metric === "points" ? "Points" : "Accuracy", metric === "points" ? String(values[i]) : values[i] + "%", "key-dot");
        add("Average", metric === "points" ? String(Math.round(averages[i])) : Math.round(averages[i]) + "%", "key-line");
        add("Tiles placed", e.gaveUp ? "gave up" : `${e.placed} of ${e.optimum}`);
        if (e.penalties) add("Penalties", String(e.penalties));
        tooltip.append(head, date, rows);
        tooltip.hidden = false;
        const box = container.getBoundingClientRect();
        const scale = box.width / width;
        const tipW = tooltip.offsetWidth;
        let left = x(i) * scale + 14;
        if (left + tipW > box.width) left = x(i) * scale - tipW - 14;
        tooltip.style.left = Math.max(0, left) + "px";
        tooltip.style.top = Math.max(0, y(values[i]) * scale - 20) + "px";
    }

    function hide() {
        cross.style.display = "none";
        focus.style.display = "none";
        dots.forEach(dot => dot.classList.remove("dimmed"));
        tooltip.hidden = true;
    }

    hit.addEventListener("pointermove", event => {
        const box = root.getBoundingClientRect();
        const px = ((event.clientX - box.left) / box.width) * width;
        const i = n === 1 ? 0 : Math.round(((px - margin.left) / plotW) * (n - 1));
        show(Math.max(0, Math.min(n - 1, i)));
    });
    hit.addEventListener("pointerleave", hide);
    container.append(root);
}
