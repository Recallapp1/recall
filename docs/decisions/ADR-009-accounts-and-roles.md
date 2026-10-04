# ADR-009: Hesaplar davetle açılır, klinik = Better Auth organizasyonu

- **Durum:** Kabul edildi
- **Tarih:** 2026-10-04
- **İlgili:** [ADR-001](ADR-001-stack.md) (Better Auth), [ADR-006](ADR-006-email-provider.md) (e-posta), [MULTI-TENANCY.md](../01-architecture/MULTI-TENANCY.md), görevler F3.1–F3.2

## Bağlam

Ürün kararları (2026-10-04): Klinikleri Recall ekibi açar, kendi kendine kayıt yoktur; giriş e-posta ve parolayla yapılır; her kliniğin kendi ekibi ve rolleri vardır, roller klinik başına özelleştirilebilir.

Better Auth'ta `disableSignUp: true` yalnızca istemciyi değil sunucu tarafındaki `signUpEmail` çağrısını da kapatır. Bu yüzden davetli kişinin hesabı başka bir yoldan açılmalıdır.

## Karar

1. **Klinik ↔ organizasyon 1:1.** Better Auth'un `organization` tablosu ekip, üyelik, davet ve rolleri tutar. `clinics.organization_id` (unique) bağlantıdır. Kiracı bağlamı her istekte oturumun `activeOrganizationId` alanından, üyelik doğrulanarak sunucuda çözülür (`requireClinic()`).
2. **Herkese açık kayıt kapalı.** Hesap iki yoldan açılır:
   - **Recall ekibi** (`pnpm clinic:member`, ileride F6 konsolu): kullanıcı parolasız oluşturulur, üyeliği eklenir ve Better Auth'un parola sıfırlama akışıyla **"parolanızı belirleyin"** e-postası gider. Better Auth, kimlik bilgisi olmayan kullanıcıya parola sıfırlama sırasında kimlik bilgisini kendisi oluşturur.
   - **Davet** (owner/admin panelden): Better Auth davetleri kullanılır. Hesabı olmayan davetli `/davet/[id]` sayfasında ad ve parola belirler; `acceptInvitationAsNewUser()` tek transaction'da kullanıcıyı, parolayı (Better Auth'un hash fonksiyonuyla), üyeliği oluşturur ve daveti kabul edilmiş işaretler. Hesabı olan davetli giriş yapıp Better Auth'un `acceptInvitation` uç noktasıyla kabul eder.
3. **E-posta doğrulaması:** E-postayla gelen bağlantı (davet veya parola) adresin sahibini kanıtlar; bu yollarla açılan hesaplar doğrulanmış sayılır.
4. **Roller:** `owner`, `admin`, `staff` (sekreter), `practitioner` (hekim). İzin matrisi `src/lib/permissions.ts` dosyasında, istemci ve sunucu ortak. Klinik başına özel roller Better Auth dinamik erişim kontrolüyle (`organization_roles` tablosu) tutulur. Yerleşik roller yerel olarak, özel roller Better Auth API'siyle denetlenir (`can()`).
5. **Savunma katmanları:** `proxy.ts` yalnızca çerez yoksa `/giris`'e yönlendirir (doğrulamaz). Asıl kontrol her sayfa ve Server Action başındaki `requireClinic()` / `requirePermission()` çağrısıdır. Yetkisiz istek `forbidden()` ile 403 sayfası görür.
6. **Kimlikler UUID**, tablolar çoğul (`users`, `sessions`, `members`…); Drizzle şeması `src/server/db/schema.ts` içinde.

## Sonuçlar

- ✅ Kayıt formu yok; hesap açma yüzeyi yalnızca geçerli davet bağlantısı ve Recall ekibi.
- ✅ Parola belirleme ve parola sıfırlama aynı akış; e-posta şablonu türüne göre metin değişir.
- ⚠️ `acceptInvitationAsNewUser()` Better Auth'un iç tablolarına doğrudan yazar. Better Auth sürüm yükseltmelerinde `accounts.test.ts` entegrasyon testi bu sözleşmeyi doğrular.
- ⏳ Denetim kaydı (F3.4), ekip yönetimi arayüzü (F3.3) ve özel rol arayüzü sonraki adımlar.
