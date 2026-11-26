import React from "react";
import { Image } from "@/components/ui/image";
import { qrImageUrl } from "@/lib/premium";

export default function QrImage({ code, size = 320, className = "h-36 w-36" }) {
  return (
    <Image
      src={qrImageUrl(code, size)}
      alt="Cod QR pentru activarea Premium"
      referrerPolicy="no-referrer"
      fittingType="fit"
      className={className}
    />
  );
}