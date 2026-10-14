"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { resetConsoleUserTwoFactorAction } from "./actions";

export interface ConsoleUserRow {
  userId: string;
  name: string;
  email: string;
  twoFactorEnabled: boolean | null;
}

/**
 * Recall console users and their two-step sign-in; the Recall owner resets a
 * lost one after verifying the person out of band (owner's decision 2026-10-14).
 */
export function ConsoleUsers({ users, selfId }: { users: ConsoleUserRow[]; selfId: string }) {
  return (
    <ul className="flex flex-col divide-y divide-hairline">
      {users.map((user) => (
        <li key={user.userId} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
          <span className="font-medium text-heading">{user.name}</span>
          <span className="text-body">{user.email}</span>
          {user.twoFactorEnabled ? (
            <Badge variant="success">2 adım</Badge>
          ) : (
            <Badge variant="dashed">2 adım yok</Badge>
          )}
          {user.twoFactorEnabled && user.userId !== selfId && (
            <ResetConsoleUserButton userId={user.userId} name={user.name} />
          )}
        </li>
      ))}
    </ul>
  );
}

function ResetConsoleUserButton({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [verified, setVerified] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          2 adımı sıfırla
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{name}: iki adımlı girişi sıfırla</DialogTitle>
          <DialogDescription>
            Konsol kullanıcısının kayıtlı kimlik doğrulaması ve yedek kodları silinir, tüm
            oturumları kapanır; bir sonraki girişte yeniden kurar. Kayda geçer.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-2.5">
          <Checkbox
            id={`verified-${userId}`}
            checked={verified}
            onCheckedChange={(value) => setVerified(value === true)}
          />
          <Label htmlFor={`verified-${userId}`} className="font-normal text-body">
            Kişinin kimliğini konsol dışında, bilinen bir kanaldan (yüz yüze veya kayıtlı
            telefonundan geri arayarak) doğruladım
          </Label>
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={!verified || pending}
            onClick={() =>
              startTransition(async () => {
                const result = await resetConsoleUserTwoFactorAction({
                  userId,
                  verifiedOutOfBand: verified,
                });
                if (result.ok) {
                  toast.success(result.message);
                  setOpen(false);
                } else toast.error(result.message);
              })
            }
          >
            Sıfırla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
