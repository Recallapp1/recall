# Yol Haritası

Her faz bir öncekinin çıkış kriterleri karşılanmadan başlamaz.

## Faz 0: Temel ✅ (bu repo)
- [x] Belgeler (PRD, mimari, sesli asistan, uyum)
- [x] Next.js 16 iskeleti, araç zinciri, lokal Postgres
- [x] Veri modeli ve migration'lar
- [x] Müsaitlik motoru ve birim testleri
- [x] Vapi webhook iskeleti (assistant-request, tool-calls, end-of-call-report)

## Faz 1: Çalışan sesli asistan POC (2–3 hafta)
- [ ] Vapi hesabı, Vapi test numarası ile uçtan uca randevu (İngilizce numara, Türkçe konuşma)
- [ ] Türkçe STT/TTS karşılaştırması (bkz. [VOICE-AND-LANGUAGE.md](../02-voice-agent/VOICE-AND-LANGUAGE.md))
- [ ] Model gecikme ölçümü (bkz. [ADR-003](../decisions/ADR-003-llm-model.md))
- [ ] Türk operatöründen SIP trunk ile gerçek bir 0850/0212 numarasının bağlanması
- [ ] Senaryo eval seti (bkz. [TESTING.md](../06-operations/TESTING.md))

**Çıkış kriteri:** 20 senaryonun 18'i başarılı, p95 gecikme < 1,8 sn.

## Faz 2: MVP (4–6 hafta)
- [ ] Better Auth ile panel girişi, klinik = organizasyon, roller
- [ ] Panel: Bugün, Takvim, Randevular, Aramalar, Hastalar, Geri aranacaklar
- [ ] Panel: Klinik ayarları (çalışma saatleri, hizmetler, hekimler, asistan ayarları)
- [ ] Netgsm SMS: onay, iptal, 24 saat önce hatırlatma (Vercel Cron)
- [ ] KVKK: aydınlatma metni, veri saklama job'u, kayıt silme
- [ ] Vercel production deploy, Neon (Frankfurt), alan adı
- [ ] İzleme: Sentry, arama metrikleri

**Çıkış kriteri:** 3 pilot klinikte 2 hafta boyunca kesintisiz çalışma.

## Faz 3: V1 (pilot sonrası)
- [ ] Self-servis onboarding sihirbazı
- [ ] Faturalandırma (iyzico veya Stripe)
- [ ] Haftalık rapor e-postası
- [ ] Hekim rolü kısıtlamaları
- [ ] Google Calendar iki yönlü senkronizasyon
- [ ] Çoklu şube (bir organizasyon, birden çok lokasyon)

## Faz 4: V2
- [ ] Giden arama: hatırlatma ve no-show sonrası yeniden randevu
- [ ] WhatsApp kanalı
- [ ] Çoklu dil (EN, AR, DE): sağlık turizmi
- [ ] Klinik yazılımı entegrasyonları
- [ ] Kapora ve ön ödeme
