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
      "No. WhoNow does not track deals, pipelines, or revenue. It helps you instantly find, organize, and strengthen the people behind your work. Use it alongside your CRM — not in place of it.",
  },
  {
    question: "How does WhoNow integrate with my existing tools?",
    answer:
      "WhoNow integrates with Slack and Microsoft Teams at the organization level: your org admin connects once, and all members can import workspace contacts and share contact cards from chat. You can also import contacts from CSV files and export your data when needed. WhoNow is designed to complement the tools you already use, not replace them.",
  },
  {
    question: "What makes WhoNow different from other contact tools?",
    answer:
      "WhoNow is built around three things most contact tools ignore: natural language search, relationship health scoring, and proactive follow-up memory. You can ask questions like \"who do I know at Stripe?\" or \"clients I haven't spoken to in 60 days\" and get instant, accurate results — no complex filtering or menu navigation required.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Yes. We use enterprise-grade security with encrypted data at rest and in transit. Your contact information is stored securely and only accessible to you and your organization members. The desktop app processes search on-device for maximum privacy.",
  },
  {
    question: "Can I use WhoNow with my team?",
    answer:
      "Yes. WhoNow is designed for both individuals and teams. You can share contacts, organize them in folders, and give your whole team visibility into your collective network — without duplicating effort or creating internal CRM overhead. It scales from solo professionals to large organizations.",
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

