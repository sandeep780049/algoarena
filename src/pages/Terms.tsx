import { Layout } from '@/components/Layout';
import { SEO } from '@/components/SEO';

export default function Terms() {
  return (
    <Layout>
      <SEO 
        title="Terms & Conditions"
        description="Read the terms and conditions for using JC AlgoArena. Understand the rules for participating in coding contests."
        path="/terms"
      />
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Terms & Conditions</h1>
        
        <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
          <p className="text-lg">
            Last updated: January 2, 2026
          </p>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By accessing and using JC AlgoArena, you accept and agree to be bound by these Terms and Conditions. 
              If you do not agree to these terms, please do not use our platform.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">2. User Accounts</h2>
            <p>
              To participate in contests, you must create an account. You are responsible for:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Providing accurate and complete information</li>
              <li>Notifying us of any unauthorized use of your account</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">3. Contest Rules</h2>
            <p>When participating in contests, you agree to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Complete all challenges independently without external assistance</li>
              <li>Not share contest questions or answers during active contests</li>
              <li>Not use automated tools or scripts to gain unfair advantages</li>
              <li>Accept the final decisions of contest administrators</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">4. Prohibited Conduct</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Create multiple accounts to manipulate rankings</li>
              <li>Attempt to access other users' accounts or data</li>
              <li>Interfere with the proper functioning of the platform</li>
              <li>Upload malicious code or content</li>
              <li>Harass or abuse other users</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">5. Intellectual Property</h2>
            <p>
              All content on JC AlgoArena, including questions, code, and design elements, 
              is the property of JC AlgoArena and is protected by intellectual property laws.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">6. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account if you violate these terms 
              or engage in conduct that we deem harmful to the platform or other users.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">7. Changes to Terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the platform after 
              changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">8. Contact</h2>
            <p>
              For questions about these terms, contact us at{' '}
              <a href="mailto:jccoderr@gmail.com" className="text-primary hover:underline">
                jccoderr@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
