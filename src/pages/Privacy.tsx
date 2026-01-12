import { LandingNav } from "@/components/landing/LandingNav";
import { Footer } from "@/components/landing/Footer";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <LandingNav onSignIn={() => {}} onGetStarted={() => {}} />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
          
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Last Updated</h2>
            <p className="text-muted-foreground">
              This privacy policy was last updated on {new Date().toLocaleDateString()}.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Information We Collect</h2>
            <p className="text-muted-foreground mb-4">
              We collect information that you provide directly to us, such as when you create an account, 
              use our services, or contact us for support.
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Email address and account information</li>
              <li>Contact information you add to your directory</li>
              <li>Usage data and preferences</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">How We Use Your Information</h2>
            <p className="text-muted-foreground mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and send related information</li>
              <li>Send you technical notices and support messages</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
            <p className="text-muted-foreground">
              If you have questions about this privacy policy, please contact us.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Privacy;
