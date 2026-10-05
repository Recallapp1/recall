/**
 * Sector templates for new clinics (F6, docs/04-panel/ONBOARDING.md). They
 * are a starting point: the clinic edits services, prices and hours in the
 * panel afterwards. Durations in minutes; no prices (set per clinic).
 */
export interface ServiceTemplate {
  name: string;
  durationMinutes: number;
  aliases: string[];
}

export const CLINIC_TEMPLATES = {
  dis: {
    label: "Diş kliniği",
    practitionerTitle: "Dt.",
    services: [
      {
        name: "Muayene / Kontrol",
        durationMinutes: 20,
        aliases: ["muayene", "kontrol", "bakılması", "ağrı"],
      },
      {
        name: "Diş Taşı Temizliği",
        durationMinutes: 30,
        aliases: ["temizlik", "detertraj", "taş"],
      },
      { name: "Dolgu", durationMinutes: 45, aliases: ["dolgu", "çürük"] },
      { name: "Kanal Tedavisi", durationMinutes: 60, aliases: ["kanal"] },
      { name: "Diş Çekimi", durationMinutes: 30, aliases: ["çekim", "çektirmek"] },
      { name: "İmplant Görüşmesi", durationMinutes: 30, aliases: ["implant", "vida"] },
      { name: "Diş Beyazlatma", durationMinutes: 60, aliases: ["beyazlatma", "bleaching"] },
      {
        name: "Ortodonti Görüşmesi",
        durationMinutes: 30,
        aliases: ["tel", "şeffaf plak", "ortodonti"],
      },
    ],
  },
  estetik: {
    label: "Estetik ve güzellik",
    practitionerTitle: "Dr.",
    services: [
      {
        name: "Ön Görüşme / Konsültasyon",
        durationMinutes: 30,
        aliases: ["görüşme", "konsültasyon", "muayene"],
      },
      { name: "Botoks", durationMinutes: 30, aliases: ["botoks", "botox"] },
      {
        name: "Dolgu Uygulaması",
        durationMinutes: 45,
        aliases: ["dudak dolgusu", "yüz dolgusu", "filler"],
      },
      {
        name: "Cilt Bakımı",
        durationMinutes: 60,
        aliases: ["cilt bakımı", "hydrafacial", "temizlik"],
      },
      { name: "Lazer Epilasyon", durationMinutes: 45, aliases: ["lazer", "epilasyon"] },
      { name: "Mezoterapi", durationMinutes: 30, aliases: ["mezoterapi", "gençlik aşısı"] },
    ],
  },
  fizyoterapi: {
    label: "Fizyoterapi",
    practitionerTitle: "Fzt.",
    services: [
      {
        name: "İlk Değerlendirme",
        durationMinutes: 45,
        aliases: ["değerlendirme", "muayene", "ilk seans"],
      },
      {
        name: "Fizik Tedavi Seansı",
        durationMinutes: 60,
        aliases: ["seans", "fizik tedavi", "terapi"],
      },
      { name: "Manuel Terapi", durationMinutes: 45, aliases: ["manuel terapi", "masaj"] },
      { name: "Kinesyo Bantlama", durationMinutes: 20, aliases: ["bant", "kinesyo"] },
    ],
  },
  genel: {
    label: "Diğer / boş",
    practitionerTitle: null,
    services: [
      { name: "Muayene", durationMinutes: 30, aliases: ["muayene", "kontrol", "randevu"] },
    ],
  },
} as const satisfies Record<
  string,
  { label: string; practitionerTitle: string | null; services: ServiceTemplate[] }
>;

export type ClinicTemplate = keyof typeof CLINIC_TEMPLATES;
export const CLINIC_TEMPLATE_KEYS = Object.keys(CLINIC_TEMPLATES) as ClinicTemplate[];

/** Default opening hours for a new clinic: weekdays 09:00–18:00. */
export const DEFAULT_CLINIC_HOURS = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startTime: "09:00",
  endTime: "18:00",
}));

/** "Gülüş Diş Kliniği" → "gulus-dis-klinigi" */
export function slugify(name: string): string {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", i̇: "i", ö: "o", ş: "s", ü: "u" };
  return name
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]|i̇/g, (char) => map[char] ?? char)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
