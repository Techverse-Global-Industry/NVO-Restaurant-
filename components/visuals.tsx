"use client";
import { useState } from "react";
import Image from "next/image";
import { Play, X } from "lucide-react";
import { useNvo } from "./provider";
export function SampleBadge() {
  const { tr } = useNvo();
  return (
    <span className="sample-badge">
      {tr("Sample content", "Contenu de démonstration")}
    </span>
  );
}
export function KitchenFilm() {
  const { tr } = useNvo();
  const [playing, setPlaying] = useState(false);
  return (
    <section className="kitchen-film section">
      <div className="film-copy">
        <span className="eyebrow">
          {tr("A MOMENT IN OUR KITCHEN", "UN INSTANT EN CUISINE")}
        </span>
        <h2>
          {tr("You can almost", "On peut presque")}
          <br />
          <em>{tr("taste it.", "y goûter.")}</em>
        </h2>
        <p>
          {tr(
            "No stock footage. Just a close-up of something delicious from NVO. Take nine seconds. Get hungry.",
            "Pas d’images de banque. Un vrai moment gourmand de NVO. Neuf secondes pour ouvrir l’appétit.",
          )}
        </p>
        <span className="film-length">NVO KITCHEN · 00:09</span>
      </div>
      <div className="film-frame">
        {playing ? (
          <>
            <video
              controls
              autoPlay
              playsInline
              muted
              preload="none"
              aria-label={tr(
                "Close-up of NVO soup and starch, no spoken content",
                "Gros plan sur la soupe et le starch NVO, sans dialogue",
              )}
            >
              <source src="/videos/nvo-kitchen.mp4" type="video/mp4" />
            </video>
            <button
              className="film-close"
              onClick={() => setPlaying(false)}
              aria-label={tr("Close video", "Fermer la vidéo")}
            >
              <X size={18} />
            </button>
          </>
        ) : (
          <button
            className="film-poster"
            onClick={() => setPlaying(true)}
            aria-label={tr(
              "Play the NVO kitchen film: A little taste, in motion",
              "Lire la vidéo NVO : Les saveurs en mouvement",
            )}
          >
            <Image
              src="/images/table-spread.webp"
              alt=""
              fill
              sizes="(max-width:700px) 90vw, 50vw"
              style={{ objectFit: "cover" }}
            />
            <span className="play-circle">
              <Play size={25} fill="currentColor" />
            </span>
            <span className="film-label">
              {tr("A little taste, in motion", "Les saveurs en mouvement")}
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
