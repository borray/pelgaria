"use client";

import { useEffect, useRef } from "react";

type Props = {
  value: string;
  height?: number;
  width?: number;
  color?: string;
  showText?: boolean;
};

export default function PassportBarcode({
  value,
  height = 40,
  width = 1.4,
  color = "#1a1a2e",
  showText = false,
}: Props) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    import("jsbarcode").then(({ default: JsBarcode }) => {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        width,
        height,
        displayValue: showText,
        margin: 0,
        background: "transparent",
        lineColor: color,
      });
    });
  }, [value, height, width, color, showText]);

  return <svg ref={ref} style={{ display: "block" }} />;
}
