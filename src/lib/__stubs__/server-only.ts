// Stub for the 'server-only' package under vitest. Next.js's bundler swaps
// this package for a no-op in server bundles and lets it throw only in
// client bundles; vitest has no such conditional resolution, and every test
// here runs in a plain Node context (never a browser), so it's always the
// server-bundle case.
export {};
