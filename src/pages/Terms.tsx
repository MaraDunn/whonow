import { LandingNav } from "@/components/landing/LandingNav";
import { Footer } from "@/components/landing/Footer";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <LandingNav onSignIn={() => {}} onGetStarted={() => {}} />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
          
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Last Updated</h2>
            <p className="text-muted-foreground">
              These terms of service were last updated on {new Date().toLocaleDateString()}.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing or using our service, you agree to be bound by these Terms of Service. 
              If you disagree with any part of these terms, you may not access the service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Use License</h2>
            <p className="text-muted-foreground mb-4">
              Permission is granted to use our service for personal and commercial purposes, subject to the following restrictions:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>You may not use the service for any unlawful purpose</li>
              <li>You may not attempt to gain unauthorized access to any part of the service</li>
              <li>You may not interfere with or disrupt the service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">User Accounts</h2>
            <p className="text-muted-foreground">
              You are responsible for maintaining the confidentiality of your account credentials and for 
              all activities that occur under your account.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
            <p className="text-muted-foreground">
              If you have questions about these terms, please contact us.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Terms;
