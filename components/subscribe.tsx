"use client";
import { useState } from "react";
import { MessageCircle, ArrowUpRight } from "lucide-react";
import { useNvo } from "./provider";
export function Subscribe({ phone }: { phone: string | null }) {
  const [consent, setConsent] = useState(false);
  const { tr } = useNvo();
  return (
    <div className="subscribe-card">
      <span className="eyebrow">LE CERCLE NVO</span>
      <h1>
        {tr(
          "A little flavour in your inbox.",
          "Un peu de saveur dans vos messages.",
        )}
      </h1>
      <p>
        {tr(
          "Get NVO’s new dishes, specials and restaurant news on WhatsApp. Subscribe only if you would like to receive these promotional messages.",
          "Recevez nos nouveaux plats, nos offres et les nouvelles du restaurant sur WhatsApp. Abonnez-vous si vous souhaitez recevoir ces messages promotionnels.",
        )}
      </p>
      {phone ? (
        <>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            {tr(
              "I want to receive NVO Restaurant’s offers and news on WhatsApp.",
              "Je souhaite recevoir les offres et les nouvelles de NVO Restaurant sur WhatsApp.",
            )}
          </label>
          <button
            className="button"
            disabled={!consent}
            onClick={() =>
              window.open(
                `https://wa.me/${phone}?text=${encodeURIComponent(tr("JOIN NVO", "ABONNER NVO"))}`,
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            <MessageCircle size={18} />
            {tr("Subscribe in WhatsApp", "M’abonner sur WhatsApp")}
            <ArrowUpRight size={17} />
          </button>
          <p className="form-note">
            {tr(
              "Send the prepared message in WhatsApp to confirm your subscription. Opening the chat alone does not subscribe you. Reply STOP at any time to unsubscribe. Ordering food does not subscribe you.",
              "Envoyez le message préparé dans WhatsApp pour confirmer votre abonnement. Ouvrir la conversation ne suffit pas. Répondez STOP à tout moment pour vous désabonner. Commander un repas ne vous abonne pas.",
            )}
          </p>
        </>
      ) : (
        <p>
          {tr(
            "WhatsApp subscriptions will open once the restaurant connects its business messaging account. Please check back soon.",
            "Les abonnements ouvriront dès que le restaurant aura connecté son compte de messagerie professionnelle. À très bientôt !",
          )}
        </p>
      )}
      <a href="/privacy">
        {tr(
          "How we protect your information",
          "Comment nous protégeons vos informations",
        )}
      </a>
    </div>
  );
}
