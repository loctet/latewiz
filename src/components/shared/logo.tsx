import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: { box: "h-6 w-6", text: "text-base" },
  md: { box: "h-8 w-8", text: "text-xl" },
  lg: { box: "h-12 w-12", text: "text-2xl" },
};

/** Geometric mark — timeline + pulse, uses theme primary */
function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M8 16h6.5M17.5 16H24"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="2.75" fill="white" />
      <circle cx="8" cy="16" r="1.75" fill="white" fillOpacity="0.85" />
      <circle cx="24" cy="16" r="1.75" fill="white" fillOpacity="0.85" />
    </svg>
  );
}

export function Logo({ size = "md", showText = true, className }: LogoProps) {
  const { box, text } = sizes[size];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Mark className={cn("flex-shrink-0", box)} />
      {showText && (
        <span
          className={cn(
            "font-heading font-semibold tracking-tight text-foreground",
            text
          )}
        >
          {BRAND.name}
        </span>
      )}
    </div>
  );
}
