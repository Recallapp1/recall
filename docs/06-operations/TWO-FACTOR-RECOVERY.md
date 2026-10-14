# İki adımlı giriş: kurtarma runbook'u

_2026-10-14 (tam denetim FA-06; ürün sahibinin kararı). İki adımlı giriş `PANEL_TWO_FACTOR` ile açılır; anahtarlar: [NEXT-STEPS-FOR-OWNER.md](../NEXT-STEPS-FOR-OWNER.md). Gizli değer değişikliği ayrı: [SECRET-ROTATION-2026-10.md §6](SECRET-ROTATION-2026-10.md)._

## Kural

- Birinin iki adımlı girişini **yalnızca Recall sahibi** sıfırlar: `TWO_FACTOR_RESET_EMAILS` içindeki e-posta(lar). Tanımsızsa kimse sıfırlayamaz.
- Her sıfırlama denetim kaydına yazılır (kritik: kayıt yazılamazsa sıfırlama yapılmaz).
- Sıfırlama kişinin kayıtlı doğrulayıcısını ve yedek kodlarını siler, **tüm oturumlarını kapatır**; kişi bir sonraki girişte yeniden kurar (`required-*` ise ilk girişte yönlendirilir).
- Önce kişinin kendi yedek kodlarını denemesini isteyin: yedek kodla giriş yapan kişi `/iki-adim` sayfasından yeni yedek kodlar ve yeni bir doğrulayıcı kurabilir (kapatma, rolü zorunluysa engellidir).

## 1. Klinik personeli

1. Talep klinikten gelir. Kliniği **sistemde kayıtlı numarasından** geri arayın (talebi yapan numaradan değil) ve talebi doğrulayın.
2. Konsol → **Klinikler** → klinik → ekip listesi → kişinin yanında **2 adımı sıfırla** → "Kliniği … geri arayıp doğruladım" kutusunu işaretleyin → **Sıfırla**.
3. Denetim kaydı: `auth.two_factor_reset_by_recall`, metadata `calledBackOnRegisteredNumber: true`; klinik kendi Denetim kaydında görür.

## 2. Recall konsol kullanıcısı (klinik üyesi olmayan)

1. Kişinin kimliğini **konsol dışında, önceden bilinen bir kanaldan** doğrulayın: yüz yüze, ya da kişinin önceden kayıtlı telefon numarasını siz arayarak. Gelen e-posta, mesaj veya talebi yapan numara yeterli değildir.
2. Konsol ana sayfası → **Recall konsol kullanıcıları** (yalnızca Recall sahibi görür) → kişinin yanında **2 adımı sıfırla** → "Kimliğini konsol dışında … doğruladım" kutusu **zorunlu** → **Sıfırla**.
3. Denetim kaydı: `auth.two_factor_reset_console_user`, klinik yok, metadata `verifiedOutOfBand: true`.
4. Kendi hesabınızı buradan sıfırlayamazsınız (aşağıdaki iki hesap yaklaşımı).

## 3. İki konsol hesabı yaklaşımı (Recall sahibi için önerilen)

Recall sahibi kendi telefonunu kaybederse kimse onu sıfırlayamaz. Bunu önlemek için:

1. Recall sahibi **iki ayrı konsol hesabı** açar (iki farklı e-posta, ör. kişisel ve şirket): `pnpm platform:admin --email <e-posta> --name "<ad>"` (her biri için bir kez, production'a karşı; [DEPLOYMENT.md → İlk konsol yöneticisi](DEPLOYMENT.md)).
2. İki e-posta da `TWO_FACTOR_RESET_EMAILS` içine yazılır (virgülle).
3. Her hesap iki adımlı girişi **ayrı bir cihazda** kurar; iki hesabın yedek kodları **ayrı yerlerde** saklanır (ör. biri kasada, biri parola yöneticisinde).
4. Bir hesap kilitlenirse diğerine girilir ve §2 ile ilki sıfırlanır.
5. İstisna kaydı: "her kişiye bir hesap" kuralının ([CLINIC-ONBOARDING.md](../07-sales/CLINIC-ONBOARDING.md) §2.4) tek istisnası budur ve yalnızca konsol içindir; bu hesaplar hiçbir kliniğin üyesi yapılmaz.

## 4. İki hesap da kilitliyse: anahtarı geçici kapatma (veritabanına dokunmadan)

1. Ürün sahibi Vercel'de `PANEL_TWO_FACTOR` değişkenini **silip** yeniden deploy eder (eklenti yüklenmez; herkes yalnızca parolayla girer; kayıtlar silinmez). Bu süre kısa tutulur; klinik personeli için de iki adım geçici olarak devre dışıdır.
2. Recall sahibi A hesabıyla parolayla girer → konsol ana sayfası → **Recall konsol kullanıcıları** → B hesabını sıfırlar (kutu: kimlik doğrulaması bu durumda sahibinin kendisidir; olayı kayda geçirin).
3. `PANEL_TWO_FACTOR` önceki değerine döndürülür, yeniden deploy edilir; B hesabı girişte yeniden kurar, sonra §2 ile A hesabını sıfırlar.
4. Olay kaydı: [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) şablonuyla, süre ve neden.

## 5. Son çare: elle veritabanı sıfırlama

Yalnızca §3 ve §4 mümkün değilse (ör. Vercel'e erişim de yoksa). **Ürün sahibinin yazılı onayı** gerekir; Claude SQL'i hazırlar, önce Neon **dev** dalında dener, production'da ürün sahibi Neon SQL Editor'da tek transaction olarak çalıştırır:

```sql
BEGIN;
DELETE FROM two_factors WHERE user_id = '<kullanıcı uuid>';
UPDATE users SET two_factor_enabled = false WHERE id = '<kullanıcı uuid>';
DELETE FROM sessions WHERE user_id = '<kullanıcı uuid>';
INSERT INTO audit_events (clinic_id, actor_user_id, action, target_type, target_id, metadata)
VALUES (NULL, NULL, 'auth.two_factor_reset_console_user', 'user', '<kullanıcı uuid>',
        '{"verifiedOutOfBand": true, "manual": true}'::jsonb);
COMMIT;
```

- `<kullanıcı uuid>` için önce salt okunur sorgu: `SELECT id, role FROM users WHERE email = '<e-posta>';` (rol `platform_admin` olmalı).
- Sonrasında kişi girişte yeniden kurar; olay kaydı açılır ve bu runbook'taki §3 hazırlığı tamamlanır.
