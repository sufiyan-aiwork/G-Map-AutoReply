import React from 'react';
import { Star } from 'lucide-react';

export default function StarRating({ rating = 5, size = 18, interactive = false, onRatingChange = null }) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <div
      className="inline-flex items-center space-x-1"
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={`Rating: ${rating} out of 5 stars`}
    >
      {stars.map((star) => {
        const isFilled = star <= rating;
        return (
          <button
            type="button"
            key={star}
            disabled={!interactive}
            role={interactive ? 'radio' : undefined}
            aria-checked={interactive ? isFilled && star === rating : undefined}
            aria-label={`${star} Star${star > 1 ? 's' : ''}`}
            onClick={() => interactive && onRatingChange && onRatingChange(star)}
            className={`rounded ${
              interactive
                ? 'cursor-pointer hover:scale-110 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
                : 'cursor-default focus:outline-none'
            }`}
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
