/** What is shared about a finished puzzle, and where it can be shared. Free of the DOM, so it can be tested. */

import { Difficulty, DIFFICULTIES } from "../../src/puzzle/Generator.ts";
import { HistoryEntry } from "./storage.ts";
import { DIFFICULTY_LABEL, isOptimal } from "./stats.ts";

/** The parameter of a link that opens the trainer at a level: `?level=hard`. */
export const LEVEL_PARAM = "level";

/** The words in front of the link. */
export const INVITATION = "Play at the same level:";

/** A link that opens the trainer at a level; `page` is the address of the trainer. */
export function levelLink(page: string, difficulty: Difficulty): string {
    const url = new URL(".", page);
    url.searchParams.set(LEVEL_PARAM, difficulty);
    return url.href;
}

/** The level a link asks for, or null if it asks for none or for one that doesn't exist. */
export function linkedLevel(page: string): Difficulty | null {
    const level = (new URL(page).searchParams.get(LEVEL_PARAM) || "").toLowerCase();
    return DIFFICULTIES.find(difficulty => difficulty === level) || null;
}

/** A duration as on a stopwatch: "2:05", from an hour on "1:02:05". */
export function formatDuration(ms: number): string {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds / 60) % 60;
    const rest = String(seconds % 60).padStart(2, "0");
    return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

/** What is shared besides the score and the level. */
export interface ShareOptions {
    /** the time the puzzle took */
    time: boolean;
    /** the points of all finished puzzles */
    total: boolean;
}

export interface ShareMessage {
    title: string;
    /** the result, without the link */
    text: string;
    /** the link to play at the same level */
    link: string;
}

function count(n: number, noun: string): string {
    return `${n.toLocaleString()} ${noun}${n === 1 ? "" : "s"}`;
}

/** The result of a puzzle as a message: the score and the level, optionally the time and the total score. */
export function shareMessage(entry: HistoryEntry, total: number, options: ShareOptions, link: string): ShareMessage {
    const level = DIFFICULTY_LABEL[entry.difficulty];
    const puzzle = `${/^[aeiou]/i.test(level) ? "an" : "a"} ${level} puzzle in Rummy Trainer`;
    const points = count(entry.points, "point");
    let headline: string;
    if (entry.gaveUp) {
        headline = `💡 I gave up on ${puzzle}: ${points}.`;
    } else if (isOptimal(entry)) {
        headline = entry.penalties === 0
            ? `🏆 I solved ${puzzle} perfectly: ${points}!`
            : `🎉 I found the optimal solution to ${puzzle}: ${points}!`;
    } else {
        headline = `👍 I placed ${entry.placed} of ${entry.optimum} possible tiles in ${puzzle}: ${points}.`;
    }
    const details: string[] = [];
    if (options.time) details.push(`⏱️ ${formatDuration(entry.durationMs)}`);
    if (options.total) details.push(`⭐ ${count(total, "point")} in total`);
    return {
        title: "Rummy Trainer",
        text: details.length ? `${headline}\n${details.join(" · ")}` : headline,
        link,
    };
}

/** The result and the invitation, for apps that add the link themselves. */
export function invitingText(message: ShareMessage): string {
    return `${message.text}\n${INVITATION}`;
}

/** The whole message: the result, the invitation and the link. */
export function fullText(message: ShareMessage): string {
    return `${invitingText(message)} ${message.link}`;
}

/** A messenger or social network that takes a message through a link. */
export interface ShareTarget {
    id: string;
    label: string;
    /** the color of the brand */
    color: string;
    /** the logo, drawn in a 24 × 24 box (brand logos from Simple Icons, CC0) */
    icon: string;
    /** the logo is a disk with the symbol cut out, rather than a symbol to put on a disk */
    disk?: boolean;
    /** only the link can be passed on, the text has to be pasted */
    linkOnly?: boolean;
    href: (message: ShareMessage) => string;
}

const encode = encodeURIComponent;

export const SHARE_TARGETS: ShareTarget[] = [
    {
        id: "whatsapp",
        label: "WhatsApp",
        color: "#25d366",
        icon: `<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>`,
        href: m => `https://wa.me/?text=${encode(fullText(m))}`,
    },
    {
        id: "telegram",
        label: "Telegram",
        color: "#26a5e4",
        disk: true,
        icon: `<path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>`,
        // Telegram puts the link in front of the text
        href: m => `https://t.me/share/url?url=${encode(m.link)}&text=${encode(m.text)}`,
    },
    {
        id: "facebook",
        label: "Facebook",
        color: "#0866ff",
        disk: true,
        linkOnly: true,
        icon: `<path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/>`,
        href: m => `https://www.facebook.com/sharer/sharer.php?u=${encode(m.link)}`,
    },
    {
        id: "x",
        label: "X",
        color: "#000000",
        icon: `<path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"/>`,
        href: m => `https://x.com/intent/post?text=${encode(invitingText(m))}&url=${encode(m.link)}`,
    },
    {
        id: "bluesky",
        label: "Bluesky",
        color: "#1185fe",
        icon: `<path d="M5.202 2.857C7.954 4.922 10.913 9.11 12 11.358c1.087-2.247 4.046-6.436 6.798-8.501C20.783 1.366 24 .213 24 3.883c0 .732-.42 6.156-.667 7.037-.856 3.061-3.978 3.842-6.755 3.37 4.854.826 6.089 3.562 3.422 6.299-5.065 5.196-7.28-1.304-7.847-2.97-.104-.305-.152-.448-.153-.327 0-.121-.05.022-.153.327-.568 1.666-2.782 8.166-7.847 2.97-2.667-2.737-1.432-5.473 3.422-6.3-2.777.473-5.899-.308-6.755-3.369C.42 10.04 0 4.615 0 3.883c0-3.67 3.217-2.517 5.202-1.026"/>`,
        href: m => `https://bsky.app/intent/compose?text=${encode(fullText(m))}`,
    },
    {
        id: "email",
        label: "Email",
        color: "#11523b",
        icon: `<path d="M4.5 5.5h15a1.5 1.5 0 011.5 1.5v10a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17V7a1.5 1.5 0 011.5-1.5zM3.6 6.4l8.4 6.6 8.4-6.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
        href: m => `mailto:?subject=${encode(m.title)}&body=${encode(fullText(m))}`,
    },
];
