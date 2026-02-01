import { OnboardingStep } from "@/components/OnboardingTutorial";

export const onboardingSteps: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to WhoNow",
    content: "WhoNow helps you find people using plain language — no folders, no tags required.",
    position: "bottom",
  },
  {
    id: "search",
    title: "Smart Search",
    content: "Try searches like 'designers I met last month' or 'clients at Acme'. Natural language works.",
    targetSelector: "[data-onboarding-search]",
    position: "bottom",
  },
  {
    id: "contacts",
    title: "Rich Contact Cards",
    content: "Add descriptions and context to your contacts. The more you add, the easier they are to find.",
    targetSelector: "[data-onboarding-contact-card]",
    position: "right",
  },
  {
    id: "import",
    title: "Import & Add Contacts",
    content: "Import contacts in bulk or scan business cards. You can always enrich them later.",
    targetSelector: "[data-onboarding-add-button]",
    position: "bottom",
  },
  {
    id: "done",
    title: "You're All Set",
    content: "Start searching or add your first contact. Everything is designed to be fast and simple.",
    position: "bottom",
  },
];
