/**
 * A table row's one link: its ::after covers the whole row, which must be
 * `relative`. Controls in the row are lifted above it with
 * {@link aboveRowLinkClass}.
 */
export const stretchedRowLinkClass =
  "block outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ring";

// Lifts a control above the link stretched over the row.
export const aboveRowLinkClass = "relative z-10";
