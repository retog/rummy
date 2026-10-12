/** A short confetti burst on a full-screen canvas. */

const COLORS = ["#e53935", "#1e63c4", "#f08c00", "#2b2b2b", "#f6c945", "#2fbf71"];

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    rotation: number;
    spin: number;
    color: string;
    shape: number;
}

export function confetti(canvas: HTMLCanvasElement, origin?: { x: number; y: number }) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    canvas.classList.add("active");
    const popover = canvas as HTMLCanvasElement & { showPopover?: () => void; hidePopover?: () => void };
    try {
        if (popover.showPopover) popover.showPopover();
    } catch {
        // already open or popovers not supported: the canvas stays below dialogs
    }

    const ox = origin ? origin.x : width / 2;
    const oy = origin ? origin.y : height / 3;
    const particles: Particle[] = [];
    for (let i = 0; i < 160; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 9;
        particles.push({
            x: ox,
            y: oy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 6,
            size: 5 + Math.random() * 7,
            rotation: Math.random() * Math.PI,
            spin: (Math.random() - 0.5) * 0.4,
            color: COLORS[i % COLORS.length],
            shape: i % 3,
        });
    }
    const started = performance.now();
    function frame(now: number) {
        const elapsed = now - started;
        ctx!.clearRect(0, 0, width, height);
        const fade = Math.max(0, 1 - Math.max(0, elapsed - 1800) / 900);
        for (const p of particles) {
            p.vy += 0.28;
            p.vx *= 0.985;
            p.vy *= 0.985;
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.spin;
            ctx!.save();
            ctx!.globalAlpha = fade;
            ctx!.translate(p.x, p.y);
            ctx!.rotate(p.rotation);
            ctx!.fillStyle = p.color;
            if (p.shape === 0) {
                ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            } else if (p.shape === 1) {
                ctx!.beginPath();
                ctx!.arc(0, 0, p.size / 3, 0, Math.PI * 2);
                ctx!.fill();
            } else {
                ctx!.beginPath();
                ctx!.moveTo(0, -p.size / 2);
                ctx!.lineTo(p.size / 2, p.size / 2);
                ctx!.lineTo(-p.size / 2, p.size / 2);
                ctx!.closePath();
                ctx!.fill();
            }
            ctx!.restore();
        }
        if (elapsed < 2700) {
            requestAnimationFrame(frame);
        } else {
            ctx!.clearRect(0, 0, width, height);
            canvas.classList.remove("active");
            try {
                if (popover.hidePopover) popover.hidePopover();
            } catch {
                // not open
            }
        }
    }
    requestAnimationFrame(frame);
}
