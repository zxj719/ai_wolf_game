export function Avatar({
  name = "?",
  color = "clay",
  size = "",
  className = "",
}) {
  const safeColor = ["clay", "sage", "slate", "plum", "ochre"].includes(color)
    ? color
    : "clay";
  return (
    <span
      aria-hidden="true"
      className={`studio-avatar avatar-${safeColor} ${size ? `avatar-${size}` : ""} ${className}`}
    >
      {Array.from(name)[0]?.toUpperCase() || "?"}
    </span>
  );
}
