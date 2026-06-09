import React from 'react'

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin text-current ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

export function Waveform() {
  return (
    <div className="flex items-end justify-center gap-0.75 h-4 w-6">
      <div className="w-[3px] bg-current rounded-full h-2 animate-[bounce_0.8s_infinite]" style={{ animationDelay: '0.1s' }} />
      <div className="w-[3px] bg-current rounded-full h-4 animate-[bounce_0.8s_infinite]" style={{ animationDelay: '0.2s' }} />
      <div className="w-[3px] bg-current rounded-full h-3 animate-[bounce_0.8s_infinite]" style={{ animationDelay: '0.3s' }} />
      <div className="w-[3px] bg-current rounded-full h-5 animate-[bounce_0.8s_infinite]" style={{ animationDelay: '0.4s' }} />
      <div className="w-[3px] bg-current rounded-full h-2 animate-[bounce_0.8s_infinite]" style={{ animationDelay: '0.5s' }} />
    </div>
  )
}

export default Spinner
