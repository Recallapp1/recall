"use client";

import { MailPlus, Pencil, UserMinus, X } from "lucide-react";
import { useState } from "react";

import { FormField } from "@/components/panel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CUSTOM_ROLE_PERMISSIONS,
  isBuiltInRole,
  roleLabel,
  type CustomRoleResource,
  type RoleName,
} from "@/lib/permissions";

import { cancelInvitation, inviteMember, removeMember, updateMember } from "./actions";
import { SaveButton, SettingsCard, useSave } from "../_components/settings-ui";

interface Member {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  practitionerId: string | null;
}

const ROLE_HINTS: Record<RoleName, string> = {
  owner: "Her şey, faturalandırma dahil",
  admin: "Ayarlar, ekip ve tüm kayıtlar",
  staff: "Takvim, randevular, hastalar, geri aramalar",
  practitioner: "Yalnızca kendi takvimi ve hastaları",
};

function roleText(role: string) {
  return role.split(",").map(roleLabel).join(", ");
}

/** Built-in roles describe themselves; custom ones list the areas they open. */
function roleHint(role: string, customRoles: CustomRole[]): string | undefined {
  if (isBuiltInRole(role)) return ROLE_HINTS[role];
  const custom = customRoles.find((r) => r.name === role);
  if (!custom) return undefined;
  const areas = Object.keys(custom.permission)
    .map((resource) => CUSTOM_ROLE_PERMISSIONS[resource as CustomRoleResource]?.label)
    .filter(Boolean);
  return `Özel rol: ${areas.join(", ")}`;
}

function RoleSelect({
  value,
  onChange,
  roles,
  customRoles,
}: {
  value: string;
  onChange: (role: string) => void;
  roles: string[];
  customRoles: CustomRole[];
}) {
  return (
    <FormField label="Rol" hint={roleHint(value, customRoles)}>
      {(field) => (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger {...field} className="w-full">
            <SelectValue>{roleLabel(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {roles.map((role) => (
              <SelectItem key={role} value={role}>
                {roleLabel(role)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  );
}

interface CustomRole {
  name: string;
  permission: Record<string, string[]>;
}

export function TeamManager({
  currentUserId,
  members,
  invitations,
  practitioners,
  assignableRoles,
  customRoles,
  permissions,
}: {
  currentUserId: string;
  members: Member[];
  invitations: { id: string; email: string; role: string | null; expiresAt: Date }[];
  practitioners: { id: string; name: string }[];
  assignableRoles: string[];
  customRoles: CustomRole[];
  permissions: { update: boolean; remove: boolean; cancel: boolean };
}) {
  const [invite, setInvite] = useState<{ email: string; role: string }>({
    email: "",
    role: assignableRoles.includes("staff") ? "staff" : (assignableRoles[0] ?? "staff"),
  });
  const [editing, setEditing] = useState<Member | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const { pending, save } = useSave();
  const date = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" });

  return (
    <>
      <SettingsCard
        title="Ekibe davet et"
        description="Davet e-postasındaki bağlantıyla kişi kendi parolasını belirleyip ekibe katılır. Davet 7 gün geçerlidir."
        footer={
          <SaveButton
            pending={pending}
            disabled={!invite.email}
            onClick={() =>
              save(
                () => inviteMember(invite),
                () => setInvite((current) => ({ ...current, email: "" })),
              )
            }
          >
            <MailPlus />
            Davet gönder
          </SaveButton>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="E-posta">
            <Input
              type="email"
              autoComplete="off"
              value={invite.email}
              onChange={(event) =>
                setInvite((current) => ({ ...current, email: event.target.value }))
              }
            />
          </FormField>
          <RoleSelect
            value={invite.role}
            onChange={(role) => setInvite((current) => ({ ...current, role }))}
            roles={assignableRoles}
            customRoles={customRoles}
          />
        </div>
      </SettingsCard>

      {invitations.length > 0 && (
        <SettingsCard title="Bekleyen davetler">
          <ul className="flex flex-col divide-y divide-hairline">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <span className="flex flex-col">
                  <span className="font-medium text-heading">{invitation.email}</span>
                  <span className="text-xs text-body">
                    {roleText(invitation.role ?? "staff")} · {date.format(invitation.expiresAt)}{" "}
                    tarihine kadar
                  </span>
                </span>
                {permissions.cancel && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => save(() => cancelInvitation(invitation.id))}
                  >
                    <X data-icon="inline-start" />
                    İptal et
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </SettingsCard>
      )}

      <SettingsCard title="Ekip" description={`${members.length} kişi`}>
        <ul className="flex flex-col divide-y divide-hairline">
          {members.map((member) => {
            const practitioner = practitioners.find((p) => p.id === member.practitionerId);
            const self = member.userId === currentUserId;
            return (
              <li
                key={member.memberId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {member.name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part.charAt(0).toLocaleUpperCase("tr"))
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-heading">
                      {member.name}
                      {self && <span className="text-body"> (siz)</span>}
                    </span>
                    <span className="truncate text-xs text-body">{member.email}</span>
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant="outline">{roleText(member.role)}</Badge>
                  {practitioner && <Badge variant="soft">{practitioner.name}</Badge>}
                  {permissions.update && !self && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Düzenle"
                      onClick={() => setEditing(member)}
                    >
                      <Pencil />
                    </Button>
                  )}
                  {permissions.remove && !self && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Ekipten çıkar"
                      onClick={() => setRemoving(member)}
                    >
                      <UserMinus />
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </SettingsCard>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          {editing && (
            <MemberEditor
              key={editing.memberId}
              member={editing}
              practitioners={practitioners}
              roles={assignableRoles}
              customRoles={customRoles}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{removing?.name} ekipten çıkarılsın mı?</DialogTitle>
            <DialogDescription>
              Panele erişimi hemen kapanır. Gerekirse yeniden davet edebilirsiniz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Vazgeç</Button>
            </DialogClose>
            <SaveButton
              pending={pending}
              onClick={() =>
                removing &&
                save(
                  () => removeMember(removing.memberId),
                  () => setRemoving(null),
                )
              }
            >
              Ekipten çıkar
            </SaveButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MemberEditor({
  member,
  practitioners,
  roles,
  customRoles,
  onDone,
}: {
  member: Member;
  practitioners: { id: string; name: string }[];
  roles: string[];
  customRoles: CustomRole[];
  onDone: () => void;
}) {
  // Several roles ("admin,staff") are edited as one; the first is kept.
  const initialRole = member.role.split(",")[0]?.trim() || "staff";
  const [role, setRole] = useState(initialRole);
  const [practitionerId, setPractitionerId] = useState(member.practitionerId ?? "");
  const { pending, save } = useSave();
  const available = roles.includes(initialRole) ? roles : [initialRole, ...roles];

  return (
    <>
      <DialogHeader>
        <DialogTitle>{member.name}</DialogTitle>
        <DialogDescription>{member.email}</DialogDescription>
      </DialogHeader>
      <RoleSelect value={role} onChange={setRole} roles={available} customRoles={customRoles} />
      {role === "practitioner" && (
        <FormField
          label="Bağlı hekim"
          hint="Bu kişi takvimde yalnızca seçilen hekimin randevularını görür."
        >
          {(field) => (
            <Select value={practitionerId} onValueChange={setPractitionerId}>
              <SelectTrigger {...field} className="w-full">
                <SelectValue placeholder="Hekim seçin">
                  {practitioners.find((p) => p.id === practitionerId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {practitioners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Vazgeç</Button>
        </DialogClose>
        <SaveButton
          pending={pending}
          onClick={() =>
            save(
              () =>
                updateMember({
                  memberId: member.memberId,
                  role,
                  practitionerId: practitionerId || null,
                }),
              onDone,
            )
          }
        />
      </DialogFooter>
    </>
  );
}
