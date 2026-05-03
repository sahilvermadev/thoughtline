import type { SVGProps } from "react";

export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect
        x="1.5"
        y="1.5"
        width="21"
        height="21"
        rx="6"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M6.5 8.5h5.2c1.6 0 2.8 1.2 2.8 2.7 0 1.4-1.1 2.6-2.5 2.7l-3.6.2c-1.5.1-2.6 1.2-2.6 2.7 0 1.5 1.2 2.7 2.7 2.7h8.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <circle cx="8.2" cy="8.5" r="1" fill="currentColor" />
      <circle cx="16.1" cy="15.5" r="1" fill="currentColor" />
    </svg>
  );
}
