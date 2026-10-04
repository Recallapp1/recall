"use client";

import { Building2, Check, ChevronsUpDown, LogOut } from "lucide-react";
import { useTransition } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";
import { isBuiltInRole, ROLE_LABELS } from "@/lib/permissions";

import { signOut } from "../../../(auth)/actions";
import { switchClinic } from "../../actions";

export interface ClinicOption {
  organizationId: string;
  clinicName: string;
}

export function roleLabel(role: string) {
  return role
    .split(",")
    .map((name) => (isBuiltInRole(name) ? ROLE_LABELS[name] : name))
    .join(", ");
}

/** Clinic name and role; a switcher when the user belongs to several clinics. */
export function ClinicSwitcher({
  current,
  options,
  role,
}: {
  current: ClinicOption;
  options: ClinicOption[];
  role: string;
}) {
  const [pending, startTransition] = useTransition();
  const label = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary">
        <Building2 aria-hidden className="size-4 text-on-dark" />
      </span>
      <span className="flex min-w-0 flex-col text-left">
        <span className="truncate text-sm font-semibold text-on-dark">{current.clinicName}</span>
        <span className="truncate text-xs text-on-dark-muted">{roleLabel(role)}</span>
      </span>
    </>
  );

  if (options.length < 2) {
    return <div className="flex items-center gap-3 rounded-card glass p-2.5">{label}</div>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="flex w-full items-center gap-3 rounded-card glass p-2.5 transition-colors hover:bg-glass-strong"
      >
        {label}
        <ChevronsUpDown aria-hidden className="ml-auto size-4 shrink-0 text-on-dark-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Klinikler</DropdownMenuLabel>
        {options.map((option) => (
          <DropdownMenuItem
            key={option.organizationId}
            onSelect={() => {
              if (option.organizationId !== current.organizationId) {
                startTransition(() => switchClinic(option.organizationId));
              }
            }}
          >
            <span className="truncate">{option.clinicName}</span>
            {option.organizationId === current.organizationId && (
              <Check aria-hidden className="ml-auto text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("tr"))
    .join("");
}

export function UserMenu({
  name,
  email,
  tone = "light",
}: {
  name: string;
  email: string;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Hesap menüsü"
        className={cn(
          "flex min-w-0 items-center gap-3 rounded-full p-1 pr-3 transition-colors",
          dark ? "w-full hover:bg-glass" : "hover:bg-paper",
        )}
      >
        <Avatar>
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
        <span className={cn("min-w-0 flex-col text-left", dark ? "flex" : "hidden sm:flex")}>
          <span
            className={cn("truncate text-sm font-medium", dark ? "text-on-dark" : "text-heading")}
          >
            {name}
          </span>
          <span className={cn("truncate text-xs", dark ? "text-on-dark-muted" : "text-body")}>
            {email}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Hesap</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden />
              Çıkış yap
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
