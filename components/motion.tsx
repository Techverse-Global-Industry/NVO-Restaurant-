"use client";
import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { usePathname } from "next/navigation";
import { useNvo } from "./provider";
export function RestaurantMotion() {
  const pathname = usePathname();
  const { tr } = useNvo();
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () =>
      setEnabled(
        localStorage.getItem("nvo-motion") !== "off" && !media.matches,
      );
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion = enabled ? "on" : "off";
    if (!enabled) return;
    const seen = new WeakSet<Element>();
    const running = new Set<Animation>();
    const observer = new IntersectionObserver(
      (items) => {
        items
          .filter((i) => i.isIntersecting)
          .forEach((item, index) => {
            observer.unobserve(item.target);
            const anim = item.target.animate(
              [
                { opacity: 0, transform: "translateY(22px)" },
                { opacity: 1, transform: "translateY(0)" },
              ],
              {
                duration: 650,
                delay: Math.min(index * 65, 260),
                easing: "cubic-bezier(.2,.75,.2,1)",
              },
            );
            running.add(anim);
            anim.onfinish = () => running.delete(anim);
          });
      },
      { threshold: 0.06 },
    );
    const selectors =
      "[data-reveal], .post-card, .meal-card, .journal-card, .admin-panel, .social-account, .royal-section-heading, .gallery-item, .editor-dialog, .royal-home section > .section-heading, .admin-stat";
    const scan = (node: ParentNode) => {
      const elements = [
        ...(node instanceof Element && node.matches(selectors) ? [node] : []),
        ...Array.from(node.querySelectorAll(selectors)),
      ];
      for (const el of elements) {
        if (!seen.has(el)) {
          seen.add(el);
          observer.observe(el);
        }
      }
    };
    scan(document);
    const changes = new MutationObserver((records) =>
      records.forEach((r) =>
        r.addedNodes.forEach((n) => {
          if (n instanceof Element) scan(n);
        }),
      ),
    );
    changes.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      changes.disconnect();
      running.forEach((a) => a.cancel());
    };
  }, [enabled, pathname]);
  return (
    <>
      <div className="reading-progress" aria-hidden="true" />
      <button
        className="motion-control"
        aria-label={
          enabled
            ? tr("Pause animations", "Mettre les animations en pause")
            : tr("Enable animations", "Activer les animations")
        }
        aria-pressed={enabled}
        onClick={() => {
          localStorage.setItem("nvo-motion", enabled ? "off" : "on");
          setEnabled(!enabled);
        }}
      >
        {enabled ? <Pause size={13} /> : <Play size={13} />}
        <span>{tr("Motion", "Animations")}</span>
      </button>
    </>
  );
}
