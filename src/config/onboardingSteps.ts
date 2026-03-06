import { OnboardingStep } from "@/components/OnboardingTutorial";

export const onboardingSteps: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to WhoNow",
    content: "WhoNow helps you find people using plain language — no folders or tags required. Here’s a quick tour of the main features.",
    position: "bottom",
  },
  {
    id: "search",
    title: "Smart Search",
    content: "Use the search bar to ask in plain language: e.g. “designers I met last month”, “clients at Acme”, or “email Sarah”. Natural language works.",
    targetSelector: "[data-onboarding-search]",
    position: "bottom",
  },
  {
    id: "contacts",
    title: "Contacts & Client Management",
    content: "Your contact cards hold descriptions and context. Mark contacts as clients to track them in the Client Directory and manage relationships.",
    targetSelector: "[data-onboarding-contact-card]",
    position: "right",
  },
  {
    id: "directories",
    title: "Contacts & Client Directory",
    content: "Use the sidebar to switch between All Contacts and Client Directory. Internal Directory appears when you’re in an organization.",
    targetSelector: "[data-onboarding-client-directory]",
    position: "right",
  },
  {
    id: "add",
    title: "Add, Import & You’re All Set",
    content: "Add contacts manually, scan business cards, or import from file. Start searching or add your first contact — everything is designed to be fast and simple.",
    targetSelector: "[data-onboarding-add-button]",
    position: "bottom",
  },
];
