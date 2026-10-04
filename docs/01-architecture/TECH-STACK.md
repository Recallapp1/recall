# Teknoloji Seçimleri

Her seçimin gerekçesi ve alternatifi aşağıda. Büyük kararlar ayrıca [ADR](../decisions/README.md) olarak kayıtlı.

## Uygulama

| Seçim                          | Neden                                                                                      | Alternatif            |
| ------------------------------ | ------------------------------------------------------------------------------------------ | --------------------- |
| **Next.js 16 (App Router)**    | Panel ve API tek projede; Vercel'de sıfır konfigürasyon; Server Actions ile form işlemleri | Remix, ayrı SPA + API |
| **TypeScript (strict)**        | Tool argümanları, webhook payload'ları ve şema uçtan uca tipli                             | —                     |
| **Tailwind CSS 4 + shadcn/ui** | Hızlı, tutarlı, sahiplenilen (kopyalanan) bileşenler                                       | MUI, Chakra           |
| **pnpm**                       | Hızlı, disk dostu, katı bağımlılık çözümü                                                  | npm                   |
| **Node 24**                    | Vercel'in desteklediği güncel LTS                                                          | —                     |

## Veri

| Seçim                       | Neden                                                                                                                          | Alternatif                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| **PostgreSQL**              | İlişkisel veri (klinik → hekim → randevu); `tstzrange` ve exclusion constraint ile **DB seviyesinde çifte rezervasyon engeli** | MySQL                      |
| **Neon (prod)**             | Vercel Marketplace entegrasyonu; PR başına veritabanı dalı; Frankfurt bölgesi                                                  | Supabase, RDS              |
| **Docker Postgres (lokal)** | İnternetsiz, ücretsiz, hızlı sıfırlanabilir                                                                                    | Neon dev dalı              |
| **Drizzle ORM**             | SQL'e yakın, hafif, serverless dostu, tip güvenli; migration'lar düz SQL                                                       | Prisma                     |
| **`pg` sürücüsü**           | Hem lokal Postgres hem Neon ile aynı kod; Vercel Fluid Compute ile bağlantı havuzu                                             | `@neondatabase/serverless` |

Bkz. [ADR-001](../decisions/ADR-001-stack.md).

## Kimlik doğrulama

| Seçim           | Neden                                                                                                 | Alternatif                              |
| --------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Better Auth** | Kendi DB'mizde; **organization plugin** ile klinik = organizasyon, roller ve davetler hazır; ücretsiz | Clerk (ücretli, veri dışarıda), Auth.js |

## Ses

| Seçim                                                           | Neden                                                                                                                                                                | Alternatif                                                                           |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Retell AI**                                                   | Yönetilen Türkçe ses pipeline'ı (`tr-TR`); inbound webhook ile arama başına ajan ve değişken; custom function webhook'ları; API ile ajan yönetimi; elastic SIP trunk | ElevenLabs Agents, LiveKit Agents (kendimiz host ederiz). Vapi ürün kararıyla elendi |
| **STT (Retell içinde): Deepgram / Azure / Soniox / AssemblyAI** | Türkçe doğruluk ve gecikme ölçülerek seçilecek                                                                                                                       | —                                                                                    |
| **TTS (Retell içinde): ElevenLabs / Cartesia / OpenAI**         | Doğal Türkçe ses                                                                                                                                                     | —                                                                                    |
| **LLM: Claude (Retell model listesinden)**                      | Güçlü Türkçe, güvenilir tool kullanımı, talimata bağlılık                                                                                                            | —                                                                                    |

Bkz. [ADR-004](../decisions/ADR-004-retell-voice-platform.md), [ADR-003](../decisions/ADR-003-llm-model.md), [VOICE-AND-LANGUAGE.md](../02-voice-agent/VOICE-AND-LANGUAGE.md).

## Telefon ve bildirim

| Seçim                                           | Neden                                                                                | Alternatif                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------- |
| **Türk operatörü SIP trunk (Netgsm / Verimor)** | Türk numaraları için yerel operatör gerekli; Retell'e elastic SIP trunk ile bağlanır | Twilio (Türkiye numara stoku sınırlı) |
| **Netgsm SMS**                                  | Türkiye'de yaygın, İYS uyumlu, uygun fiyatlı                                         | İleti Merkezi, Twilio                 |

## Kalite ve operasyon

| Seçim                 | Neden                                                                          |
| --------------------- | ------------------------------------------------------------------------------ |
| **Zod**               | Env, webhook ve tool argümanı doğrulaması; tool JSON şemaları Zod'dan üretilir |
| **Vitest**            | Hızlı, ESM ve TS yerel desteği                                                 |
| **ESLint + Prettier** | Tutarlı kod                                                                    |
| **Sentry (Faz 2)**    | Hata izleme                                                                    |
| **Vercel Cron**       | Hatırlatma SMS'leri ve veri saklama temizliği                                  |
