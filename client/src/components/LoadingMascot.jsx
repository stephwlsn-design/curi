const SIZES = {
  md: 'w-28 h-28',
  lg: 'w-40 h-40',
  xl: 'w-52 h-52',
};

export default function LoadingMascot({ size = 'xl', className = '' }) {
  return (
    <img
      src="/images/curi-mascot.png"
      alt=""
      className={`${SIZES[size] || SIZES.xl} mx-auto object-contain animate-float drop-shadow-clay ${className}`}
    />
  );
}
