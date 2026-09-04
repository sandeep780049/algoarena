import { Layout } from '@/components/Layout';
import { SEO } from '@/components/SEO';
import { Terminal, Trophy, Users, Code2, Zap, Target } from 'lucide-react';

export default function About() {
  return (
    <Layout>
      <SEO 
        title="About Us"
        description="JC AlgoArena is a competitive coding platform with daily challenges, weekly contests, and global leaderboards. Sharpen your algorithmic skills."
        path="/about"
      />
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6">
            <Terminal className="h-12 w-12 text-primary" />
            <h1 className="text-4xl font-bold">
              <span className="text-primary">JC</span> AlgoArena
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A competitive coding platform designed to sharpen your algorithmic skills 
            through daily challenges, weekly contests, and real-time leaderboards.
          </p>
        </div>

        <div className="space-y-12">
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Our Mission</h2>
            <p className="text-muted-foreground text-lg">
              JC AlgoArena was created with a simple goal: to make competitive programming 
              accessible and engaging for everyone. Whether you're a beginner looking to 
              learn the basics or an experienced coder aiming to stay sharp, our platform 
              offers challenges tailored to your level.
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-2xl font-semibold">What We Offer</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-xl p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">Daily Challenges</h3>
                </div>
                <p className="text-muted-foreground text-sm">
                  Fresh coding problems every day to keep your skills sharp and build 
                  consistency in your practice routine.
                </p>
              </div>

              <div className="bg-card border border-border rounded-xl p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Trophy className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">Weekly Contests</h3>
                </div>
                <p className="text-muted-foreground text-sm">
                  Compete against other coders in timed contests with multiple questions 
                  covering various difficulty levels.
                </p>
              </div>

              <div className="bg-card border border-border rounded-xl p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">Global Leaderboards</h3>
                </div>
                <p className="text-muted-foreground text-sm">
                  Track your progress and see how you rank against coders from around 
                  the world on our real-time leaderboards.
                </p>
              </div>

              <div className="bg-card border border-border rounded-xl p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Code2 className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">Algorithm Focus</h3>
                </div>
                <p className="text-muted-foreground text-sm">
                  Questions covering data structures, algorithms, and problem-solving 
                  patterns commonly seen in technical interviews.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">The Creator</h2>
            <p className="text-muted-foreground text-lg">
              JC AlgoArena is created and maintained by{' '}
              <a 
                href="https://www.instagram.com/jc_coder_" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                @jc_coder_
              </a>
              , a passionate developer dedicated to helping others improve their coding skills. 
              Follow on Instagram for coding tips, contest updates, and behind-the-scenes content.
            </p>
          </section>

          <section className="bg-card border border-border rounded-xl p-8 text-center">
            <Target className="h-10 w-10 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-3">Ready to Level Up?</h2>
            <p className="text-muted-foreground mb-6">
              Join thousands of coders who are improving their skills every day.
            </p>
            <a 
              href="/auth?mode=signup" 
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Get Started Free
            </a>
          </section>
        </div>
      </div>
    </Layout>
  );
}
