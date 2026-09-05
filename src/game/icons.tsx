import { cn } from "../lib/utils";

type IconProps = {
  className?: string;
  title?: string;
};

export function SunToken({ className, title = "Sun" }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={cn("block", className)} aria-hidden={title ? undefined : true} role="img">
      {title ? <title>{title}</title> : null}
      <circle cx="16" cy="16" r="5.6" fill="currentColor" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <rect
          key={deg}
          x="15.2"
          y="3.4"
          width="1.6"
          height="4.2"
          rx="0.8"
          fill="currentColor"
          transform={`rotate(${deg} 16 16)`}
        />
      ))}
    </svg>
  );
}

export function MoonToken({ className, title = "Moon" }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={cn("block", className)} aria-hidden={title ? undefined : true} role="img">
      {title ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        d="M20.5 7.1c-4.4 1.3-7.6 5.4-7.6 10.2 0 5.8 4.5 10.5 10.1 10.5 1.6 0 3.1-.4 4.4-1A10.2 10.2 0 1 1 20.5 7.1z"
      />
    </svg>
  );
}

export function EqMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={cn("block", className)} aria-hidden="true">
      <rect x="3" y="5" width="10" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="3" y="9.4" width="10" height="1.6" rx="0.8" fill="currentColor" />
    </svg>
  );
}

export function NeqMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={cn("block", className)} aria-hidden="true">
      <path
        d="M4.2 4.2 L11.8 11.8 M11.8 4.2 L4.2 11.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PlayaddaMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={cn("block", className)} aria-hidden="true">
      <rect x="3" y="3" width="26" height="26" rx="7" fill="currentColor" opacity="0.12" />
      <path
        d="M10 21.5c3.4-7.6 8.6-7.6 12 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <circle cx="12.4" cy="12.2" r="1.7" fill="currentColor" />
      <circle cx="19.6" cy="12.2" r="1.7" fill="currentColor" />
    </svg>
  );
}
