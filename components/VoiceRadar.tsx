
import React, { useRef, useEffect, useState } from 'react';
import type { JarvisStatus } from '../hooks/useJarvis';

interface VoiceRadarProps {
  status: JarvisStatus;
  analyserNode: AnalyserNode | null;
}

export const VoiceRadar: React.FC<VoiceRadarProps> = ({ status, analyserNode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [aiHeadImage, setAiHeadImage] = useState<HTMLImageElement | null>(null);

  // Load the AI head image on mount
  useEffect(() => {
    const img = new Image();
    img.src = '/ai-head.png';
    img.onload = () => setAiHeadImage(img);
  }, []);

  useEffect(() => {
    if (!aiHeadImage) return; // Wait for the image to load

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const center = { x: width / 2, y: height / 2 };
    const baseRadius = Math.min(width, height) / 2.8;

    let animationFrameId: number;
    let time = 0;

    const neonStroke = (alpha: number) => `rgba(0, 255, 255, ${alpha})`;

    const drawBackground = () => {
      const gradient = ctx.createRadialGradient(
        center.x,
        center.y,
        baseRadius * 0.2,
        center.x,
        center.y,
        baseRadius * 1.6,
      );
      gradient.addColorStop(0, 'rgba(14, 116, 144, 0.35)');
      gradient.addColorStop(0.5, 'rgba(10, 25, 47, 0.85)');
      gradient.addColorStop(1, 'rgba(4, 12, 24, 0.95)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.strokeStyle = 'rgba(0, 180, 255, 0.18)';
      ctx.lineWidth = 1;
      const gridSize = baseRadius * 0.35;
      for (let x = center.x - baseRadius * 1.5; x <= center.x + baseRadius * 1.5; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, center.y - baseRadius * 1.5);
        ctx.lineTo(x, center.y + baseRadius * 1.5);
        ctx.stroke();
      }
      for (let y = center.y - baseRadius * 1.5; y <= center.y + baseRadius * 1.5; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(center.x - baseRadius * 1.5, y);
        ctx.lineTo(center.x + baseRadius * 1.5, y);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawReticle = () => {
      ctx.save();
      const radialGradient = ctx.createRadialGradient(center.x, center.y, baseRadius * 0.25, center.x, center.y, baseRadius);
      radialGradient.addColorStop(0, 'rgba(0, 255, 255, 0.2)');
      radialGradient.addColorStop(1, 'rgba(0, 150, 200, 0)');
      ctx.fillStyle = radialGradient;
      ctx.beginPath();
      ctx.arc(center.x, center.y, baseRadius, 0, 2 * Math.PI);
      ctx.fill();

      ctx.strokeStyle = neonStroke(0.6);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(center.x, center.y, baseRadius, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.strokeStyle = neonStroke(0.45);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(center.x, center.y, baseRadius * 0.7, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.strokeStyle = neonStroke(0.3);
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.arc(center.x, center.y, baseRadius * 1.2, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);

      const tickCount = 36;
      ctx.lineWidth = 2;
      ctx.strokeStyle = neonStroke(0.6);
      for (let i = 0; i < tickCount; i++) {
        const angle = (i / tickCount) * Math.PI * 2;
        const inner = baseRadius * 0.92;
        const outer = baseRadius * 1.02;
        ctx.beginPath();
        ctx.moveTo(center.x + Math.cos(angle) * inner, center.y + Math.sin(angle) * inner);
        ctx.lineTo(center.x + Math.cos(angle) * outer, center.y + Math.sin(angle) * outer);
        ctx.stroke();
      }

      ctx.strokeStyle = neonStroke(0.6);
      ctx.lineWidth = 1.5;
      const crossLength = baseRadius * 0.25;
      ctx.beginPath();
      ctx.moveTo(center.x - crossLength, center.y);
      ctx.lineTo(center.x + crossLength, center.y);
      ctx.moveTo(center.x, center.y - crossLength);
      ctx.lineTo(center.x, center.y + crossLength);
      ctx.stroke();
      ctx.restore();
    };

    const drawDataParticles = (frameTime: number) => {
      const particleCount = 60;
      for (let i = 0; i < particleCount; i++) {
        const radius = baseRadius * (0.4 + ((i * 37) % 60) / 100);
        const angle = (i * 0.35 + frameTime * 0.6) % (Math.PI * 2);
        const x = center.x + Math.cos(angle) * radius;
        const y = center.y + Math.sin(angle) * radius * 0.72;

        const flicker = (Math.sin(frameTime * 3 + i) + 1) / 2;
        ctx.fillStyle = `rgba(0, 255, 255, ${0.15 + flicker * 0.35})`;
        ctx.beginPath();
        ctx.arc(x, y, 2 + flicker * 2, 0, 2 * Math.PI);
        ctx.fill();
      }
    };

    const drawHead = (opacity = 1, scale = 1) => {
      const imgSize = Math.min(width, height) * 0.62 * scale;
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.drawImage(aiHeadImage, center.x - imgSize / 2, center.y - imgSize / 2, imgSize, imgSize);
      ctx.restore();

      ctx.save();
      const glowGradient = ctx.createRadialGradient(center.x, center.y, imgSize * 0.2, center.x, center.y, imgSize * 0.7);
      glowGradient.addColorStop(0, 'rgba(0, 255, 255, 0.35)');
      glowGradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
      ctx.fillStyle = glowGradient;
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.arc(center.x, center.y, imgSize * 0.55, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      drawBackground();
      time += 0.02;

      drawReticle();
      drawDataParticles(time);

      switch (status) {
        case 'recording':
        case 'speaking': {
          drawHead(1);
          if (!analyserNode) break;
          
          const bufferLength = analyserNode.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyserNode.getByteFrequencyData(dataArray);
          
          let sum = 0;
          for(let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
          }
          const avg = sum / bufferLength;
          const volumeRadius = baseRadius * 0.5 * (1 + (avg / 256) * 0.2);

          ctx.strokeStyle = status === 'recording' ? 'rgba(255, 80, 80, 0.9)' : 'rgba(0, 255, 255, 0.9)';
          ctx.lineWidth = 2 + (avg / 256) * 4;
          ctx.beginPath();
          ctx.arc(center.x, center.y, volumeRadius, 0, 2 * Math.PI);
          ctx.stroke();
          break;
        }
          
        case 'initializing':
        case 'processing': {
          drawHead(0.9);
          ctx.strokeStyle = 'rgba(0, 255, 255, 1)';
          ctx.lineWidth = 2.5;
          
          const angle1 = time % (2*Math.PI);
          ctx.beginPath();
          ctx.arc(center.x, center.y, baseRadius * 0.95, angle1, angle1 + Math.PI * 0.7);
          ctx.stroke();

          const angle2 = -time * 1.5 % (2*Math.PI);
          ctx.beginPath();
          ctx.arc(center.x, center.y, baseRadius * 0.85, angle2, angle2 + Math.PI * 1.1);
          ctx.stroke();
          break;
        }
        
        case 'listening': {
            const breath = (Math.sin(time * 2) + 1) / 2; // 0 to 1 cycle
            drawHead(0.8 + breath * 0.2, 1 + breath * 0.02);
            break;
        }

        default: { // idle, error
            drawHead(0.7);
            break;
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [status, analyserNode, aiHeadImage]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
};
