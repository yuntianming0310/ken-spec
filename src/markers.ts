export const START_MARKER = '<!-- KEN_SPEC:START -->';
export const END_MARKER = '<!-- KEN_SPEC:END -->';

export function renderManagedBlock(body: string): string {
  return [START_MARKER, body.trim(), END_MARKER].join('\n');
}

export function updateManagedBlock(content: string, block: string): string {
  const startIndex = content.indexOf(START_MARKER);
  const endIndex = content.indexOf(END_MARKER);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const before = content.slice(0, startIndex).trimEnd();
    const after = content.slice(endIndex + END_MARKER.length).trimStart();
    return joinSections(before, block, after);
  }

  return joinSections(content.trimEnd(), block, '');
}

/**
 * Removes the managed block (including its START/END markers) from content.
 * Preserves any surrounding user content. Returns an empty string if the
 * block was the only content in the file.
 */
export function removeManagedBlock(content: string): string {
  const startIndex = content.indexOf(START_MARKER);
  const endIndex = content.indexOf(END_MARKER);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return content;
  }

  const before = content.slice(0, startIndex).trimEnd();
  const after = content.slice(endIndex + END_MARKER.length).trimStart();

  if (!before && !after) {
    return '';
  }
  if (!before) {
    return `${after}\n`;
  }
  if (!after) {
    return `${before}\n`;
  }
  return `${before}\n\n${after}\n`;
}

function joinSections(before: string, middle: string, after: string): string {
  const sections = [before, middle, after].filter((section) => section.length > 0);
  return `${sections.join('\n\n')}\n`;
}
