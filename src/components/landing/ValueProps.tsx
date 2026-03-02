import { Search, FolderTree, Link2, MapPin, Heart, Bell, X, Check } from "lucide-react";

const features = [
  {
    icon: Search,
    title: "Ask WhoNow Anything About Your Network",
    description: "Type in plain English: \"Who do I know at Stripe?\", \"Designers in San Francisco\", or \"Clients I haven't talked to in 60 days\" — and get instant, accurate results.",
  },
  {
    icon: Heart,
    title: "Know Which Relationships Need Attention",
    description: "Every contact gets a relationship health score based on recency and frequency. See who's healthy, at risk, or going cold — so you can act before a relationship fades.",
  },
  {
    icon: Bell,
    title: "Never Forget to Reach Out Again",
    description: "Smart follow-up suggestions surface contacts you've lost touch with. Set contact intervals, review a follow-up queue, and let WhoNow handle the reminders.",
  },
  {
    icon: FolderTree,
    title: "Shared Relationship Visibility for Teams",
    description: "Organize contacts into folders, mark clients, and share your network with your team. Everyone stays aligned on who knows whom — without duplicating effort.",
  },
  {
    icon: MapPin,
    title: "Location-aware contact search",
    description: "Add addresses to contacts and automatically detect nearby businesses. Find who you know in a city or at a specific company location in seconds.",
  },
  {
    icon: Link2,
    title: "Connects to your existing tools",
    description: "Organization admins connect Slack or Microsoft Teams once; all members can import workspace contacts and share contact cards from chat. WhoNow complements what you already use.",
  },
];

const crmComparison = {
  crm: [
    "Deal tracking",
    "Pipeline management",
    "Revenue forecasting",
    "Complex setup",
  ],
  whonow: [
    "Instant contact retrieval",
    "Relationship health scoring",
    "Smart follow-up reminders",
    "Lightweight and fast",
  ],
};

export const ValueProps = () => {
  return (
    <section id="features" className="py-24 sm:py-32 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Differentiation block */}
        <div className="mb-20 rounded-3xl border border-border bg-card p-10 sm:p-14 shadow-card">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
              Not a CRM. A Relationship Intelligence Layer.
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              WhoNow does not manage deals or pipelines.<br className="hidden sm:block" />
              It helps you remember and strengthen relationships with your network.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Traditional CRM column */}
            <div className="rounded-2xl border border-border/60 p-6 bg-background/50">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Traditional CRM</p>
              <ul className="space-y-3">
                {crmComparison.crm.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <X className="h-4 w-4 text-destructive/60 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* WhoNow column */}
            <div className="rounded-2xl border border-primary/30 p-6 bg-primary/5">
              <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">WhoNow</p>
              <ul className="space-y-3">
                {crmComparison.whonow.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-foreground">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Built for memory, context, and connection
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Every feature is designed to reduce the friction between knowing someone and staying connected with them.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
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
