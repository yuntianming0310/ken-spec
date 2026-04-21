export declare const START_MARKER = "<!-- KEN_SPEC:START -->";
export declare const END_MARKER = "<!-- KEN_SPEC:END -->";
export declare function renderManagedBlock(body: string): string;
export declare function updateManagedBlock(content: string, block: string): string;
/**
 * Removes the managed block (including its START/END markers) from content.
 * Preserves any surrounding user content. Returns an empty string if the
 * block was the only content in the file.
 */
export declare function removeManagedBlock(content: string): string;
