import { useState, useEffect, useRef } from 'react';
import type { Word } from '@english-learning/domain';
import './WordCard.css';

interface WordCardProps {
  word: Word;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}

export function WordCard({ word, onSwipeLeft, onSwipeRight }: WordCardProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        onSwipeLeft();
      } else if (e.key === 'ArrowRight') {
        onSwipeRight();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSwipeLeft, onSwipeRight]);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startPos.x;
    const deltaY = e.clientY - startPos.y;
    setPosition({ x: deltaX, y: deltaY });
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // Check if swipe threshold is met
    const threshold = 100;
    if (Math.abs(position.x) > threshold) {
      if (position.x > 0) {
        onSwipeRight();
      } else {
        onSwipeLeft();
      }
    }

    // Reset position
    setPosition({ x: 0, y: 0 });
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setStartPos({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - startPos.x;
    const deltaY = touch.clientY - startPos.y;
    setPosition({ x: deltaX, y: deltaY });
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = 100;
    if (Math.abs(position.x) > threshold) {
      if (position.x > 0) {
        onSwipeRight();
      } else {
        onSwipeLeft();
      }
    }

    setPosition({ x: 0, y: 0 });
  };

  const rotation = position.x * 0.1;
  const opacity = 1 - Math.abs(position.x) / 500;

  return (
    <div
      ref={cardRef}
      className="word-card"
      style={{
        transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg)`,
        opacity: Math.max(0.3, opacity),
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="word-card-content">
        <h2 className="word-text">{word.text}</h2>
        {word.exampleEn && (
          <p className="word-example">{word.exampleEn}</p>
        )}
        {word.level && (
          <span className="word-level">{word.level}</span>
        )}
      </div>
      <div className="word-card-hint">
        <span className="hint-left">← Don't know</span>
        <span className="hint-right">Know →</span>
      </div>
    </div>
  );
}

