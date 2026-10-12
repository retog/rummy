// Builds the web app into dist/web.
//   node scripts/build-web.mjs           production build
//   node scripts/build-web.mjs --serve   development server on http://localhost:8000 (rebuilds on change)
import * as esbuild from "esbuild";
import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const serve = process.argv.includes("--serve");
const outdir = "dist/web";

async function listFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries.map(entry => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? listFiles(path) : [path];
    }));
    return files.flat();
}

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
await cp("web/public", outdir, { recursive: true });

const common = {
    bundle: true,
    minify: !serve,
    sourcemap: true,
    target: ["es2019"],
    define: { __DEV__: String(serve) },
    logLevel: "info",
};
const app = { ...common, entryPoints: ["web/src/main.ts"], outfile: join(outdir, "app.js"), format: "esm" };
const worker = { ...common, entryPoints: ["web/src/worker.ts"], outfile: join(outdir, "worker.js"), format: "iife" };

if (serve) {
    const contexts = await Promise.all([esbuild.context(app), esbuild.context(worker)]);
    await Promise.all(contexts.map(context => context.watch()));
    const { port } = await contexts[0].serve({ servedir: outdir, port: 8000 });
    console.log(`Serving on http://localhost:${port}`);
} else {
    await Promise.all([esbuild.build(app), esbuild.build(worker)]);
    // service worker with the list of files to precache, versioned by their content
    const files = (await listFiles(outdir)).filter(file => !file.endsWith(".map")).sort();
    const hash = createHash("sha256");
    for (const file of files) hash.update(file).update(await readFile(file));
    const assets = ["./", ...files.map(file => relative(outdir, file).split("\\").join("/"))];
    const template = await readFile("web/sw.js", "utf8");
    await writeFile(join(outdir, "sw.js"), template
        .replace("__VERSION__", hash.digest("hex").slice(0, 12))
        .replace("__ASSETS__", JSON.stringify(assets)));
    console.log(`Built ${assets.length} files into ${outdir}`);
}
