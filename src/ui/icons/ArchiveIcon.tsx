import type { IconProps } from "./icon-props";

export function ArchiveIcon(props: IconProps) {
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
        d="M12 0a12 12 0 1 0 0 24a12 12 0 1 0 0-24z M5.25 5.25h13.5v3H5.25z M6 18.75V9h12v9.75z M13.5 13.5v-2.25h-3v2.25H8.25l3.75 3.75l3.75-3.75z"
      />
    </svg>
  );
}
