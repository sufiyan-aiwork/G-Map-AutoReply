import React from 'react';
import { Star } from 'lucide-react';

export default function StarRating({ rating = 5, size = 18, interactive = false, onRatingChange = null }) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center space-x-1">
      {stars.map((star) => {
        const isFilled = star <= rating;
        return (
          <button
            type="button"
            key={star}
            disabled={!interactive}
            onClick={() => interactive && onRatingChange && onRatingChange(star)}
            className={`${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'} focus:outline-none`}
            title={`${star} Star${star > 1 ? 's' : ''}`}
          >
            <Star
              size={size}
              className={`${
                isFilled
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-slate-300 stroke-slate-300'
              } transition-colors`}
            />
          </button>
        );
      })}
    </div>
  );
}
