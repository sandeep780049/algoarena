import { Layout } from '@/components/Layout';
import { SEO } from '@/components/SEO';
import { Mail, Instagram, MessageCircle } from 'lucide-react';

export default function Contact() {
  return (
    <Layout>
      <SEO 
        title="Contact Us"
        description="Get in touch with JC AlgoArena. Email us at jccoderr@gmail.com or follow @jc_coder_ on Instagram for updates and support."
        path="/contact"
      />
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Have questions, feedback, or just want to say hi? We'd love to hear from you!
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          <a 
            href="mailto:jccoderr@gmail.com"
            className="bg-card border border-border rounded-xl p-8 hover:border-primary/50 transition-colors group"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Email</h2>
                <p className="text-primary font-medium">jccoderr@gmail.com</p>
                <p className="text-sm text-muted-foreground mt-2">
                  For general inquiries, feedback, or support
                </p>
              </div>
            </div>
          </a>

          <a 
            href="https://www.instagram.com/jc_coder_"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-card border border-border rounded-xl p-8 hover:border-primary/50 transition-colors group"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Instagram className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Instagram</h2>
                <p className="text-primary font-medium">@jc_coder_</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Follow for updates, tips, and coding content
                </p>
              </div>
            </div>
          </a>
        </div>

        <div className="mt-16 bg-card border border-border rounded-xl p-8 max-w-2xl mx-auto">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-primary/10 shrink-0">
              <MessageCircle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Quick Response</h2>
              <p className="text-muted-foreground">
                We typically respond to emails within 24-48 hours. For urgent matters 
                or quick questions, feel free to reach out on Instagram for faster responses.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            Based in India 🇮🇳 • Available globally
          </p>
        </div>
      </div>
    </Layout>
  );
}
