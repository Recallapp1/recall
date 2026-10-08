# Gizli değer rotasyonu (Ekim 2026): plan, "başla" onayı bekliyor

_Güncelleme 2026-10-08: yayın öncesi denetimin (P-01, P-02, P-16, P-17) bulgularıyla genişletildi. Hiçbir adım ürün ekibinin "başla" onayı olmadan uygulanmaz; değerler sohbete, commit'e veya loglara yazılmaz. Değerleri ürün ekibi girer; Claude yalnızca doğrular._

## Neden

Dış incelemeye verilen kopyada `.env.local` vardı. Değerler yazdırılmadan kontrol edildi (2026-10-07, denetimde canlı olarak doğrulandı 2026-10-08):

| Değişken                                  | Kopyadaki durum         | Production'a etkisi                                                                                                                                                                                                     | Rotasyon                       |
| ----------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `DATABASE_URL` (dev dalı, `neondb_owner`) | Gerçek                  | **Evet.** Neon'da alt dal, açıldığı anda üst dalın rol parolasını kopyalar; dev, production'dan açıldığı için parola aynı. Production rolü 2026-10-04'ten beri hiç değişmedi; IP kısıtı yok, herkese açık bağlantı açık | **Gerekli, öncelik 1**         |
| `RETELL_API_KEY`                          | Gerçek                  | **Evet.** Dev ve production aynı Retell çalışma alanı ve anahtar. Anahtar webhook imzasını da doğruladığı için sahibi production'a sahte webhook gönderebilir                                                           | **Gerekli, öncelik 1**         |
| `CRON_SECRET`                             | Gerçek (yalnızca lokal) | Hayır: production bu değeri reddetti (401)                                                                                                                                                                              | Lokal değeri yenilemek yeterli |
| `BETTER_AUTH_SECRET`                      | Gerçek (yalnızca lokal) | Hayır: production'daki değer doğrudan Vercel'de üretildi                                                                                                                                                                | Lokal değeri yenilemek yeterli |
| `NETGSM_*`                                | Boş                     | Yok                                                                                                                                                                                                                     | Gerekmez                       |
| `RESEND_API_KEY`                          | Kopyada yok             | —                                                                                                                                                                                                                       | Gerekmez                       |

## Sıra (özet)

| Adım | Ne                                             | Kim                                      | Kesinti                                | Süre  |
| ---- | ---------------------------------------------- | ---------------------------------------- | -------------------------------------- | ----- |
| 0    | Hazırlık ve sakin saat seçimi                  | Ürün ekibi + Claude                      | Yok                                    | 10 dk |
| 1    | Neon production parolası                       | Ürün ekibi (Neon + Vercel)               | **~2–3 dk** site DB'siz                | 10 dk |
| 2    | Dev kimliğini ayır (dev dalı parolası)         | Ürün ekibi                               | Yalnızca lokal                         | 5 dk  |
| 3    | Eski production verisi taşıyan yedek dallar    | Ürün ekibi (silme onayı)                 | Yok                                    | 5 dk  |
| 4    | Retell: production anahtarı yenile             | Ürün ekibi (Retell + Vercel)             | **~1–3 dk** imzalı istekler reddedilir | 10 dk |
| 5    | Retell: dev için ayrı çalışma alanı ve anahtar | Ürün ekibi (Retell) + Claude (dev ajanı) | Yok (production'a dokunmaz)            | 20 dk |
| 6    | Lokal değerler                                 | Ürün ekibi                               | Yok                                    | 5 dk  |
| 7    | Neon IP kısıtı ve dal koruması                 | Karar + ücret (aşağıda)                  | —                                      | —     |

Şu an hiçbir klinik canlı değil ve Retell'de telefon numarası yok; kesintiler yalnızca web test aramalarını ve paneli etkiler.

## 0. Hazırlık

- Sakin bir saat seçilir (kesinti ~5 dk).
- Claude başlangıç durumunu kaydeder: `/api/health` 200, son deploy READY, `/api/health/jobs` sağlıklı.
- Vercel'de `DATABASE_URL` ve `RETELL_API_KEY` değişkenlerinin hangi ortamlarda tanımlı olduğuna ürün ekibi bakar (Production; Preview kapalı olduğu için başka yerde olmamalı).

## 1. Neon production parolası

1. **Ürün ekibi:** Neon → proje → Branches → **production** → Roles & Databases → `neondb_owner` → **Reset password**. Yeni bağlantı dizesini kopyalar (pooled, sonuna `sslmode=verify-full`).
   - Bu andan itibaren eski parola production'da geçersizdir; yeni değer girilip yeniden deploy edilene kadar site veritabanına bağlanamaz.
2. **Ürün ekibi:** Vercel → Settings → Environment Variables → `DATABASE_URL` (Production) → yeni değer → Save → Deployments → son deploy → **Redeploy**.
3. **Claude doğrular:**
   - build READY; `/api/health` → `db: ok`; panel girişi çalışır;
   - **eski parolanın reddedildiği:** lokal `.env.local` hâlâ eski değeri taşırken production uç noktasına `select 1` denemesi başarısız olmalı (bu deneme yalnızca bağlanır, veri okumaz).
4. **Geri alma:** eski parola geri getirilemez. Sorun çıkarsa çözüm, doğru yeni dizeyi Vercel'e girip yeniden deploy etmektir; gerekirse Neon'da yeniden "Reset password". Veriye dokunulmaz.

**Kesintisiz alternatif (gerekirse, şimdi önerilmiyor):** production'da ikinci bir rol açıp uygulamayı ona geçirmek. Tablolar `neondb_owner`'a ait olduğu için build sırasındaki migration'lar bu rolle çalışamaz; ayrı migration rolü gerekir (F8 sonrası "en az yetki" işiyle birlikte yapılmalı).

## 2. Dev kimliğini ayırma

Neon'da rol parolaları dal başınadır: 1. adım dev dalını değiştirmez, dev dalı **eski (sızmış) parolayla** açık kalır.

1. **Ürün ekibi:** Neon → **dev** dalı → Roles → `neondb_owner` → **Reset password** → yeni dizeyi lokal `.env.local` dosyasındaki `DATABASE_URL`'e yazar.
2. **Claude doğrular:** lokal uygulama dev'e bağlanır (`pnpm dev`, `/api/health`); yeni dev parolası production uç noktasında **reddedilir**; eski parola dev'de de reddedilir.
3. İsteğe bağlı (daha temiz): dev dalını production'dan bağımsız yeni bir boş dal olarak yeniden kurmak (`pnpm db:migrate` + `pnpm db:seed`). Bugünkü dev dalı 2026-10-04 tarihli production kopyasından açıldı (o tarihte yalnızca demo verisi vardı). Karar ürün ekibinde.

## 3. Yedek dallar

`backup-pre-0009` … `backup-pre-0014` (6 dal) production'ın 2026-10-06/07 kopyalarıdır ve **eski parolayı** taşır. Compute uçları olmadığı için şu an bağlanılamazlar, ama biri uç açarsa açılırlar. Ayrıca 10 dal sınırının 6'sını kullanırlar.

- **Öneri:** 1. adım doğrulandıktan sonra silinmeleri (geri alınamaz, **ayrıca onay gerekir**). Gelecekte yedek, ücretli planın zaman içinde geri yükleme (PITR) özelliğiyle alınır.

## 4. Retell: production anahtarı

Kod aynı anahtarı hem API çağrıları hem webhook imzası için kullanır (`RETELL_API_KEY`). Retell'de imza, çalışma alanında "webhook" olarak işaretli anahtarla atılır.

1. **Ürün ekibi:** Retell Dashboard (production çalışma alanı) → Settings → API Keys → **Create new key**.
2. **Ürün ekibi:** yeni anahtarı **webhook anahtarı** olarak işaretler ve hemen ardından Vercel → `RETELL_API_KEY` (Production) → yeni değer → Save → **Redeploy**.
   - İşaretleme ile deploy arasındaki ~1–3 dakikada Retell'in imzalı istekleri reddedilir (web test aramaları bozulur; telefon numarası olmadığı için gerçek arama etkilenmez).
3. **Claude doğrular:** build sırasında ajan senkronu başarılı (log); imzalı bir `check_availability` isteği 200; Retell'de ajanların webhook adresi production alanı.
4. **Ürün ekibi:** doğrulamadan sonra eski anahtarı **siler**.
5. **Geri alma:** eski anahtar silinmeden önce, eski anahtarı yeniden webhook anahtarı yapıp Vercel'de eski değere dönmek ve yeniden deploy etmek yeterli.

**Kesintisiz alternatif (küçük kod değişikliği, ister misiniz?):** imza doğrulamasının geçiş süresince iki anahtarı kabul etmesi (`RETELL_PREVIOUS_API_KEY`). Bugün klinik olmadığı için gerekli görülmüyor.

## 5. Retell: dev için ayrı çalışma alanı

Aynı çalışma alanında ikinci bir anahtar yeterli değildir: imza çalışma alanının webhook anahtarıyla atılır ve dev ajanı production ajanlarıyla aynı yerde durur. Gerçek ayrım için:

1. **Ürün ekibi:** Retell'de yeni bir çalışma alanı (ör. "Recall Dev") açar ve kendi API anahtarını oluşturur. **Not:** krediler çalışma alanı başınadır; ses değerlendirmesi (~19 $) bu alana yüklenen krediyle çalışır.
2. **Ürün ekibi:** dev anahtarını lokal `.env.local` dosyasındaki `RETELL_API_KEY`'e yazar. Production anahtarı artık hiçbir lokal dosyada durmaz.
3. **Claude:** dev veritabanında dev kliniğinin eski ajan kaydını temizler ve `pnpm voice:sync --clinic gulus-dis --force` ile ajanı yeni çalışma alanında oluşturur; `pnpm dev:tunnel` ile bağlar. Production ajanları ve production veritabanı etkilenmez.
4. **Ürün ekibi (isteğe bağlı):** production çalışma alanında kalan eski dev ajanını ("Recall · Gülüş Diş Kliniği", ölü bir tünel adresini gösteriyor) ve kullanılmayan "Conversation Flow Agent"ı siler (**silme, ayrıca onay**).
5. **Claude doğrular:** dev anahtarıyla production ajanları **görünmez**; bir dev test araması dev ajanında çalışır (kredi gerekir).

## 6. Lokal değerler

`CRON_SECRET` ve `BETTER_AUTH_SECRET`: ürün ekibi `.env.local` içinde yeni rastgele değerlerle değiştirir (ör. `openssl rand -base64 32`). Production'ı etkilemez; lokal oturumlar kapanır.

## 7. Neon IP kısıtı ve dal koruması

- **IP kısıtı ("IP Allow"):** Neon'un ücretli üst planlarında (Scale ve üstü; güncel fiyat ve plan adı Neon'da teyit edilmeli). Tek başına işe yaramaz: Vercel fonksiyonlarının çıkış IP'leri sabit değildir. Sabit çıkış IP'si için Vercel'in Static IPs / Secure Compute özelliği gerekir (ücretli, Pro ve üstü). İkisi birlikte olmadan IP kısıtı production'ı kilitler. **Öneri:** şimdi değil; pilot öncesi maliyetle birlikte karar.
- **Dal koruması:** production dalını "protected" yapmak ücretli planlarda mümkün. Ücretli plana geçildiğinde açılmalı (silme ve parola sıfırlama gibi işlemlere ek koruma).
- **En az yetki:** uygulama için yalnızca veri yetkisi olan bir rol, migration için ayrı sahip rolü. F8 sonrası, ayrı iş.

## Bundan sonrası için

- Dışarıya kod kopyası yalnızca `git archive HEAD` ile verilir (`.env*` hariç; inceleme paketi süreci).
- Production değerleri hiçbir lokal dosyada durmaz (5. adım bunu sağlar).
- Rol parolaları dal başınadır: production'dan açılan her yeni dalın parolası hemen sıfırlanır.
