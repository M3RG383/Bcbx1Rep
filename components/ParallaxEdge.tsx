"use client";

import { useEffect, useRef } from "react";

export default function ParallaxEdge() {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ticking = false;

    function handleScroll() {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          const progress = docHeight > 0 ? scrollY / docHeight : 0;

          if (leftRef.current) {
            leftRef.current.style.transform = `translateY(${scrollY * 0.15}px)`;
            leftRef.current.style.opacity = `${0.3 + progress * 0.5}`;
          }
          if (rightRef.current) {
            rightRef.current.style.transform = `translateY(${-scrollY * 0.1}px)`;
            rightRef.current.style.opacity = `${0.3 + (1 - progress) * 0.4}`;
          }
          if (topRef.current) {
            topRef.current.style.transform = `translateX(${scrollY * 0.08}px)`;
          }
          if (bottomRef.current) {
            bottomRef.current.style.transform = `translateX(${-scrollY * 0.06}px)`;
          }

          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <div ref={leftRef} className="parallax-edge parallax-edge-left" />
      <div ref={rightRef} className="parallax-edge parallax-edge-right" />
      <div ref={topRef} className="parallax-edge parallax-edge-top" />
      <div ref={bottomRef} className="parallax-edge parallax-edge-bottom" />
    </>
  );
}