# Denetim kaydı politikası

_2026-10-09 (denetim A7). Kaynak: [`src/server/domain/audit.ts`](../../src/server/domain/audit.ts)._

Denetim kaydı kimin neyi ne zaman yaptığını tutar. Kayıtta ad, telefon veya serbest metin yoktur; yalnızca kimlikler, rol adları ve ayar anahtarları.

## Sınıflar

| Sınıf                                       | Kayıt yazılamazsa                                                                                                                                                     | Eylemler                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kritik** (her zaman)                      | 3 deneme, sonra `audit.critical_write_failed` alarmı ve eylem başarısız olur. Okumalarda kayıt önce yazılır; değişikliklerde aynı transaction içindedir (`withAudit`) | `patient.exported`, `patient.anonymized`, `call.recording_played`, ekip değişiklikleri (`team.*` davet, üye, rol), platform numara/özellik/sınır/klinik durumu, bir konsol kullanıcısının kliniğe katılması (`platform.console_user_joined_clinic`), iki adımlı giriş olayları ve sıfırlamaları (`auth.two_factor_*`) |
| **Sıkı modda kritik** (`AUDIT_STRICT=true`) | Kritikle aynı: deneme, alarm, eylem başarısız                                                                                                                         | `patient.updated`, `patient.sms_opt_out/in`, `appointment.created/updated/status_changed`, `settings.updated`, `follow_up.started/stopped/consent_recorded/consent_withdrawn`, `team.invitation_accepted`, `platform.clinic_created`                                                                                  |
| **Olağan**                                  | Eylem sürer; `audit.write_failed` logu (`metric: audit_write_failed`)                                                                                                 | `auth.sign_in`, `security.auth_endpoint_blocked`, `call.flagged`, `assistant.test_call`, takip kuralları ve diğer takip olayları, `platform.assistant_synced`, `platform.member_added` dışındaki konsol olayları                                                                                                      |

## Sıkı mod neden kapalı

Sıkı moddaki eylemlerin çoğu kaydı değişiklikten **sonra** yazar (aynı transaction değil). Sıkı mod açıkken kayıt yazılamazsa kullanıcı hata görür ve alarm çalar, ancak değişiklik geri alınmaz. Tam "ya hep ya hiç" için bu eylemlerin `withAudit` ile aynı transaction'a taşınması gerekir (ayrı iş; randevu oluşturma kendi transaction'ını açtığı için yeniden düzenleme ister).

## İzleme

- Kritik başarısızlık: `ALARM` logu, Sentry etkinse olay ([MONITORING.md](../06-operations/MONITORING.md)).
- Olağan başarısızlık: `metric: audit_write_failed` loguna göre günlük sayı uyarısı (log tabanlı uyarı kurulunca).
