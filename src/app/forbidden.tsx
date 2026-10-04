import { ShieldAlert } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/panel";
import { Button } from "@/components/ui/button";

/** Rendered by forbidden(): the member's role does not allow this page or action. */
export default function Forbidden() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <EmptyState
        icon={ShieldAlert}
        title="Bu sayfa için yetkiniz yok"
        description="Rolünüz bu işlemi kapsamıyor. Erişim gerekiyorsa kliniğinizin yöneticisiyle görüşün."
        action={
          <Button asChild>
            <Link href="/panel">Panele dön</Link>
          </Button>
        }
        className="w-full max-w-md"
      />
    </main>
  );
}
