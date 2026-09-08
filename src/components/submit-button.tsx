"use client";

import { useFormStatus } from "react-dom";

interface Props {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "quiet";
  className?: string;
}

/** Submit button that disables itself while its form action is in flight. */
export function SubmitButton({ children, pendingLabel, variant = "primary", className = "" }: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`btn ${variant === "primary" ? "btn-primary" : "btn-quiet"} ${className}`}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
