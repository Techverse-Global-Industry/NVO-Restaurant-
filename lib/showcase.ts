import type { Entry } from "./types";
// Editorial sample copy only. No invented reviews, sales, discounts or customer identities.
export const showcaseEntries: Entry[] = [
  {
    id: "sample-sunday-table",
    kind: "events",
    title: "The Sunday table",
    titleFr: "La table du dimanche",
    description:
      "A slow afternoon, a generous spread and your favourite people. Imagine a Sunday gathering built around familiar Nigerian flavours, seafood and something chilled.\n\nThis is a sample event concept for the website design, not a scheduled event. Contact our team to plan your own visit.",
    descriptionFr:
      "Un après-midi tranquille, des plats généreux et vos proches. Un concept de rencontre autour des saveurs nigérianes et des fruits de mer.\n\nExemple de concept, pas un événement programmé. Contactez notre équipe pour organiser votre visite.",
    image: "/images/table-spread.webp",
    badge: "Gather around",
    sort: 1,
  },
  {
    id: "sample-blue-hour",
    kind: "events",
    title: "A little blue-hour magic",
    titleFr: "La magie de l’heure bleue",
    description:
      "Good conversation deserves good food. A relaxed evening concept with seafood at the centre of the table, rich flavours and room for one more friend.\n\nSample event concept only. Dates, menus and availability have not been announced. Ask our team about planning an evening together.",
    descriptionFr:
      "Un concept de soirée détendue autour des fruits de mer et de belles conversations.\n\nExemple uniquement : aucune date ni formule annoncée. Renseignez-vous auprès de notre équipe.",
    image: "/images/peppered-bites.webp",
    badge: "An evening together",
    sort: 2,
  },
  {
    id: "sample-celebrate",
    kind: "events",
    title: "Make it an NVO occasion",
    titleFr: "Un moment à célébrer chez NVO",
    description:
      "A birthday, a reunion, or simply a reason to bring your people together. This sample celebration concept pairs a colourful food spread with the joy of sharing.\n\nEnquire with the team about space, group size and available dishes before making plans. No event package is currently promised by this sample.",
    descriptionFr:
      "Anniversaire, retrouvailles ou plaisir de se réunir : un exemple de célébration autour de bons plats.\n\nConfirmez l’espace, le nombre de personnes et les plats avec notre équipe. Cet exemple ne constitue pas une offre.",
    image: "/images/rice-fish.jpeg",
    badge: "Your people, your occasion",
    sort: 3,
  },
  {
    id: "sample-banga-story",
    kind: "posts",
    title: "A bowl worth slowing down for",
    titleFr: "Un bol à savourer sans se presser",
    description:
      "Some meals invite you to take your time. A rich bowl of banga, a smooth accompaniment, and that first satisfying taste: this is the kind of food that turns lunch into a moment.\n\nStart with the soup, enjoy the textures, and make room for conversation. Explore the NVO menu and ask our team which accompaniments are available.\n\nSample editorial copy for owner review.",
    descriptionFr:
      "Certains plats invitent à prendre son temps. Une soupe Banga généreuse, un accompagnement fondant : le déjeuner devient un moment à partager.\n\nDécouvrez la carte et les accompagnements disponibles auprès de notre équipe.\n\nTexte de démonstration à valider.",
    image: "/images/banga-detail.webp",
    badge: "From the kitchen",
    sort: 1,
  },
  {
    id: "sample-your-perfect-plate",
    kind: "posts",
    title: "Build your perfect NVO moment",
    titleFr: "Composez votre moment NVO",
    description:
      "Are you here for the rice, the fish, or the golden plantain? A colourful plate brings different cravings together. Take a look through the menu, find the combination that speaks to you, and let our team help with the details.\n\nFor a relaxed lunch, choose a favourite. For a shared table, explore a little more. WhatsApp is the easiest way to confirm today’s availability and your order.\n\nSample editorial copy for owner review.",
    descriptionFr:
      "Riz, poisson ou plantain doré ? Une assiette colorée réunit toutes les envies. Parcourez notre carte et laissez notre équipe vous guider.\n\nWhatsApp permet de confirmer la disponibilité et votre commande.\n\nTexte de démonstration à valider.",
    image: "/images/rice-fish.jpeg",
    badge: "The good-food journal",
    sort: 2,
  },
  {
    id: "sample-food-and-company",
    kind: "posts",
    title: "The secret ingredient? Your people.",
    titleFr: "L’ingrédient secret ? Vos proches.",
    description:
      "A meal can be the reason to finally catch up. Put the phones aside for a moment, order something you love, and let the conversation find its own pace.\n\nNVO is an invitation to enjoy familiar flavours in Cotonou. Planning to come with friends? Send a table request and our team will get back to you to confirm the arrangement.\n\nSample editorial copy for owner review.",
    descriptionFr:
      "Un repas est parfois la meilleure occasion de se retrouver. Commandez un plat que vous aimez et prenez le temps d’échanger.\n\nVous venez entre amis ? Envoyez une demande de table pour confirmation par notre équipe.\n\nTexte de démonstration à valider.",
    image: "/images/fish-rice.jpeg",
    badge: "Around our table",
    sort: 3,
  },
  {
    id: "sample-kitchen-spotlight",
    kind: "specials",
    title: "A little comfort. A lot of flavour.",
    titleFr: "Du réconfort. Et beaucoup de saveurs.",
    description:
      "Rich soup. Golden starch. A combination made for slowing down and enjoying every spoonful. Explore our banga favourite and ask the kitchen what’s available today.",
    descriptionFr:
      "Une soupe généreuse et du starch doré. Découvrez notre Banga et les accompagnements disponibles aujourd’hui.",
    image: "/images/banga-detail.webp",
    badge: "Kitchen spotlight",
    sort: 1,
  },
].map((e) => ({
  ...e,
  active: true,
  status: "published",
  demo: true,
})) as Entry[];
