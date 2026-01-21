import { LandingNav } from "@/components/landing/LandingNav";
import { Footer } from "@/components/landing/Footer";
import { useNavigate } from "react-router-dom";

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <LandingNav
        onSignIn={() => navigate("/", { state: { authModal: "signin" } })}
        onGetStarted={() => navigate("/", { state: { authModal: "signup" } })}
      />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
          
          <section className="mb-8">
            <p className="text-muted-foreground mb-4">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-muted-foreground">
              This Privacy Policy describes how WhoNow ("we," "our," or "us") collects, uses, and shares information about you when you use our software-as-a-service platform and related services (collectively, the "Service").
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-4">1.1 Information You Provide to Us</h3>
            <p className="text-muted-foreground mb-4">
              We collect information that you provide directly to us, including:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li><strong>Account Information:</strong> Name, email address, password, and profile information when you create an account</li>
              <li><strong>Contact Data:</strong> Contact information, business cards, employee directory data, and other contact details you add to your directory</li>
              <li><strong>Organization Information:</strong> Company name, team structure, and organizational data</li>
              <li><strong>Communications:</strong> Information you provide when contacting us for support or feedback</li>
              <li><strong>Payment Information:</strong> Billing details processed through secure third-party payment processors</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-4">1.2 Information We Collect Automatically</h3>
            <p className="text-muted-foreground mb-4">
              When you use our Service, we automatically collect certain information, including:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li><strong>Usage Data:</strong> Information about how you interact with the Service, including features used, time spent, and actions taken</li>
              <li><strong>Device Information:</strong> Device type, operating system, browser type, IP address, and unique device identifiers</li>
              <li><strong>Log Data:</strong> Server logs, including timestamps, access times, and error information</li>
              <li><strong>Location Data:</strong> General location information based on IP address (with your permission)</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-4">1.3 Cookies and Similar Technologies</h3>
            <p className="text-muted-foreground mb-4">
              We use cookies, web beacons, and similar tracking technologies to collect information about your interactions with our Service. You can control cookie preferences through your browser settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
            <p className="text-muted-foreground mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Provide, maintain, and improve our Service</li>
              <li>Process and complete transactions, and manage your account</li>
              <li>Send you technical notices, updates, security alerts, and support messages</li>
              <li>Respond to your comments, questions, and requests</li>
              <li>Monitor and analyze trends, usage, and activities in connection with our Service</li>
              <li>Detect, prevent, and address technical issues and fraudulent activity</li>
              <li>Personalize your experience and provide content tailored to your interests</li>
              <li>Comply with legal obligations and enforce our Terms of Service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. How We Share Your Information</h2>
            <p className="text-muted-foreground mb-4">
              We may share your information in the following circumstances:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li><strong>With Your Consent:</strong> We may share information when you explicitly consent</li>
              <li><strong>Service Providers:</strong> With third-party vendors who perform services on our behalf, such as hosting, payment processing, analytics, and customer support</li>
              <li><strong>Business Transfers:</strong> In connection with any merger, sale of assets, or acquisition of all or a portion of our business</li>
              <li><strong>Legal Requirements:</strong> When required by law, court order, or government regulation</li>
              <li><strong>Protection of Rights:</strong> To protect our rights, property, or safety, or that of our users or others</li>
              <li><strong>Within Your Organization:</strong> Contact information you add may be accessible to other members of your organization based on your account settings</li>
            </ul>
            <p className="text-muted-foreground">
              We do not sell your personal information to third parties.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Data Security</h2>
            <p className="text-muted-foreground">
              We implement appropriate technical and organizational security measures to protect your information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Your Rights and Choices</h2>
            <p className="text-muted-foreground mb-4">
              Depending on your location, you may have certain rights regarding your personal information, including:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Access:</strong> Request access to your personal information</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li><strong>Portability:</strong> Request transfer of your information to another service</li>
              <li><strong>Opt-Out:</strong> Opt out of certain data processing activities, such as marketing communications</li>
              <li><strong>Account Settings:</strong> Update your account information and preferences through your account settings</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              To exercise these rights, please contact us using the information provided in the "Contact Us" section below.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Third-Party Services</h2>
            <p className="text-muted-foreground">
              Our Service may contain links to third-party websites or integrate with third-party services (such as Google Contacts, Slack, or payment processors). This Privacy Policy does not apply to third-party services. We encourage you to review the privacy policies of any third-party services you use.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Data Retention</h2>
            <p className="text-muted-foreground">
              We retain your information for as long as your account is active or as needed to provide you with our Service. We may retain certain information for longer periods as required by law or for legitimate business purposes, such as resolving disputes, enforcing agreements, and preventing fraud.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. International Data Transfers</h2>
            <p className="text-muted-foreground">
              Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country. By using our Service, you consent to the transfer of your information to these countries.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Children's Privacy</h2>
            <p className="text-muted-foreground">
              Our Service is not intended for children under the age of 13 (or the applicable age in your jurisdiction). We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Changes to This Privacy Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have any questions, concerns, or requests regarding this Privacy Policy or our privacy practices, please contact us at:
            </p>
            <p className="text-muted-foreground mt-4">
              <strong>WhoNow</strong><br />
              Email: privacy@whonow.co
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Privacy;
