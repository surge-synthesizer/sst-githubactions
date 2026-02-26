import { build } from "esbuild";
import { builtinModules } from "node:module";
import { resolve } from "node:path";

const actions = [
    { name: "install-innosetup" },
    { name: "install-ninja" },
    { name: "install-wix" },
    { name: "receive-web-notification" },
    { name: "send-web-notification" },
    { name: "uv-tool" },
];

await Promise.all(
    actions.map((action) =>
        build({
            entryPoints: [resolve(`${action.name}/src/index.ts`)],
            outfile: resolve(`${action.name}/dist/index.cjs`),
            platform: "node",
            target: "node24",
            format: "cjs",
            bundle: true,
            minify: false,
            sourcemap: false,
            external: [...builtinModules],
        }),
    ),
).catch((error) => {
    console.error(error);
    process.exit(1);
});
