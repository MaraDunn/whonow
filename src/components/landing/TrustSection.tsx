import { Shield, TrendingUp, Building } from "lucide-react";

const trustIndicators = [
  {
    icon: Shield,
    title: "Secure authentication",
    description: "Enterprise-grade security with encrypted data at rest and in transit.",
  },
  {
    icon: TrendingUp,
    title: "Scalable for teams",
    description: "From startups to enterprises, WhoNow grows with your organization.",
  },
  {
    icon: Building,
    title: "Designed for professionals",
    description: "Built specifically for professional environments and workflows.",
  },
];

export const TrustSection = () => {
  return (
    <section className="py-16 sm:py-20 bg-muted/20">
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
