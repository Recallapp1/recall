# API

Panel, veri değişiklikleri için **Server Actions** kullanır. Herkese açık HTTP uç noktaları sadece aşağıdakilerdir.

## `GET /api/health`

Uptime izleme. Veritabanına `select 1` atar.

```json
200 { "status": "ok", "db": "ok", "version": "0.1.0" }
503 { "status": "degraded", "db": "error", "version": "0.1.0" }
```

## `POST /api/voice/vapi`

Vapi'nin **Server URL**'i. Tüm Vapi mesajları buraya gelir.

**Kimlik doğrulama:** `x-vapi-secret` header'ı `VAPI_WEBHOOK_SECRET` ile sabit zamanlı karşılaştırılır. Eşleşmezse `401`.

**Kiracı çözümleme:** `message.phoneNumber.number` (yoksa `message.call.phoneNumber.number`), yani aranan numara → E.164 → `clinics.phone_number`. Bulunamazsa `assistant-request` için `200 { "error": "…" }` döner (Vapi bu metni arayana okur ve aramayı kapatır), diğer mesajlar için `404`.

### Mesaj tipleri

| `message.type`             | Ne zaman                  | Yanıt                                        |
| -------------------------- | ------------------------- | -------------------------------------------- |
| `assistant-request`        | Arama başlarken           | `{ assistant: {...} }`: kliniğe özel asistan |
| `tool-calls`               | LLM bir tool çağırdığında | `{ results: [{ toolCallId, result }] }`      |
| `end-of-call-report`       | Arama bittiğinde          | `200 {}`: arama kaydı yazılır                |
| `status-update`, diğerleri | Bilgilendirme             | `200 {}`                                     |

#### `assistant-request` yanıtı (özet)

```json
{
  "assistant": {
    "name": "Gülüş Diş Kliniği",
    "firstMessage": "Gülüş Diş Kliniği, merhaba! Ben Elif…",
    "model": {
      "provider": "anthropic",
      "model": "<ADR-003>",
      "messages": [{ "role": "system", "content": "<klinik prompt'u>" }],
      "tools": [{ "type": "function", "function": { "name": "check_availability", "parameters": {...} } }]
    },
    "voice": { "provider": "...", "voiceId": "..." },
    "transcriber": { "provider": "...", "language": "tr" },
    "server": { "url": "https://<app>/api/voice/vapi" }
  }
}
```

#### `tool-calls` yanıtı

```json
{
  "results": [{ "toolCallId": "call_abc", "result": "{\"ok\":true,\"slots\":[...]}" }]
}
```

`result` bir **string**'dir (JSON serileştirilmiş). Hata durumunda da `200` döneriz ve `result` içinde `{ "ok": false, "error": "SLOT_TAKEN", "message": "…" }` olur. Böylece LLM hatayı hastaya doğal dille açıklayabilir.

Tool listesi ve şemaları: [TOOLS.md](../02-voice-agent/TOOLS.md).

## `GET /api/cron/reminders` (Faz 2)

Vercel Cron tarafından saatlik çağrılır. `Authorization: Bearer ${CRON_SECRET}` zorunlu. 23–25 saat sonraki randevular için hatırlatma SMS'i gönderir (idempotent).

## `GET /api/cron/retention` (Faz 2)

Günlük. Saklama süresi dolan transkript ve kayıt URL'lerini temizler.

## Hata biçimi (iç uç noktalar)

```json
{ "error": { "code": "UNAUTHORIZED", "message": "Invalid webhook secret" } }
```
