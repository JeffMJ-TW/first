
import React from 'react';

interface StampCircleProps {
  isStamped: boolean;
  emoji: string;
  index: number;
}

const StampCircle: React.FC<StampCircleProps> = ({ isStamped, emoji, index }) => {
  return (
    <div className="relative group">
      <div className={`
        w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-dashed flex items-center justify-center
        transition-all duration-300
        ${isStamped ? 'border-transparent bg-white shadow-lg' : 'border-gray-300 bg-gray-50/50'}
      `}>
        {isStamped ? (
          <span className="text-3xl md:text-4xl stamp-pop select-none">
            {emoji}
          </span>
        ) : (
          <span className="text-gray-300 font-bold text-lg">{index + 1}</span>
        )}
      </div>
      {isStamped && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default StampCircle;
