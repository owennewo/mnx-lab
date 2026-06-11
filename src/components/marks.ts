import { svg } from 'lit';

/**
 * The MNX Lab mark: five hairline staff lines + one accent notehead ellipse.
 * Callers style it via `.mark line { stroke: … }` and `.mark ellipse { fill: … }`.
 */
export const brandMark = (size = 20) => svg`
  <svg class="mark" width=${size} height=${size} viewBox="0 0 20 20" aria-hidden="true">
    <line x1="1" y1="4" x2="19" y2="4"></line>
    <line x1="1" y1="7" x2="19" y2="7"></line>
    <line x1="1" y1="10" x2="19" y2="10"></line>
    <line x1="1" y1="13" x2="19" y2="13"></line>
    <line x1="1" y1="16" x2="19" y2="16"></line>
    <ellipse cx="13.5" cy="10" rx="3.1" ry="2.3" transform="rotate(-18 13.5 10)"></ellipse>
  </svg>
`;
