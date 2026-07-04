import React, { useEffect, useMemo, useState } from 'react';
import { getImageVariantUrl } from '../services/cloudinary';
import { cacheImageFromUrl, getCachedImageObjectUrl } from '../utils/indexedDbCache';

type OptimizedImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  variant?: 'avatar' | 'card' | 'gallery' | 'hero' | 'full';
};

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  variant = 'card',
  loading = 'lazy',
  decoding = 'async',
  onLoad,
  ...props
}) => {
  const optimizedSrc = useMemo(() => src ? getImageVariantUrl(src, variant) : undefined, [src, variant]);
  const [displaySrc, setDisplaySrc] = useState<string | undefined>(optimizedSrc);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    setDisplaySrc(optimizedSrc);

    if (!optimizedSrc) return undefined;

    getCachedImageObjectUrl(optimizedSrc).then((cachedUrl) => {
      if (!active || !cachedUrl) {
        if (cachedUrl) URL.revokeObjectURL(cachedUrl);
        return;
      }

      objectUrl = cachedUrl;
      setDisplaySrc(cachedUrl);
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [optimizedSrc]);

  const handleLoad: React.ReactEventHandler<HTMLImageElement> = (event) => {
    if (optimizedSrc && displaySrc === optimizedSrc && !optimizedSrc.startsWith('data:')) {
      cacheImageFromUrl(optimizedSrc).catch(() => {});
    }

    onLoad?.(event);
  };

  return (
    <img
      {...props}
      src={displaySrc}
      loading={loading}
      decoding={decoding}
      onLoad={handleLoad}
    />
  );
};

export default OptimizedImage;
