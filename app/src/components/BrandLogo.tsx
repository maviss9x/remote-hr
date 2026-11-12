import Image from "next/image";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "icon" | "full";
  className?: string;
  withContainer?: boolean;
  priority?: boolean;
}

const ICON_SIZES = {
  sm: { box: 32, iconW: 16, iconH: 24, radius: "8px" },
  md: { box: 40, iconW: 22, iconH: 34, radius: "10px" },
  lg: { box: 72, iconW: 39, iconH: 60, radius: "18px" },
};

const FULL_SIZES = {
  sm: { width: 110, height: 32 },
  md: { width: 145, height: 42 },
  lg: { width: 186, height: 54 },
};

export default function BrandLogo({
  size = "md",
  variant = "icon",
  className = "",
  withContainer,
  priority = true,
}: BrandLogoProps) {
  if (variant === "full") {
    const fullCfg = FULL_SIZES[size] || FULL_SIZES.md;
    return (
      <div
        className={`brand-logo-full ${className}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          filter: "drop-shadow(0 4px 16px rgba(247, 93, 15, 0.25))",
        }}
      >
        <Image
          src="/images/logos/LogoFreetrip.png"
          alt="Freetrip"
          width={fullCfg.width}
          height={fullCfg.height}
          style={{
            objectFit: "contain",
            width: `${fullCfg.width}px`,
            height: `${fullCfg.height}px`,
          }}
          priority={priority}
          unoptimized
        />
      </div>
    );
  }

  const cfg = ICON_SIZES[size] || ICON_SIZES.md;
  const shouldWrap = withContainer !== undefined ? withContainer : true;

  if (!shouldWrap) {
    return (
      <Image
        src="/images/logos/Logo.png"
        alt="Freetrip Logo"
        width={cfg.iconW}
        height={cfg.iconH}
        className={className}
        style={{ objectFit: "contain", width: "auto", height: `${cfg.iconH}px` }}
        priority={priority}
        unoptimized
      />
    );
  }

  return (
    <div
      className={`brand-logo-container ${className}`}
      style={{
        width: cfg.box,
        height: cfg.box,
        borderRadius: cfg.radius,
        background: "rgba(249, 115, 22, 0.08)",
        border: "1px solid rgba(249, 115, 22, 0.22)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow:
          size === "lg"
            ? "0 10px 25px rgba(249, 115, 22, 0.2), 0 2px 6px rgba(0, 0, 0, 0.06)"
            : "0 2px 8px rgba(249, 115, 22, 0.12)",
      }}
    >
      <Image
        src="/images/logos/Logo.png"
        alt="Freetrip Logo"
        width={cfg.iconW}
        height={cfg.iconH}
        style={{ objectFit: "contain", width: "auto", height: `${cfg.iconH}px` }}
        priority={priority}
        unoptimized
      />
    </div>
  );
}
