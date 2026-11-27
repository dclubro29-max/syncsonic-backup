import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound } from "lucide-react";
import LibraryShareCode from "@/components/library/LibraryShareCode";
import LibraryImportCode from "@/components/library/LibraryImportCode";
import { workerPreview } from "@/api/workerClient";

/** Zona de transfer: cod generat pe un dispozitiv, introdus pe celălalt. */
export default function LibraryTransfer() {
  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          {workerPreview ? "Transfer prin internet" : "Cod de bibliotecă"}
        </CardTitle>
        <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
          {workerPreview
            ? "Încarcă până la 20 de piese, 50 MB per piesă și 250 MB per transfer."
            : "Piesele se trimit direct între dispozitive, în aceeași rețea Wi-Fi, cu ambele deschise."}
        </p>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <LibraryShareCode />
        <LibraryImportCode />
      </CardContent>
    </Card>
  );
}
