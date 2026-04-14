import { Suspense } from "react";
import { GprArchive } from "@/components/gprs/GprArchive";

export default function GprsPage() {
  return (
    <Suspense>
      <GprArchive />
    </Suspense>
  );
}
