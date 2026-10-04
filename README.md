# Recall

**Kliniğinizin telefonlarını 7/24 açan, randevu alan Türkçe sesli asistan.**

Hasta kliniği aradığında karşısında, kliniğe özel yapılandırılmış bir yapay zekâ asistanı bulur. Asistan uygun saatleri kontrol eder, randevuyu oluşturur, SMS ile onaylar ve randevuyu kliniğin paneline düşürür. Sekreterin telefonda geçirdiği zaman, gerçekten insan gerektiren işlere kalır.

## Hızlı başlangıç (lokal)

Gereksinimler: Node 24, pnpm 12, Docker.

```bash
pnpm install
cp .env.example .env.local     # değerleri doldur
pnpm db:up                     # lokal Postgres
pnpm db:migrate
pnpm db:seed                   # demo klinik
pnpm dev
```

Uygulama: http://localhost:3000. Sağlık kontrolü: http://localhost:3000/api/health

Sesli asistanı lokalde test etmek için bkz. [docs/06-operations/LOCAL-DEVELOPMENT.md](docs/06-operations/LOCAL-DEVELOPMENT.md).

## Belgeler

| Alan | Belge |
|---|---|
| Ürün | [PRD](docs/00-product/PRD.md) · [Personalar](docs/00-product/USER-PERSONAS.md) · [Akışlar](docs/00-product/USER-FLOWS.md) · [Yol haritası](docs/00-product/ROADMAP.md) · [Fiyatlandırma](docs/00-product/PRICING.md) |
| Mimari | [Mimari](docs/01-architecture/ARCHITECTURE.md) · [Stack](docs/01-architecture/TECH-STACK.md) · [Veri modeli](docs/01-architecture/DATA-MODEL.md) · [API](docs/01-architecture/API.md) · [Multi-tenancy](docs/01-architecture/MULTI-TENANCY.md) |
| Sesli asistan | [Tasarım](docs/02-voice-agent/AGENT-DESIGN.md) · [System prompt](docs/02-voice-agent/SYSTEM-PROMPT.md) · [Klinik konfigürasyonu](docs/02-voice-agent/CLINIC-CONFIG-SCHEMA.md) · [Tool'lar](docs/02-voice-agent/TOOLS.md) · [Senaryolar](docs/02-voice-agent/CONVERSATION-SCENARIOS.md) · [Eskalasyon](docs/02-voice-agent/ESCALATION.md) · [Ses ve dil](docs/02-voice-agent/VOICE-AND-LANGUAGE.md) |
| Telefon | [Telefon altyapısı](docs/03-telephony/TELEPHONY.md) · [Çağrı yönlendirme](docs/03-telephony/CALL-ROUTING.md) · [Bildirimler](docs/03-telephony/NOTIFICATIONS.md) |
| Panel | [Panel](docs/04-panel/PANEL-SPEC.md) · [Tasarım sistemi](docs/04-panel/DESIGN-SYSTEM.md) · [Onboarding](docs/04-panel/ONBOARDING.md) · [Entegrasyonlar](docs/04-panel/INTEGRATIONS.md) |
| Uyum | [KVKK](docs/05-compliance/KVKK.md) · [Güvenlik](docs/05-compliance/SECURITY.md) · [Veri saklama](docs/05-compliance/DATA-RETENTION.md) |
| Operasyon | [Lokal geliştirme](docs/06-operations/LOCAL-DEVELOPMENT.md) · [Deploy](docs/06-operations/DEPLOYMENT.md) · [Test](docs/06-operations/TESTING.md) · [İzleme](docs/06-operations/MONITORING.md) · [Maliyet modeli](docs/06-operations/COST-MODEL.md) |
| Kararlar | [docs/decisions/](docs/decisions/README.md) |

## Katkı

Kod kuralları, komutlar ve git akışı için bkz. [CLAUDE.md](CLAUDE.md).
