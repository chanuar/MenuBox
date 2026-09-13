export default function FoodMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 16h28l-3 17H9L6 16ZM6 16l5-8h6m17 8-5-8h-4" />
      <path d="M17 5h8v18l-2-1.5-2 1.5-2-1.5-2 1.5V5Zm3 5h2m-2 4h2M13 28h14" />
    </svg>
  );
}
