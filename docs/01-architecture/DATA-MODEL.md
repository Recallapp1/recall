# Veri Modeli

Kaynak gerçek: [`src/server/db/schema.ts`](../../src/server/db/schema.ts). Bu belge kavramsal modeli ve kuralları açıklar.

## ER diyagramı

```mermaid
erDiagram
    clinics ||--o{ practitioners : has
    clinics ||--o{ services : offers
    clinics ||--o{ working_hours : defines
    clinics ||--o{ time_off : has
    clinics ||--o{ patients : has
    clinics ||--o{ appointments : has
    clinics ||--o{ calls : receives
    clinics ||--o{ callback_requests : has
    practitioners ||--o{ practitioner_services : performs
    services ||--o{ practitioner_services : "performed by"
    practitioners ||--o{ working_hours : works
    practitioners ||--o{ time_off : takes
    practitioners ||--o{ appointments : attends
    services ||--o{ appointments : "is booked as"
    patients ||--o{ appointments : books
    calls |o--o{ appointments : "created"
    calls |o--o{ callback_requests : "created"
```

## Tablolar

### `clinics`: kiracı

| Kolon                  | Tip                    | Not                                                                                         |
| ---------------------- | ---------------------- | ------------------------------------------------------------------------------------------- |
| id                     | uuid PK                |                                                                                             |
| slug                   | text unique            | URL'lerde                                                                                   |
| name                   | text                   | Asistanın söylediği ad                                                                      |
| timezone               | text                   | Varsayılan `Europe/Istanbul`                                                                |
| phone_number           | text unique, null      | Recall'a bağlı numara (E.164). Gelen aramada kiracıyı bu belirler                           |
| transfer_phone_number  | text, null             | İnsana devretme numarası                                                                    |
| address                | text, null             |                                                                                             |
| settings               | jsonb                  | Asistan ayarları, bkz. [CLINIC-CONFIG-SCHEMA.md](../02-voice-agent/CLINIC-CONFIG-SCHEMA.md) |
| status                 | enum `active`/`paused` | `paused` iken asistan sadece mesaj bırakır                                                  |
| created_at, updated_at | timestamptz            |                                                                                             |

> Faz 2'de Better Auth `organization` tablosu eklenecek ve `clinics.organization_id` ile 1:1 bağlanacak.

### `practitioners`: hekim veya uzman

`id, clinic_id, name, title (Dt., Dr., Uzm.), is_active`

### `services`: hizmet

| Kolon                | Not                                                                              |
| -------------------- | -------------------------------------------------------------------------------- |
| name                 | "Diş Taşı Temizliği"                                                             |
| aliases              | text[]: sesli eşleştirme için eş anlamlılar ("temizlik", "detertraj")            |
| duration_minutes     | Slot uzunluğu                                                                    |
| price_min, price_max | Kuruş (integer), null olabilir. `settings.assistant.speakPrices` açıksa söylenir |
| is_active            |                                                                                  |

### `practitioner_services`

Hangi hekim hangi hizmeti veriyor. Bir hizmet için hiç kayıt yoksa **tüm aktif hekimler** o hizmeti verebilir kabul edilir.

### `working_hours`: haftalık program

| Kolon                | Not                                 |
| -------------------- | ----------------------------------- |
| practitioner_id      | null ise **klinik açılış saatleri** |
| weekday              | 1 = Pazartesi … 7 = Pazar (ISO)     |
| start_time, end_time | `time`, kliniğin yerel saati        |

Bir güne birden fazla satır girilebilir (öğle arası = iki blok). Bir hekimin müsaitliği, **hekim saatleri ∩ klinik saatleri** olarak hesaplanır.

### `time_off`: izin ve tatil

`practitioner_id` null ise klinik tamamen kapalıdır (resmî tatil vb.). `starts_at, ends_at` timestamptz.

### `patients`

| Kolon          | Not                                                |
| -------------- | -------------------------------------------------- |
| full_name      |                                                    |
| phone          | E.164. `(clinic_id, phone)` unique                 |
| notes          | Panelden                                           |
| kvkk_notice_at | Aydınlatma anonsunun dinletildiği ilk arama zamanı |

### `appointments`

| Kolon                                   | Not                                                           |
| --------------------------------------- | ------------------------------------------------------------- |
| patient_id, practitioner_id, service_id |                                                               |
| starts_at, ends_at                      | timestamptz (UTC)                                             |
| status                                  | `scheduled`, `confirmed`, `cancelled`, `completed`, `no_show` |
| source                                  | `voice`, `panel`                                              |
| call_id                                 | Sesli asistan oluşturduysa                                    |
| notes, cancelled_at                     |                                                               |

**Çifte rezervasyon engeli:** Aynı hekim için aktif (`scheduled`, `confirmed`) randevuların zaman aralıkları çakışamaz. Bu kural PostgreSQL `EXCLUDE USING gist` constraint'i ile **veritabanında** zorlanır, sadece uygulama kodunda değil. İki arama aynı anda aynı slotu almaya çalışırsa biri hata alır ve asistan yeni slot önerir.

### `calls`

| Kolon                                  | Not                                                                                           |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| provider, provider_call_id             | `vapi`, unique                                                                                |
| from_number, to_number                 |                                                                                               |
| started_at, ended_at, duration_seconds |                                                                                               |
| ended_reason                           | Sağlayıcıdan gelen                                                                            |
| outcome                                | `booked`, `cancelled`, `rescheduled`, `info`, `transferred`, `callback`, `abandoned`, `other` |
| summary, transcript                    | Hassas veri, saklama politikasına tabi                                                        |
| recording_url                          |                                                                                               |
| cost_usd                               | numeric                                                                                       |

### `callback_requests`: geri aranacaklar

`clinic_id, call_id, patient_name, phone, reason, status (open/done), resolved_at`

## Kurallar

- Her tabloda (clinics hariç) `clinic_id NOT NULL` ve `ON DELETE CASCADE` var.
- Para birimi kuruş (integer). Float kullanılmaz.
- Telefon numaraları E.164 (`+905321234567`) olarak normalize edilir: `src/lib/phone.ts`.
- Silme: hasta silme talebi (KVKK) gelirse hasta anonimleştirilir, randevu istatistikleri korunur. Bkz. [DATA-RETENTION.md](../05-compliance/DATA-RETENTION.md).

## Migration

```bash
pnpm db:generate   # schema.ts değişikliğinden SQL migration üret
pnpm db:migrate    # uygula
```

Exclusion constraint gibi Drizzle'ın ifade edemediği yapılar, `drizzle/` altındaki **custom** migration dosyalarında düz SQL olarak tutulur.
