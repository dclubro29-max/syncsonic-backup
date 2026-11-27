import React from "react";
import CalibrationQr from "@/components/speakers/CalibrationQr";
import { activationUrl } from "@/lib/premium";

export default function QrImage({ code, className = "h-36 w-36" }) {
  return (
    <CalibrationQr
      value={activationUrl(code)}
      label="Cod QR pentru activarea Premium"
      className={`${className} p-0 shadow-none`}
    />
  );
}
