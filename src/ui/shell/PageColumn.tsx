import type { ReactNode } from "react";

export const ColumnWidth = {
  // The applications list.
  Wide: "wide",
  // One application, and forms.
  Narrow: "narrow",
} as const;
export type ColumnWidth = (typeof ColumnWidth)[keyof typeof ColumnWidth];

export type PageColumnProps = {
  width: ColumnWidth;
  children: ReactNode;
};

/**
 * The centred column a page's content sits in. The pixel widths live in
 * background.css, which also keeps the background's skin clear of the column.
 */
export function PageColumn({ width, children }: PageColumnProps) {
  return (
    <div
      data-column={width}
      className="mx-auto flex w-full max-w-(--content-width) flex-col gap-6 px-6"
    >
      {children}
    </div>
  );
}
