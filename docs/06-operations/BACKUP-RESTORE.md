# Yedekleme ve geri yükleme

_2026-10-09 (denetim C2, P-05). Fiyatlar [neon.com/pricing](https://neon.com/pricing) sayfasından, 2026-10-09; değişebilir, satın almadan önce teyit edin._

## Bugünkü durum

| Konu                                       | Durum                                              |
| ------------------------------------------ | -------------------------------------------------- |
| Plan                                       | Neon **Free**                                      |
| Zaman içinde geri yükleme (PITR) penceresi | **6 saat**                                         |
| Zamanlanmış anlık görüntü                  | Yok                                                |
| Production dalı korumalı mı                | Hayır (Free planda yok)                            |
| Eski yedek dallar                          | 2026-10-09'da silindi (eski parolayı taşıyorlardı) |
| Denenmiş geri yükleme                      | **Yok**                                            |

**Risk:** Sabah fark edilen bir gece hatası (yanlış migration, yanlış toplu silme) 6 saatlik pencerenin dışında kalır ve geri getirilemez.

## Öneri: Launch planı (en ucuz ≥ 7 gün geçmiş)

| Plan       | Hesaplama               | Depolama     | Geçmiş (PITR)    | Geri yükleme ücreti | Korumalı dal | Zamanlanmış görüntü | IP izni |
| ---------- | ----------------------- | ------------ | ---------------- | ------------------- | ------------ | ------------------- | ------- |
| Free       | 100 CU-saat/proje dahil | 1 GB/proje   | 6 saat           | —                   | Yok          | Yok                 | Yok     |
| **Launch** | 0,106 $/CU-saat         | 0,35 $/GB-ay | **7 güne kadar** | 0,20 $/GB-ay        | Var          | Var (0,09 $/GB-ay)  | Yok     |
| Scale      | 0,222 $/CU-saat         | 0,35 $/GB-ay | 30 güne kadar    | 0,20 $/GB-ay        | Var          | Var                 | **Var** |

**Tahmini aylık maliyet (Launch, bugünkü ~35 MB veri):** depolama ve geçmiş birkaç sentlik; maliyetin neredeyse tamamı hesaplama. 0,25 CU sürekli açık: 0,25 × 730 × 0,106 ≈ **19 $/ay**; otomatik askıya alma (5 dk) açıkken düşük trafikte **5–10 $/ay**. Pilotta askıya almayı kapatmak ilk aramadaki gecikmeyi önler (tahmin 19 $/ay). _Varsayımdır; Neon faturası esas alınır._

IP kısıtı yalnızca Scale'de ve Vercel tarafında sabit çıkış IP'si de gerektirir ([SECRET-ROTATION-2026-10.md](SECRET-ROTATION-2026-10.md) §7).

## Hedefler

| Ölçü                       | Hedef (pilot)                               |
| -------------------------- | ------------------------------------------- |
| Veri kaybı penceresi (RPO) | En fazla birkaç dakika (PITR)               |
| Geri dönüş süresi (RTO)    | 1 saat içinde                               |
| Geri yükleme provası       | Plana geçince ilk hafta, sonra çeyrekte bir |

## Ürün ekibinin adımları (Launch'a geçiş)

1. Neon → Billing → **Upgrade → Launch**; ödeme yöntemi ekle.
2. Project settings → **Storage / History retention → 7 days**.
3. Branches → **production** → **Protect branch** (yanlışlıkla silme ve parola sıfırlamaya karşı).
4. (İsteğe bağlı) Backups → **Snapshot schedule** → günlük, 7 gün tut.
5. Bitince Claude'a "Neon Launch'a geçti" yaz: prova aşağıdaki gibi yapılır ve sonucu bu belgeye işlenir.

## Geri yükleme provası (Claude yapar, production'a yazmaz)

1. Neon → Branches → **Create branch** → kaynak `production` → **Past point in time** → 1 saat öncesi → ad `restore-drill-<tarih>`; compute ekle (yalnızca prova süresince).
2. Doğrulama (salt okunur): her iki dalda tablo satır sayıları ve son kayıt zamanları (`select count(*) …`, `max(created_at)`); farklar provadan sonraki yeni kayıtlarla açıklanabilmeli.
3. Uygulama testi: yerel `.env.local` geçici olarak prova dalına bağlanır, `/api/health` ve panel girişi denenir (production parolası prova dalında da geçerli olduğundan bu adım yalnızca ürün ekibinin makinesinde yapılır).
4. Prova dalı **silinir** (uç noktası kalmaz). Sonuç ve süre aşağıdaki tabloya yazılır.

## Gerçek geri yükleme (yalnızca ürün ekibinin onayıyla)

- **Kısmi hata** (bir tabloda yanlış silme): geçmişten prova dalı aç, ilgili satırları dışa aktarıp production'a geri yaz (Claude hazırlar, onayla uygulanır).
- **Tam geri dönüş:** Neon'un "Restore to point in time" işlemi production'ı seçilen ana döndürür; o andan sonraki **her şey** gider. Yıkıcıdır, ayrıca onay gerekir. Önce Vercel'de son sağlıklı deploy'a dönülür ([DEPLOYMENT.md → Geri alma](DEPLOYMENT.md)).

## Uygulama düzeyinde dışa aktarma (yalnızca dev)

`pnpm db:export` dev veritabanını tablo başına JSON Lines olarak `outputs/db-export-<zaman>/` altına yazar; ekrana yalnızca tablo adları ve satır sayıları basılır. Yalnızca Neon **dev** dalında veya yerel bir veritabanında çalışır (izin listesi, `src/lib/dev-database.ts`; FA-24): production ve yeni açılmış başka her uç nokta reddedilir, production verisi dizüstüne kopyalanmaz. `outputs/` git'e girmez.

`pnpm db:restore-verify outputs/db-export-<zaman>` bu dışa aktarmayı hiçbir uzak veritabanına değil, bellek içi geçici bir PostgreSQL'e (PGlite, gerçek migration'larla) yükler; tabloları yabancı anahtarların izin verdiği sırayla ekler (her anahtar yeniden denetlenir) ve satır sayılarını karşılaştırır. Yalnızca tablo adları ve sayılar basılır. 2026-10-11 dev dışa aktarması: 33 tablo, 217 satır, eksiksiz (R2 4m).

## Prova kaydı

| Tarih | Kaynak an | Süre | Sonuç                       | Kim |
| ----- | --------- | ---- | --------------------------- | --- |
| —     | —         | —    | Henüz yapılmadı (Free plan) | —   |
