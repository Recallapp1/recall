# API

Panel, veri değişiklikleri için **Server Actions** kullanır. Herkese açık HTTP uç noktaları sadece aşağıdakilerdir.

## `GET /api/health`

Uptime izleme. Veritabanına `select 1` atar.

```json
200 { "status": "ok", "db": "ok", "version": "0.1.0" }
503 { "status": "degraded", "db": "error", "version": "0.1.0" }
```

## Retell uç noktaları

Kaynak: [`src/server/voice/providers/retell/handlers.ts`](../../src/server/voice/providers/retell/handlers.ts). Karar: [ADR-004](../decisions/ADR-004-retell-voice-platform.md).

### Ortak kurallar

| Konu               | Kural                                                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kimlik doğrulama   | `X-Retell-Signature: v={ms},d={hex}` = HMAC-SHA256(**ham gövde** + zaman damgası, `RETELL_API_KEY`), 5 dakikalık pencere. Doğrulama SDK'nın `verify` fonksiyonuyla yapılır. Geçersizse `401` |
| Yapılandırma eksik | `RETELL_API_KEY` yoksa `503 VOICE_NOT_CONFIGURED`                                                                                                                                            |
| Ayrıştırma         | Gövde doğrulamadan **sonra** parse edilir; beklenmeyen biçim `400`                                                                                                                           |
| Kiracı             | Sunucuda çözülür: numara (inbound) veya `call.agent_id` (tools, events). LLM argümanları kiracı belirlemez                                                                                   |
| Tekrar denemeler   | Retell 2xx almazsa tekrar dener. Tüm işlemler `call_id` ile idempotent                                                                                                                       |

### `POST /api/voice/retell/inbound`

Telefon numarasının **Inbound Webhook URL**'i (F2'de numara içe aktarılırken ayarlanır). Retell 10 sn bekler.

İstek:

```json
{
  "event": "call_inbound",
  "call_inbound": {
    "call_id": "call_…",
    "from_number": "+905321234567",
    "to_number": "+902120000000"
  }
}
```

Yanıt (klinik bulundu):

```json
{
  "call_inbound": {
    "override_agent_id": "agent_…",
    "override_agent_version": 3,
    "dynamic_variables": { "transfer_available": "evet", "clinic_status": "active" },
    "metadata": { "clinic_id": "…" }
  }
}
```

Numara hiçbir kliniğe ait değilse veya kliniğin ajanı senkronize değilse: `{ "call_inbound": { "reject": true } }`.

### `POST /api/voice/retell/tools`

Ajanın tüm custom function'larının URL'i. Tool listesi ve şemaları: [TOOLS.md](../02-voice-agent/TOOLS.md).

İstek:

```json
{
  "name": "check_availability",
  "args": { "serviceId": "…", "date": "2026-11-05" },
  "call": {
    "call_id": "…",
    "agent_id": "agent_…",
    "from_number": "+90…",
    "metadata": { "clinic_id": "…" }
  }
}
```

Yanıt: tool sonucu doğrudan JSON olarak döner (Retell metne çevirip LLM'e verir, en fazla 15.000 karakter).

```json
{ "ok": true, "date": "2026-11-05", "spokenDate": "5 Kasım Perşembe", "slots": [ … ] }
{ "ok": false, "error": "SLOT_UNAVAILABLE", "message": "Bu saat artık uygun değil." }
```

İş hataları `200` ile döner; böylece LLM hatayı hastaya doğal dille açıklayabilir. `agent_id` bilinmiyorsa veya `metadata.clinic_id` ajanın kliniğiyle eşleşmiyorsa `404`.

### `POST /api/voice/retell/events`

Ajanın **webhook URL**'i (senkron sırasında ayarlanır). Olaylar: `call_started`, `call_ended`, `call_analyzed`.

| Olay            | Yazılanlar                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| `call_started`  | `calls` satırı (yoksa açılır)                                                                          |
| `call_ended`    | Başlangıç/bitiş, süre, `disconnection_reason`, transkript, kayıt URL'i (klinik izin verdiyse), maliyet |
| `call_analyzed` | `call_analysis.call_summary`                                                                           |

Her zaman `200 {}` döner. Bilinmeyen ajanların olayları kaydedilmez (tekrar denemenin faydası yoktur).

## `GET /api/cron/reminders` (F2)

Vercel Cron tarafından saatlik çağrılır. `Authorization: Bearer ${CRON_SECRET}` zorunlu. Hatırlatma SMS'leri (idempotent).

## `GET /api/cron/retention` (F7)

Günlük. Saklama süresi dolan transkript ve kayıt URL'lerini temizler.

## Hata biçimi (iç uç noktalar)

```json
{ "error": { "code": "UNAUTHORIZED", "message": "Invalid signature" } }
```
