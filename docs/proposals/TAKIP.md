# Takip (hasta takip ve hatırlatma): tasarım önerisi

- **Durum:** Onaylandı (2026-10-06), uygulama V0 ile başlıyor
- **İlgili:** [NOTIFICATIONS.md](../03-telephony/NOTIFICATIONS.md), [KVKK.md](../05-compliance/KVKK.md), [DATA-RETENTION.md](../05-compliance/DATA-RETENTION.md), [ADR-009](../decisions/ADR-009-accounts-and-roles.md), [ADR-010](../decisions/ADR-010-platform-console.md)

## Ürün ekibi kararları (2026-10-06)

1. Saati geçmiş, durumu `no_show`/`cancelled` olmayan bağlı randevu **gerçekleşmiş sayılır**. Personel düzeltebilir; plan yeniden hesaplanır.
2. SMS onayı **plan bazında** tutulur. Gerçek SMS gönderimi kapalıdır.
3. Takip, Netgsm'i beklemez. SMS katmanı sağlayıcıdan bağımsız ve stub'dır; Netgsm bağlanınca yalnızca gönderim katmanı devreye girer.
4. **V0:** bildirim kaydı (`notifications`) ve randevu hatırlatma akışı, stub ile. Gerçek SMS yok.
5. Otomatik plan başlatma V1'de var, **varsayılan kapalı**.
6. Sektör örnek kuralları tıbbi öneri gibi görünmez. Aralıklar klinisyen onayı yoksa **boş (placeholder)** bırakılır; örnekler pasif ve düzenlenebilir gelir.
7. Hekim (practitioner) erişimi V1'de yok.
8. Klinik anahtarı, kiracı izolasyonu, denetim kaydı, KVKK dışa aktarma ve anonimleştirme mevcut mimariyle korunur.

**Bağlayıcı kural:** Netgsm entegrasyonu ve hukuki/İYS değerlendirmesi tamamlanana kadar production'da **hiçbir gerçek SMS gönderilmez**. Bunu üç bağımsız kilit sağlar:

- `SMS_SENDING_ENABLED` env değişkeni; varsayılan `false`, production'da ayarlanmaz;
- `SMS_PROVIDER=console` (`delivers=false`);
- kliniğin takip/hatırlatma anahtarı.

Kilitlerden biri kapalıysa kayıt `skipped` olur ve hiçbir sağlayıcı çağrılmaz.

## V0 onayı ile gelen ek kararlar (2026-10-06)

1. **Kiracı izolasyonu:** Ucuz olan yerde **bileşik yabancı anahtar** kullanılır.
   - V0: `notifications (clinic_id, patient_id)` → `patients (clinic_id, id)`, `ON DELETE SET NULL (patient_id)`.
   - V1: `follow_up_plans (clinic_id, patient_id)`, `follow_up_visits (clinic_id, plan_id)` ve `(clinic_id, appointment_id)`.
   - Hedef tablolara `UNIQUE (clinic_id, id)` eklenir.
   - Bileşik anahtar konamayan her yazma yolu (çok biçimli `subject_id`, iş, eşleştirme) için klinik eşitliğini kontrol eden ayrı test yazılır. İş klinikleri asla karıştırmaz.
2. **Otomatik sayılan ziyaret:** V1'de arayüzde açıkça "otomatik sayıldı" diye gösterilir ve tek tıkla düzeltilir ("Gelmedi" / "Tamamlandı").
   - Bu bilgi türetilir: bağlı randevu `scheduled`/`confirmed` ve saati geçmiş. Personel durumu değiştirince "otomatik" etiketi kalkar.
   - Ek kolon gerekmez. `follow_up_visits.source` bağlanma şeklini, randevu durumu sayılma şeklini taşır.
3. **Otomatik başlatma (satır 15):** `follow_up_rules.auto_start` kolonu **kalır** (varsayılan `false`). V1'de **iş yolu ve arayüzü yapılmaz**; V1.1'e ertelendi.
4. **Geç alınan randevu:** Günlük işten sonra ertesi sabah için alınan randevu hatırlatılamaz. Sessizce düşürülmez; `skipped` + `too_late` olarak kaydedilir.
   - **Sınırlama:** İş günde bir kez çalıştığı sürece (Vercel Hobby) hatırlatma "bir gün önce, 10:00"dır.
   - Bir önceki günün işinden sonra alınan, o güne ait her randevu `too_late` olur. Vercel Pro'da saatlik işle kalkar.
5. **Production güvenliği:**
   - 0008 yalnızca ekleme yapar (test: `production-safety.test.ts`). Deploy'da otomatik uygulanması güvenlidir.
   - `SMS_SENDING_ENABLED` production'da **tanımlı değildir**.
   - Cron rotaları doğru `CRON_SECRET` olmadan 401, secret yoksa 503 döner (testli).
6. **Saklama süreleri** "hukuki inceleme bekliyor" olarak işaretlidir (DATA-RETENTION.md).

## A. Özet

Ne yapılacak:

- **Basit tekrarlı kurallar:** her N gün/hafta/ay; süresiz veya toplam N ziyaret.
- Kuralın **hasta planına kopyalanması** (snapshot).
- **Belirsizlikte bağlamayan** randevu eşleştirme.
- **Takip sekmesi.**
- Tek bir günlük iş ve tek bir bildirim kaydı. Bu kayıt, şu an hiçbir şey göndermeyen "randevudan önce hatırlatma" ayarını da gerçek hâle getirir.

Kapsam dışı (V1): kademeli protokoller, sesli asistan önerisi, elle SMS gönder düğmesi, hekim erişimi.

Üç tasarım kararı:

- **Ziyaret bilgisi:** Klinikler randevuyu "tamamlandı" diye işaretlemiyor; bu yüzden karar 1 uygulanır.
- **Önce V0:** Bildirim kaydı önce randevu hatırlatmasıyla kurulur.
- **İki ayrı hizmet:** Kuralda "takibi başlatan hizmet" ile "takip ziyaretinde alınan hizmet" ayrıdır (implant → kontrol).

## B. Mevcut mimari: yeniden kullanım

| Alan                                                | Kullanılır mı | Gereken değişiklik                                                                                                         |
| --------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `patients` (`clinicId+phone` tekil, E.164)          | Evet          | `sms_opt_out_at` kolonu                                                                                                    |
| `appointments` (5 durum, kaynak voice/panel)        | Evet          | Erteleme = iptal + yeni kayıt (yeni id): bağlantı **aynı transaction'da** taşınır. Durum değişince plan yeniden hesaplanır |
| `services`, `practitioners`                         | Evet          | Yok                                                                                                                        |
| İzinler (`permissions.ts`, özel rol paleti)         | Evet          | Yeni `followUps: ["read", "manage"]`                                                                                       |
| Denetim (`recordAudit`)                             | Evet          | Yeni eylem adları                                                                                                          |
| İş zamanlama (Vercel Cron, `CRON_SECRET`)           | Evet          | İkinci cron. **Hobby planında günde bir kez**; saatlik için Pro                                                            |
| SMS (`SmsProvider.delivers`, stub, Netgsm sınıfı)   | Kısmen        | Gönderim kaydı yok, ateşle-unut. `notifications` kaydı ve `SMS_SENDING_ENABLED` kilidi                                     |
| `clinics.settings` (varsayılanlı JSON)              | Evet          | `followUp` bölümü; özellik anahtarı yalnızca konsoldan                                                                     |
| Özellik bayrağı                                     | **Yok**       | Klinik başına `settings.features.followUp`, yalnızca Recall konsolu değiştirir                                             |
| Sektör şablonları (`clinic-templates.ts`)           | Evet          | Örnek kurallar veri olarak, aralıklar boş                                                                                  |
| Zaman (`LocalDate`, `localToUtc`, `addLocalDays`)   | Evet          | `addLocalMonths` (ay sonuna sıkıştırma)                                                                                    |
| Kiracı izolasyonu                                   | Evet          | Aynı kurallar; iş klinik klinik çalışır                                                                                    |
| KVKK (saklama cron'u, anonimleştirme, dışa aktarma) | Evet          | Üçü de takip ve bildirim verisini kapsar                                                                                   |
| Sesli asistan araçları                              | Sonra         | V1'de asistanın aldığı randevu da aynı yolla otomatik bağlanır; prompt değişmez                                            |

**Mevcut tutarsızlık (V0'da düzeltilir):** onay SMS'i hizmet adını içeriyor ("Kanal Tedavisi"). Bu, "SMS'te tedavi bilgisi yok" ilkesine aykırı; şablonlar genelleştirilir.

## C. Final şema

İki migration. Enum değerleri `src/lib/contracts/` altında tanımlanır (mevcut desen). Kolon adları snake_case, tarihler `timestamptz`; klinik yerel günleri `date`.

### Migration 0008 (V0): bildirim kaydı ve SMS izni

```sql
CREATE TYPE notification_kind    AS ENUM ('appointment_reminder', 'follow_up_reminder');
CREATE TYPE notification_channel AS ENUM ('sms');
CREATE TYPE notification_status  AS ENUM ('pending', 'sending', 'sent', 'failed', 'skipped', 'unknown');

CREATE TABLE notifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id          uuid REFERENCES patients(id) ON DELETE SET NULL,
  kind                notification_kind NOT NULL,
  channel             notification_channel NOT NULL DEFAULT 'sms',
  -- Randevu veya takip planı id'si (çok biçimli; FK yok, silinince kayıt kalır)
  subject_id          uuid NOT NULL,
  -- ör. 'appt:<id>:<startsAt epoch>' veya 'fu:<planId>:<dueOn>:<n>'
  dedupe_key          text NOT NULL,
  -- ör. 'appointment_reminder.v1'; mesaj metni ve telefon SAKLANMAZ
  template_key        text NOT NULL,
  status              notification_status NOT NULL DEFAULT 'pending',
  -- provider_disabled | sending_disabled | feature_off | no_consent | opted_out |
  -- invalid_phone | cap_reached | subject_changed | outside_window | patient_removed
  skip_reason         text,
  attempts            smallint NOT NULL DEFAULT 0,
  scheduled_for       timestamptz NOT NULL,
  locked_at           timestamptz,
  sent_at             timestamptz,
  provider            text,
  provider_message_id text,
  error_code          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_attempts_range CHECK (attempts BETWEEN 0 AND 10)
);
CREATE UNIQUE INDEX notifications_dedupe_key_idx  ON notifications (dedupe_key);
CREATE INDEX notifications_dispatch_idx           ON notifications (status, scheduled_for);
CREATE INDEX notifications_clinic_created_idx     ON notifications (clinic_id, created_at);
CREATE INDEX notifications_subject_idx            ON notifications (subject_id);

ALTER TABLE patients ADD COLUMN sms_opt_out_at timestamptz;
```

### Migration 0009 (V1): takip

```sql
CREATE TYPE follow_up_interval_unit AS ENUM ('day', 'week', 'month');
CREATE TYPE follow_up_state         AS ENUM ('active', 'paused', 'stopped', 'completed');
CREATE TYPE follow_up_visit_source  AS ENUM ('start', 'auto_link', 'staff_link', 'manual');

CREATE TABLE follow_up_rules (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id          uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name               text NOT NULL,
  -- Takibi başlatan hizmet (otomatik başlatma ve öneri için); boşsa yalnızca elle
  trigger_service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  -- Takip ziyaretinde alınan hizmet (eşleştirme ve randevu oluşturma bununla)
  visit_service_id   uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  -- Boş = örnek şablonda aralık belirlenmemiş; kural etkinleştirilemez
  interval_value     smallint,
  interval_unit      follow_up_interval_unit,
  -- Boş = süresiz. Plan bir randevudan başlarsa ilk ziyaret dahildir
  total_visits       smallint,
  auto_start         boolean NOT NULL DEFAULT false,
  sms_reminders      boolean NOT NULL DEFAULT false,
  is_active          boolean NOT NULL DEFAULT false,
  -- Örnek şablondan geldiyse anahtarı (ör. 'dis.temizlik'); arayüzde "Örnek şablon" etiketi
  template_key       text,
  archived_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT follow_up_rules_interval_range CHECK (
    interval_value IS NULL OR (interval_unit = 'day'   AND interval_value BETWEEN 1 AND 730)
                          OR (interval_unit = 'week'  AND interval_value BETWEEN 1 AND 104)
                          OR (interval_unit = 'month' AND interval_value BETWEEN 1 AND 36)),
  CONSTRAINT follow_up_rules_interval_pair CHECK ((interval_value IS NULL) = (interval_unit IS NULL)),
  CONSTRAINT follow_up_rules_total_range   CHECK (total_visits IS NULL OR total_visits BETWEEN 1 AND 50),
  -- Aralığı belirlenmemiş veya arşivlenmiş kural etkin olamaz
  CONSTRAINT follow_up_rules_active_valid  CHECK (NOT is_active OR (interval_value IS NOT NULL AND archived_at IS NULL))
);
CREATE INDEX follow_up_rules_clinic_idx  ON follow_up_rules (clinic_id);
CREATE INDEX follow_up_rules_trigger_idx ON follow_up_rules (clinic_id, trigger_service_id) WHERE is_active;

CREATE TABLE follow_up_plans (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id            uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id           uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  rule_id              uuid NOT NULL REFERENCES follow_up_rules(id) ON DELETE RESTRICT,
  -- Başlangıçta kuraldan kopyalanır; kural değişikliği mevcut planı etkilemez
  name                 text NOT NULL,
  visit_service_id     uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  interval_value       smallint NOT NULL,
  interval_unit        follow_up_interval_unit NOT NULL,
  total_visits         smallint,
  state                follow_up_state NOT NULL DEFAULT 'active',
  started_on           date NOT NULL,
  -- Personelin elle verdiği sonraki tarih; bundan sonra gerçekleşen ziyaret onu geçersiz kılar
  due_override_on      date,
  due_override_at      timestamptz,
  -- Önbellek: recompute() ile her ilgili olayda ve günlük işte yeniden hesaplanır
  next_due_on          date,
  visits_done          smallint NOT NULL DEFAULT 0,
  -- Birden çok plana uyan randevu: personel eşleştirmeli ("Eşleştirme bekliyor")
  needs_review         boolean NOT NULL DEFAULT false,
  sms_consent_at       timestamptz,
  sms_consent_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  -- patient_request | treatment_changed | unreachable | other (serbest metin yok)
  stopped_reason       text,
  state_changed_at     timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT follow_up_plans_interval_positive CHECK (interval_value > 0),
  CONSTRAINT follow_up_plans_override_pair     CHECK ((due_override_on IS NULL) = (due_override_at IS NULL)),
  CONSTRAINT follow_up_plans_stop_reason       CHECK ((state = 'stopped') = (stopped_reason IS NOT NULL))
);
-- Aynı hasta ve kural için tek açık plan
CREATE UNIQUE INDEX follow_up_plans_open_idx ON follow_up_plans (patient_id, rule_id) WHERE state IN ('active', 'paused');
CREATE INDEX follow_up_plans_due_idx        ON follow_up_plans (clinic_id, state, next_due_on);
CREATE INDEX follow_up_plans_patient_idx    ON follow_up_plans (patient_id);

CREATE TABLE follow_up_visits (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  plan_id        uuid NOT NULL REFERENCES follow_up_plans(id) ON DELETE CASCADE,
  -- Bağlı randevu: gerçekleşme randevunun güncel durumundan türetilir, burada saklanmaz
  appointment_id uuid REFERENCES appointments(id) ON DELETE CASCADE,
  -- Randevusuz ziyaret ("Ziyaret kaydet")
  visited_on     date,
  source         follow_up_visit_source NOT NULL,
  created_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT follow_up_visits_has_date CHECK (appointment_id IS NOT NULL OR visited_on IS NOT NULL)
);
-- Bir randevu en fazla bir plana bağlanır
CREATE UNIQUE INDEX follow_up_visits_appointment_idx ON follow_up_visits (appointment_id);
CREATE INDEX follow_up_visits_plan_idx               ON follow_up_visits (plan_id);
```

**Kiracı bütünlüğü:** `clinic_id` her tabloda, ama FK'ler klinikler arası referansı engellemez (ör. A kliniğinin planına B'nin randevusu). Bu, yazan her domain fonksiyonunda `clinicId` eşitliği ile kontrol edilir ve testlenir (mevcut desen).

**Klinik ayarları** (`clinics.settings`, JSON, varsayılanlı):

```ts
features: { followUp: false },          // yalnızca Recall konsolu
followUp: { smsReminders: false, dueSoonDays: 14, dailySmsCap: 100 },
notifications: { /* mevcut */ smsConfirmation, smsReminderHoursBefore },
```

**Env:** `SMS_SENDING_ENABLED` (`false` varsayılan). `true` olmadan hiçbir sağlayıcı çağrılmaz.

## D. Hesaplama kuralı

`recompute(plan)` saf bir fonksiyondur. Önbellek kolonlarını (`next_due_on`, `visits_done`, `state`) üretir; ilgili her olayda aynı transaction'da ve günlük işte çağrılır.

- **Gerçekleşmiş ziyaret:**
  - `visited_on` dolu manuel ziyaret, veya
  - bağlı randevu, şu şartlarla: durumu `completed`, ya da `ends_at < now()` ve durumu `scheduled`/`confirmed`.
  - Ziyaret tarihi = randevunun klinik yerel günü.
- **Çapa:**
  1. `due_override_on` varsa ve override'dan (`due_override_at`) sonra gerçekleşmiş ziyaret yoksa → `next_due_on = due_override_on`.
  2. Yoksa son gerçekleşmiş ziyaret.
  3. O da yoksa `started_on`.
- **Sonraki tarih:** `next_due_on = çapa + aralık`. Ay ekleme ay sonuna sıkıştırır (31 Oca + 1 ay = 28/29 Şub). Yerel gün aritmetiği olduğu için yaz saati sorunu yok.
- **Ziyaret sayısı ve tamamlanma:** `visits_done` = gerçekleşmiş ziyaret sayısı. `total_visits` doluysa ve `visits_done >= total_visits` ise `state = completed`, `next_due_on = NULL`.
- **Durum korunur:** `paused` ve `stopped`, recompute ile değişmez. `completed` yalnızca sayıdan türer; bir düzeltme (ör. no-show) sayıyı düşürürse `active`'e döner.

**Görünen durum** (yalnızca `active` için; kaydedilmez):

| Görünen      | Koşul                                                   |
| ------------ | ------------------------------------------------------- |
| Randevulu    | Bağlı, gelecekte, `scheduled`/`confirmed` randevu var   |
| Gecikti      | Randevulu değil ve `next_due_on < bugün`                |
| Zamanı geldi | Randevulu değil ve `next_due_on <= bugün + dueSoonDays` |
| Yaklaşan     | Diğer durumlar                                          |
| + rozet      | `needs_review` → "Eşleştirme bekliyor"                  |

## E. Durum geçiş tablosu: randevu ↔ takip planı ↔ takip ziyareti

"Uygun plan": aynı klinik ve hasta, `state = active`, `visit_service_id` = randevunun hizmeti, bağlı gelecek aktif randevusu olmayan.

| #   | Olay (tetikleyen)                                                | Randevu                                     | Takip ziyareti (`follow_up_visits`)                                    | Takip planı                                                                     | Bildirim / denetim                                                                                 |
| --- | ---------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Randevu oluşturuldu (panel veya asistan), **1 uygun plan**       | `scheduled`                                 | Yeni satır, `source = auto_link`                                       | Recompute → **Randevulu**                                                       | Planlanmış takip hatırlatmaları `skipped(subject_changed)`. Denetim: `follow_up.linked` (otomatik) |
| 2   | Randevu oluşturuldu, **2+ uygun plan**                           | `scheduled`                                 | Yok                                                                    | Uygun planlar `needs_review = true`                                             | —                                                                                                  |
| 3   | Randevu oluşturuldu, uygun plan yok                              | `scheduled`                                 | Yok                                                                    | Değişmez                                                                        | —                                                                                                  |
| 4   | Randevu saati geçti (`ends_at < now`, `scheduled`/`confirmed`)   | Değişmez (veri yazılmaz)                    | Gerçekleşmiş sayılır                                                   | Günlük iş recompute: `visits_done`, `next_due_on`; toplam dolarsa `completed`   | —                                                                                                  |
| 5   | Personel "Tamamlandı"                                            | `completed`                                 | Gerçekleşmiş                                                           | Recompute (4 ile aynı sonuç)                                                    | Mevcut randevu denetimi                                                                            |
| 6   | Personel "Gelmedi"                                               | `no_show`                                   | Satır kalır, **sayılmaz**                                              | Recompute: sayı düşer; `completed` → `active` olabilir; çoğunlukla **Gecikti**  | Mevcut randevu denetimi                                                                            |
| 7   | Düzeltme: `no_show` ↔ `completed`/`confirmed`                    | Yeni durum                                  | Sayılır/sayılmaz                                                       | Recompute                                                                       | Mevcut randevu denetimi                                                                            |
| 8   | Randevu iptal (panel/asistan)                                    | `cancelled`                                 | Satır kalır (geçmiş), sayılmaz                                         | Recompute → Zamanı geldi/Gecikti                                                | Randevu hatırlatması `skipped(subject_changed)`                                                    |
| 9   | Randevu ertelendi (eski iptal + yeni kayıt, **tek transaction**) | Eski `cancelled`, yeni `scheduled`          | Satırın `appointment_id`'si **yeni randevuya taşınır**                 | Recompute → Randevulu                                                           | Eski hatırlatma `skipped`, yeni randevu için yeni kayıt                                            |
| 10  | Personel randevuyu plana bağladı                                 | Değişmez (aynı klinik ve hasta şart)        | Yeni satır, `source = staff_link` (randevu başka plandaysa reddedilir) | Recompute; ilgili planlarda `needs_review` temizlenir                           | `follow_up.linked`                                                                                 |
| 11  | Personel bağlantıyı kaldırdı                                     | Değişmez                                    | Satır silinir                                                          | Recompute                                                                       | `follow_up.unlinked`                                                                               |
| 12  | Personel "Ziyaret kaydet (tarih)"                                | —                                           | Yeni satır, `source = manual`, `visited_on`                            | Recompute                                                                       | `follow_up.visit_recorded`                                                                         |
| 13  | Personel "Takibe al" (randevudan)                                | Değişmez                                    | Başlangıç satırı, `source = start`                                     | Yeni plan (`started_on` = randevu günü, kural kopyası), recompute               | `follow_up.started`                                                                                |
| 14  | Personel "Takip başlat" (hastadan, randevusuz)                   | —                                           | Yok                                                                    | Yeni plan (`started_on` = seçilen gün)                                          | `follow_up.started`                                                                                |
| 15  | Otomatik başlatma (kuralda açık; günlük iş)                      | `trigger_service_id` randevusu gerçekleşmiş | Başlangıç satırı, `source = start`                                     | Açık plan yoksa yeni plan; **SMS izni yok**                                     | `follow_up.started` (aktör: sistem)                                                                |
| 16  | Duraklat                                                         | —                                           | —                                                                      | `paused`; eşleştirme dışı                                                       | Bekleyen takip hatırlatmaları `skipped`. `follow_up.paused`                                        |
| 17  | Devam ettir                                                      | —                                           | —                                                                      | `active`, recompute (tarih geçmişse Gecikti)                                    | `follow_up.resumed`                                                                                |
| 18  | Bırak (sebep kodu)                                               | Bağlı gelecek randevu **değişmez**          | —                                                                      | `stopped` (son durum; yeniden başlatma = yeni plan)                             | Bekleyen hatırlatmalar `skipped`. `follow_up.stopped`                                              |
| 19  | Sonraki tarihi elle değiştir                                     | —                                           | —                                                                      | `due_override_on/at`, recompute                                                 | `follow_up.due_changed`                                                                            |
| 20  | SMS izni kaydedildi / geri alındı                                | —                                           | —                                                                      | `sms_consent_at/by` dolu/boş                                                    | `follow_up.consent_recorded` / `_withdrawn`                                                        |
| 21  | Hasta SMS istemiyor (`sms_opt_out_at`)                           | —                                           | —                                                                      | Değişmez, görünür kalır                                                         | Tüm bekleyenler `skipped(opted_out)`. `patient.sms_opt_out`                                        |
| 22  | Kural düzenlendi / arşivlendi                                    | —                                           | —                                                                      | **Mevcut planlar değişmez** (kopya). Arşivde yeni plan ve otomatik başlatma yok | `follow_up_rule.saved` / `.archived`                                                               |
| 23  | Klinik takip anahtarı kapandı (konsol)                           | —                                           | —                                                                      | Veri kalır; sekme gizlenir, iş kliniği atlar                                    | Bekleyenler `skipped(feature_off)`. `platform.feature_changed`                                     |
| 24  | Hasta anonimleştirildi                                           | Mevcut kural (kimlik kopar)                 | Silinir (plan ile birlikte)                                            | Hastanın planları **silinir**                                                   | `patient_id` → NULL, bekleyenler `skipped(patient_removed)`                                        |

**Bildirim kaydı geçişleri:**

```
pending ──(iş sahiplenir)──> sending ──> sent
   │                           │
   │                           ├──> failed ──(attempts < 3, sonraki çalıştırma)──> pending
   │                           │       └──(attempts = 3)──> failed (son)
   │                           └──(15 dk kilitli kaldı)──> unknown (yeniden GÖNDERİLMEZ)
   └──(kilit/izin/kota/konu değişti)──> skipped(skip_reason)
```

## F. Hatırlatma işi

- **Zamanlama:** `/api/cron/notifications`, günlük 07:00 UTC (İstanbul 10:00). Yalnızca yerel saati 09:00–20:00 olan klinikler işlenir. Pro'da aynı kod saatlik çalışır.
- **Planlama:** `INSERT … ON CONFLICT (dedupe_key) DO NOTHING`; iki kez çalışmak çoğaltmaz.
- **Gönderim:**
  - `UPDATE … SET status = 'sending', locked_at = now() WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED LIMIT n)`;
  - her kayıtta kilitler, izin, opt-out, telefon geçerliliği ve kota kontrol edilir; sonra gönderilir;
  - SMS en fazla bir kez gönderilir ("at-most-once").
- **Ölçek:** Yığın boyutu ve süre sınırı var; sıradaki çalıştırma kaldığı yerden devam eder.
- **V0 randevu hatırlatması:**
  - günlük işte **ertesi günün** `scheduled`/`confirmed` randevuları için;
  - `smsReminderHoursBefore` saatlik iş gelene kadar "bir gün önce" olarak yorumlanır (ayar metni buna göre güncellenir);
  - dedupe anahtarı: `appt:<id>:<startsAt>`.

## G. İzinler (V1)

| İzin                                                                                       | Sahip                   | Yönetici | Sekreter | Hekim |
| ------------------------------------------------------------------------------------------ | ----------------------- | -------- | -------- | ----- |
| `followUps.read`: Takip sekmesi, plan detayı                                               | ✓                       | ✓        | ✓        | –     |
| `followUps.manage`: başlat, duraklat, devam, bırak, bağla, ziyaret kaydet, tarih, SMS izni | ✓                       | ✓        | ✓        | –     |
| Kurallar ve takip ayarları: mevcut `clinicSettings.update`                                 | ✓                       | ✓        | –        | –     |
| Klinik için özelliği açma                                                                  | Yalnızca Recall konsolu |          |          |       |

İki eylem özel rol paletine eklenir. Elle SMS gönderme izni yok (V1'de düğme de yok).

## H. Ekranlar

- **Takip sekmesi:**
  - Filtreler: Yapılacaklar (Zamanı geldi + Gecikti, varsayılan), Yaklaşan, Randevulu, Duraklatıldı, Tamamlandı, Bırakıldı.
  - Satır: hasta, plan adı, "3 / 4 ziyaret", son ziyaret, sonraki tarih, SMS durumu.
  - Eylemler: Ara (`tel:`), Randevu oluştur (mevcut randevu penceresi, takip hizmeti dolu, otomatik bağlanır), Duraklat, Bırak.
- **Plan detayı:**
  - ziyaret zaman çizelgesi, bağlantı durumu, hatırlatma geçmişi (yalnızca tarih ve durum);
  - devam/duraklat, tarih değiştir, ziyaret kaydet, bağla/kaldır, SMS izni.
- **Randevu detayı:** "Takibe al" ve bağlı plan bilgisi.
- **Ayarlar → Takip kuralları:**
  - cümle editörü: "**[Hizmet]** sonrasında hastayı **[6] [ay]**da bir takip et, **[süresiz | toplam 4 ziyaret (ilk ziyaret dahil)]**. Takip ziyareti: **[Kontrol]**. SMS hatırlatması **[açık]**. Otomatik başlat **[kapalı]**."
  - Canlı önizleme ve doğrulama.
  - Kaydederken uyarı: "Mevcut N plan değişmez".
  - Örnekler "Örnek şablon · düzenlenebilir · tıbbi öneri değildir" etiketli; aralık boş ve pasif gelir.
- **Ayarlar → Takip:** SMS hatırlatma, "zamanı geldi" penceresi, günlük SMS sınırı.

## I. KVKK

- **Veri niteliği:** Plan bir tedaviyi ima eder, yani sağlık verisidir. Kiracı kapsamı ve denetimi randevu ile aynıdır; loglarda kişisel veri yok.
- **SMS metni:** Genel; ad, hizmet ve tanı yok. Yalnızca `template_key` saklanır; metin ve telefon saklanmaz.
- **İzin:** SMS için klinik anahtarı, kuraldaki SMS, plan izni, opt-out yok ve `SMS_SENDING_ENABLED` birlikte gerekir. İzin yoksa plan tam çalışır; personel arar.
- **İYS:** Tekrarlı "kontrol zamanı" iletisi ticari ileti sayılabilir. Hukuk görüşü gelmeden gönderim açılmaz.
- **Anonimleştirme:** planlar ve ziyaretler silinir; bildirim kayıtlarında `patient_id` boşalır.
- **Dışa aktarma:** JSON'a planlar, ziyaretler ve hatırlatma geçmişi eklenir.
- **Saklama** (saklama cron'u genişler; DATA-RETENTION.md güncellenir, avukatla teyit):
  - bildirim kaydı 1 yıl;
  - `stopped`/`completed` planlar son değişiklikten 2 yıl sonra silinir.

## J. Sesli asistan

- **V1:** Asistanın aldığı randevu, olay 1–3 ile aynı yoldan otomatik bağlanır; prompt ve araç değişmez.
- **V2:** inbound webhook'tan "takip zamanı geldi" değişkeni. Arayan numarayla sağlık bilgisi ifşası riski var; nötr metin, klinik anahtarı ve hukuk görüşü gerekir.

## K. Maliyet sınırları

- Döngü başına en fazla 2 hatırlatma (vadeden 7 gün önce; randevu yoksa vadeden 14 gün sonra).
- Hasta başına günde en fazla 1 SMS.
- Klinik başına günlük sınır (varsayılan 100).
- Elle gönderim yok.
- Konsolda aylık sayı. Faturalandırma yok.

## L. Etkilenen kod

- **Yeni:**
  - 0008 ve 0009 migration'ları;
  - `domain/follow-ups.ts` (recompute, eşleştirme, geçişler);
  - `domain/notifications.ts`;
  - `/api/cron/notifications` ve `vercel.json`;
  - Takip sayfası ve kural editörü;
  - örnek kurallar (veri).
- **Değişen:**
  - `bookAppointment`, panel `createAppointment`: eşleştirme;
  - `rescheduleAppointment`: bağlantı taşıma;
  - `changeAppointmentStatus`, `cancelAppointment`: recompute ve hatırlatma iptali;
  - `anonymizePatient`, `exportPatientData`, `applyRetention`;
  - `permissions.ts`, panel menüsü, klinik ayar şeması, denetim eylemleri;
  - konsol klinik sayfası (özellik anahtarı), SMS şablonları ve `env.ts`.
- **İnvazivlik:** Orta. Mevcut transaction'lara küçük bir "takip yeniden hesapla" çağrısı eklenir.

## M. Yol haritası

- **V0:** `notifications` kaydı, günlük iş, randevu hatırlatması (stub), SMS kilitleri, şablonların genelleştirilmesi, `sms_opt_out_at`.
- **V1:** kurallar, planlar, ziyaretler, eşleştirme ("otomatik sayıldı" etiketi ve kolay düzeltme), Takip sekmesi, plan bazlı izin, takip hatırlatması (stub), KVKK genişlemeleri, konsol anahtarı. `auto_start` kolonu var ama iş yolu ve arayüzü yok.
- **V1.1:** otomatik plan başlatma (iş yolu ve arayüz), kural değişikliğini mevcut planlara uygulama, kliniğe SMS kullanım görünürlüğü, saatlik iş (Pro).
- **V2:** kademeli protokoller (`follow_up_rule_steps` + plan adım sayacı; V1 planı = tek adımlı tekrar), sesli asistan önerisi, Netgsm gelen RET/STOP (F2), hekim erişimi.

## N. Test planı

- **Birim:**
  - recompute: erken/geç ziyaret, no-show, iptal, override, ay sonu, duraklat/devam, toplam;
  - görünen durum, dedupe anahtarları, şablonda hizmet adı olmaması.
- **Veritabanı (PGlite):** tek açık plan, randevu tek plana, CHECK kısıtları, hasta silinince cascade.
- **Eşleştirme:** 0/1/2+ plan, erteleme taşıma, asistan randevusu, başka hastanın/kliniğin randevusunu bağlama reddi.
- **İş:**
  - iki kez çalıştırma çoğaltmaz, eşzamanlı çalıştırma (`SKIP LOCKED`);
  - `sending` takılırsa `unknown`, yeniden deneme 3;
  - kota, hasta-gün sınırı;
  - kilitler kapalıyken sağlayıcı **hiç çağrılmaz**.
- **Zaman dilimi:** yerel gün, 09–20 penceresi, İstanbul dışı dilim, yaz saati geçiş günü.
- **İzin:** her rol × her eylem, özel rol, hekim erişemez.
- **Kiracı:** başka kliniğin planı/randevusu görünmez, bağlanmaz, iş klinikleri karıştırmaz.
- **KVKK:** anonimleştirme planları siler, dışa aktarma içerir, saklama eski kayıtları siler, loglarda metin yok.
- **E2E:** randevudan takibe al; Takip'ten randevu oluştur → otomatik bağlandı → Randevulu; duraklat → listeden çıktı; sekreter kural editörünü açamaz.

## Karar günlüğü (V1 uygulaması, 2026-10-06/07)

Ürün ekibi, rutin kararları en makul ve iyi uygulamaya uygun seçenekle vermemi ve buraya yazmamı istedi.

| #   | Karar                                                                                                                                                                                                                                             | Gerekçe                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | V1 tablolarındaki **her tablolar arası referans bileşik FK** (`clinic_id` + id). Hedeflere `UNIQUE (clinic_id, id)` eklendi: patients, services, appointments, follow_up_rules, follow_up_plans. 0009'da bu indeksler FK'lerden önce oluşturulur. | Kiracı karışması veritabanında imkânsız. Drizzle sıralamayı ters üretmişti, elle düzeltildi. |
| 2   | Kural düzenlemesi mevcut planları **hiç** değiştirmez (kopya). "Mevcut planlara uygula" V1.1'de.                                                                                                                                                  | Sessiz tarih değişikliği hastayı yanlış zamanda aratır.                                      |
| 3   | Kurallar silinmez, **arşivlenir**; planlar kurala `RESTRICT` ile bağlı. Bir kuralda kullanılan hizmet silinemez (`RESTRICT`).                                                                                                                     | Geçmiş planlar anlamını korur.                                                               |
| 4   | Sektör örnekleri yalnızca ad ve hizmet içerir; **aralık ve toplam yok**, pasif gelir. Kliniğin hizmet adıyla eşleşmezse atlanır. Klinikte sektör bilgisi saklanmadığı için sektör, ekleme sırasında seçilir.                                      | Karar 6: klinisyen onayı olmadan sayı yok.                                                   |
| 5   | "Toplam N ziyaret" **ilk ziyareti içerir** (editörde yazılı).                                                                                                                                                                                     | "PRP × 4" sezgisiyle uyumlu.                                                                 |
| 6   | "Otomatik sayıldı" saklanmaz, **türetilir** (bağlı randevu `scheduled`/`confirmed` ve bitmiş). Ziyaret satırında rozet ve tek tıkla **Gelmedi / Geldi** var.                                                                                      | Ek kolon yok. Personel düzeltmesi randevu durumunu değiştirir, plan yeniden hesaplanır.      |
| 7   | Zamanla sayılan ziyaret için ayrı iş yok. Bağlı randevusu planın son hesabından sonra biten planlar, **Takip sekmesi açılınca ve günlük işte** yeniden hesaplanır.                                                                                | Yalnızca değişen planlar hesaplanır, ucuz.                                                   |
| 8   | Takip listesi kliniğin tüm planlarını yükleyip uygulamada süzer (V1 ölçeği). Gerekirse sayfalama sonra.                                                                                                                                           | Basitlik. Görünüm türetilmiş olduğu için SQL'de süzmek karmaşık.                             |
| 9   | Otomatik bağlama yalnızca `active` planlara yapılır. 2+ aday varsa hepsi "Eşleştirme bekliyor" olur. Personel bağlayınca aynı hasta ve hizmetteki işaretler kalkar.                                                                               | Yanlış plana sessiz bağlama yok.                                                             |
| 10  | "Bırak" son durumdur, sonraki tarih silinir. Yeniden başlatmak yeni plan demektir; tekil açık plan indeksi kuralı serbest bırakır.                                                                                                                | Geçmiş net kalır.                                                                            |
| 11  | Elle verilen tarih, verildiği günden **sonraki** bir ziyaretle geçersiz olur.                                                                                                                                                                     | Personelin kararı, yeni ziyaret gelene kadar geçerli.                                        |
| 12  | Takip hatırlatması: (1) vadeden 7 gün önce; (2) randevu yoksa vadeden 14 gün sonra. **Yalnızca uygun olan son hatırlatma** planlanır, ikisi birden gitmez. Anahtar: `fu:<plan>:<vade>:<n>`.                                                       | Geç başlayan planda çift SMS yok.                                                            |
| 13  | Bekleyen takip hatırlatması duraklat, bırak, tarih değiştir, bağla ve onay geri alma anında `skipped(subject_changed)` olur. Gönderim de planı yeniden kontrol eder.                                                                              | İki katmanlı koruma.                                                                         |
| 14  | Takip SMS metni tamamen geneldir: tarih, ad ve hizmet yok (`follow_up_reminder.v1`).                                                                                                                                                              | KVKK.                                                                                        |
| 15  | İzinler: `followUps.read/manage` sahip, yönetici ve sekreterde. Kurallar ve ayarlar `clinicSettings.update` ister. Hekimde yok (karar 7). Özel rol paletinde var.                                                                                 | En küçük yeni izin seti.                                                                     |
| 16  | Klinik anahtarı kapalıyken menü gizli, sayfalar ve action'lar 404 döner. Veri korunur, günlük iş kliniği atlar.                                                                                                                                   | Modül görünmez ama geri açılabilir.                                                          |
| 17  | "SMS istemiyor" `patients.update` izniyle açılır; açılınca bekleyen tüm mesajlar hemen `skipped(opted_out)` olur.                                                                                                                                 | Hasta talebi anında uygulanır.                                                               |
| 18  | Kapanmış (bırakılmış veya tamamlanmış) plan **kapanıştan 2 yıl** sonra silinir (hukuki inceleme bekliyor). Anonimleştirme planları ve ziyaretleri siler; dışa aktarma ikisini de içerir.                                                          | Mevcut KVKK yapısıyla aynı.                                                                  |
| 19  | Denetim kaydında yalnızca id ve kod bulunur (sebep kodu, randevu id); tarih ve serbest metin yok.                                                                                                                                                 | Mevcut kural.                                                                                |
| 20  | Aralık hesabı (ay sonuna sıkıştırma dahil) tek yerdedir: `src/lib/contracts/follow-up.ts`. Sunucu ve editör önizlemesi aynısını kullanır.                                                                                                         | Önizleme ile gerçek tarih asla farklı çıkmaz.                                                |
| 21  | Randevu penceresine isteğe bağlı ön doldurma eklendi (hizmet, ad, telefon). Takip'ten alınan randevu normal yoldan otomatik bağlanır.                                                                                                             | Tek randevu akışı.                                                                           |
| 22  | Ayarlar ve Takip action'larından sonra sayfa yenilenir (`router.refresh`). Tarayıcı testinde "Gelmedi" sonrası eski sayı görünüyordu.                                                                                                             | Personel yanlış durumu görmez.                                                               |
| 23  | `auto_start` kolonu var; iş yolu ve arayüzü yok (V1.1).                                                                                                                                                                                           | Onaylı karar.                                                                                |
| 24  | Süreç: commit'ler yalnızca testler çıkış koduyla geçerse yapılır. Bu oturumda iki kez boruya bağlı `grep` hatayı gizlemişti.                                                                                                                      | Kırmızı test asla gönderilmez.                                                               |

### V1 durumu

- **Bitti** (yerel dal `feat/V1-takip`, push edilmedi):
  - şema (0009), alan mantığı, eşleştirme ve randevu kancaları;
  - günlük iş (stub hatırlatma);
  - KVKK (anonimleştirme, dışa aktarma, saklama);
  - izinler ve denetim;
  - ekranlar: Takip sekmesi, plan detayı, kural editörü, randevu ve hasta sayfasından takibe alma, "SMS istemiyor", konsol anahtarı.
- **Doğrulama:**
  - 326 test;
  - dev veritabanıyla tarayıcıda: örnek ekleme, kural düzenleme ve önizleme, randevudan takibe alma, "otomatik sayıldı" ve "Gelmedi" düzeltmesi, randevusuz ziyaret, liste, ön doldurmalı randevu.
- **Production'a çıkmadı:** ürün ekibinin onayını bekliyor.
