/**
 * Builds the web app with `deno bundle`.
 *
 *   deno task build   production build into dist/web (minified, with service worker)
 *   deno task serve   development server on http://localhost:8000 that rebuilds on changes
 */

const PUBLIC = "web/public";
const serve = Deno.args.includes("--serve");
const outdir = serve ? "dist/dev" : "dist/web";

const ENTRIES = [
    { entry: "web/src/main.ts", output: "app.js", format: "esm" },
    { entry: "web/src/worker.ts", output: "worker.js", format: "iife" },
];

function bundle(entry: string, output: string, format: string): Deno.ChildProcess {
    const args = ["bundle", "--platform=browser", `--format=${format}`, "--sourcemap=linked", `--output=${outdir}/${output}`];
    args.push(serve ? "--watch" : "--minify", entry);
    return new Deno.Command(Deno.execPath(), { args, stdout: "inherit", stderr: "inherit" }).spawn();
}

async function copyDir(from: string, to: string) {
    await Deno.mkdir(to, { recursive: true });
    for await (const entry of Deno.readDir(from)) {
        const source = `${from}/${entry.name}`;
        const target = `${to}/${entry.name}`;
        if (entry.isDirectory) await copyDir(source, target);
        else await Deno.copyFile(source, target);
    }
}

async function listFiles(dir: string, prefix = ""): Promise<string[]> {
    const files: string[] = [];
    for await (const entry of Deno.readDir(dir)) {
        const path = prefix + entry.name;
        if (entry.isDirectory) files.push(...await listFiles(`${dir}/${entry.name}`, path + "/"));
        else files.push(path);
    }
    return files.sort();
}

/** Writes sw.js with the list of files to precache, versioned by their content. */
async function writeServiceWorker() {
    const files = (await listFiles(outdir)).filter(file => !file.endsWith(".map"));
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];
    for (const file of files) parts.push(encoder.encode(file), await Deno.readFile(`${outdir}/${file}`));
    const all = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
    let offset = 0;
    for (const part of parts) {
        all.set(part, offset);
        offset += part.length;
    }
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", all));
    const version = Array.from(digest.slice(0, 6), b => b.toString(16).padStart(2, "0")).join("");
    const template = await Deno.readTextFile("web/sw.js");
    await Deno.writeTextFile(
        `${outdir}/sw.js`,
        template.replace("__VERSION__", version).replace("__ASSETS__", JSON.stringify(["./", ...files])),
    );
    console.log(`Built ${files.length + 1} files into ${outdir} (version ${version})`);
}

const CONTENT_TYPES: Record<string, string> = {
    html: "text/html; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    css: "text/css; charset=utf-8",
    json: "application/json",
    map: "application/json",
    webmanifest: "application/manifest+json",
    svg: "image/svg+xml",
    png: "image/png",
};

/** Serves the bundles from the output directory and everything else straight from web/public. */
function startServer() {
    Deno.serve({ hostname: "localhost", port: 8000 }, async request => {
        let path = decodeURIComponent(new URL(request.url).pathname);
        if (path.endsWith("/")) path += "index.html";
        if (!path.includes("..")) {
            for (const root of [outdir, PUBLIC]) {
                try {
                    const body = await Deno.readFile(root + path);
                    const type = CONTENT_TYPES[path.slice(path.lastIndexOf(".") + 1)] || "application/octet-stream";
                    return new Response(body, { headers: { "content-type": type, "cache-control": "no-store" } });
                } catch {
                    // not in this root
                }
            }
        }
        return new Response("Not found", { status: 404 });
    });
}

await Deno.remove(outdir, { recursive: true }).catch(() => undefined);
await Deno.mkdir(outdir, { recursive: true });

if (serve) {
    // no service worker in development, so that changes show up immediately
    ENTRIES.forEach(({ entry, output, format }) => bundle(entry, output, format));
    startServer();
} else {
    await copyDir(PUBLIC, outdir);
    const results = await Promise.all(ENTRIES.map(({ entry, output, format }) => bundle(entry, output, format).status));
    if (results.some(status => !status.success)) Deno.exit(1);
    await writeServiceWorker();
}
