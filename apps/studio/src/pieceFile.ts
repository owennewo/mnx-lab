// The name a stored score goes by.
/** A filename the service will accept: the title, without what a path or a header could misread. */
export const pieceFilename = (title: string) => `${title.trim().replace(/[\\/\x00-\x1f"<>|:*?]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Untitled'}.gp`;
