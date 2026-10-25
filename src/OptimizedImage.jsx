import { forwardRef } from "react";

export const OptimizedImage = forwardRef(function OptimizedImage({
  src,
  alt = "",
  sizes = "100vw",
  breakpoints,
  quality = 80,
  priority = false,
  loading,
  decoding,
  ...props
}, ref) {
  // Protected URLs redirect to a short-lived Supabase download URL. CORS keeps
  // the wardrobe editor's canvas color sampler usable after that redirect.
  return <img ref={ref} src={src} crossOrigin={src?.startsWith('/api/') ? 'anonymous' : undefined} alt={alt} sizes={sizes} loading={loading || (priority ? 'eager' : 'lazy')} decoding={decoding || 'async'} {...props} />;
});
