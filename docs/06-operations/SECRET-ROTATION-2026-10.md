# Gizli değer rotasyonu (Ekim 2026): plan, onay bekliyor

Dış incelemeye verilen kopyada `.env.local` vardı. Değerler yazdırılmadan kontrol edildi (2026-10-07):

| Değişken                                  | Kopyadaki durum                   | Production'a etkisi                                                                                                                                                 | Rotasyon                       |
| ----------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `DATABASE_URL` (dev dalı, `neondb_owner`) | Gerçek                            | **Evet.** Dev dalı production'dan açıldığı için parola aynı; dev bilgileriyle production uç noktasına bağlantı **kabul edildi** (yalnızca `select 1` ile denendi)   | **Gerekli, öncelik 1**         |
| `RETELL_API_KEY`                          | Gerçek                            | **Evet.** Production ile aynı Retell hesabı ve anahtar; arama kayıtları, dökümler ve ajanlar bu anahtarla okunur/değiştirilir, webhook imzası da bununla doğrulanır | **Gerekli, öncelik 1**         |
| `CRON_SECRET`                             | Gerçek (yalnızca lokal)           | Hayır: production bu değeri reddetti (401)                                                                                                                          | Lokal değeri yenilemek yeterli |
| `BETTER_AUTH_SECRET`                      | Gerçek (yalnızca lokal)           | Hayır: production'daki değer doğrudan Vercel'de üretildi, hiç dışarı çıkmadı                                                                                        | Lokal değeri yenilemek yeterli |
| `NETGSM_USERCODE/PASSWORD/HEADER`         | **Boş** (yalnızca anahtar adları) | Yok, Netgsm hesabı yok                                                                                                                                              | Gerekmez                       |
| `RESEND_API_KEY`                          | Kopyada yok                       | —                                                                                                                                                                   | Gerekmez                       |

Hiçbir değer ürün ekibinin onayı olmadan değiştirilmez. Değerler sohbete yazılmaz.

## 1. Neon veritabanı parolası (production ve dev)

Production ve dev için ayrı rol parolası, böylece bir dev sızıntısı bir daha production'ı açmaz.

1. **Ürün ekibi:** Neon → proje → Branches → **production** → Roles → `neondb_owner` → **Reset password**. Yeni bağlantı dizesini kopyala (Connection pooling açık, `sslmode=verify-full`'a çevir).
   - Bu andan itibaren eski parola production'da geçersizdir ve site, yeni değer girilip yeniden deploy edilene kadar veritabanına bağlanamaz (yaklaşık 2–3 dk kesinti). Sakin bir saatte yap.
2. **Ürün ekibi:** Vercel → Settings → Environment Variables → `DATABASE_URL` (yalnızca Production) → yeni değer → Save → Deployments → son deploy → **Redeploy**.
3. **Ürün ekibi:** Neon → **dev** dalı → Roles → `neondb_owner` → Reset password → yeni dizeyi lokal `.env.local` dosyasındaki `DATABASE_URL`'e yaz.
4. **Claude doğrular:** build READY; `/api/health` ok; imzalı `check_availability` 200; eski dev parolasıyla production'a bağlantının **reddedildiği** (`select 1` denemesi); lokal uygulamanın dev'e bağlandığı.
5. **Geri alma:** eski parola geri getirilemez. Sorun çıkarsa çözüm doğru yeni dizeyi girmektir; Neon'da tekrar "Reset password" yeni bir parola üretir. Veriye dokunulmaz.

## 2. Retell API anahtarı

1. **Ürün ekibi:** Retell Dashboard → Settings → API Keys → **Create new key**. Webhook imzası için kullanılan anahtar olarak işaretle (Retell'de "webhook" rozeti olan anahtar).
2. **Ürün ekibi:** Vercel → `RETELL_API_KEY` (Production) → yeni değer → Save → **Redeploy**. Lokal `.env.local` dosyasına da yaz.
3. **Claude doğrular:** build sırasında ajan senkronu başarılı; production'da imzalı tool isteği 200; gerçek bir test web araması (randevu bilgisi sorgusu, veri değiştirmez).
4. **Ürün ekibi:** doğrulamadan sonra Retell'de **eski anahtarı sil**.
5. **Geri alma:** eski anahtar silinene kadar Vercel'de eski değere dönüp yeniden deploy etmek yeterli.

## 3. Lokal değerler

- `CRON_SECRET` ve `BETTER_AUTH_SECRET`: ürün ekibi `.env.local` içinde yeni rastgele değerlerle değiştirir (ör. `openssl rand -base64 32`). Production'ı etkilemez; lokal oturumlar kapanır.

## 4. Bundan sonrası için

- Dışarıya kod kopyası verirken `.env*` dosyaları hariç tutulmalı (`git archive HEAD` veya GitHub'dan indirme; ikisi de `.env.local` içermez).
- Production ve dev rolleri ayrı parolada kalmalı (1. adım bunu sağlar).
