"use client";

import {
  CalendarPlus,
  CalendarX2,
  ChevronDown,
  LogOut,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AppointmentSourceBadge,
  AppointmentStatusBadge,
  EmptyState,
  FormField,
  ScheduleGrid,
  type ScheduleAppointment,
} from "@/components/panel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { APPOINTMENT_STATUSES } from "@/lib/contracts/appointment";

// Example data for the style guide only (fictional names).
const practitioners = [
  { id: "dr-a", label: "Dt. Elif Kaya", description: "Genel diş hekimliği" },
  { id: "dr-b", label: "Dt. Murat Demir", description: "Ortodonti" },
  { id: "dr-c", label: "Dt. Selin Aydın", description: "Pedodonti" },
];

const appointments: ScheduleAppointment[] = [
  {
    id: "1",
    columnId: "dr-a",
    startMinute: 540,
    endMinute: 570,
    title: "Ayşe Y.",
    detail: "Muayene",
    status: "confirmed",
    source: "voice",
  },
  {
    id: "2",
    columnId: "dr-a",
    startMinute: 600,
    endMinute: 660,
    title: "Can T.",
    detail: "Dolgu",
    status: "scheduled",
    source: "panel",
  },
  {
    id: "3",
    columnId: "dr-a",
    startMinute: 615,
    endMinute: 645,
    title: "Deniz K.",
    detail: "Kontrol",
    status: "cancelled",
    source: "voice",
  },
  {
    id: "4",
    columnId: "dr-a",
    startMinute: 780,
    endMinute: 795,
    title: "Ece B.",
    detail: "Kontrol",
    status: "scheduled",
    source: "voice",
  },
  {
    id: "5",
    columnId: "dr-b",
    startMinute: 570,
    endMinute: 630,
    title: "Mert A.",
    detail: "Tel kontrolü",
    status: "completed",
    source: "panel",
  },
  {
    id: "6",
    columnId: "dr-b",
    startMinute: 690,
    endMinute: 750,
    title: "Zeynep S.",
    detail: "İlk muayene",
    status: "no_show",
    source: "voice",
  },
  {
    id: "7",
    columnId: "dr-c",
    startMinute: 840,
    endMinute: 900,
    title: "Ali R.",
    detail: "Flor uygulaması",
    status: "confirmed",
    source: "voice",
  },
];

const tableRows = [
  {
    time: "09:00",
    patient: "Ayşe Y.",
    service: "Muayene",
    practitioner: "Dt. Elif Kaya",
    status: "confirmed",
    source: "voice",
  },
  {
    time: "10:00",
    patient: "Can T.",
    service: "Dolgu",
    practitioner: "Dt. Elif Kaya",
    status: "scheduled",
    source: "panel",
  },
  {
    time: "11:30",
    patient: "Zeynep S.",
    service: "İlk muayene",
    practitioner: "Dt. Murat Demir",
    status: "no_show",
    source: "voice",
  },
] as const;

export function PanelShowcase() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-10">
        <Block title="Butonlar">
          <div className="flex flex-wrap items-center gap-3">
            <Button>
              <CalendarPlus data-icon="inline-start" />
              Randevu oluştur
            </Button>
            <Button variant="outline">Vazgeç</Button>
            <Button variant="secondary">Filtrele</Button>
            <Button variant="ghost">Tümünü gör</Button>
            <Button variant="destructive">Randevuyu iptal et</Button>
            <Button variant="link">Ayrıntılar</Button>
            <Button size="sm">Küçük</Button>
            <Button size="lg">Büyük</Button>
            <Button disabled>Pasif</Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Düzenle">
                  <Pencil />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Düzenle</TooltipContent>
            </Tooltip>
          </div>
        </Block>

        <Block title="Rozetler">
          <div className="flex flex-wrap items-center gap-2">
            {APPOINTMENT_STATUSES.map((status) => (
              <AppointmentStatusBadge key={status} status={status} />
            ))}
            <AppointmentSourceBadge source="voice" />
            <AppointmentSourceBadge source="panel" />
            <Badge variant="success">Senkronize</Badge>
            <Badge variant="destructive">Hata</Badge>
          </div>
        </Block>

        <Block title="Form alanları">
          <div className="grid gap-6 md:grid-cols-2">
            <FormField label="Hasta adı" hint="Ad ve soyad">
              <Input placeholder="Örn. Ayşe Yılmaz" />
            </FormField>
            <FormField label="Telefon" error="Geçerli bir telefon numarası yazın.">
              <Input defaultValue="0532" inputMode="tel" />
            </FormField>
            <FormField label="Hekim">
              {(field) => (
                <Select defaultValue="dr-a">
                  <SelectTrigger {...field} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {practitioners.map((practitioner) => (
                      <SelectItem key={practitioner.id} value={practitioner.id}>
                        {practitioner.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField label="Tarih">
              {(field) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button {...field} variant="outline" className="justify-between">
                      {date
                        ? date.toLocaleDateString("tr-TR", { dateStyle: "long" })
                        : "Tarih seçin"}
                      <ChevronDown />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={date} onSelect={setDate} />
                  </PopoverContent>
                </Popover>
              )}
            </FormField>
            <FormField label="Not" className="md:col-span-2">
              <Textarea placeholder="Hastanın iletmek istediği not" />
            </FormField>
            <div className="flex items-center gap-3">
              <Checkbox id="sms" defaultChecked />
              <Label htmlFor="sms">Hastaya SMS ile bildir</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="assistant" defaultChecked />
              <Label htmlFor="assistant">Asistan aramaları yanıtlasın</Label>
            </div>
          </div>
        </Block>

        <Block title="Sekmeler, menü, dialog, sheet, toast">
          <div className="flex flex-wrap items-start gap-6">
            <Tabs defaultValue="day">
              <TabsList>
                <TabsTrigger value="day">Gün</TabsTrigger>
                <TabsTrigger value="week">Hafta</TabsTrigger>
                <TabsTrigger value="list">Liste</TabsTrigger>
              </TabsList>
              <TabsContent value="day" className="text-body">
                Gün görünümü
              </TabsContent>
              <TabsContent value="week" className="text-body">
                Hafta görünümü
              </TabsContent>
              <TabsContent value="list" className="text-body">
                Liste görünümü
              </TabsContent>
            </Tabs>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Randevu işlemleri">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-52">
                <DropdownMenuLabel>Randevu</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Pencil />
                  Düzenle
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <UserRound />
                  Hasta kartı
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                  <Trash2 />
                  İptal et
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Randevu iptal edilsin mi?</DialogTitle>
                  <DialogDescription>
                    Ayşe Y. için 09:00 randevusu iptal edilecek. Hastaya SMS ile bilgi verilir.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Vazgeç</Button>
                  </DialogClose>
                  <Button variant="destructive">İptal et</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Sheet</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Randevu ayrıntısı</SheetTitle>
                  <SheetDescription>09:00–09:30 · Muayene · Dt. Elif Kaya</SheetDescription>
                </SheetHeader>
                <div className="flex flex-wrap gap-2 px-6">
                  <AppointmentStatusBadge status="confirmed" />
                  <AppointmentSourceBadge source="voice" />
                </div>
                <SheetFooter>
                  <Button>Kaydet</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            <Button variant="outline" onClick={() => toast.success("Randevu oluşturuldu")}>
              Toast (başarı)
            </Button>
            <Button
              variant="outline"
              onClick={() => toast.error("Randevu kaydedilemedi. Tekrar deneyin.")}
            >
              Toast (hata)
            </Button>
          </div>
        </Block>

        <Block title="Tablo">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Saat</TableHead>
                <TableHead>Hasta</TableHead>
                <TableHead>Hizmet</TableHead>
                <TableHead>Hekim</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Kaynak</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.map((row) => (
                <TableRow key={row.time}>
                  <TableCell className="tabular-nums">{row.time}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarFallback>{row.patient.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      {row.patient}
                    </span>
                  </TableCell>
                  <TableCell className="text-body">{row.service}</TableCell>
                  <TableCell className="text-body">{row.practitioner}</TableCell>
                  <TableCell>
                    <AppointmentStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    <AppointmentSourceBadge source={row.source} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableCaption>
              Örnek veri · sıralama ve sayfalama F5&apos;te veriyle bağlanacak
            </TableCaption>
          </Table>
        </Block>

        <Block title="Takvim · gün görünümü (hekim kolonları)">
          <ScheduleGrid
            label="Örnek gün takvimi"
            columns={practitioners}
            appointments={appointments}
            nowMinute={11 * 60 + 20}
            range={{ startMinute: 8 * 60, endMinute: 16 * 60 }}
          />
        </Block>

        <Block title="Boş durum ve iskelet">
          <div className="grid gap-6 md:grid-cols-2">
            <EmptyState
              icon={CalendarX2}
              title="Bugün randevu yok"
              description="Asistanın oluşturduğu ve panelden eklenen randevular burada görünür."
              action={<Button size="sm">Randevu oluştur</Button>}
            />
            <div className="flex flex-col gap-3 rounded-card border border-hairline bg-paper p-6">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-10 w-32 rounded-full" />
            </div>
          </div>
        </Block>

        <Block title="Avatar">
          <div className="flex items-center gap-3">
            <Avatar size="sm">
              <AvatarFallback>EK</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>MD</AvatarFallback>
            </Avatar>
            <Avatar size="lg">
              <AvatarFallback>SA</AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="sm">
              <LogOut data-icon="inline-start" />
              Çıkış yap
            </Button>
          </div>
        </Block>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-label text-body">{title}</h3>
      {children}
    </div>
  );
}
