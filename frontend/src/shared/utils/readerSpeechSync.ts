/**
 * Resolve the currently playing speech key to its rendered content index.
 *
 * Word lessons render one tile per lesson item; passage/dialog lessons render
 * sentence keys (which may be derived from an item id). Keeping this mapping
 * pure makes playback-to-highlight synchronization deterministic and testable.
 */
export function resolvePlayingIndex(
  playingKey: string | null | undefined,
  sentenceKeys: readonly string[],
  itemKeys: readonly string[],
  isWordLesson: boolean,
): number {
  if (!playingKey) return -1
  return (isWordLesson ? itemKeys : sentenceKeys).indexOf(playingKey)
}
