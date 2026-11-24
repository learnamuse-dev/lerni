import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  Sprout,
  BookOpenText,
  CalendarCheck,
  Timer,
  MoreHorizontal,
  Settings,
  Check,
  Dices,
  HeartHandshake,
  Briefcase,
  GraduationCap,
} from 'lucide-react';
import { soundEngine } from '../utils/audioSynth';
import {
  ActiveSection,
  NavSection,
  DEFAULT_NAV_ORDER,
  EnergyLevel,
  SensoryState,
  ENERGY_LEVELS,
} from '../types';
import { useI18n } from '../utils/i18n';

export type { ActiveSection };

interface NavigationProps {
  activeSection: ActiveSection;
  onChangeSection: (section: ActiveSection) => void;
  onOpenSettings?: () => void;
  isFocusRunning?: boolean;
  navOrder?: NavSection[];
  currentEnergy?: EnergyLevel;
  sensoryState?: SensoryState;
  onOpenStatus?: () => void;
  onOpenParalysisBuster?: () => void;
  onOpenGrounding?: () => void;
}

const SECTION_ICONS: Record<NavSection, React.ReactNode> = {
  planner: <CalendarCheck className="w-5 h-5" />,
  journal: <BookOpenText className="w-5 h-5" />,
  habits: <Sprout className="w-5 h-5" />,
  focus: <Timer className="w-5 h-5" />,
  work: <Briefcase className="w-5 h-5" />,
  study: <GraduationCap className="w-5 h-5" />,
  braindump: <Brain className="w-5 h-5" />,
};

export const Navigation: React.FC<NavigationProps> = ({
  activeSection,
  onChangeSection,
  onOpenSettings,
  isFocusRunning = false,
  navOrder = DEFAULT_NAV_ORDER,
  currentEnergy = 'medium',
  sensoryState = 'balanced',
  onOpenStatus,
  onOpenParalysisBuster,
  onOpenGrounding,
}) => {
  const { t, isRtl } = useI18n();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [desktopMenuPos, setDesktopMenuPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const railMoreBtnRef = useRef<HTMLButtonElement | null>(null);

  const currentOrder =
    navOrder && navOrder.length >= DEFAULT_NAV_ORDER.length
      ? navOrder
      : DEFAULT_NAV_ORDER;
  const primaryOrder = currentOrder.slice(0, 4);
  const overflowSectionIds = currentOrder.slice(4);

  const primarySections = primaryOrder.map((secId) => ({
    id: secId,
    label: t(`nav.${secId}`, secId),
    icon: SECTION_ICONS[secId] || <Brain className="w-5 h-5" />,
    isPulsing: secId === 'focus' ? isFocusRunning : false,
  }));

  const overflowSections = overflowSectionIds.map((secId) => ({
    id: secId,
    label: t(`nav.${secId}`, secId),
    icon: SECTION_ICONS[secId] || <Brain className="w-5 h-5" />,
    isPulsing: secId === 'focus' ? isFocusRunning : false,
  }));

  const isAnyOverflowPulsing = overflowSections.some((s) => s.isPulsing);
  const isMoreActive =
    overflowSectionIds.includes(activeSection as NavSection) ||
    activeSection === 'settings';

  const currentEnergyMeta = ENERGY_LEVELS.find((l) => l.id === currentEnergy) || ENERGY_LEVELS[1];
  const currentEnergyName =
    currentEnergy === 'low'
      ? t('header.lowEnergy', 'Low Energy')
      : currentEnergy === 'high'
      ? t('header.highEnergy', 'High Energy')
      : t('header.medEnergy', 'Medium Energy');

  const handleSelect = (secId: ActiveSection) => {
    soundEngine.playPop();
    setIsMoreOpen(false);
    if (secId === 'settings' && onOpenSettings) {
      onOpenSettings();
    } else {
      onChangeSection(secId);
    }
  };

  const handleTriggerTool = (cb?: () => void) => {
    soundEngine.playPop();
    setIsMoreOpen(false);
    cb?.();
  };

  const updateDesktopMenuAnchor = () => {
    if (!railMoreBtnRef.current) return;
    const rect = railMoreBtnRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const estimatedHeight = Math.min(viewportHeight - 32, 270 + (overflowSections.length + 1) * 50);
    const top = Math.min(Math.max(rect.top - 40, 16), Math.max(16, viewportHeight - estimatedHeight - 16));
    if (isRtl) {
      setDesktopMenuPos({ top, right: window.innerWidth - rect.left + 12 });
    } else {
      setDesktopMenuPos({ top, left: rect.right + 12 });
    }
  };

  const handleToggleMore = (fromDesktopRail: boolean) => {
    soundEngine.playPop();
    if (!isMoreOpen && fromDesktopRail) {
      updateDesktopMenuAnchor();
    } else if (!fromDesktopRail) {
      setDesktopMenuPos(null);
    }
    setIsMoreOpen((prev) => !prev);
  };

  // Close More menu on Escape or viewport resize
  useEffect(() => {
    if (!isMoreOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMoreOpen(false);
      }
    };
    const handleResize = () => {
      if (window.innerWidth >= 768 && desktopMenuPos) {
        updateDesktopMenuAnchor();
      } else if (window.innerWidth < 768 && desktopMenuPos) {
        setDesktopMenuPos(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [isMoreOpen, desktopMenuPos, isRtl]);

  const moreNavItems: Array<{
    id: ActiveSection;
    label: string;
    icon: React.ReactNode;
    isPulsing?: boolean;
  }> = [
    ...overflowSections.map((sec) => ({
      id: sec.id as ActiveSection,
      label: sec.label,
      icon: sec.icon,
      isPulsing: sec.isPulsing,
    })),
    {
      id: 'settings',
      label: t('nav.settings', 'Settings'),
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  const moreToolItems: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
  }> = [
    {
      id: 'energy',
      label: `${t('header.energy', 'Energy')} · ${currentEnergyName}`,
      icon: <span className="text-lg leading-none">{currentEnergyMeta.icon}</span>,
      onClick: () => handleTriggerTool(onOpenStatus),
    },
    {
      id: 'paralysis',
      label: t('header.paralysisBuster', 'Paralysis Buster'),
      icon: <Dices className="w-5 h-5" />,
      onClick: () => handleTriggerTool(onOpenParalysisBuster),
    },
    {
      id: 'grounding',
      label: t('header.sensoryReset', 'Sensory Reset'),
      icon: <HeartHandshake className="w-5 h-5" />,
      onClick: () => handleTriggerTool(onOpenGrounding),
    },
  ];

  return (
    <>
      {/* =========================================================================
          1. Desktop Navigation Rail (md and up)
         ========================================================================= */}
      <aside
        id="desktop-navigation-rail"
        aria-label="Desktop Navigation Rail"
        className="hidden md:flex flex-col items-center justify-between sticky top-0 h-screen w-20 lg:w-24 shrink-0 py-6 px-2 border-r rtl:border-r-0 rtl:border-l border-[#D8E8D0] dark:border-[#22301F] bg-[#EDF6E8]/40 dark:bg-[#162014]/40 backdrop-blur-xs select-none z-20 transition-colors"
      >
        <div className="flex flex-col items-center gap-4 w-full">
          {primarySections.map((sec) => {
            const isActive = activeSection === sec.id;
            return (
              <button
                id={`rail-nav-tab-${sec.id}`}
                key={`rail-${sec.id}`}
                type="button"
                onClick={() => handleSelect(sec.id)}
                className="group relative flex flex-col items-center justify-center w-full py-2 px-1 rounded-2xl transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80D141] cursor-pointer"
              >
                <div className="relative w-14 lg:w-16 h-8 flex items-center justify-center rounded-full transition-all">
                  {isActive && (
                    <motion.div
                      layoutId="m3-rail-active-pill"
                      className="absolute inset-0 rounded-full bg-[#80D141] shadow-xs"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}

                  <div
                    className={`relative z-10 transition-transform duration-200 group-hover:scale-110 ${
                      isActive
                        ? 'text-[#0F2600] font-bold'
                        : 'text-[#485B44] dark:text-[#9EB598] group-hover:text-[#151E14] dark:group-hover:text-[#E8F2E4]'
                    }`}
                  >
                    {sec.icon}
                  </div>

                  {sec.isPulsing && (
                    <span className="absolute -top-0.5 -right-0.5 z-20 w-2.5 h-2.5 rounded-full bg-[#80D141] animate-ping" />
                  )}
                </div>

                <span
                  className={`mt-1 text-[11px] font-bold tracking-tight transition-colors text-center whitespace-nowrap ${
                    isActive
                      ? 'text-[#151E14] dark:text-[#E8F2E4]'
                      : 'text-[#485B44] dark:text-[#9EB598] group-hover:text-[#151E14] dark:group-hover:text-[#E8F2E4]'
                  }`}
                >
                  {sec.label}
                </span>
              </button>
            );
          })}

          {/* 5th Item: More */}
          <button
            ref={railMoreBtnRef}
            id="rail-nav-tab-more"
            type="button"
            aria-expanded={isMoreOpen}
            aria-haspopup="menu"
            onClick={() => handleToggleMore(true)}
            className="group relative flex flex-col items-center justify-center w-full py-2 px-1 rounded-2xl transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80D141] cursor-pointer"
          >
            <div className="relative w-14 lg:w-16 h-8 flex items-center justify-center rounded-full transition-all">
              {isMoreActive && (
                <motion.div
                  layoutId="m3-rail-active-pill"
                  className="absolute inset-0 rounded-full bg-[#80D141] shadow-xs"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}

              <div
                className={`relative z-10 transition-transform duration-200 group-hover:scale-110 ${
                  isMoreActive
                    ? 'text-[#0F2600] font-bold'
                    : isMoreOpen
                    ? 'text-[#151E14] dark:text-[#E8F2E4]'
                    : 'text-[#485B44] dark:text-[#9EB598] group-hover:text-[#151E14] dark:group-hover:text-[#E8F2E4]'
                }`}
              >
                <MoreHorizontal className="w-5 h-5" />
              </div>

              {isAnyOverflowPulsing && (
                <span className="absolute -top-0.5 -right-0.5 z-20 w-2.5 h-2.5 rounded-full bg-[#80D141] animate-ping" />
              )}
            </div>

            <span
              className={`mt-1 text-[11px] font-bold tracking-tight transition-colors text-center whitespace-nowrap ${
                isMoreActive || isMoreOpen
                  ? 'text-[#151E14] dark:text-[#E8F2E4]'
                  : 'text-[#485B44] dark:text-[#9EB598] group-hover:text-[#151E14] dark:group-hover:text-[#E8F2E4]'
              }`}
            >
              {t('nav.more', 'More')}
            </span>
          </button>
        </div>
      </aside>

      {/* =========================================================================
          2. Mobile Bottom Navigation Bar (below md)
         ========================================================================= */}
      <div id="mobile-navigation-wrapper" className="md:hidden fixed bottom-0 inset-x-0 z-20 w-full">
        <nav
          id="m3-mobile-navigation-bar"
          aria-label="Mobile Navigation"
          className="pointer-events-auto w-full bg-[#EDF6E8]/98 dark:bg-[#162014]/98 backdrop-blur-xl border-t border-[#D8E8D0] dark:border-[#22301F] shadow-[0_-4px_24px_rgba(0,0,0,0.07)] px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] flex items-center justify-around gap-1"
        >
          {primarySections.map((sec) => {
            const isActive = activeSection === sec.id;
            return (
              <button
                id={`mobile-nav-tab-${sec.id}`}
                key={`mobile-${sec.id}`}
                type="button"
                onClick={() => handleSelect(sec.id)}
                className="group relative flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-2xl transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80D141] cursor-pointer"
              >
                <div className="relative w-14 h-8 flex items-center justify-center rounded-full transition-all">
                  {isActive && (
                    <motion.div
                      layoutId="m3-mobile-active-pill"
                      className="absolute inset-0 rounded-full bg-[#80D141] shadow-xs"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}

                  <div
                    className={`relative z-10 transition-transform duration-200 group-hover:scale-110 ${
                      isActive
                        ? 'text-[#0F2600] font-bold'
                        : 'text-[#485B44] dark:text-[#9EB598] group-hover:text-[#151E14] dark:group-hover:text-[#E8F2E4]'
                    }`}
                  >
                    {sec.icon}
                  </div>

                  {sec.isPulsing && (
                    <span className="absolute -top-0.5 -right-0.5 z-20 w-2.5 h-2.5 rounded-full bg-[#80D141] animate-ping" />
                  )}
                </div>

                <span
                  className={`mt-1 text-[11px] font-bold tracking-tight transition-colors truncate max-w-[80px] text-center ${
                    isActive
                      ? 'text-[#151E14] dark:text-[#E8F2E4]'
                      : 'text-[#485B44] dark:text-[#9EB598] group-hover:text-[#151E14] dark:group-hover:text-[#E8F2E4]'
                  }`}
                >
                  {sec.label}
                </span>
              </button>
            );
          })}

          {/* 5th Item: More */}
          <button
            id="mobile-nav-tab-more"
            type="button"
            aria-expanded={isMoreOpen}
            aria-haspopup="menu"
            onClick={() => handleToggleMore(false)}
            className="group relative flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-2xl transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80D141] cursor-pointer"
          >
            <div className="relative w-14 h-8 flex items-center justify-center rounded-full transition-all">
              {isMoreActive && (
                <motion.div
                  layoutId="m3-mobile-active-pill"
                  className="absolute inset-0 rounded-full bg-[#80D141] shadow-xs"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}

              <div
                className={`relative z-10 transition-transform duration-200 group-hover:scale-110 ${
                  isMoreActive
                    ? 'text-[#0F2600] font-bold'
                    : isMoreOpen
                    ? 'text-[#151E14] dark:text-[#E8F2E4]'
                    : 'text-[#485B44] dark:text-[#9EB598] group-hover:text-[#151E14] dark:group-hover:text-[#E8F2E4]'
                }`}
              >
                <MoreHorizontal className="w-5 h-5" />
              </div>

              {isAnyOverflowPulsing && (
                <span className="absolute -top-0.5 -right-0.5 z-20 w-2.5 h-2.5 rounded-full bg-[#80D141] animate-ping" />
              )}
            </div>

            <span
              className={`mt-1 text-[11px] font-bold tracking-tight transition-colors truncate max-w-[80px] text-center ${
                isMoreActive || isMoreOpen
                  ? 'text-[#151E14] dark:text-[#E8F2E4]'
                  : 'text-[#485B44] dark:text-[#9EB598] group-hover:text-[#151E14] dark:group-hover:text-[#E8F2E4]'
              }`}
            >
              {t('nav.more', 'More')}
            </span>
          </button>
        </nav>
      </div>

      {/* =========================================================================
          3. "More" Menu Overlay (Desktop Flyout Popover / Mobile Bottom Sheet)
         ========================================================================= */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isMoreOpen && (
              <div
                dir={isRtl ? 'rtl' : 'ltr'}
                className="fixed inset-0 z-50 text-start"
              >
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  onClick={() => setIsMoreOpen(false)}
                  className="fixed inset-0 bg-black/35 md:bg-black/10 backdrop-blur-[2px] md:backdrop-blur-none"
                />

                {/* Desktop Popover Anchored Next to Rail "More" Tab */}
                {desktopMenuPos && (
                  <motion.div
                    id="desktop-more-menu"
                    role="menu"
                    aria-label={t('nav.moreTitle', 'More')}
                    initial={{ opacity: 0, scale: 0.96, x: isRtl ? 8 : -8 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.96, x: isRtl ? 8 : -8 }}
                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      top: desktopMenuPos.top,
                      left: desktopMenuPos.left,
                      right: desktopMenuPos.right,
                    }}
                    className="hidden md:block fixed w-80 max-h-[calc(100vh-32px)] overflow-y-auto rounded-2xl bg-white dark:bg-[#192417] border border-[#DCEAD4] dark:border-[#2A3E26] shadow-xl p-2 z-50"
                  >
                    {/* Section Navigation Group */}
                    <div className="px-3 py-1.5 text-[11px] font-bold text-[#5A7055] dark:text-[#8DA787]">
                      {t('more.sectionNav', 'Navigation')}
                    </div>

                    <div className="space-y-1">
                      {moreNavItems.map((item) => {
                        const isSelected = activeSection === item.id;
                        return (
                          <button
                            key={`desktop-more-${item.id}`}
                            id={`more-menu-item-${item.id}`}
                            type="button"
                            role="menuitem"
                            onClick={() => handleSelect(item.id)}
                            className={`w-full min-h-[46px] px-3 py-2 rounded-xl flex items-center gap-3 text-start transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80D141] ${
                              isSelected
                                ? 'bg-[#E8F8D8] dark:bg-[#1E3800] text-[#151E14] dark:text-[#E8F2E4]'
                                : 'hover:bg-[#F3F8EF] dark:hover:bg-[#22301F] text-[#151E14] dark:text-[#E8F2E4]'
                            }`}
                          >
                            <div
                              className={`relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-[#80D141] text-[#0F2600]'
                                  : 'bg-[#EDF6E8] dark:bg-[#22301F] text-[#3B4E37] dark:text-[#9EB598]'
                              }`}
                            >
                              {item.icon}
                              {item.isPulsing && (
                                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#80D141] animate-ping" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold truncate">{item.label}</div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-[#3B7E10] dark:text-[#80D141] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Check-in & Quick Support Tools Group */}
                    <div className="mt-2 pt-2 border-t border-[#DCEAD4] dark:border-[#273722]">
                      <div className="px-3 py-1 text-[11px] font-bold text-[#5A7055] dark:text-[#8DA787]">
                        {t('more.sectionTools', 'Check-in & Tools')}
                      </div>

                      <div className="space-y-1">
                        {moreToolItems.map((tool) => (
                          <button
                            key={`desktop-tool-${tool.id}`}
                            id={`more-menu-item-${tool.id}`}
                            type="button"
                            role="menuitem"
                            onClick={tool.onClick}
                            className="w-full min-h-[46px] px-3 py-2 rounded-xl flex items-center gap-3 text-start transition-colors hover:bg-[#F3F8EF] dark:hover:bg-[#22301F] text-[#151E14] dark:text-[#E8F2E4] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80D141]"
                          >
                            <div className="w-9 h-9 rounded-xl bg-[#EDF6E8] dark:bg-[#22301F] text-[#3B4E37] dark:text-[#9EB598] flex items-center justify-center shrink-0">
                              {tool.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold truncate">{tool.label}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Mobile Bottom Sheet Drawer */}
                <motion.div
                  id="mobile-more-sheet"
                  role="menu"
                  aria-label={t('nav.moreTitle', 'More')}
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 30, stiffness: 320 }}
                  className="md:hidden fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-[#F8FAF5] dark:bg-[#182316] border-t border-[#DCEAD4] dark:border-[#2A3E26] shadow-2xl px-4 pt-2.5 pb-[max(env(safe-area-inset-bottom),1.25rem)] space-y-4"
                >
                  {/* Drag Handle */}
                  <div className="w-10 h-1.5 rounded-full bg-[#CBDAC4] dark:bg-[#32462E] mx-auto" />

                  {/* Navigation Group */}
                  <div className="space-y-2">
                    <div className="px-1 text-xs font-bold text-[#5A7055] dark:text-[#8DA787]">
                      {t('more.sectionNav', 'Navigation')}
                    </div>

                    <div className="space-y-2">
                      {moreNavItems.map((item) => {
                        const isSelected = activeSection === item.id;
                        return (
                          <button
                            key={`mobile-more-${item.id}`}
                            id={`mobile-more-item-${item.id}`}
                            type="button"
                            role="menuitem"
                            onClick={() => handleSelect(item.id)}
                            className={`w-full min-h-[52px] px-3.5 py-2.5 rounded-2xl border flex items-center gap-3.5 text-start transition-all active:scale-[0.99] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80D141] ${
                              isSelected
                                ? 'bg-[#E8F8D8] dark:bg-[#1E3800] border-[#80D141] text-[#151E14] dark:text-[#E8F2E4]'
                                : 'bg-white dark:bg-[#1E2B1A] border-[#DCEAD4] dark:border-[#273722] text-[#151E14] dark:text-[#E8F2E4]'
                            }`}
                          >
                            <div
                              className={`relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-[#80D141] text-[#0F2600]'
                                  : 'bg-[#EDF6E8] dark:bg-[#243421] text-[#3B4E37] dark:text-[#9EB598]'
                              }`}
                            >
                              {item.icon}
                              {item.isPulsing && (
                                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#80D141] animate-ping" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold truncate">{item.label}</div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-[#3B7E10] dark:text-[#80D141] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Check-in & Support Tools Group */}
                  <div className="space-y-2 pt-3 border-t border-[#DCEAD4] dark:border-[#273722]">
                    <div className="px-1 text-xs font-bold text-[#5A7055] dark:text-[#8DA787]">
                      {t('more.sectionTools', 'Check-in & Tools')}
                    </div>

                    <div className="space-y-2">
                      {moreToolItems.map((tool) => (
                        <button
                          key={`mobile-tool-${tool.id}`}
                          id={`mobile-more-item-${tool.id}`}
                          type="button"
                          role="menuitem"
                          onClick={tool.onClick}
                          className="w-full min-h-[52px] px-3.5 py-2.5 rounded-2xl border bg-white dark:bg-[#1E2B1A] border-[#DCEAD4] dark:border-[#273722] text-[#151E14] dark:text-[#E8F2E4] flex items-center gap-3.5 text-start transition-all active:scale-[0.99] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80D141]"
                        >
                          <div className="w-10 h-10 rounded-xl bg-[#EDF6E8] dark:bg-[#243421] text-[#3B4E37] dark:text-[#9EB598] flex items-center justify-center shrink-0">
                            {tool.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold truncate">{tool.label}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};
