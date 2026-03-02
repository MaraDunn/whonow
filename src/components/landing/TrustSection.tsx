import { Shield, Cpu, Users } from "lucide-react";

const trustIndicators = [
  {
    icon: Shield,
    title: "Privacy-first by design",
    description: "Enterprise-grade encryption at rest and in transit. Your network data stays yours — no external data dependency.",
  },
  {
    icon: Cpu,
    title: "On-device AI search",
    description: "The desktop app runs natural language search locally — fast, deterministic, and private without any cloud round-trips.",
  },
  {
    icon: Users,
    title: "Built for professionals and teams",
    description: "Works for solo professionals managing their own network, and scales to full organizations sharing relationship visibility.",
  },
];

export const TrustSection = () => {
  return (
    <section className="py-24 sm:py-32 bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-3 gap-8 sm:gap-12">
          {trustIndicators.map((indicator, index) => (
            <div
              key={indicator.title}
              className="flex flex-col items-center text-center animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <indicator.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-foreground mb-2">
                {indicator.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {indicator.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
