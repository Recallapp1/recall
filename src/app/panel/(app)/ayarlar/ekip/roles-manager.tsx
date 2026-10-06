"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { FormField } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { CUSTOM_ROLE_PERMISSIONS, roleLabel, type CustomRoleResource } from "@/lib/permissions";

import { deleteCustomRole, saveCustomRole } from "./actions";
import { SaveButton, SettingsCard, useSave } from "../_components/settings-ui";

interface Role {
  name: string;
  permission: Record<string, string[]>;
  memberCount: number;
}

type Draft = { existing: boolean; name: string; permission: Record<string, string[]> };

const RESOURCES = Object.entries(CUSTOM_ROLE_PERMISSIONS) as [
  CustomRoleResource,
  { label: string; actions: Record<string, string> },
][];

function areas(permission: Record<string, string[]>) {
  return Object.keys(permission)
    .map((resource) => CUSTOM_ROLE_PERMISSIONS[resource as CustomRoleResource]?.label)
    .filter(Boolean)
    .join(", ");
}

export function RolesManager({
  roles,
  permissions,
}: {
  roles: Role[];
  permissions: { create: boolean; update: boolean; remove: boolean };
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<Role | null>(null);
  const { pending, save } = useSave();

  return (
    <>
      <SettingsCard
        title="Özel roller"
        description="Hazır roller yetmezse kliniğinize özel bir rol tanımlayın; ekibe davet ederken seçebilirsiniz. Özel roller ekip yönetimi ve faturalandırma yetkisi içermez ve tüm kliniğin takvimini görür."
        footer={
          permissions.create && (
            <Button
              variant="outline"
              onClick={() => setDraft({ existing: false, name: "", permission: {} })}
            >
              <Plus data-icon="inline-start" />
              Yeni rol
            </Button>
          )
        }
      >
        {roles.length === 0 ? (
          <p className="text-sm text-body">Henüz özel rol yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {roles.map((role) => (
              <li
                key={role.name}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium text-heading">{roleLabel(role.name)}</span>
                  <span className="text-xs text-body">{areas(role.permission)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant="outline">{role.memberCount} kişi</Badge>
                  {permissions.update && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${roleLabel(role.name)} rolünü düzenle`}
                      onClick={() =>
                        setDraft({ existing: true, name: role.name, permission: role.permission })
                      }
                    >
                      <Pencil />
                    </Button>
                  )}
                  {permissions.remove && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${roleLabel(role.name)} rolünü sil`}
                      onClick={() => setRemoving(role)}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="sm:max-w-xl">
          {draft && (
            <RoleEditor key={draft.name || "new"} initial={draft} onDone={() => setDraft(null)} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{removing && roleLabel(removing.name)} rolü silinsin mi?</DialogTitle>
            <DialogDescription>
              {removing && removing.memberCount > 0
                ? `Bu rol ${removing.memberCount} kişide kullanılıyor. Silmeden önce o kişilere başka bir rol verin.`
                : "Rol kalıcı olarak silinir."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Vazgeç</Button>
            </DialogClose>
            <SaveButton
              pending={pending}
              disabled={!removing || removing.memberCount > 0}
              onClick={() =>
                removing &&
                save(
                  () => deleteCustomRole(removing.name),
                  () => setRemoving(null),
                )
              }
            >
              Rolü sil
            </SaveButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RoleEditor({ initial, onDone }: { initial: Draft; onDone: () => void }) {
  const [name, setName] = useState(initial.name);
  const [permission, setPermission] = useState(initial.permission);
  const { pending, save } = useSave();

  const toggle = (resource: string, action: string, checked: boolean) =>
    setPermission((current) => {
      const actions = new Set(current[resource] ?? []);
      if (checked) {
        actions.add(action);
        // Doing anything with an area needs seeing it.
        actions.add("read");
      } else if (action === "read") {
        actions.clear();
      } else {
        actions.delete(action);
      }
      return { ...current, [resource]: [...actions] };
    });

  const selected = Object.values(permission).some((actions) => actions.length > 0);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{initial.existing ? roleLabel(initial.name) : "Yeni rol"}</DialogTitle>
        <DialogDescription>
          Yalnızca kendi sahip olduğunuz yetkileri bir role verebilirsiniz.
        </DialogDescription>
      </DialogHeader>
      <FormField
        label="Rol adı"
        hint={
          initial.existing ? "Rol adı oluşturulduktan sonra değiştirilemez." : "Örn: Diş asistanı"
        }
      >
        <Input
          value={name}
          maxLength={40}
          disabled={initial.existing}
          onChange={(event) => setName(event.target.value)}
        />
      </FormField>
      <fieldset className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto">
        <legend className="mb-2 text-sm font-medium text-heading">Yetkiler</legend>
        {RESOURCES.map(([resource, { label, actions }]) => (
          <div
            key={resource}
            className="flex flex-col gap-2 rounded-card-sm border border-hairline p-3"
          >
            <span className="text-sm font-medium text-heading">{label}</span>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {Object.entries(actions).map(([action, actionLabel]) => {
                const id = `perm-${resource}-${action}`;
                return (
                  <label
                    key={action}
                    htmlFor={id}
                    className="flex items-center gap-2 text-sm text-body"
                  >
                    <Checkbox
                      id={id}
                      checked={permission[resource]?.includes(action) ?? false}
                      onCheckedChange={(checked) => toggle(resource, action, checked === true)}
                    />
                    {actionLabel}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </fieldset>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Vazgeç</Button>
        </DialogClose>
        <SaveButton
          pending={pending}
          disabled={!name.trim() || !selected}
          onClick={() =>
            save(() => saveCustomRole({ existing: initial.existing, name, permission }), onDone)
          }
        />
      </DialogFooter>
    </>
  );
}
