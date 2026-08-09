import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ArrivalScene from "@/components/ArrivalScene";
import InstitutionSection from "@/components/InstitutionSection";
import MissionSection from "@/components/MissionSection";
import EcosystemSection from "@/components/EcosystemSection";
import LabSection from "@/components/LabSection";
import PrinciplesSection from "@/components/PrinciplesSection";
import EngagementSection from "@/components/EngagementSection";
import InstitutionalOutroScene from "@/components/InstitutionalOutroScene";

export default function HomePage() {
  return (
    <>
      <Nav />
      <main id="content">
        <ArrivalScene />
        <InstitutionSection />
        <MissionSection />
        <EcosystemSection />
        <LabSection />
        <PrinciplesSection />
        <EngagementSection />
        <InstitutionalOutroScene />
      </main>
      <Footer />
    </>
  );
}
