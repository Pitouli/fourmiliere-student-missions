type BrandLogoProps = {
  className?: string
}

export function BrandLogo({ className = '' }: BrandLogoProps) {
  return (
    <div className={`inline-flex items-center justify-center shrink-0 ${className}`}>
      <img src="/icon.svg" alt="Brindille" className="h-full w-full object-contain" />
    </div>
  )
}
