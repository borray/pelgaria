import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  IconUsers,
  IconId,
  IconScale,
  IconGavel,
  IconAlertTriangle,
  IconCurrencyDollar,
  IconBuildingBank,
  IconBuilding,
  IconMap,
  IconGlobe,
  IconMessageCircle,
  IconUserCog,
  IconShield,
} from '@tabler/icons-react'
import { useAuthStore } from '../../store/auth'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  permission?: string
  badge?: number
}

interface NavSection {
  title: string
  items: NavItem[]
}

export function Sidebar() {
  const { hasPermission } = useAuthStore()

  const sections: NavSection[] = [
    {
      title: 'Реестр',
      items: [
        {
          to: '/citizens',
          label: 'Граждане',
          icon: <IconUsers size={16} />,
          permission: 'citizens.view',
        },
        {
          to: '/passports',
          label: 'Паспорта',
          icon: <IconId size={16} />,
          permission: 'passports.view',
        },
      ],
    },
    {
      title: 'Законодательство',
      items: [
        {
          to: '/laws',
          label: 'Законодательство',
          icon: <IconScale size={16} />,
          permission: 'laws.view',
        },
      ],
    },
    {
      title: 'Правопорядок',
      items: [
        {
          to: '/cases',
          label: 'Дела',
          icon: <IconGavel size={16} />,
          permission: 'cases.view',
        },
        {
          to: '/punishments',
          label: 'Наказания',
          icon: <IconAlertTriangle size={16} />,
          permission: 'punishments.view',
        },
      ],
    },
    {
      title: 'Экономика',
      items: [
        {
          to: '/taxes',
          label: 'Налоги',
          icon: <IconCurrencyDollar size={16} />,
          permission: 'taxes.view',
        },
        {
          to: '/treasury',
          label: 'Казна',
          icon: <IconBuildingBank size={16} />,
          permission: 'treasury.view',
        },
      ],
    },
    {
      title: 'Инфраструктура',
      items: [
        {
          to: '/buildings',
          label: 'РЕЛИКТ',
          icon: <IconBuilding size={16} />,
          permission: 'relict.view',
        },
        {
          to: '/territories',
          label: 'Территории',
          icon: <IconMap size={16} />,
          permission: 'territories.view',
        },
      ],
    },
    {
      title: 'Дипломатия',
      items: [
        {
          to: '/diplomacy',
          label: 'Дипломатия',
          icon: <IconGlobe size={16} />,
          permission: 'diplomacy.view',
        },
      ],
    },
    {
      title: 'Общение',
      items: [
        {
          to: '/chat',
          label: 'Чат',
          icon: <IconMessageCircle size={16} />,
          permission: 'chat.send',
        },
      ],
    },
    {
      title: 'Система',
      items: [
        {
          to: '/accounts',
          label: 'Аккаунты',
          icon: <IconUserCog size={16} />,
          permission: 'accounts.manage',
        },
        {
          to: '/roles',
          label: 'Роли',
          icon: <IconShield size={16} />,
          permission: 'roles.manage',
        },
      ],
    },
  ]

  return (
    <nav
      style={{
        width: '240px',
        background: '#0D1E35',
        flexShrink: 0,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        padding: '8px 0',
      }}
    >
      {sections.map((section) => {
        const visibleItems = section.items.filter(
          (item) => !item.permission || hasPermission(item.permission)
        )
        if (visibleItems.length === 0) return null

        return (
          <div key={section.title} style={{ marginBottom: '4px' }}>
            <div
              style={{
                padding: '8px 16px 4px',
                fontSize: '10px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {section.title}
            </div>
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px 8px 13px',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.6)',
                  background: isActive ? 'rgba(59,130,246,0.18)' : 'transparent',
                  borderLeft: isActive ? '3px solid #3B82F6' : '3px solid transparent',
                  margin: '0 8px 0 0',
                  borderRadius: '0 4px 4px 0',
                  transition: 'background 0.15s ease, color 0.15s ease',
                })}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement
                  if (!el.getAttribute('aria-current')) {
                    el.style.background = 'rgba(255,255,255,0.07)'
                  }
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement
                  if (!el.getAttribute('aria-current')) {
                    el.style.background = 'transparent'
                  }
                }}
              >
                {({ isActive }) => (
                  <>
                    <span style={{ color: isActive ? '#3B82F6' : 'rgba(255,255,255,0.5)' }}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        style={{
                          marginLeft: 'auto',
                          background: '#DC2626',
                          color: '#FFFFFF',
                          borderRadius: '10px',
                          padding: '1px 6px',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        )
      })}
    </nav>
  )
}
