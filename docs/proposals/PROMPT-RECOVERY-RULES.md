# Proposal: silence, tool retry, abuse and "did not understand twice"

_Status: **sections 1–4 approved by the owner as drafts only (2026-10-14).** `VOICE_PROMPT_RECOVERY` is not built and stays off until a real call; retries apply only to the read-only tools (`check_availability`, `find_appointments`), never to booking, cancelling, rescheduling or callback notes. The open questions stay open until then. Nothing here is in the prompt or the agent. Owner-facing, English; the proposed lines the assistant would say are in Turkish, exactly as they would go into `src/server/voice/prompt.ts`._

The full audit (FA-11) and the A15 doc check found four rules that [ESCALATION.md](../02-voice-agent/ESCALATION.md) and [AGENT-DESIGN.md](../02-voice-agent/AGENT-DESIGN.md) describe but the assistant does not follow. This document proposes wording and settings for each one, so you can approve, change or reject them line by line.

## How it would ship

- **One switch, off by default:** `VOICE_PROMPT_RECOVERY=true`. With it off, the prompt and the agent spec stay exactly as today, so production keeps spec `23dfd4f92bde`. With it on, the spec hash changes and the build pushes the new prompt to the agents (`voice:sync --existing --soft`).
- The rules go into both prompt variants: today's prompt and the hardened one (`VOICE_PROMPT_HARDENING`). They sit with the existing safety rules, after the emergency rule, because the emergency rule always comes first.
- **Tests before merging:**
  - a prompt snapshot with the switch on and off;
  - a spec-hash test showing it only changes when the switch is on;
  - for rule 2, a test that mutating tools are never listed as retryable.
- **Verification needs real calls** (section 6). This is why every rule stays off until you have run them.

## 1. Silence

**Today.**

- The agent spec sets `end_call_after_silence_ms: 20000`, so Retell hangs up after 20 seconds of silence.
- The spec does not set `reminder_trigger_ms` or `reminder_max_count`, so Retell's defaults apply: after **10 seconds** of silence the model is prompted **once** to say something. The prompt has no instruction for that moment, so the wording is up to the model.
- The docs promise "Orada mısınız?" after 6 seconds and a close after another 15.

**Proposed settings:**

| Agent setting               | Today          | Proposed           |
| --------------------------- | -------------- | ------------------ |
| `reminder_trigger_ms`       | unset (10 000) | 7 000              |
| `reminder_max_count`        | unset (1)      | 1                  |
| `end_call_after_silence_ms` | 20 000         | 20 000 (unchanged) |

**Proposed prompt line:**

> - Arayan bir süre hiç konuşmazsa yalnızca bir kez, kısa ve sakin şekilde şunu söyle: "Sizi duyamıyorum, orada mısınız?" Yanıt gelir gelmez kaldığın yerden devam et; önceki soruyu tekrar etmen gerekiyorsa kısaca tekrarla. Yine ses gelmezse yeni bir soru sorma.

The final close stays with Retell's 20-second timeout, because a model-spoken goodbye cannot be timed reliably.

**Open question for you:** should a silent call that already had a booking in progress leave a callback note? I propose **no**. A silent caller has not agreed to anything, and a note would rarely have a name.

## 2. Tool failure and retry

**Today.**

- The hardened prompt says that when a tool fails, the assistant never claims success, says "Şu anda sistemimize ulaşamıyorum, işleminizi tamamlayamadım." and offers a callback note.
- The default prompt has no such rule.
- Nothing retries.
- `VOICE_TOOL_FAILSAFE` (off) makes a failure before the tool runs answer `ok: false` instead of HTTP 500.

**Proposed rule:** retry **once**, and only for read-only tools. A booking, cancellation or reschedule that timed out may have gone through. Retrying it could double-book unless `VOICE_TOOL_IDEMPOTENCY` is on, and it is off in production.

| Tool                                                               | Retry once?                                                 |
| ------------------------------------------------------------------ | ----------------------------------------------------------- |
| `check_availability`, `find_appointments`                          | Yes                                                         |
| `book_appointment`, `cancel_appointment`, `reschedule_appointment` | No. Say it could not be confirmed and leave a callback note |
| `create_callback_request`                                          | No. Ask the caller to call again later                      |

**Proposed prompt lines:**

> - check_availability veya find_appointments hata verir ya da yanıt vermezse "Bir saniye, tekrar bakıyorum." de ve aynı isteği yalnızca bir kez daha gönder. İkinci deneme de olmazsa: "Şu anda sistemimize ulaşamıyorum." de ve geri arama notu öner (create_callback_request).
> - book_appointment, cancel_appointment veya reschedule_appointment hata verir ya da yanıt vermezse bu tool'u tekrar çağırma ve işlemin yapıldığını asla söyleme. Şunu söyle: "İşleminizin tamamlandığını şu anda doğrulayamıyorum. Ekibimiz kontrol edip sizi arasın." Sonra create_callback_request ile not bırak; sebebe hangi işlemi denediğini yaz (ör. "randevu oluşturma doğrulanamadı").
> - create_callback_request da başarısız olursa: "Şu anda not da alamıyorum, lütfen biraz sonra tekrar arayın." de ve vedalaş.

**Open question for you:** once `VOICE_TOOL_IDEMPOTENCY` is on and verified on a real call, should mutating tools also retry once? I propose to decide that after the idempotency test (C-script), not now.

## 3. Abuse or harassment

**Today:** no rule. ESCALATION.md promises one warning, then a polite close.

**Proposed prompt line:**

> - Arayan hakaret, küfür, tehdit veya taciz içeren sözler kullanırsa bir kez sakin bir şekilde uyar: "Size yardımcı olmak istiyorum, ancak bu şekilde devam edemem." Aynı davranış sürerse şunu söyle: "Görüşmeyi burada sonlandırıyorum. İyi günler." ve hemen endCall kullan. Arayan acil bir durum anlatıyorsa bu kural değil, acil durum kuralı geçerlidir. Öfkeli ama hakaret etmeyen bir arayanı uyarma; sakin kal ve isteğine yardım et.

**What I deliberately left out:** no callback note and no flag for this.

- A note would put an insult into the clinic's list.
- A post-call flag (`abuse`) could be added later in `call-flags.ts` if clinics want to see these calls. That is a separate decision.

**Open question for you:** one warning, or two, before closing? I propose one, as ESCALATION.md says.

## 4. Did not understand twice

**Today:** no rule. The assistant may keep asking. ESCALATION.md promises a transfer (in clinic hours, when a transfer number exists) or a callback note after two failed attempts.

**Proposed prompt line:**

> - Arayanın ne istediğini veya verdiği bir bilgiyi (ad, tarih, saat, numara) aynı konuda iki kez sorduğun hâlde anlayamazsan üçüncü kez sorma. "${transfer_available}" değeri "evet" ise "Sizi bir ekip arkadaşıma aktarıyorum." de ve transferCall ile aktar. Değilse "Sizi daha iyi anlayabilmesi için ekibimizin sizi aramasını sağlayayım." de, create_callback_request ile not bırak (sebep: "asistan anlayamadı"), adı anlaşılamadıysa adsız bırak.

The `${transfer_available}` placeholder is the same call-time value the transfer rule already uses (`buildCallVariables`), so out-of-hours calls never try a transfer.

**Open question for you:** is a nameless callback note acceptable? I propose yes, since the number is still kept. On a hidden number, the note has neither, and the assistant should then ask the caller to call again.

## 5. What this does not change

- The emergency rule, the "no medical advice" rule and the recording-objection rule stay word for word.
- No new tool, no change to tool arguments, no migration.
- Panel, SMS and notification behaviour are unchanged.

## 6. Real-call checks before turning it on

Run on the pilot clinic's agent with `VOICE_PROMPT_RECOVERY=true`, synthetic names, and the transcript checked afterwards:

| #   | Scenario                                                                                      | Expected                                                                                        |
| --- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| R1  | Stay silent after the greeting                                                                | One "Sizi duyamıyorum, orada mısınız?" at about 7 s; hang-up at about 20 s; no booking, no note |
| R2  | Silent mid-booking, then answer                                                               | Reminder once, then the booking resumes where it stopped                                        |
| R3  | Insult once, then calm down                                                                   | One warning; the call continues normally                                                        |
| R4  | Insult twice                                                                                  | Warning, then the closing line and the call ends                                                |
| R5  | Mumble the name twice (in hours, transfer number set)                                         | Transfer on the third turn instead of a third question                                          |
| R6  | Same, out of hours                                                                            | Callback note with reason "asistan anlayamadı"                                                  |
| R7  | Tool failure (dev only: local `pnpm dev:tunnel` with the dev database stopped, so tools fail) | Read tool: "tekrar bakıyorum", one retry. Booking tool: no success claim, callback note         |

R7 runs only against the dev workspace and the dev database, never production.

## 7. Your decision

For each section, reply with one of: **approve as written**, **approve with changes** (give the new wording), or **reject**. After that, I add the approved lines behind `VOICE_PROMPT_RECOVERY`, with tests, and production stays unchanged until the real-call checks pass and you turn the switch on.
