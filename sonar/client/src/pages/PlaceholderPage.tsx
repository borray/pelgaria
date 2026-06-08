import { Card } from '../components/ui/Card'

interface PlaceholderPageProps {
  title: string
  description?: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      <h1
        style={{
          margin: '0 0 20px 0',
          fontSize: '20px',
          fontWeight: 600,
          color: '#18211D',
        }}
      >
        {title}
      </h1>
      <Card>
        <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>
          {description ?? 'Раздел находится в разработке.'}
        </p>
      </Card>
    </div>
  )
}
