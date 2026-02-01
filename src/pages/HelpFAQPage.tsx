import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqItems = [
  {
    question: "How do I add a contact?",
    answer:
      "Click the 'Add Contact' button in the header, then choose 'Add Contact' from the dropdown. Fill in the contact's name, email, phone, company, and any other details. You can also add contacts by scanning a business card, importing from a file, or syncing from Google or Slack.",
  },
  {
    question: "How do I search my contacts?",
    answer:
      "Use the search bar at the top of the app. You can type a name, company, or even natural questions like 'Who handles marketing?' or 'email Sarah'. The app understands context and will show the right contacts and suggest actions.",
  },
  {
    question: "How do I create a folder?",
    answer:
      "Open the sidebar and find the 'Folders' section. Click the '+' or 'New folder' option, give your folder a name, and save. You can then move contacts into folders by editing a contact and selecting the folder, or by using bulk actions when multiple contacts are selected.",
  },
  {
    question: "How do I import contacts?",
    answer:
      "Click 'Add Contact' and choose one of the import options: 'Scan Business Card' to capture a card with your camera, 'Import from File' to upload a CSV or vCard, 'Sync from Google' to connect your Google contacts, or 'Import from Slack' (if available on your plan) to pull in your Slack workspace members.",
  },
  {
    question: "How do I export contacts?",
    answer:
      "Go to Settings (profile menu → Settings) and use the Export section. You can export all contacts or a selection to CSV. For a single contact, open the contact card and use the export option from the details view.",
  },
];

export default function HelpFAQPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to app
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Help & FAQ</h1>
        <p className="text-muted-foreground mb-8">
          Quick answers to common questions about using WhoNow.
        </p>

        <Accordion type="single" collapsible className="w-full">
          {faqItems.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </main>
    </div>
  );
}
