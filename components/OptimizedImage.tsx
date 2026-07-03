import React from 'react';
import { getImageVariantUrl } from '../services/cloudinary';

type OptimizedImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  variant?: 'avatar' | 'card' | 'gallery' | 'hero' | 'full';
};

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  variant = 'card',
  loading = 'lazy',
  decoding = 'async',
  ...props
}) => {
  const optimizedSrc = src ? getImageVariantUrl(src, variant) : undefined;

  return (
    <img
      {...props}
      src={optimizedSrc}
      loading={loading}
      decoding={decoding}
    />
  );
};

export default OptimizedImage;
