import logoUrl from '../assets/logo-cmpc.svg';

interface LogoProps {
  /**
   * Tailwind classes for the height (`h-8`). The width is never set: the image
   * keeps the 191.961 × 76.608 proportion of the original file on its own.
   */
  className?: string;
}

/**
 * The CMPC logo. The `width` and `height` attributes are the size of the
 * original and let the browser reserve the space before the file loads; CSS
 * (`w-auto` with the height from `className`) then scales it without distortion.
 */
export function Logo({ className = '' }: LogoProps) {
  return (
    <img
      src={logoUrl}
      alt="CMPC Libros"
      width={192}
      height={77}
      className={`w-auto ${className}`.trim()}
    />
  );
}
