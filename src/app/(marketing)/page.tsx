import { Contact } from "./_components/contact";
import { Hero } from "./_components/hero";
import { ClinicTypes, Features, HowItWorks, Problems } from "./_components/overview";
import { Conversation, PanelPreview } from "./_components/product";
import { Faq, Onboarding, Pricing, Security } from "./_components/trust";

export default function HomePage() {
  return (
    <>
      <Hero />
      <ClinicTypes />
      <Problems />
      <HowItWorks />
      <Features />
      <Conversation />
      <PanelPreview />
      <Security />
      <Onboarding />
      <Pricing />
      <Faq />
      <Contact />
    </>
  );
}
