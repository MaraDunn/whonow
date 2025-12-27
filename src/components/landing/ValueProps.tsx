import { Search, BookOpen, Link2 } from "lucide-react";

const features = [
  {
    icon: Search,
    title: "Find who you need when you need",
    description: "Reduce time spent searching for the right contact across teams and systems.",
  },
  {
    icon: BookOpen,
    title: "Make your company directory work for you",
    description: "Turn static directories into dynamic, searchable sources of organizational knowledge.",
  },
  {
    icon: Link2,
    title: "Integrate the platforms you use to improve workflow",
    description: "Connect WhoNow with existing tools to create a single source of truth for people data.",
  },
];

export const ValueProps = () => {
  return (
    <section id="features" className="py-24 sm:py-32 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Enterprise-ready features
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Everything you need to streamline how your organization connects and collaborates.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group relative bg-card rounded-2xl p-8 shadow-card hover:shadow-card-hover transition-all duration-300 border border-border/50 animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Icon */}
              <div className="w-14 h-14 rounded-xl gradient-hero flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <feature.icon className="h-7 w-7 text-primary-foreground" />
              </div>

              {/* Content */}
              <h3 className="font-display text-xl font-semibold mb-3 text-foreground">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>

              {/* Hover glow effect */}
              <div className="absolute inset-0 rounded-2xl bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
