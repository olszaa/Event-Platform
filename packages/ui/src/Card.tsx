import React from "react";

type BadgeVariant = "primary" | "success" | "warning" | "error" | "neutral";

export interface StatusBadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
}

export function StatusBadge({
  variant = "neutral",
  children,
  dot = false,
}: StatusBadgeProps) {
  return (
    <span className={`badge badge--${variant}`}>
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "currentColor",
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function Card({
  children,
  className = "",
  elevated = false,
  onClick,
  style,
}: CardProps) {
  return (
    <div
      className={`glass-card ${elevated ? "glass-card--elevated" : ""} ${className}`}
      onClick={onClick}
      style={{
        ...style,
        cursor: onClick ? "pointer" : undefined,
      }}
    >
      {children}
    </div>
  );
}

export interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down";
  icon?: React.ReactNode;
}

export function StatCard({ label, value, change, trend, icon }: StatCardProps) {
  return (
    <div className="glass-card stat-card">
      <div className="flex-between">
        <span className="stat-card__label">{label}</span>
        {icon && (
          <span style={{ fontSize: "1.5em", opacity: 0.5 }}>{icon}</span>
        )}
      </div>
      <span className="stat-card__value">{value}</span>
      {change && (
        <span className={`stat-card__change stat-card__change--${trend ?? "up"}`}>
          {trend === "up" ? "↑" : "↓"} {change}
        </span>
      )}
    </div>
  );
}

export interface LoadingProps {
  size?: "sm" | "md" | "lg";
  text?: string;
}

export function Loading({ size = "md", text }: LoadingProps) {
  return (
    <div className="flex-center flex-col gap-3" style={{ padding: "2rem" }}>
      <span className={`spinner ${size !== "md" ? `spinner--${size}` : ""}`} />
      {text && (
        <span style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
          {text}
        </span>
      )}
    </div>
  );
}
