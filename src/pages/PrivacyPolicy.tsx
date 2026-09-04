import { Layout } from '@/components/Layout';
import { SEO } from '@/components/SEO';

export default function PrivacyPolicy() {
  return (
    <Layout>
      <SEO 
        title="Privacy Policy"
        description="Learn how JC AlgoArena collects, uses, and protects your personal information. Your privacy matters to us."
        path="/privacy"
      />
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
          <p className="text-lg">
            Last updated: January 2, 2026
          </p>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">1. Information We Collect</h2>
            <p>
              When you use JC AlgoArena, we collect information you provide directly to us, such as:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Account information (username, email address, password)</li>
              <li>Profile information (avatar, display preferences)</li>
              <li>Contest participation data and scores</li>
              <li>Communication preferences</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide, maintain, and improve our services</li>
              <li>Process contest registrations and track your progress</li>
              <li>Display leaderboards and rankings</li>
              <li>Send you updates about contests and platform features</li>
              <li>Respond to your comments and questions</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">3. Information Sharing</h2>
            <p>
              We do not sell, trade, or otherwise transfer your personal information to third parties. 
              Your contest scores and username may be displayed publicly on leaderboards.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">4. Data Security</h2>
            <p>
              We implement appropriate security measures to protect your personal information. 
              However, no method of transmission over the Internet is 100% secure.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">5. Your Rights</h2>
            <p>
              You have the right to access, update, or delete your personal information at any time 
              through your profile settings.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">6. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at{' '}
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
