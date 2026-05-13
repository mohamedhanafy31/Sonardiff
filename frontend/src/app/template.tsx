'use client';

/**
 * Next.js Template component. Unlike layouts, templates create a new instance 
 * for each child on navigation. This allows us to trigger entry animations 
 * every time the user moves between pages.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-[fade-in-blur_0.4s_cubic-bezier(0.16,1,0.3,1)]">
      {children}
    </div>
  );
}
