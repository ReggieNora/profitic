"use client";

import React, { useEffect, useRef, useState } from "react";

interface Props {
  price: number;
  sentiment?: number; // 0 (Red dominant) to 1 (Green dominant)
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  life: number;
  maxLife: number;
  active: boolean;
}

const POOL_SIZE = 40;

export default function TrendBackground({ price, sentiment = 0.5 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [direction, setDirection] = useState<"up" | "down" | "flat">("flat");
  const [flash, setFlash] = useState(0); // For React UI if needed
  const [currentSentiment, setCurrentSentiment] = useState(sentiment);
  const lastPriceRef = useRef(price);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();
  
  // Internal animation state to avoid React render loops
  const animStateRef = useRef({
    flash: 0,
    direction: "flat" as "up" | "down" | "flat",
    lastPrice: price,
  });

  useEffect(() => {
    if (price > lastPriceRef.current) {
      animStateRef.current.direction = "up";
      animStateRef.current.flash = Math.min(1.0, animStateRef.current.flash + 0.6);
      setDirection("up");
    } else if (price < lastPriceRef.current) {
      animStateRef.current.direction = "down";
      animStateRef.current.flash = Math.min(1.0, animStateRef.current.flash + 0.6);
      setDirection("down");
    }
    lastPriceRef.current = price;
  }, [price]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.offsetWidth;
    let height = canvas.offsetHeight;
    
    // Set actual size in memory (scaled to account for extra pixel density)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        width = entry.contentRect.width;
        height = entry.contentRect.height;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
      }
    });
    resizeObserver.observe(canvas);

    // Initialize pool
    if (particlesRef.current.length === 0) {
      for (let i = 0; i < POOL_SIZE; i++) {
        particlesRef.current.push({
          x: 0, y: 0, size: 0, speed: 0, opacity: 0, life: 0, maxLife: 0, active: false
        });
      }
    }

    const particles = particlesRef.current;
    
    let frameCount = 0;

    const drawArrow = (x: number, y: number, size: number, dir: "up" | "down", opacity: number) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      if (dir === "up") {
        ctx.lineTo(x - size, y + size * 1.5);
        ctx.lineTo(x - size * 0.4, y + size * 1.5);
        ctx.lineTo(x - size * 0.4, y + size * 3);
        ctx.lineTo(x + size * 0.4, y + size * 3);
        ctx.lineTo(x + size * 0.4, y + size * 1.5);
        ctx.lineTo(x + size, y + size * 1.5);
      } else {
        ctx.lineTo(x - size, y - size * 1.5);
        ctx.lineTo(x - size * 0.4, y - size * 1.5);
        ctx.lineTo(x - size * 0.4, y - size * 3);
        ctx.lineTo(x + size * 0.4, y - size * 3);
        ctx.lineTo(x + size * 0.4, y - size * 1.5);
        ctx.lineTo(x + size, y - size * 1.5);
      }
      ctx.closePath();
      
      // Add a vibrant glow effect
      ctx.shadowBlur = 10;
      ctx.shadowColor = dir === "up" ? "rgba(34, 197, 94, 0.8)" : "rgba(239, 68, 68, 0.8)";
      
      ctx.fillStyle = dir === "up" ? `rgba(74, 222, 128, ${opacity})` : `rgba(248, 113, 113, ${opacity})`;
      ctx.fill();
      
      // Reset shadow for other drawing
      ctx.shadowBlur = 0;
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Dynamic Sentiment Background Fill
      // Smoothly interpolate sentiment
      setCurrentSentiment((prev) => prev + (sentiment - prev) * 0.05);
      
      // Calculate color blend based on sentiment
      // More vibrant alpha: 0.1 to 0.4
      const redAlpha = Math.max(0.1, 0.4 * (1 - currentSentiment));
      const greenAlpha = Math.max(0.1, 0.4 * currentSentiment);
      
      const backgroundGradient = ctx.createLinearGradient(0, 0, 0, height);
      backgroundGradient.addColorStop(0, `rgba(185, 28, 28, ${redAlpha})`); // Deeper Red
      backgroundGradient.addColorStop(1, `rgba(21, 128, 61, ${greenAlpha})`); // Deeper Green
      
      ctx.fillStyle = backgroundGradient;
      ctx.fillRect(0, 0, width, height);

      // 2. Trend flash gradient background (Smoother decay)
      const internalFlash = animStateRef.current.flash;
      const internalDir = animStateRef.current.direction;

      if (internalFlash > 0.001) {
        ctx.save();
        const flashIntensity = Math.min(0.5, internalFlash);
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        if (internalDir === "up") {
          gradient.addColorStop(0, `rgba(34, 197, 94, ${flashIntensity * 0.7})`);
          gradient.addColorStop(1, "rgba(34, 197, 94, 0)");
        } else if (internalDir === "down") {
          gradient.addColorStop(1, `rgba(239, 68, 68, ${flashIntensity * 0.7})`);
          gradient.addColorStop(0, "rgba(239, 68, 68, 0)");
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }

      // 3. Slower decay for smoother "fade to clear"
      if (animStateRef.current.flash > 0.001) {
        animStateRef.current.flash *= 0.985;
      } else if (animStateRef.current.flash > 0) {
        animStateRef.current.flash = 0;
        animStateRef.current.direction = "flat";
        setDirection("flat");
      }

      // Spawn new particles if moving
      if (internalDir !== "flat") {
        const spawnRate = internalFlash > 0.4 ? 1 : 3; // Even faster spawn
        if (frameCount % spawnRate === 0) {
          const inactive = particles.find((p) => !p.active);
          if (inactive) {
            inactive.active = true;
            inactive.x = Math.random() * width;
            inactive.y = internalDir === "up" ? height + 20 : -20;
            inactive.size = (Math.random() * 10 + 6) * (1 + internalFlash * 0.8); // Larger arrows
            inactive.speed = (Math.random() * 3 + 2) * (internalDir === "up" ? -1 : 1) * (1 + internalFlash * 1.0); // Faster
            inactive.maxLife = Math.random() * 100 + 60;
            inactive.life = 0;
            inactive.opacity = Math.random() * 0.6 + 0.4; // High opacity (0.4 to 1.0)
          }
        }
      }

      // Update and draw
      for (const p of particles) {
        if (!p.active) continue;

        p.y += p.speed;
        p.life++;

        // Fade in and out (Smoother: 30 frames)
        let currentOpacity = p.opacity;
        const fadeFrames = 30;
        if (p.life < fadeFrames) {
          currentOpacity = p.opacity * (p.life / fadeFrames);
        } else if (p.life > p.maxLife - fadeFrames) {
          currentOpacity = p.opacity * ((p.maxLife - p.life) / fadeFrames);
        }

        if (p.life >= p.maxLife || (p.speed < 0 && p.y < -30) || (p.speed > 0 && p.y > height + 30)) {
          p.active = false;
        } else if (direction !== "flat") {
          drawArrow(p.x, p.y, p.size, p.speed < 0 ? "up" : "down", currentOpacity);
        }
      }

      frameCount++;
      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      resizeObserver.disconnect();
    };
  }, [sentiment, currentSentiment]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full pointer-events-none z-0"
      style={{ opacity: 0.8 }}
    />
  );
}
