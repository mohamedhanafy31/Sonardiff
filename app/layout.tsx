import './globals.css'

export const metadata = {
  title: 'SonarDiff',
  description: 'Never lose deals because your competitor changed pricing.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
