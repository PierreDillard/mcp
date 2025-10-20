import { readFileSync } from "fs";
import { join } from "path";

/**
 * Loads the GPAC filters architecture documentation (filters_gen.md)
 * Used to understand the architecture depth and exceptions like 'enc'
 */
let FILTERS_ARCHITECTURE = "";

/**
 * Special filters documented in filters_gen.md:
 * - enc: encoder shortcut (line 126)
 * - src: source shortcut (line 96)
 * - dst: destination/sink shortcut (line 96)
 */
const SPECIAL_FILTERS = new Set<string>(['enc', 'src', 'dst']);

export function loadDocResources(): void {
    const docDir = join(process.cwd(), "doc");

    try {
        FILTERS_ARCHITECTURE = readFileSync(join(docDir, "filters_gen.md"), "utf-8");
        console.error(`[DOC-RESOURCES] Loaded filters_gen.md (${FILTERS_ARCHITECTURE.length} chars)`);
        console.error(`[DOC-RESOURCES] Special filters: ${Array.from(SPECIAL_FILTERS).join(', ')}, ff* (ffmpeg filters)`);
    } catch (error) {
        console.error("[DOC-RESOURCES] Could not load filters_gen.md:", (error as any).message);
    }
}

/**
 * Check if a filter is valid based on filters_gen.md documentation:
 * - Special shortcuts: enc, src, dst
 * - FFmpeg filters: ff* prefix (ffsws, ffdmx, ffdec, etc.)
 */
export function isSpecialFilter(filterName: string): boolean {
    return SPECIAL_FILTERS.has(filterName) || filterName.startsWith('ff');
}

/**
 * Access to architecture documentation (to enrich responses if ambiguity)
 */
export function getFiltersArchitecture(): string {
    return FILTERS_ARCHITECTURE;
}

/**
 * Checks if the MCP knows the architecture documentation
 */
export function hasArchitectureDoc(): boolean {
    return FILTERS_ARCHITECTURE.length > 0;
}