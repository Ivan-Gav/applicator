import type { IconProps } from "./icon-props";

export function SearchIcon(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="2 2 19.41 19.41"
      width="1em"
      height="1em"
      aria-hidden
      focusable="false"
      {...props}
    >
      <path
        fill="currentColor"
        d="M18 10c0-4.41-3.59-8-8-8s-8 3.59-8 8s3.59 8 8 8c1.85 0 3.54-.63 4.9-1.69l5.1 5.1L21.41 20l-5.1-5.1A8 8 0 0 0 18 10M4 10c0-3.31 2.69-6 6-6s6 2.69 6 6s-2.69 6-6 6s-6-2.69-6-6"
      />
    </svg>
  );
}
