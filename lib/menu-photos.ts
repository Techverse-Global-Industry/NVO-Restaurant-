export const menuPhotos = [
  {
    image: "/images/menu-jollof.webp",
    file: "Plate_of_jellof_rice.jpg",
    author: "Daniel Paullll",
    source: "https://commons.wikimedia.org/wiki/File:Plate_of_jellof_rice.jpg",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    en: "Jollof rice",
    fr: "Riz jollof",
  },
  {
    image: "/images/menu-shawarma.webp",
    file: "Chicken_Sharwama.jpg",
    author: "Umuhiera",
    source: "https://commons.wikimedia.org/wiki/File:Chicken_Sharwama.jpg",
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    en: "Chicken shawarma",
    fr: "Shawarma au poulet",
  },
  {
    image: "/images/menu-plantain.webp",
    file: "Plantain.jpg",
    author: "Renee Comet / National Cancer Institute",
    source: "https://commons.wikimedia.org/wiki/File:Plantain.jpg",
    license: "Public domain",
    licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    en: "Plantain",
    fr: "Plantain",
  },
];
export function photoCredit(image?: string) {
  return menuPhotos.find((photo) => photo.image === image);
}
