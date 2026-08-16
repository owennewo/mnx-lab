import { describe, expect, it } from 'vitest';
import {
  isEchoProjection,
  projectionForSourceClass
} from '../../src/engine/render/projection.ts';

describe('combined-view primary and echo projection', () => {
  it('identifies both source-bearing forms of tab ink', () => {
    expect(projectionForSourceClass('fret-number selected')).toBe('tab');
    expect(projectionForSourceClass('fret-bg')).toBe('tab');
    expect(projectionForSourceClass('notehead selected')).toBe('notation');
  });

  it('marks only the rendering opposite the active projection as an echo', () => {
    expect(isEchoProjection('notation', 'tab')).toBe(true);
    expect(isEchoProjection('tab', 'tab')).toBe(false);
    expect(isEchoProjection('tab', 'notation')).toBe(true);
    expect(isEchoProjection('notation', null)).toBe(false);
  });
});
