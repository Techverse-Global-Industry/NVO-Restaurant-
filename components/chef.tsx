"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "./locale-link";
import { X, ArrowUpRight, Volume2 } from "lucide-react";
import { useNvo } from "./provider";

// Original, lightweight vector illustration: no image request or animation library.
export function ChefPortrait() {
  return (
    <svg viewBox="0 0 160 180" aria-hidden="true" className="chef-portrait">
      <circle
        cx="80"
        cy="89"
        r="69"
        fill="#132e64"
        stroke="#d9b874"
        strokeWidth="1.5"
      />
      <circle
        cx="80"
        cy="89"
        r="61"
        fill="none"
        stroke="#d9b874"
        strokeOpacity=".3"
      />
      <path
        d="M25 162q3-47 55-47t55 47"
        fill="#faf8f2"
        stroke="#d9b874"
        strokeWidth="2"
      />
      <path d="m60 119 20 17 20-17-6 44H66z" fill="#163675" />
      <path d="m70 125 10 11 10-11-10-6z" fill="#d9b874" />
      <path d="M49 69q0-34 31-34t31 34v20q-3 35-31 35T49 89z" fill="#8d5436" />
      <path d="M51 81q-14-10-9 8l10 9M109 81q14-10 9 8l-10 9" fill="#8d5436" />
      <path
        d="M48 69V49q-16-3-13-19 3-15 19-13 7-22 26-11 19-11 26 11 16-2 19 13 3 16-13 19v20z"
        fill="#fffdf6"
        stroke="#d9b874"
        strokeWidth="2"
      />
      <path
        d="M48 58h64M65 21l4 25m26-25-4 25"
        fill="none"
        stroke="#e2d7bf"
        strokeWidth="2"
      />
      <path
        d="M61 81q6-5 12 0m14 0q6-5 12 0"
        stroke="#38251f"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="68" cy="86" r="2.2" fill="#211b19" />
      <circle cx="93" cy="86" r="2.2" fill="#211b19" />
      <path d="m79 86-3 10 7 1" fill="none" stroke="#653923" strokeWidth="2" />
      <path
        d="M68 104q12 12 25-1"
        fill="#fffdf6"
        stroke="#663c29"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="53" cy="143" r="2" fill="#c6a15f" />
      <circle cx="107" cy="143" r="2" fill="#c6a15f" />
      <text
        x="80"
        y="158"
        fill="#e5c88f"
        fontFamily="Georgia,serif"
        fontSize="12"
        textAnchor="middle"
      >
        NVO
      </text>
      <path d="m130 44 3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#d9b874" />
    </svg>
  );
}

export const staffGuides: Record<string, [string, string, string[]]> = {
  overview: [
    "Welcome to your restaurant desk.",
    "A little guidance from your NVO host. Choose a task and we’ll help you take care of it.",
    [
      "Update what’s on the menu.",
      "Check new orders and table requests.",
      "Share something delicious with your guests.",
    ],
  ],
  meals: [
    "Let’s make your menu irresistible.",
    "Each card is a dish customers can discover and add to their order.",
    [
      "Add the dish name, a photo and a short description.",
      "Choose a category and whether to show its price.",
      "Save it as published when it’s ready, or hide it when sold out.",
    ],
  ],
  categories: [
    "Give every dish a home.",
    "Categories help guests find soups, rice, seafood and drinks quickly.",
    [
      "Create a short, familiar category name.",
      "Assign dishes to it in Food menu.",
      "Use display order to put your favourites first.",
    ],
  ],
  specials: [
    "Put something special in the spotlight.",
    "Feature a dish on the homepage and its own Current specials page. Coupons stay in their separate rewards area.",
    [
      "Choose a tempting image and title.",
      "Add start and end dates if this is temporary.",
      "Publish when the details are confirmed.",
    ],
  ],
  orders: [
    "A warm welcome starts with a reply.",
    "These are customer requests. Confirm availability and payment with the guest on WhatsApp.",
    [
      "Match the order reference with their message.",
      "Record the agreed total if prices were hidden.",
      "Mark paid only after the meal is fulfilled and payment received.",
    ],
  ],
  reservations: [
    "Make room for a good moment.",
    "Guests request a table here; your team confirms the arrangement.",
    [
      "Check the date, party size and contact details.",
      "Contact the guest to agree the details.",
      "Mark confirmed, or cancel if you cannot accommodate them.",
    ],
  ],
  campaigns: [
    "Create a reason to come back.",
    "Offers have real limits and expiry dates. Review the benefit before you publish.",
    [
      "Choose a discount or a free item.",
      "Set how many guests can claim and how long it lasts.",
      "Each guest claims a named card. Check or redeem it from Order requests.",
    ],
  ],
  posts: [
    "Tell a delicious story.",
    "Journal stories appear on the website and give guests more to explore.",
    [
      "Choose a title and a beautiful photograph.",
      "Write in either language; the other translates automatically.",
      "Save a draft or publish your finished story.",
    ],
  ],
  events: [
    "Give your guests something to look forward to.",
    "Announce confirmed occasions, gatherings and experiences here.",
    [
      "Add a title, photo, date and location.",
      "Explain what guests should expect.",
      "Publish only when your team is ready to take enquiries.",
    ],
  ],
  loyalty: [
    "Celebrate your community.",
    "Recognise customers with their permission.",
    [
      "Confirm the person’s consent and details.",
      "Add their recognition story.",
      "Publish the approved announcement.",
    ],
  ],
  testimonials: [
    "Let real guest stories shine.",
    "Only publish genuine feedback you have permission to share.",
    [
      "Add the guest’s approved name and words.",
      "Check spelling and consent.",
      "Publish when reviewed.",
    ],
  ],
  media: [
    "Your restaurant’s photo collection.",
    "Upload your best food pictures, then choose them when editing a dish or story.",
    [
      "Use JPEG, PNG or WebP pictures up to 8 MB.",
      "Search by filename to find a picture quickly.",
      "Delete unused uploads; replace pictures on their pages before removing them.",
    ],
  ],
  publishing: [
    "One story. More guests.",
    "Choose your destinations and review a caption for each. Follow every delivery here.",
    [
      "Connect your restaurant accounts and choose your defaults.",
      "Create a story with a photo; select or deselect any destination.",
      "Facebook, Instagram and WhatsApp send automatically. Finish TikTok uploads in the TikTok inbox.",
    ],
  ],
  analytics: [
    "See what catches your guests’ attention.",
    "Consented guest browsing is separate from staff testing and earlier mixed records. Browser counts are not a headcount.",
    [
      "Compare browser visits with menu and special views.",
      "Review WhatsApp clicks as enquiries.",
      "Use paid orders to understand completed sales.",
    ],
  ],
  settings: [
    "Keep the essentials up to date.",
    "Your contact details, map and price preferences live here.",
    [
      "Check the WhatsApp number carefully.",
      "Set your opening hours and map location.",
      "Turn off sample content before the public launch.",
    ],
  ],
};

export function StaffGuide({ section }: { section: string }) {
  const [expanded, setExpanded] = useState(false);
  const guide = staffGuides[section] || staffGuides.overview;
  useEffect(() => setExpanded(false), [section]);
  return (
    <aside className="staff-guide">
      <ChefPortrait />
      <div>
        <span className="eyebrow">YOUR NVO HOST</span>
        <h2>{guide[0]}</h2>
        <p>{guide[1]}</p>
        <button
          className="text-button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Close guide" : "Show me how this works"}{" "}
          <ArrowUpRight size={15} />
        </button>
        {expanded && (
          <ol>
            {guide[2].map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}

export function ChefHost() {
  const { tr, lang } = useNvo();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [arriving, setArriving] = useState(false);
  useEffect(() => {
    setOpen(false);
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }, [pathname]);
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    if (!sessionStorage.getItem("nvo-welcomed")) {
      setOpen(true);
      setArriving(true);
      sessionStorage.setItem("nvo-welcomed", "yes");
      const timer = setTimeout(() => setArriving(false), 2200);
      return () => clearTimeout(timer);
    }
  }, [pathname]);
  if (pathname.startsWith("/admin")) return null;
  const welcome = tr(
    "Welcome to NVO Restaurant. Come hungry, feel at home.",
    "Bienvenue au restaurant NVO. Venez avec appétit, sentez-vous chez vous.",
  );
  return (
    <div className={`chef-host ${arriving ? "chef-arriving" : ""}`}>
      {open && (
        <div
          className="chef-bubble"
          role="region"
          aria-label={tr("NVO welcome", "Bienvenue chez NVO")}
        >
          <button
            className="chef-close"
            aria-label={tr("Close welcome", "Fermer")}
            onClick={() => setOpen(false)}
          >
            <X size={17} />
          </button>
          <span className="eyebrow">BON APPÉTIT · NVO</span>
          <h2>
            {tr("Your table. Your moment.", "Votre table. Votre moment.")}
          </h2>
          <p>{welcome}</p>
          <Link href="/menu" onClick={() => setOpen(false)}>
            {tr("Find something delicious", "Découvrez nos saveurs")}{" "}
            <ArrowUpRight size={16} />
          </Link>
          <button
            className="welcome-audio"
            onClick={() => {
              if (!("speechSynthesis" in window)) return;
              speechSynthesis.cancel();
              const speech = new SpeechSynthesisUtterance(welcome);
              speech.lang = lang === "fr" ? "fr-FR" : "en-GB";
              speech.rate = 0.9;
              speechSynthesis.speak(speech);
            }}
          >
            <Volume2 size={14} />
            {tr("Hear the welcome", "Écouter l’accueil")}
          </button>
        </div>
      )}
      <button
        className="chef-launcher"
        aria-label={tr("Meet your NVO host", "Votre hôte NVO")}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <ChefPortrait />
      </button>
    </div>
  );
}
