# WORKLOG: Recall Çalışma Günlüğü

> **Agent'lar ve geliştiriciler için:** Bu dosya projede yapılan her işin kronolojik kaydıdır.
> İşe başlamadan önce **"Güncel durum"** bölümünü ve [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md) belgesini oku.
> İşini bitirdiğinde **en üste** yeni bir kayıt ekle ve "Güncel durum" bölümünü güncelle. Kayıt eklemeden oturum bitmiş sayılmaz.

---

## Güncel durum

_Son güncelleme: 2026-10-04_

| Konu                    | Durum                                                                                                                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aktif faz               | F1 (Retell geçişi) ve F4 (tasarım sistemi) başlamaya hazır. F3 (auth) `feat/panel-auth` dalında başlatılmış                                                                                                                      |
| Ses sağlayıcısı         | **Retell AI** ([ADR-004](docs/decisions/ADR-004-retell-voice-platform.md)). Kodda hâlâ Vapi adaptörü var, F1.7'de kaldırılacak                                                                                                   |
| Tasarım                 | **[DESIGN.md](DESIGN.md) tek kaynak** ([ADR-005](docs/decisions/ADR-005-design-system.md)). Kodda hâlâ eski teal + Geist teması var, F4.1'de taşınacak                                                                           |
| Testler                 | 72 test geçiyor (birim + PGlite entegrasyon)                                                                                                                                                                                     |
| Lokal DB                | `pnpm db:local` (PGlite, Docker gerekmez) veya `pnpm db:up` (Docker)                                                                                                                                                             |
| Deploy                  | Yok. Vercel takımı `RECALL` (`recall25`) hazır, proje yok. GitHub reposu ve Neon bekleniyor (F8)                                                                                                                                 |
| Bekleyen ürün kararları | [IMPLEMENTATION-PLAN.md → Açık sorular](docs/IMPLEMENTATION-PLAN.md#açık-sorular-ürün-ekibine)                                                                                                                                   |
| Alınan ürün kararları   | [IMPLEMENTATION-PLAN.md → Alınan kararlar](docs/IMPLEMENTATION-PLAN.md#alınan-kararlar): Recall ekibi klinik açar; e-posta + parola; özelleştirme = roller, modül görünürlüğü, kişisel tercihler (logo yok); Retell hesabı hazır |

### Dallar

| Dal                        | İçerik                                                                                                                          | Durum                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `main`                     | F0 temeli (`3ee627a`'ya kadar)                                                                                                  | Kararlı                                                        |
| `feat/panel-auth`          | `468d94b` Docker'sız lokal Postgres (PGlite). **Commit'lenmemiş:** `better-auth` bağımlılığı (`package.json`, `pnpm-lock.yaml`) | F3 için yarım iş. Sahibi devam edecek; başka agent dokunmamalı |
| `docs/implementation-plan` | Fazlı plan, WORKLOG, ADR-004/005, DESIGN.md                                                                                     | Bu oturum. `feat/panel-auth` üzerinden açıldı                  |

### Sıradaki işler

1. Ürün ekibinden: `RETELL_API_KEY` değerinin `.env.local` dosyasına girilmesi ve GitHub repo adresi
2. F1.1–F1.4: Retell belgeleri, veri modeli, imza doğrulama, ajan spec'i
3. F4.1: DESIGN.md token'ları ve Inter fontu
4. F3: `feat/panel-auth` dalında Better Auth kurulumu

---

## Kayıt biçimi

Her kayıt şu şablonu izler (en yeni en üstte):

```markdown
### YYYY-AA-GG · <kısa başlık> · <görev kimlikleri, ör. F1.3, F1.4>

**Agent/kişi:** <model veya isim> · **Dal:** <dal> · **Commit'ler:** <kısa hash'ler>

**Ne yapıldı**

- …

**Neden** (kararlar ve gerekçeleri; büyükse ADR'ye bağlantı)

- …

**Doğrulama**

- Çalıştırılan komutlar ve sonuçları (ör. `pnpm test`: 80/80)

**Açık kalanlar / dikkat**

- …
```

Kurallar:

- Dosya yollarını tıklanabilir link olarak yaz.
- Kişisel veri, gizli anahtar veya token yazma.
- Başarısız denemeleri de yaz; bir sonraki agent'ın aynı hatayı yapmasını önler.

---

## Kayıtlar

### 2026-10-04 · Fazlı uygulama planı, Retell kararı, DESIGN.md kabulü · Planlama

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `docs/implementation-plan` · **Commit'ler:** bu kaydı içeren commit

**Ne yapıldı**

- Ürün ekibinin yönergeleri kayıt altına alındı:
  - Birincil ses altyapısı **Retell AI Voice Agent API**. **Vapi kullanılmayacak.** Netgsm gibi yerel altyapılar (SIP ve SMS) test edilip karşılaştırılacak.
  - Tasarımda kök dizindeki [DESIGN.md](DESIGN.md) dosyasına kesinlikle sadık kalınacak.
  - Sistem çok sayıda kliniğe uyarlanabilir olacak: her kliniğin kendi hesabı, kendi çalışanları ve özelleştirilebilir paneli.
  - Backend ve frontend birbiriyle uyumlu geliştirilecek.
  - Tüm işler bu dosyaya kaydedilecek.
- Retell dokümantasyonu araştırıldı ve bulgular [ADR-004](docs/decisions/ADR-004-retell-voice-platform.md) içine kaynaklarıyla yazıldı: `tr-TR` desteği, inbound webhook, custom function, `X-Retell-Signature`, SIP trunk, olay webhook'ları, Claude model desteği.
- [ADR-004](docs/decisions/ADR-004-retell-voice-platform.md) (Retell, klinik başına senkronize ajan) yazıldı. ADR-002 "yerini aldı" olarak işaretlendi.
- [ADR-005](docs/decisions/ADR-005-design-system.md) (DESIGN.md tek tasarım kaynağı) yazıldı. [DESIGN-SYSTEM.md](docs/04-panel/DESIGN-SYSTEM.md) DESIGN.md'nin uzantısı olacak şekilde yönlendirildi.
- [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md): F0–F10 fazları, görev kimlikleri, dosyalar, testler, çıkış kriterleri, ortak sözleşmeler ve açık sorular.
- [ROADMAP.md](docs/00-product/ROADMAP.md) özet tablosuna indirildi ve plana bağlandı.
- [CLAUDE.md](CLAUDE.md): stack (Retell, Inter, DESIGN.md), yeni kurallar (DESIGN.md, ortak sözleşmeler, WORKLOG zorunluluğu).
- DESIGN.md `.prettierignore` dosyasına eklendi (ürün ekibinin dosyası, biçimlendirilmez).

**Neden**

- Klinik başına ayrı Retell ajanı: ses, model, prompt ve tool'lar kliniğe göre farklılaşabilir. Tek kaynak bizim DB'miz, Retell bir senkron hedefi. Arama anına özgü veriler inbound webhook'un `dynamic_variables` alanıyla verilir.
- Kiracı, Retell çağrılarında `call.agent_id` (→ `voice_agents`) ve `metadata.clinic_id` ile çapraz doğrulanır. LLM argümanları asla kiracı belirlemez.

**Doğrulama**

- Yalnızca belge değişikliği. `pnpm format:check` temiz.

**Açık kalanlar / dikkat**

- `feat/panel-auth` dalında commit'lenmemiş `better-auth` değişikliği **bulundu ve dokunulmadı**. O dal başka bir oturumun yarım işi.
- Retell'in custom function çağrılarını hangi bölgeden yaptığı bilinmiyor. Gecikme F1.8'de ölçülecek.
- Erişilebilirlik: Zinc-500 / Zinc-100 kontrastı ≈ 4,4:1 (AA eşiği 4,5:1). Ürün ekibine soruldu.
- Ürün ekibi kararları (aynı oturum): klinikleri Recall ekibi açar; giriş e-posta + parola, açık kayıt kapalı; panel özelleştirme = rol ve yetkiler + modül görünürlüğü + kişisel tercihler (logo ve renk yok); Retell hesabı hazır; GitHub reposu açıldı (adres bekleniyor). Plana "Alınan kararlar" tablosu olarak işlendi.

### 2026-10-04 · Docker'sız lokal Postgres · Altyapı

**Agent/kişi:** Claude (Opus 5.5, önceki oturum) · **Dal:** `feat/panel-auth` · **Commit'ler:** `468d94b`

**Ne yapıldı**

- `pnpm db:local`: PGlite'ı Postgres protokolüyle 5433 portunda sunan [scripts/local-db.ts](scripts/local-db.ts). Veri `.pglite/` altında (gitignore'da). Docker Desktop açılamadığı için eklendi.
- [LOCAL-DEVELOPMENT.md](docs/06-operations/LOCAL-DEVELOPMENT.md) ve [README.md](README.md) güncellendi.
- Ardından Better Auth kurulumuna başlandı (`better-auth` bağımlılığı eklendi, **commit'lenmedi**).

**Açık kalanlar / dikkat**

- F3 bu dalda devam edecek.

### 2026-10-04 · Proje temeli (F0) · F0

**Agent/kişi:** Claude (Opus 5.5) · **Dal:** `main` · **Commit'ler:** `8bf14be` … `3ee627a`

**Ne yapıldı**

- Next.js 16 iskeleti (pnpm, TypeScript strict, Tailwind 4, ESLint, Prettier, Vitest, GitHub Actions CI, `vercel.json` `fra1`).
- 38 belge: ürün (PRD, personalar, akışlar, yol haritası, fiyatlandırma), mimari, sesli asistan, telefon, panel, KVKK/güvenlik/saklama, operasyon, ADR-001..003.
- Drizzle şeması: `clinics`, `practitioners`, `services`, `practitioner_services`, `working_hours`, `time_off`, `patients`, `appointments`, `calls`, `callback_requests`. Özel migration ile `EXCLUDE USING gist` çifte rezervasyon engeli ([drizzle/0001_appointment_overlap_guard.sql](drizzle/0001_appointment_overlap_guard.sql)).
- Domain: müsaitlik motoru ([availability.ts](src/server/domain/availability.ts), saf), randevu akışları ([appointments.ts](src/server/domain/appointments.ts): atomik erteleme, idempotent oluşturma), arama kayıtları ([calls.ts](src/server/domain/calls.ts): sonuç önceliği), klinik ayarları şeması ([clinic-settings.ts](src/server/domain/clinic-settings.ts)).
- Sesli asistan: sağlayıcıdan bağımsız 6 tool ([src/server/voice/tools/](src/server/voice/tools/)), prompt üretici ([prompt.ts](src/server/voice/prompt.ts)), Vapi adaptörü (artık geçersiz, F1.7'de silinecek).
- SMS: konsol ve Netgsm adaptörü ([sms.ts](src/server/notifications/sms.ts)). Netgsm uç noktası doğrulanmadı.
- Testler: 72 (birim + [PGlite](src/test/db.ts) ile gerçek migration'lara karşı entegrasyon).
- Canlı doğrulama: `/api/health` ok, webhook 18–53 ms, tool 6 ms.

**Neden**

- Gerçek zamanlı ses Vercel Functions'ta çalışmadığı için ses yönetilen bir platformda, iş mantığı bizde ([ARCHITECTURE.md](docs/01-architecture/ARCHITECTURE.md)).
- Çifte rezervasyon DB seviyesinde engellendi; eşzamanlı aramalarda uygulama kontrolü yetmez.

**Açık kalanlar / dikkat**

- Windows'ta Python ile dosya yazarken `newline="\n"` kullan. Aksi hâlde CRLF oluşur ve Prettier kontrolü bozulur.
- `next build` sonrası `.next/types` eski rotalara referans verirse `rm -rf .next && pnpm exec next typegen`.
