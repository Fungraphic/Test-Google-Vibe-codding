
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

    const drawReticle = () => {
        ctx.strokeStyle = 'rgba(0, 150, 200, 0.4)';
        ctx.lineWidth = 1;
        
        // Main circle
        ctx.beginPath();
        ctx.arc(center.x, center.y, baseRadius, 0, 2 * Math.PI);
        ctx.stroke();

        // Inner circle
        ctx.beginPath();
        ctx.arc(center.x, center.y, baseRadius * 0.5, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Target lines
        const lineLength = baseRadius * 0.15;
        ctx.beginPath();
        ctx.moveTo(center.x, center.y - baseRadius - lineLength);
        ctx.lineTo(center.x, center.y - baseRadius + lineLength);
        ctx.moveTo(center.x, center.y + baseRadius - lineLength);
        ctx.lineTo(center.x, center.y + baseRadius + lineLength);
        ctx.moveTo(center.x - baseRadius - lineLength, center.y);
        ctx.lineTo(center.x - baseRadius + lineLength, center.y);
        ctx.moveTo(center.x + baseRadius - lineLength, center.y);
        ctx.lineTo(center.x + baseRadius + lineLength, center.y);
        ctx.stroke();
    };
    
    const drawHead = (opacity = 1, scale = 1) => {
        const imgSize = Math.min(width, height) * 0.6 * scale;
        ctx.globalAlpha = opacity;
        ctx.drawImage(aiHeadImage, center.x - imgSize / 2, center.y - imgSize / 2, imgSize, imgSize);
        ctx.globalAlpha = 1;
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#0a192f'; // Match background
      ctx.fillRect(0,0,width,height);
      time += 0.02;

      drawReticle();

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
