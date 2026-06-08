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
  IconLayoutDashboard,
  IconPrinter,
  IconShieldCheck,
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

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { hasPermission } = useAuthStore()

  const sections: NavSection[] = [
    {
      title: 'Рабочий стол',
      items: [
        {
          to: '/',
          label: 'Главная',
          icon: <IconLayoutDashboard size={16} />,
        },
        {
          to: '/print-center',
          label: 'Документы',
          icon: <IconPrinter size={16} />,
        },
        {
          to: '/verify',
          label: 'Проверка подлинности',
          icon: <IconShieldCheck size={16} />,
        },
      ],
    },
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
    <>
      <button
        className={`sidebar-backdrop${open ? ' is-open' : ''}`}
        onClick={onClose}
        aria-label="Закрыть меню"
      />
      <nav className={`app-sidebar${open ? ' is-open' : ''}`} aria-label="Основная навигация">
      <div className="sidebar-caption">
        <strong>Рабочие разделы</strong>
        <span>Доступ определяется вашей ролью</span>
      </div>
      {sections.map((section) => {
        const visibleItems = section.items.filter(
          (item) => !item.permission || hasPermission(item.permission)
        )
        if (visibleItems.length === 0) return null

        return (
          <div key={section.title} className="sidebar-section">
            <div className="sidebar-section-title">
              {section.title}
            </div>
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onClose}
                className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}
              >
                <span className="sidebar-link-icon">{item.icon}</span>
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
              </NavLink>
            ))}
          </div>
        )
      })}
      <div className="sidebar-disclaimer">
        <strong>Пельагрия</strong>
        <span>Игровой служебный портал Minecraft RP</span>
      </div>
      </nav>
    </>
  )
}
