import type { IconProps } from "./icon-props";

export function DownloadIcon(props: IconProps) {
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
        d="M12 1a11 11 0 1 0 0 22a11 11 0 1 0 0-22ZM10.2 4.8H13.8V10H17.6L12 15.6L6.4 10H10.2ZM6.6 16.8H17.4V19.2H6.6Z"
      />
    </svg>
  );
}
