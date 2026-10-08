# Alan adı taşıma kontrol listesi

Ürün ekibi ilk klinikten önce `recalltr.company`'den yeni bir alan adına geçecek; eski alanın otomatik yenilemesi bilerek kapalı. Bu liste taşımayı tek seferde ve kesintisiz yapmak için.

**İyi haber:** uygulama alan adını kodda tutmaz. Her şey `APP_URL` (ve `BETTER_AUTH_URL`) değişkeninden türer: oturum ve CSRF güvenilen kaynak, e-posta bağlantıları, Retell webhook ve tool adresleri, `www` yönlendirmesi, canonical, sitemap, robots, OG görselleri. CSP yalnızca kendi kaynağımıza ve sabit Retell adreslerine izin verir; alana özel girdi yok.

## Önce (taşıma gününden en az 1 hafta önce)

- [ ] **Ürün ekibi:** yeni alan adını al; otomatik yenilemeyi aç.
- [ ] **Ürün ekibi:** Vercel → proje `recall` → Settings → Domains → yeni alanı ve `www.` alt alanını ekle; DNS kayıtlarını (Vercel'deyse otomatik) doğrula.
- [ ] **Ürün ekibi:** Resend → Domains → yeni alanı **eu-west-1** bölgesinde ekle; verilen DKIM (`resend._domainkey`), SPF ve `send` MX kayıtlarını ve `_dmarc` TXT'yi DNS'e gir; "Verified" olana kadar bekle. Açılma/tıklama takibi kapalı kalsın.
- [ ] **Claude:** dokümanlardaki `recalltr.company` geçişlerini güncelleyen değişikliği hazırla (DEPLOYMENT, MONITORING, WORKLOG güncel durum, voice-eval koruması, test verisi).

## Taşıma günü (sakin bir saat; yaklaşık 15 dk)

1. **Ürün ekibi:** Vercel → Environment Variables (Production): `APP_URL` = `https://<yeni-alan>`, `BETTER_AUTH_URL` = `https://<yeni-alan>`, `EMAIL_FROM` = `Recall <bildirim@<yeni-alan>>` → Save.
2. **Ürün ekibi:** Deployments → son production deploy → **Redeploy**. Build sonunda `voice:sync --existing` tüm ajanların webhook ve tool adreslerini yeni alana çevirir (log'da `✓ … updated` görülmeli).
3. **Ürün ekibi:** Vercel → Domains → eski alan `recalltr.company` (ve `www.`) için **Redirect to** `<yeni-alan>` (308). Eski e-posta bağlantıları (parola 24 saat, davet 7 gün) böylece çalışmaya devam eder; yönlendirmeyi en az 7 gün, tercihen eski alanın süresi dolana kadar tut.
4. **Claude doğrular:** yeni alanda `/api/health` ok; `/api/health/jobs`; giriş (oturumlar yeni alanda yeniden açılır, herkesin bir kez giriş yapması gerekir); parola sıfırlama e-postası yeni alandan gelir ve bağlantısı yeni alanı gösterir; imzalı tool çağrısı ve gerçek bir test web araması (randevu sorgusu); Retell'de ajanın webhook adresi yeni alan; eski alan 308 ile yeni alana gidiyor.
5. **F2 sonrası (gerçek numara varsa):** Retell'de numaranın inbound webhook URL'i `https://<yeni-alan>/api/voice/retell/inbound` olmalı (konsoldan veya Retell panelinden).

## Sonra

- [ ] **Ürün ekibi:** uptime izleyicilerinde iki URL'i güncelle ([MONITORING.md](MONITORING.md)); Sentry'de proje URL'i (varsa).
- [ ] **Ürün ekibi:** Google Search Console'da yeni alanı doğrula ve "Adres değişikliği" bildir (isteğe bağlı, SEO).
- [ ] **Claude:** doküman değişikliğini birleştir; WORKLOG'a taşıma kaydı.
- [ ] Yasal sayfalar ve e-posta şablonlarındaki iletişim adresleri (yazıldığında) yeni alanla yazılır.

## Geri alma

`APP_URL` ve `BETTER_AUTH_URL`'i eski değere döndür ve yeniden deploy et: build ajanları eski adrese geri senkronlar. Eski alanın yönlendirmesini kaldır. Veriye dokunulmaz.
