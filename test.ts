const releasesInput = "" || "{}";
let releases: Record<string, string>;

try {
    releases = JSON.parse(releasesInput);
    console.log("OK!");
} catch (error) {
    throw new Error(`Invalid JSON for releases input: ${error}`);
}
