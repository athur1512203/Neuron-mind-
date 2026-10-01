import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "icon" | "toolbar";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size,
  className = "",
  type = "button",
  children,
  ...props
}: ButtonProps) {
  const resolvedSize = size ?? (variant === "icon" || variant === "toolbar" ? "icon" : "md");
  const classes = ["nm-button", `nm-button--${variant}`, `nm-button--${resolvedSize}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} {...props}>
      <span className="nm-button-shadow" aria-hidden="true" />
      <span className="nm-button-edge" aria-hidden="true" />
      <span className="nm-button-front">{children}</span>
    </button>
  );
}
