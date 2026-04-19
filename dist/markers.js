export const START_MARKER = '<!-- KEN_SPEC:START -->';
export const END_MARKER = '<!-- KEN_SPEC:END -->';
export function renderManagedBlock(body) {
    return [START_MARKER, body.trim(), END_MARKER].join('\n');
}
export function updateManagedBlock(content, block) {
    const startIndex = content.indexOf(START_MARKER);
    const endIndex = content.indexOf(END_MARKER);
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        const before = content.slice(0, startIndex).trimEnd();
        const after = content.slice(endIndex + END_MARKER.length).trimStart();
        return joinSections(before, block, after);
    }
    return joinSections(content.trimEnd(), block, '');
}
function joinSections(before, middle, after) {
    const sections = [before, middle, after].filter((section) => section.length > 0);
    return `${sections.join('\n\n')}\n`;
}
