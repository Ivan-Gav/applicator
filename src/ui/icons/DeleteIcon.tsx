import type { IconProps } from "./icon-props";

export function DeleteIcon(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden
      focusable="false"
      {...props}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 0c6.627 0 12 5.373 12 12s-5.373 12-12 12S0 18.627 0 12S5.373 0 12 0m5.135 6.865a1.091 1.091 0 0 0-1.543 0L12 10.457L8.408 6.865a1.091 1.091 0 1 0-1.543 1.543L10.457 12l-3.592 3.592a1.091 1.091 0 1 0 1.543 1.543L12 13.543l3.592 3.592a1.091 1.091 0 1 0 1.543-1.543L13.543 12l3.592-3.592a1.091 1.091 0 0 0 0-1.543"
      />
    </svg>
  );
}
