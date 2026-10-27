import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { DIFFICULTIES } from '../../src/puzzle/Generator.ts';
import {
    formatDuration, fullText, INVITATION, invitingText, levelLink, linkedLevel, SHARE_TARGETS, shareMessage,
} from './share.ts';
import { HistoryEntry } from './storage.ts';

const PAGE = "https://retog.github.io/rummy/";
const LINK = PAGE + "?level=hard";
const ALL = { time: true, total: true };
const NONE = { time: false, total: false };

/** an optimal hard puzzle solved at the first check in 2:35 */
function entry(changes: Partial<HistoryEntry> = {}): HistoryEntry {
    return {
        time: 0, difficulty: "hard", seed: 123456, placed: 7, optimum: 7, points: 450, penalties: 0,
        durationMs: 155000, gaveUp: false, ...changes,
    };
}

function target(id: string) {
    return SHARE_TARGETS.find(t => t.id === id)!;
}

describe('share.levelLink', () => {

    it('opens the trainer at the level', () => {
        expect(levelLink(PAGE, 'hard')).toBe(LINK);
        expect(levelLink(PAGE + "index.html?level=easy#top", 'extreme')).toBe(PAGE + "?level=extreme");
        expect(levelLink("http://localhost:8000/", 'easy')).toBe("http://localhost:8000/?level=easy");
    });

    it('is understood by linkedLevel', () => {
        for (const difficulty of DIFFICULTIES) expect(linkedLevel(levelLink(PAGE, difficulty))).toBe(difficulty);
    });
});

describe('share.linkedLevel', () => {

    it('ignores links without a known level', () => {
        expect(linkedLevel(PAGE)).toBe(null);
        expect(linkedLevel(PAGE + "?level=")).toBe(null);
        expect(linkedLevel(PAGE + "?level=impossible")).toBe(null);
        expect(linkedLevel(PAGE + "?difficulty=hard")).toBe(null);
    });

    it('ignores case', () => {
        expect(linkedLevel(PAGE + "?level=Extreme")).toBe('extreme');
    });
});

describe('share.formatDuration', () => {

    it('reads like a stopwatch', () => {
        expect(formatDuration(0)).toBe("0:00");
        expect(formatDuration(9999)).toBe("0:09");
        expect(formatDuration(155000)).toBe("2:35");
        expect(formatDuration(59 * 60000 + 59999)).toBe("59:59");
        expect(formatDuration(3600000 + 65000)).toBe("1:01:05");
        expect(formatDuration(-1)).toBe("0:00");
    });
});

describe('share.shareMessage', () => {

    it('tells the score and the level', () => {
        expect(shareMessage(entry(), 450, NONE, LINK).text).toBe("🏆 I solved a Hard puzzle in Rummy Trainer perfectly: 450 points!");
        expect(shareMessage(entry({ difficulty: 'easy', points: 150 }), 450, NONE, LINK).text)
            .toBe("🏆 I solved an Easy puzzle in Rummy Trainer perfectly: 150 points!");
        expect(shareMessage(entry({ difficulty: 'extreme', points: 750 }), 750, NONE, LINK).text)
            .toBe("🏆 I solved an Extreme puzzle in Rummy Trainer perfectly: 750 points!");
    });

    it('tells how well the puzzle was solved', () => {
        expect(shareMessage(entry({ penalties: 2, points: 270 }), 0, NONE, LINK).text)
            .toBe("🎉 I found the optimal solution to a Hard puzzle in Rummy Trainer: 270 points!");
        expect(shareMessage(entry({ difficulty: 'medium', placed: 2, optimum: 3, points: 133 }), 0, NONE, LINK).text)
            .toBe("👍 I placed 2 of 3 possible tiles in a Medium puzzle in Rummy Trainer: 133 points.");
        expect(shareMessage(entry({ gaveUp: true, placed: 0, points: 0 }), 0, NONE, LINK).text)
            .toBe("💡 I gave up on a Hard puzzle in Rummy Trainer: 0 points.");
    });

    it('adds the time and the total score on request', () => {
        const total = 12345;
        const lines = (options: typeof ALL) => shareMessage(entry(), total, options, LINK).text.split("\n");
        expect(lines(ALL)[1]).toBe(`⏱️ 2:35 · ⭐ ${total.toLocaleString()} points in total`);
        expect(lines({ time: true, total: false })[1]).toBe("⏱️ 2:35");
        expect(lines({ time: false, total: true })[1]).toBe(`⭐ ${total.toLocaleString()} points in total`);
        expect(lines(NONE).length).toBe(1);
    });

    it('ends with the link to play at the same level', () => {
        const message = shareMessage(entry(), 450, ALL, LINK);
        expect(message.link).toBe(LINK);
        expect(message.text).not.toContain(LINK);
        expect(invitingText(message)).toBe(message.text + "\n" + INVITATION);
        expect(fullText(message)).toBe(`${message.text}\n${INVITATION} ${LINK}`);
    });
});

describe('share.SHARE_TARGETS', () => {

    const message = shareMessage(entry(), 12345, ALL, LINK);

    function params(href: string): URLSearchParams {
        return new URL(href).searchParams;
    }

    it('pass the whole message to the messengers', () => {
        expect(params(target('whatsapp').href(message)).get("text")).toBe(fullText(message));
        expect(params(target('bluesky').href(message)).get("text")).toBe(fullText(message));
        // Telegram adds the link itself, in front of the text
        expect(params(target('telegram').href(message)).get("url")).toBe(LINK);
        expect(params(target('telegram').href(message)).get("text")).toBe(message.text);
        // X adds the link itself, after the text
        expect(params(target('x').href(message)).get("url")).toBe(LINK);
        expect(params(target('x').href(message)).get("text")).toBe(invitingText(message));
    });

    it('pass only the link where nothing else is taken', () => {
        expect(target('facebook').linkOnly).toBe(true);
        expect(params(target('facebook').href(message)).get("u")).toBe(LINK);
        expect(SHARE_TARGETS.filter(t => t.linkOnly).map(t => t.id)).toEqual(['facebook']);
    });

    it('write an email', () => {
        const href = target('email').href(message);
        expect(href.startsWith("mailto:?")).toBe(true);
        // a mailto URL encodes spaces as %20, never as +
        expect(href).not.toContain("+");
        expect(params(href).get("subject")).toBe("Rummy Trainer");
        expect(params(href).get("body")).toBe(fullText(message));
    });

    it('fit the longest message into a Bluesky post', () => {
        const longest = shareMessage(entry({ difficulty: 'extreme', penalties: 1, durationMs: 99 * 3600000 }), 9999999, ALL,
            levelLink(PAGE, 'extreme'));
        expect([...new Intl.Segmenter().segment(fullText(longest))].length).toBeLessThanOrEqual(300);
    });
});
