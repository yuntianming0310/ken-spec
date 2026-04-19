import { describe, expect, it } from 'vitest';
import { renderManagedBlock, updateManagedBlock } from '../src/markers.js';

describe('updateManagedBlock', () => {
  it('replaces an existing managed block without touching surrounding content', () => {
    const content = [
      '# Notes',
      '',
      '<!-- KEN_SPEC:START -->',
      'old block',
      '<!-- KEN_SPEC:END -->',
      '',
      'tail',
    ].join('\n');

    const updated = updateManagedBlock(content, renderManagedBlock('new block'));

    expect(updated).toContain('new block');
    expect(updated).toContain('# Notes');
    expect(updated).toContain('tail');
    expect(updated).not.toContain('old block');
  });

  it('appends a managed block when markers are missing', () => {
    const updated = updateManagedBlock('# Notes', renderManagedBlock('hello'));

    expect(updated).toContain('# Notes');
    expect(updated).toContain('<!-- KEN_SPEC:START -->');
    expect(updated).toContain('hello');
    expect(updated).toContain('<!-- KEN_SPEC:END -->');
  });
});
