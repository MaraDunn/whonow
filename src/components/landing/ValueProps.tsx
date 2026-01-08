import { Search, FolderTree, Link2, MapPin } from "lucide-react";

const features = [
  {
    icon: Search,
    title: "Natural language search",
    description: "Search your contacts using plain English. Ask questions like 'who do I know at mcdonalds' or 'engineers in San Francisco' and get instant results.",
  },
  {
    icon: FolderTree,
    title: "Organize your contacts",
    description: "Create folders, add tags, and mark clients to keep your network organized. Track interactions and manage your contacts efficiently.",
  },
  {
    icon: MapPin,
    title: "Location-based contacts",
    description: "Add addresses to contacts and automatically detect businesses at those locations. Find contacts by location or business name.",
  },
  {
    icon: Link2,
    title: "Slack and Teams integration",
    description: "Connect Slack or Microsoft Teams to import workspace members as contacts and share contact cards directly from your chat.",
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
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
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
