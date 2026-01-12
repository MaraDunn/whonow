import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Is this a CRM?",
    answer:
      "No, WhoNow is not a CRM. While we provide some functionality that overlaps with CRM systems, we're designed to be lightweight and focused on contact management and organization. WhoNow is meant to be used alongside your existing CRM, not in place of it. We help you quickly find and organize contacts without the bloat that comes with full-featured CRM platforms.",
  },
  {
    question: "How does WhoNow integrate with my existing tools?",
    answer:
      "WhoNow integrates with Slack and Microsoft Teams to import workspace members as contacts and share contact cards directly from your chat. You can also import contacts from CSV files and export your data when needed. We're designed to complement your existing workflow tools.",
  },
  {
    question: "What makes WhoNow different from other contact management tools?",
    answer:
      "WhoNow focuses on natural language search, making it easy to find contacts using plain English questions like 'who do I know at TechCorp' or 'engineers in San Francisco'. We prioritize simplicity and speed over complex features, helping you quickly access the information you need without navigating through multiple menus or learning a complex interface.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Yes, we use enterprise-grade security with encrypted data at rest and in transit. Your contact information is stored securely and only accessible to you and your organization members.",
  },
  {
    question: "Can I use WhoNow with my team?",
    answer:
      "Yes, WhoNow is designed for teams and organizations. You can share contacts, organize them in folders, and collaborate with your team members. The platform scales from small teams to large enterprises.",
  },
];

export const FAQSection = () => {
  return (
    <section id="faq" className="py-24 sm:py-32 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Everything you need to know about WhoNow
          </p>
        </div>

        {/* FAQ Accordion */}
        <Accordion type="single" collapsible className="w-full space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="bg-card rounded-lg px-6 border border-border/50 shadow-sm hover:shadow-md transition-shadow"
            >
              <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline py-6">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed pb-6">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

