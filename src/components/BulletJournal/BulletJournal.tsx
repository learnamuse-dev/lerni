import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
  BookOpenText, 
  Plus, 
  Sparkles, 
  Check, 
  ArrowRight, 
  Star, 
  Calendar as CalendarIcon, 
  FileText, 
  CheckSquare, 
  Zap, 
  Trash2, 
  Pencil,
  Play, 
  Filter, 
  RefreshCw,
  Clock,
  Heart,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  X,
  Eye,
  EyeOff,
  Briefcase,
  GraduationCap
} from 'lucide-react';
import { BujoEntry, BujoType, BujoStatus, EnergyLevel, ENERGY_LEVELS, JournalCardFields, DEFAULT_JOURNAL_CARD_FIELDS, UserPreferences, SpaceItem, WorkStudySpace } from '../../types';
import { storage } from '../../utils/storage';
import { soundEngine } from '../../utils/audioSynth';
import { 
  getTodayKey, 
  shiftDate, 
  formatDateDisplay, 
  getRelativeDayLabel 
} from '../../utils/dateUtils';
import { useI18n, getCategoryLabel, getEnergyLabel, toPersianDigits, formatMinutes } from '../../utils/i18n';
import { JournalCalendar } from './JournalCalendar';
import { AddBujoModal } from './AddBujoModal';
import { EditBujoModal } from './EditBujoModal';
import { MigrateOverdueModal } from './MigrateOverdueModal';
import { UnstickModal, getLocalizedTaskTitle } from '../UnstickModal';
import { MaterialExpressiveDatePicker } from '../common/MaterialExpressiveDatePicker';
import { AddEntryModeChooser } from '../common/AddEntryModeChooser';
import { VoiceEntryModal } from '../common/VoiceEntryModal';

interface BulletJournalProps {
  entries: BujoEntry[];
  onUpdateEntries: (entries: BujoEntry[]) => void;
  onSendToFocusTimer: (taskTitle: string, minutes: number) => void;
  currentEnergy: EnergyLevel;
  categories?: string[];
  onOpenSettings?: () => void;
  hasApiKey?: boolean;
  cardFields?: JournalCardFields;
  onUpdateCardFields?: (fields: JournalCardFields) => void;
  prefs?: UserPreferences;
  spaceItems?: SpaceItem[];
}

const TYPE_SYMBOLS: Record<BujoType, { symbol: string; label: string; icon: React.ReactNode }> = {
  task: { symbol: '⬜', label: 'Task (To-Do)', icon: <span className="text-xs">⬜</span> },
  event: { symbol: '⏳', label: 'Event', icon: <span className="text-xs">⏳</span> },
  note: { symbol: '✒️', label: 'Note / Reflection', icon: <span className="text-xs">✒️</span> },
};

export const BulletJournal: React.FC<BulletJournalProps> = ({
  entries,
  onUpdateEntries,
  onSendToFocusTimer,
  currentEnergy,
  categories,
  onOpenSettings,
  hasApiKey = false,
  cardFields,
  onUpdateCardFields,
  prefs,
  spaceItems = [],
}) => {
  const { t, language } = useI18n();
  const [localCardFields, setLocalCardFields] = useState<JournalCardFields>(cardFields || DEFAULT_JOURNAL_CARD_FIELDS);
  useEffect(() => {
    if (cardFields) {
      setLocalCardFields(cardFields);
    }
  }, [cardFields]);

  const effectiveCardFields = cardFields || localCardFields;
  const updateCardFields = (next: JournalCardFields) => {
    setLocalCardFields(next);
    onUpdateCardFields?.(next);
  };
  const toggleCardField = (field: keyof JournalCardFields) => {
    soundEngine.playPop();
    updateCardFields({
      ...effectiveCardFields,
      [field]: !effectiveCardFields[field],
    });
  };
  const allJournalFieldsVisible = Object.values(effectiveCardFields).every(Boolean);
  const allJournalFieldsHidden = Object.values(effectiveCardFields).every((v) => !v);
  const todayStr = getTodayKey();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [journalView, setJournalView] = useState<'day' | 'calendar' | 'timeline'>('day');
  
  // Modals & Migration state
  const [isAddChooserOpen, setIsAddChooserOpen] = useState(false);
  const [isVoiceAddOpen, setIsVoiceAddOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [manualDraft, setManualDraft] = useState<Partial<BujoEntry> | null>(null);
  const [editingEntry, setEditingEntry] = useState<BujoEntry | null>(null);
  const [unstickEntry, setUnstickEntry] = useState<BujoEntry | null>(null);
  const [isMigrateModalOpen, setIsMigrateModalOpen] = useState(false);
  const [migratingEntryId, setMigratingEntryId] = useState<string | null>(null);
  const [migrationNotice, setMigrationNotice] = useState<string | null>(null);

  const effectivePrefs: UserPreferences = useMemo(
    () =>
      prefs || {
        ...storage.getPreferences(),
        currentEnergy,
        language,
        journalCategories: categories || storage.getPreferences().journalCategories,
      },
    [prefs, currentEnergy, language, categories]
  );

  // Keep FAB hidden whenever any add/edit modal is open
  useEffect(() => {
    const anyModalOpen =
      isAddChooserOpen ||
      isVoiceAddOpen ||
      isAddModalOpen ||
      Boolean(editingEntry) ||
      Boolean(unstickEntry) ||
      isMigrateModalOpen;
    window.dispatchEvent(
      new CustomEvent('app:modal-state-change', { detail: { isOpen: anyModalOpen } })
    );
  }, [isAddChooserOpen, isVoiceAddOpen, isAddModalOpen, editingEntry, unstickEntry, isMigrateModalOpen]);

  // Listen for unified FAB click from App -> open two-option chooser
  useEffect(() => {
    const handleFabClick = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail || customEvent.detail.section === 'journal') {
        setIsAddChooserOpen(true);
      }
    };
    window.addEventListener('app:fab-clicked', handleFabClick);
    return () => window.removeEventListener('app:fab-clicked', handleFabClick);
  }, []);
  const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(new Set());

  const toggleExpandEntry = (id: string) => {
    soundEngine.playPop();
    setExpandedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filter state
  const [activeFilter, setActiveFilter] = useState<'all' | 'task' | 'note' | 'event' | 'priority'>('all');
  const [filterEnergy, setFilterEnergy] = useState<EnergyLevel | null>(null);
  const [filterSpace, setFilterSpace] = useState<'all' | WorkStudySpace>('all');
  const [filterSpaceItemId, setFilterSpaceItemId] = useState<string | null>(null);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  const spaceItemMap = useMemo(() => {
    const map = new Map<string, SpaceItem>();
    for (const item of spaceItems) {
      map.set(item.id, item);
    }
    return map;
  }, [spaceItems]);

  const filterableSpaceItems = useMemo(() => {
    if (filterSpace === 'all') return spaceItems;
    return spaceItems.filter((item) => item.space === filterSpace);
  }, [spaceItems, filterSpace]);

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
  };

  // Add Rapid Log Entry from Modal
  const handleAddEntry = (newEntry: BujoEntry) => {
    onUpdateEntries([newEntry, ...entries]);
    // If the new entry belongs to another date, switch to that date in Day view
    if (newEntry.date && newEntry.date !== selectedDate && journalView === 'day') {
      setSelectedDate(newEntry.date);
    }
  };

  // Toggle Status: open <-> completed (migrated reopens to open)
  const handleToggleStatus = (entry: BujoEntry) => {
    let nextStatus: BujoStatus = 'completed';
    if (entry.status === 'completed' || entry.status === 'migrated') {
      nextStatus = 'open';
      soundEngine.playPop();
    } else {
      nextStatus = 'completed';
      soundEngine.playGentleChime();
      try {
        confetti({
          particleCount: 30,
          spread: 50,
          origin: { y: 0.8 },
          colors: ['#7e57c2', '#9c27b0', '#ffb74d', '#4caf50']
        });
      } catch (e) {}
    }

    const updated = entries.map((e) =>
      e.id === entry.id
        ? {
            ...e,
            status: nextStatus,
            completedAt: nextStatus === 'completed' ? Date.now() : undefined,
          }
        : e
    );
    onUpdateEntries(updated);
  };

  const handleTogglePriority = (id: string) => {
    const updated = entries.map((e) =>
      e.id === id ? { ...e, isPriority: !e.isPriority } : e
    );
    onUpdateEntries(updated);
    soundEngine.playPop();
  };

  const handleDeleteEntry = (id: string) => {
    onUpdateEntries(entries.filter((e) => e.id !== id));
    soundEngine.playPop();
  };

  // Migrate open task(s) to targetDate: mark original as 'migrated' and carry open copy forward
  const handleMigrateEntries = (entryIds: string[], targetDate: string) => {
    if (!entryIds.length || !targetDate) return;
    const idSet = new Set(entryIds);
    const now = Date.now();
    const newCopies: BujoEntry[] = [];
    let seq = 0;

    const updatedEntries = entries.map((entry) => {
      if (!idSet.has(entry.id) || entry.status !== 'open' || entry.date === targetDate) {
        return entry;
      }
      const cloned: BujoEntry = {
        ...entry,
        id: `bujo-mig-${now}-${seq}-${Math.random().toString(36).slice(2, 6)}`,
        date: targetDate,
        status: 'open',
        createdAt: now + seq,
        completedAt: undefined,
      };
      seq += 1;
      newCopies.push(cloned);
      return {
        ...entry,
        status: 'migrated' as BujoStatus,
      };
    });

    if (newCopies.length === 0) return;

    onUpdateEntries([...newCopies, ...updatedEntries]);
    soundEngine.playGentleChime();
    setMigratingEntryId(null);

    const itemWord = newCopies.length === 1 ? t('journal.item') : t('journal.items');
    const countLabel = language === 'fa' ? toPersianDigits(newCopies.length) : String(newCopies.length);
    const dateLabel = getRelativeDayLabel(targetDate, language);
    setMigrationNotice(
      t('journal.migratedFeedback')
        .replace('{count}', countLabel)
        .replace('{items}', itemWord)
        .replace('{date}', dateLabel)
    );
  };

  // Auto-dismiss migration confirmation notice
  useEffect(() => {
    if (!migrationNotice) return;
    const timer = window.setTimeout(() => setMigrationNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [migrationNotice]);

  // Overdue open tasks from previous days
  const overdueTasks = useMemo(
    () =>
      entries
        .filter((e) => e.type === 'task' && e.status === 'open' && e.date < todayStr)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [entries, todayStr]
  );

  const tomorrowStr = shiftDate(todayStr, 1);

  // Quick navigation helpers
  const handlePrevDay = () => {
    soundEngine.playPop();
    handleSelectDate(shiftDate(selectedDate, -1));
  };

  const handleNextDay = () => {
    soundEngine.playPop();
    handleSelectDate(shiftDate(selectedDate, 1));
  };

  const handleJumpToToday = () => {
    soundEngine.playPop();
    handleSelectDate(todayStr);
  };

  // Filter entries based on viewMode and active filters
  const dateFilteredEntries = entries.filter((e) => {
    if (journalView === 'day' || journalView === 'calendar') {
      return e.date === selectedDate;
    }
    return true;
  });

  const filteredEntries = dateFilteredEntries.filter((e) => {
    if (activeFilter === 'task' && e.type !== 'task') return false;
    if (activeFilter === 'note' && e.type !== 'note') return false;
    if (activeFilter === 'event' && e.type !== 'event') return false;
    if (activeFilter === 'priority' && !e.isPriority) return false;
    if (filterEnergy !== null && e.energyCost !== filterEnergy) return false;
    if (filterSpace !== 'all') {
      const linked = e.linkedItemId ? spaceItemMap.get(e.linkedItemId) : undefined;
      if (!linked || linked.space !== filterSpace) return false;
    }
    if (filterSpaceItemId !== null && e.linkedItemId !== filterSpaceItemId) return false;
    return true;
  });

  // Calculate day-specific stats
  const dayEntries = entries.filter((e) => e.date === selectedDate);
  const dayTasks = dayEntries.filter((e) => e.type === 'task');
  const dayCompletedTasks = dayTasks.filter((e) => e.status === 'completed');
  const dayEvents = dayEntries.filter((e) => e.type === 'event');
  const dayNotes = dayEntries.filter((e) => e.type === 'note');

  // Grouping for Timeline / All View
  const initialGrouped: Record<string, BujoEntry[]> = {};
  const entriesGroupedByDate = filteredEntries.reduce((acc, entry) => {
    if (!acc[entry.date]) acc[entry.date] = [];
    acc[entry.date].push(entry);
    return acc;
  }, initialGrouped);
  
  // Sort dates ascending (past to future)
  const sortedDates = Object.keys(entriesGroupedByDate).sort((a, b) => a.localeCompare(b));

  const currentEnergyMeta = ENERGY_LEVELS.find((l) => l.id === currentEnergy) || ENERGY_LEVELS[0];

  return (
    <div className="w-full max-w-5xl mx-auto px-4 pb-24 space-y-6">
      
      {/* Expandable Journal Navigation & Filters Top Panel */}
      <div className="bg-white dark:bg-[#182316] p-4 sm:p-5 rounded-[28px] border border-[#DCEAD4] dark:border-[#263722] shadow-xs space-y-3">
        {/* Header Summary Row & Expand Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            id="btn-toggle-bujo-filters"
            onClick={() => {
              soundEngine.playPop();
              setIsFilterExpanded((prev) => !prev);
            }}
            className="flex items-center gap-2.5 group text-left cursor-pointer"
            aria-expanded={isFilterExpanded}
          >
            <div className="w-8 h-8 rounded-xl bg-[#EDF6E8] dark:bg-[#1E2E1B] text-[#3B7E10] dark:text-[#80D141] flex items-center justify-center border border-[#DCEAD4] dark:border-[#263722] group-hover:scale-105 transition-transform shrink-0">
              <Filter className="w-4 h-4" />
            </div>

            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs sm:text-sm font-bold text-[#151E14] dark:text-[#E8F2E4]">
                  {formatDateDisplay(selectedDate, { showDayOfWeek: true, includeYear: true, lang: language })}
                </span>
              </div>
              <p className="text-[11px] text-[#485B44] dark:text-[#9EB598]">
                {journalView === 'day' ? getRelativeDayLabel(selectedDate, language) : journalView === 'calendar' ? t('journal.calendarView') : t('journal.allDates')}
              </p>
            </div>
          </button>

          {/* Quick Date Stepper & Expand Toggle */}
          <div className="flex items-center gap-2">
            {journalView === 'day' && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevDay}
                  className="p-1.5 rounded-lg bg-[#EDF6E8] dark:bg-[#1C281A] hover:bg-[#DDF4CD] text-[#485B44] dark:text-[#9EB598] hover:text-[#151E14] border border-[#DCEAD4] dark:border-[#263722] transition-colors"
                  title={t('journal.prevDay')}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {selectedDate !== todayStr && (
                  <button
                    onClick={handleJumpToToday}
                    className="px-2.5 py-1 rounded-lg bg-[#80D141] hover:bg-[#72BF36] text-[#0F2600] text-[11px] font-bold shadow-xs active:scale-95 transition-all"
                  >
                    {t('journal.jumpToday')}
                  </button>
                )}
                <button
                  onClick={handleNextDay}
                  className="p-1.5 rounded-lg bg-[#EDF6E8] dark:bg-[#1C281A] hover:bg-[#DDF4CD] text-[#485B44] dark:text-[#9EB598] hover:text-[#151E14] border border-[#DCEAD4] dark:border-[#263722] transition-colors"
                  title={t('journal.nextDay')}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              onClick={() => {
                soundEngine.playPop();
                setIsFilterExpanded((prev) => !prev);
              }}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#EDF6E8] dark:bg-[#1E2E1B] hover:bg-[#DEEED6] text-[#485B44] dark:text-[#9EB598] hover:text-[#151E14] dark:hover:text-[#E8F2E4] border border-[#DCEAD4] dark:border-[#263722] text-xs font-semibold flex items-center gap-1 transition-colors"
              title={isFilterExpanded ? t('journal.hideFilters') : t('journal.filters')}
              aria-label={isFilterExpanded ? t('journal.hideFilters') : t('journal.filters')}
            >
              <span className="hidden sm:inline text-[11px] font-bold">{isFilterExpanded ? t('journal.hideFilters') : t('journal.filters')}</span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isFilterExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Expandable Navigation & Filter Controls */}
        <AnimatePresence>
          {isFilterExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-3 border-t border-[#DCEAD4] dark:border-[#263722] space-y-3">
                {/* Row 1: Date Selector & View Mode Switcher */}
                <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-3">
                  {/* Date Selector (Day Stepper, Date Picker, Today Jump) */}
                  <div className="flex items-center justify-center gap-1.5 flex-wrap w-full sm:w-auto">
                    <button
                      id="btn-bujo-prev-day"
                      onClick={handlePrevDay}
                      className="p-2 rounded-xl bg-[#EDF6E8] dark:bg-[#1C281A] hover:bg-[#DDF4CD] text-[#485B44] dark:text-[#9EB598] hover:text-[#151E14] border border-[#DCEAD4] dark:border-[#263722] transition-colors"
                      title={t('journal.prevDay')}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {/* Material Expressive Date Picker Pill */}
                    <MaterialExpressiveDatePicker
                      id="input-bujo-selected-date"
                      value={selectedDate}
                      onChange={(newDate) => handleSelectDate(newDate)}
                      label={t('journal.targetDate')}
                    />

                    <button
                      id="btn-bujo-next-day"
                      onClick={handleNextDay}
                      className="p-2 rounded-xl bg-[#EDF6E8] dark:bg-[#1C281A] hover:bg-[#DDF4CD] text-[#485B44] dark:text-[#9EB598] hover:text-[#151E14] border border-[#DCEAD4] dark:border-[#263722] transition-colors"
                      title={t('journal.nextDay')}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    {/* Quick Today Jump */}
                    {selectedDate !== todayStr && (
                      <button
                        id="btn-bujo-jump-today"
                        onClick={handleJumpToToday}
                        className="px-3 py-1.5 rounded-xl bg-[#80D141] hover:bg-[#72BF36] text-[#0F2600] text-xs font-bold shadow-xs active:scale-95 transition-all"
                      >
                        {t('journal.jumpToday')}
                      </button>
                    )}
                  </div>

                  {/* View Mode Switcher: Daily Log / Calendar / All Dates */}
                  <div className="flex rounded-2xl bg-[#EDF6E8] dark:bg-[#1C281A] p-1 gap-1 border border-[#DCEAD4] dark:border-[#263722] shrink-0 justify-center w-full sm:w-auto overflow-x-auto">
                    <button
                      id="btn-bujo-view-day"
                      onClick={() => {
                        soundEngine.playPop();
                        setJournalView('day');
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        journalView === 'day'
                          ? 'bg-[#80D141] text-[#0F2600] shadow-xs'
                          : 'text-[#485B44] dark:text-[#9EB598] hover:text-[#151E14]'
                      }`}
                    >
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span>{t('journal.viewDaily')}</span>
                    </button>

                    <button
                      id="btn-bujo-view-calendar"
                      onClick={() => {
                        soundEngine.playPop();
                        setJournalView('calendar');
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        journalView === 'calendar'
                          ? 'bg-[#80D141] text-[#0F2600] shadow-xs'
                          : 'text-[#485B44] dark:text-[#9EB598] hover:text-[#151E14]'
                      }`}
                    >
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>{t('journal.viewCalendar')}</span>
                    </button>

                    <button
                      id="btn-bujo-view-timeline"
                      onClick={() => {
                        soundEngine.playPop();
                        setJournalView('timeline');
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        journalView === 'timeline'
                          ? 'bg-[#80D141] text-[#0F2600] shadow-xs'
                          : 'text-[#485B44] dark:text-[#9EB598] hover:text-[#151E14]'
                      }`}
                    >
                      <CalendarRange className="w-3.5 h-3.5" />
                      <span>{t('journal.viewTimeline')}</span>
                    </button>
                  </div>
                </div>

                {/* Row 2: Type Filters & Energy Filters */}
                <div className="pt-2 border-t border-[#DCEAD4]/70 dark:border-[#263722]/70 flex flex-wrap items-center justify-between gap-3">
                  {/* Type Tabs */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { id: 'all', label: t('journal.filterAll') },
                      { id: 'priority', label: `⭐ ${t('journal.priority')}` },
                      { id: 'task', label: `⬜ ${t('journal.filterTasks')}` },
                      { id: 'event', label: `⏳ ${t('journal.filterEvents')}` },
                      { id: 'note', label: `✒️ ${t('journal.filterNotes')}` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          soundEngine.playPop();
                          setActiveFilter(tab.id as any);
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                          activeFilter === tab.id
                            ? 'bg-[#80D141] text-[#0F2600] shadow-xs'
                            : 'bg-[#EDF6E8] dark:bg-[#1C281A] text-[#485B44] dark:text-[#9EB598] hover:bg-[#E8F8D8]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Energy Filter */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => {
                        soundEngine.playPop();
                        setFilterEnergy(null);
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                        filterEnergy === null
                          ? 'bg-[#80D141] text-[#0F2600]'
                          : 'bg-[#EDF6E8] dark:bg-[#1C281A] text-[#485B44] dark:text-[#9EB598] hover:bg-[#E8F8D8]'
                      }`}
                    >
                      {t('journal.filterEnergy')}
                    </button>
                    {ENERGY_LEVELS.map((lvl) => (
                      <button
                        key={lvl.id}
                        onClick={() => {
                          soundEngine.playPop();
                          setFilterEnergy(filterEnergy === lvl.id ? null : lvl.id);
                        }}
                        className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 transition-all ${
                          filterEnergy === lvl.id
                            ? 'bg-[#80D141] text-[#0F2600]'
                            : 'bg-[#EDF6E8] dark:bg-[#1C281A] text-[#485B44] dark:text-[#9EB598] hover:bg-[#E8F8D8]'
                        }`}
                      >
                        <span>{lvl.icon}</span>
                        <span className="capitalize">{getEnergyLabel(lvl.id, language)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Row 2.5: Work / Study Space & Item Filter */}
                {spaceItems.length > 0 && (
                  <div className="pt-2.5 border-t border-[#DCEAD4]/70 dark:border-[#263722]/70 space-y-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { id: 'all', label: t('journal.filterSpaceAll', 'All Spaces') },
                        { id: 'work', label: t('journal.filterSpaceWork', 'Work'), icon: Briefcase },
                        { id: 'study', label: t('journal.filterSpaceStudy', 'Study'), icon: GraduationCap },
                      ].map((tab) => {
                        const SpaceTabIcon = tab.icon;
                        const isActive = filterSpace === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              soundEngine.playPop();
                              const nextSpace = tab.id as 'all' | WorkStudySpace;
                              setFilterSpace(nextSpace);
                              if (filterSpaceItemId) {
                                const cur = spaceItemMap.get(filterSpaceItemId);
                                if (!cur || (nextSpace !== 'all' && cur.space !== nextSpace)) {
                                  setFilterSpaceItemId(null);
                                }
                              }
                            }}
                            className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                              isActive
                                ? 'bg-[#80D141] text-[#0F2600] shadow-xs'
                                : 'bg-[#EDF6E8] dark:bg-[#1C281A] text-[#485B44] dark:text-[#9EB598] hover:bg-[#E8F8D8]'
                            }`}
                          >
                            {SpaceTabIcon && <SpaceTabIcon className="w-3.5 h-3.5" />}
                            <span>{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {filterableSpaceItems.length > 0 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                        {filterableSpaceItems.map((item) => {
                          const isSelected = filterSpaceItemId === item.id;
                          const ItemIcon = item.space === 'work' ? Briefcase : GraduationCap;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                soundEngine.playPop();
                                setFilterSpaceItemId(isSelected ? null : item.id);
                              }}
                              className={`px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#80D141] text-[#0F2600] shadow-2xs'
                                  : 'bg-[#F6FBF3] dark:bg-[#1C281A] text-[#151E14] dark:text-[#E8F2E4] border border-[#DCEAD4] dark:border-[#263722] hover:bg-[#EDF6E8]'
                              }`}
                            >
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{
                                  backgroundColor: isSelected
                                    ? '#0F2600'
                                    : item.color || (item.space === 'work' ? '#80D141' : '#3B82F6'),
                                }}
                                aria-hidden="true"
                              />
                              <ItemIcon className="w-3 h-3 opacity-80 shrink-0" />
                              <span>{item.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Row 3: Card Field Visibility Controls */}
                <div className="pt-2.5 border-t border-[#DCEAD4]/70 dark:border-[#263722]/70 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-[#485B44] dark:text-[#9EB598] me-1 inline-flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-[#3B7E10] dark:text-[#80D141]" />
                      <span>{t('cardFields.title')}:</span>
                    </span>

                    {(
                      [
                        { key: 'energy', label: t('cardFields.energy') },
                        { key: 'time', label: t('cardFields.time') },
                        { key: 'category', label: t('cardFields.category') },
                        { key: 'linkedItem', label: t('cardFields.linkedItem') },
                        { key: 'priority', label: t('cardFields.priority') },
                        { key: 'steps', label: t('cardFields.steps') },
                      ] as { key: keyof JournalCardFields; label: string }[]
                    ).map((item) => {
                      const isShown = effectiveCardFields[item.key];
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => toggleCardField(item.key)}
                          aria-pressed={isShown}
                          className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                            isShown
                              ? 'bg-[#80D141] text-[#0F2600] shadow-2xs'
                              : 'bg-[#EDF6E8] dark:bg-[#1C281A] text-[#485B44] dark:text-[#9EB598] border border-[#DCEAD4] dark:border-[#263722] opacity-80 hover:opacity-100'
                          }`}
                        >
                          {isShown ? (
                            <Eye className="w-3 h-3 shrink-0" />
                          ) : (
                            <EyeOff className="w-3 h-3 shrink-0 opacity-65" />
                          )}
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playPop();
                        updateCardFields({
                          energy: true,
                          time: true,
                          category: true,
                          linkedItem: true,
                          priority: true,
                          steps: true,
                        });
                      }}
                      disabled={allJournalFieldsVisible}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        allJournalFieldsVisible
                          ? 'text-[#3B7E10] dark:text-[#80D141] bg-[#E8F8D8] dark:bg-[#1E3800]'
                          : 'text-[#485B44] dark:text-[#9EB598] hover:bg-[#EDF6E8] dark:hover:bg-[#1C281A]'
                      }`}
                    >
                      {t('cardFields.showAll')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playPop();
                        updateCardFields({
                          energy: false,
                          time: false,
                          category: false,
                          linkedItem: false,
                          priority: false,
                          steps: false,
                        });
                      }}
                      disabled={allJournalFieldsHidden}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        allJournalFieldsHidden
                          ? 'text-[#3B7E10] dark:text-[#80D141] bg-[#E8F8D8] dark:bg-[#1E3800]'
                          : 'text-[#485B44] dark:text-[#9EB598] hover:bg-[#EDF6E8] dark:hover:bg-[#1C281A]'
                      }`}
                    >
                      {t('cardFields.minimal')}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Migration Confirmation Notice */}
      <AnimatePresence>
        {migrationNotice && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="px-4 py-3 rounded-2xl bg-[#E8F8D8] dark:bg-[#1E3800] border border-[#80D141]/50 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-[#1C3700] dark:text-[#A2EB68]">
              <Check className="w-4 h-4 shrink-0 stroke-[2.5]" />
              <span>{migrationNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setMigrationNotice(null)}
              aria-label={t('common.close')}
              className="p-1 rounded-full text-[#3B7E10] dark:text-[#80D141] hover:bg-[#DCEAD4] dark:hover:bg-[#263722] transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overdue Tasks Migration Banner */}
      <AnimatePresence>
        {overdueTasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-4 sm:p-5 rounded-[24px] bg-amber-50/80 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 flex items-center justify-center shrink-0 mt-0.5">
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-sm font-extrabold text-[#151E14] dark:text-[#E8F2E4] tabular-nums">
                  {overdueTasks.length === 1
                    ? t('journal.overdueBannerSingle')
                    : t('journal.overdueBannerPlural').replace(
                        '{count}',
                        language === 'fa'
                          ? toPersianDigits(overdueTasks.length)
                          : String(overdueTasks.length)
                      )}
                </h3>
                <p className="text-xs text-[#485B44] dark:text-[#9EB598] font-medium mt-0.5">
                  {t('journal.overdueBannerSub')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                id="btn-bujo-migrate-all-today"
                type="button"
                onClick={() =>
                  handleMigrateEntries(
                    overdueTasks.map((task) => task.id),
                    todayStr
                  )
                }
                className="min-h-[40px] px-4 py-2 rounded-full bg-[#80D141] hover:bg-[#72BF36] text-[#0F2600] text-xs font-extrabold shadow-xs flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer active:scale-95"
              >
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                <span>{t('journal.migrateAllToday')}</span>
              </button>

              <button
                id="btn-bujo-review-overdue"
                type="button"
                onClick={() => {
                  soundEngine.playPop();
                  setIsMigrateModalOpen(true);
                }}
                className="min-h-[40px] px-4 py-2 rounded-full bg-white dark:bg-[#202E1E] hover:bg-[#EDF6E8] dark:hover:bg-[#2A3B27] text-[#151E14] dark:text-[#E8F2E4] border border-amber-300 dark:border-amber-700/60 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
              >
                {t('journal.reviewMigrate')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Embedded Month Calendar View if selected */}
      {journalView === 'calendar' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <JournalCalendar
            entries={entries}
            selectedDate={selectedDate}
            onSelectDate={(date) => handleSelectDate(date)}
          />

          {/* Current Date Banner below Calendar */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[#EDF6E8] dark:bg-[#1C281A] border border-[#DCEAD4] dark:border-[#263722] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-[#80D141]" />
              <span className="font-display text-sm font-bold text-[#151E14] dark:text-[#E8F2E4]">
                {t('journal.entriesFor')} {formatDateDisplay(selectedDate, { showDayOfWeek: true, includeYear: true, lang: language })}
              </span>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white dark:bg-[#253522] text-[#3B4E37] dark:text-[#B6CCB0] border border-[#DCEAD4] dark:border-[#2E422A]">
              {language === 'fa' ? toPersianDigits(filteredEntries.length) : filteredEntries.length} {filteredEntries.length === 1 ? t('journal.item') : t('journal.items')}
            </span>
          </div>
        </motion.div>
      )}



      {/* Bullet Journal Entries Display */}
      {journalView === 'timeline' ? (
        /* Timeline / All Dates Grouped View */
        <div className="space-y-6">
          {sortedDates.length === 0 ? (
            <div className="p-8 rounded-[28px] bg-white dark:bg-[#182316] border border-[#DCEAD4] dark:border-[#263722] text-center space-y-2">
              <span className="text-3xl">🌱</span>
              <h4 className="font-display font-bold text-sm text-[#151E14] dark:text-[#E8F2E4]">
                {t('journal.noEntriesTimelineTitle')}
              </h4>
              <p className="text-xs text-[#485B44] dark:text-[#9EB598] max-w-sm mx-auto font-medium">
                {t('journal.noEntriesTimelineSub')}
              </p>
            </div>
          ) : (
            sortedDates.map((dateStr) => {
              const groupEntries = entriesGroupedByDate[dateStr] || [];

              return (
                <div key={dateStr} className="space-y-2.5">
                  {/* Date Section Header */}
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-[#80D141]" />
                      <h3 className="font-display text-sm font-bold text-[#151E14] dark:text-[#E8F2E4]">
                        {formatDateDisplay(dateStr, { showDayOfWeek: true, includeYear: true, lang: language })}
                      </h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#EDF6E8] dark:bg-[#202E1E] text-[#3B7E10] dark:text-[#80D141] font-bold">
                        {getRelativeDayLabel(dateStr, language)}
                      </span>
                    </div>
                  </div>

                  {/* Entry list for this date */}
                  <div className="space-y-2.5">
                    {groupEntries.map((entry) => renderEntryCard(entry))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Day / Selected Date View */
        <div className="space-y-2.5">
          {filteredEntries.length === 0 ? (
            <div className="p-8 rounded-[28px] bg-white dark:bg-[#182316] border border-[#DCEAD4] dark:border-[#263722] text-center space-y-3">
              <span className="text-3xl">🌱</span>
              <h4 className="font-display font-bold text-sm text-[#151E14] dark:text-[#E8F2E4]">
                {t('journal.noEntriesDayTitle')} {formatDateDisplay(selectedDate, { showDayOfWeek: true, includeYear: false, lang: language })}
              </h4>
              <p className="text-xs text-[#485B44] dark:text-[#9EB598] max-w-sm mx-auto font-medium">
                {t('journal.noEntriesDaySub')}
              </p>
              <button
                onClick={() => {
                  soundEngine.playPop();
                  setIsAddChooserOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#80D141] hover:bg-[#72BF36] text-[#0F2600] font-bold text-xs shadow-xs"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>{t('journal.logEntryForDate')}</span>
              </button>
            </div>
          ) : (
            filteredEntries.map((entry) => renderEntryCard(entry))
          )}
        </div>
      )}

      {/* Two-Option Add Mode Chooser */}
      <AddEntryModeChooser
        isOpen={isAddChooserOpen}
        mode="journal"
        onClose={() => setIsAddChooserOpen(false)}
        onSelectManual={() => {
          setIsAddChooserOpen(false);
          setManualDraft(null);
          setIsAddModalOpen(true);
        }}
        onSelectVoice={() => {
          setIsAddChooserOpen(false);
          setIsVoiceAddOpen(true);
        }}
      />

      {/* Voice-Assisted Entry Modal */}
      <VoiceEntryModal
        isOpen={isVoiceAddOpen}
        mode="journal"
        onClose={() => setIsVoiceAddOpen(false)}
        prefs={effectivePrefs}
        defaultDate={selectedDate}
        categories={categories}
        spaceItems={spaceItems}
        onSaveJournalEntry={handleAddEntry}
        onOpenManualJournal={(draft) => {
          setIsVoiceAddOpen(false);
          setManualDraft(draft);
          setIsAddModalOpen(true);
        }}
        onOpenSettings={onOpenSettings}
      />

      {/* Add Bujo Entry Modal */}
      <AddBujoModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setManualDraft(null);
        }}
        onAddEntry={handleAddEntry}
        defaultDate={selectedDate}
        currentEnergy={currentEnergy}
        categories={categories}
        onOpenSettings={onOpenSettings}
        initialDraft={manualDraft}
        spaceItems={spaceItems}
      />

      {/* Edit Bujo Entry Modal */}
      <EditBujoModal
        entry={editingEntry}
        isOpen={Boolean(editingEntry)}
        onClose={() => setEditingEntry(null)}
        onSave={(updatedEntry) => {
          onUpdateEntries(entries.map((e) => (e.id === updatedEntry.id ? updatedEntry : e)));
        }}
        categories={categories}
        onOpenSettings={onOpenSettings}
        spaceItems={spaceItems}
      />

      {/* Unstick AI Modal */}
      <UnstickModal
        entry={unstickEntry}
        isOpen={Boolean(unstickEntry)}
        onClose={() => setUnstickEntry(null)}
        onUpdateEntry={(updated) => {
          onUpdateEntries(entries.map((e) => (e.id === updated.id ? updated : e)));
          setUnstickEntry(updated);
        }}
        onSendToFocusTimer={onSendToFocusTimer}
        currentEnergy={currentEnergy}
        hasApiKey={hasApiKey}
        onOpenSettings={onOpenSettings}
      />

      {/* Overdue Tasks Review & Migration Modal */}
      <MigrateOverdueModal
        isOpen={isMigrateModalOpen}
        onClose={() => setIsMigrateModalOpen(false)}
        overdueTasks={overdueTasks}
        onMigrateEntries={handleMigrateEntries}
        onCompleteEntry={handleToggleStatus}
        onDeleteEntry={handleDeleteEntry}
        spaceItems={spaceItems}
      />

    </div>
  );

  function renderEntryCard(entry: BujoEntry) {
    const isTask = entry.type === 'task';
    const isCompleted = entry.status === 'completed';
    const isMigrated = entry.status === 'migrated';
    const isOverdue = isTask && entry.status === 'open' && entry.date < todayStr;
    const isMigratingThisCard = migratingEntryId === entry.id;
    const microSteps = entry.microSteps || [];
    const completedMicroStepsCount = microSteps.filter((s) => s.completed).length;
    const energyMeta = ENERGY_LEVELS.find((l) => l.id === entry.energyCost) || ENERGY_LEVELS[0];
    const linkedSpaceItem = entry.linkedItemId ? spaceItemMap.get(entry.linkedItemId) : undefined;
    const LinkedSpaceIcon = linkedSpaceItem?.space === 'work' ? Briefcase : GraduationCap;
    const linkedFieldEnabled = effectiveCardFields.linkedItem ?? true;

    const showPriorityInSummary = effectiveCardFields.priority && Boolean(entry.isPriority);
    const showStepsInSummary = effectiveCardFields.steps && microSteps.length > 0;
    const showEnergyInSummary = effectiveCardFields.energy;
    const showDateInSummary = Boolean(entry.date && journalView === 'timeline' && !allJournalFieldsHidden);
    const showCategoryInSummary = effectiveCardFields.category && Boolean(entry.category);
    const showLinkedItemInSummary = linkedFieldEnabled && Boolean(linkedSpaceItem);
    const showTimeInSummary = effectiveCardFields.time && Boolean(entry.time || entry.durationMinutes);
    const hasSummaryMetaRow =
      showEnergyInSummary ||
      showDateInSummary ||
      showCategoryInSummary ||
      showLinkedItemInSummary ||
      showTimeInSummary ||
      isOverdue ||
      isMigrated;
    const hasSecondLine = showStepsInSummary || hasSummaryMetaRow;

    const hiddenPriority = !effectiveCardFields.priority && Boolean(entry.isPriority);
    const hiddenEnergy = !effectiveCardFields.energy;
    const hiddenCategory = !effectiveCardFields.category && Boolean(entry.category);
    const hiddenLinkedItem = !linkedFieldEnabled && Boolean(linkedSpaceItem);
    const hiddenTime = !effectiveCardFields.time && Boolean(entry.time || entry.durationMinutes);
    const hiddenSteps = !effectiveCardFields.steps && microSteps.length > 0;
    const hasHiddenExpandedMeta =
      hiddenPriority || hiddenEnergy || hiddenCategory || hiddenLinkedItem || hiddenTime || hiddenSteps;

    return (
      <motion.div
        key={entry.id}
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => toggleExpandEntry(entry.id)}
        className={`group p-4 sm:p-5 rounded-[24px] border transition-all cursor-pointer select-none ${
          isCompleted
            ? 'bg-[#E1F6D0] dark:bg-[#1B3618] border-[#72C833] dark:border-[#529E25] shadow-xs'
            : isMigrated
            ? 'bg-[#FFF8E1] dark:bg-[#2D291E] border-[#FFE082] dark:border-[#4C442E]'
            : 'bg-white dark:bg-[#182316] border-[#DCEAD4] dark:border-[#263722] hover:border-[#80D141]/60 dark:hover:border-[#80D141]/40 shadow-xs'
        }`}
      >
        <div className={`flex justify-between gap-2.5 sm:gap-3 ${hasSecondLine ? 'items-start' : 'items-center'}`}>
          
          {/* Left: Bullet Key Icon & Text */}
          <div className={`flex gap-3 flex-1 min-w-0 ${hasSecondLine ? 'items-start' : 'items-center'}`}>
            
            {/* Interactive Key Symbol Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleStatus(entry);
              }}
              className={`w-8 h-8 ${hasSecondLine ? 'mt-0.5' : ''} shrink-0 rounded-xl flex items-center justify-center font-mono font-bold text-sm transition-all ${
                isCompleted
                  ? 'bg-[#80D141] text-[#0F2600] shadow-md font-bold'
                  : isMigrated
                  ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200'
                  : 'bg-[#EDF6E8] dark:bg-[#202E1E] text-[#3B7E10] dark:text-[#80D141] hover:bg-[#DDF4CD]'
              }`}
              title={
                isCompleted
                  ? t('journal.clickToUncheck')
                  : isMigrated
                  ? t('journal.clickToReopen')
                  : t('journal.clickToComplete')
              }
            >
              {isCompleted ? '✓' : isMigrated ? '→' : TYPE_SYMBOLS[entry.type]?.symbol || '⬜'}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {showPriorityInSummary && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFE9E9] dark:bg-[#3D1E22] text-[#B3261E] dark:text-[#F2B8B5] flex items-center gap-0.5 shrink-0">
                    <Star className="w-2.5 h-2.5 fill-current" />
                    {t('journal.priority')}
                  </span>
                )}

                <span className="text-sm font-bold leading-relaxed break-words text-[#151E14] dark:text-[#E8F2E4] transition-all">
                  {getLocalizedTaskTitle(entry.content, language === 'fa')}
                </span>
              </div>

              {/* Micro-steps status banner if shown in summary */}
              {showStepsInSummary && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-[11px] font-bold text-[#3B7E10] dark:text-[#80D141]">
                    {t('journal.microStepsDone')
                      .replace('{done}', language === 'fa' ? toPersianDigits(completedMicroStepsCount) : String(completedMicroStepsCount))
                      .replace('{total}', language === 'fa' ? toPersianDigits(microSteps.length) : String(microSteps.length))}
                  </span>
                  <div className="w-20 h-1.5 rounded-full bg-[#EDF6E8] dark:bg-[#263722] overflow-hidden">
                    <div
                      className="h-full bg-[#80D141] rounded-full"
                      style={{ width: `${(completedMicroStepsCount / microSteps.length) * 100}%` }}
                    />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setUnstickEntry(entry);
                    }}
                    className="text-[11px] text-[#3B7E10] dark:text-[#80D141] font-bold hover:underline"
                  >
                    {t('journal.viewSteps')}
                  </button>
                </div>
              )}

              {/* Tags & Energy Meta & Date Badge */}
              {hasSummaryMetaRow && (
                <div className="flex items-center gap-2 mt-2 text-[11px] text-[#485B44] dark:text-[#9EB598] flex-wrap font-medium">
                  {showEnergyInSummary && (
                    <span className="px-2 py-0.5 rounded-full bg-[#E8F8D8] dark:bg-[#1E3800] text-[#1C3700] dark:text-[#80D141] font-bold flex items-center gap-1">
                      <span>{energyMeta.icon}</span>
                      <span className="capitalize">{getEnergyLabel(energyMeta.id, language)}</span>
                    </span>
                  )}

                  {showDateInSummary && (
                    <span className="px-2 py-0.5 rounded-full bg-[#EDF6E8] dark:bg-[#202E1E] text-[#3B7E10] dark:text-[#80D141] font-semibold border border-[#DCEAD4] dark:border-[#263722] flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      <span>{getRelativeDayLabel(entry.date, language)}</span>
                    </span>
                  )}

                  {showCategoryInSummary && (
                    <span className="px-2 py-0.5 rounded-full bg-[#EDF6E8] dark:bg-[#202E1E] text-[#485B44] dark:text-[#80D141] font-semibold border border-[#DCEAD4] dark:border-[#263722]">
                      {getCategoryLabel(entry.category!, language)}
                    </span>
                  )}

                  {showLinkedItemInSummary && linkedSpaceItem && (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[#151E14] dark:text-[#E8F2E4]">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            linkedSpaceItem.color ||
                            (linkedSpaceItem.space === 'work' ? '#80D141' : '#3B82F6'),
                        }}
                        aria-hidden="true"
                      />
                      <LinkedSpaceIcon className="w-3 h-3 opacity-80 shrink-0" />
                      <span>{linkedSpaceItem.title}</span>
                    </span>
                  )}

                  {/* Scheduled Time & Duration Badge */}
                  {showTimeInSummary && (
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 shrink-0 ${
                      isCompleted
                        ? 'bg-[#CCEBB6] dark:bg-[#254A20] text-[#14300B] dark:text-[#CFF3B8]'
                        : 'bg-[#EDF6E8] dark:bg-[#202E1E] text-[#3B7E10] dark:text-[#9DD97A] border border-[#DCEAD4] dark:border-[#263722]'
                    }`}>
                      <Clock className="w-3 h-3" />
                      <span>
                        {entry.time ? (language === 'fa' ? toPersianDigits(entry.time) : entry.time) : ''}
                        {entry.time && entry.durationMinutes ? ' • ' : ''}
                        {entry.durationMinutes ? formatMinutes(entry.durationMinutes, language) : ''}
                      </span>
                    </span>
                  )}

                  {isOverdue && (
                    <span className="text-[#B3261E] dark:text-[#F2B8B5] font-bold inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{t('journal.overdue')}</span>
                    </span>
                  )}

                  {isMigrated && (
                    <span className="text-amber-600 dark:text-amber-400 font-bold">
                      {t('journal.migrated')}
                    </span>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Right: Expand / Collapse Down Arrow */}
          <div className={`shrink-0 ${hasSecondLine ? 'self-start sm:self-center mt-0.5 sm:mt-0' : 'self-center'}`}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpandEntry(entry.id);
              }}
              className={`p-1.5 rounded-full transition-all ${
                expandedEntryIds.has(entry.id)
                  ? 'bg-[#EDF6E8] dark:bg-[#202E1E] text-[#151E14] dark:text-[#E8F2E4]'
                  : 'text-[#485B44] dark:text-[#9EB598] hover:bg-[#EDF6E8] dark:hover:bg-[#202E1E] hover:text-[#151E14] dark:hover:text-[#E8F2E4]'
              }`}
              title={expandedEntryIds.has(entry.id) ? t('journal.hideButtons') : t('journal.showButtons')}
              aria-label={expandedEntryIds.has(entry.id) ? t('journal.hideButtons') : t('journal.showButtons')}
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  expandedEntryIds.has(entry.id) ? 'rotate-180 text-[#3B7E10] dark:text-[#80D141]' : ''
                }`}
              />
            </button>
          </div>

        </div>

        {/* Downward Expandable Details & Actions Area */}
        <AnimatePresence>
          {expandedEntryIds.has(entry.id) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="overflow-hidden cursor-default"
            >
              <div className="mt-3 pt-3 border-t border-[#DCEAD4] dark:border-[#263722] space-y-2.5">
                {/* Hidden Fields Revealed on Expand */}
                {hasHiddenExpandedMeta && (
                  <div className="space-y-1.5">
                    {(hiddenPriority || hiddenEnergy || hiddenCategory || hiddenLinkedItem || hiddenTime) && (
                      <div className="flex items-center gap-2 flex-wrap text-xs font-medium text-[#485B44] dark:text-[#9EB598]">
                        {hiddenPriority && (
                          <span className="inline-flex items-center gap-1 font-bold text-[#B3261E] dark:text-[#F2B8B5]">
                            <Star className="w-3 h-3 fill-current" />
                            <span>{t('journal.priority')}</span>
                          </span>
                        )}
                        {hiddenPriority && (hiddenEnergy || hiddenCategory || hiddenLinkedItem || hiddenTime) && (
                          <span aria-hidden="true" className="opacity-50">·</span>
                        )}
                        {hiddenEnergy && (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#1C3700] dark:text-[#A2EB68]">
                            <span>{energyMeta.icon}</span>
                            <span>{getEnergyLabel(energyMeta.id, language)}</span>
                          </span>
                        )}
                        {hiddenEnergy && (hiddenCategory || hiddenLinkedItem || hiddenTime) && (
                          <span aria-hidden="true" className="opacity-50">·</span>
                        )}
                        {hiddenCategory && (
                          <span className="font-semibold text-[#151E14] dark:text-[#E8F2E4]">
                            {getCategoryLabel(entry.category!, language)}
                          </span>
                        )}
                        {hiddenCategory && (hiddenLinkedItem || hiddenTime) && (
                          <span aria-hidden="true" className="opacity-50">·</span>
                        )}
                        {hiddenLinkedItem && linkedSpaceItem && (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-[#151E14] dark:text-[#E8F2E4]">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{
                                backgroundColor:
                                  linkedSpaceItem.color ||
                                  (linkedSpaceItem.space === 'work' ? '#80D141' : '#3B82F6'),
                              }}
                              aria-hidden="true"
                            />
                            <LinkedSpaceIcon className="w-3 h-3 opacity-80 shrink-0" />
                            <span>{linkedSpaceItem.title}</span>
                          </span>
                        )}
                        {hiddenLinkedItem && hiddenTime && (
                          <span aria-hidden="true" className="opacity-50">·</span>
                        )}
                        {hiddenTime && (
                          <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-[#3B7E10] dark:text-[#9DD97A]">
                            <Clock className="w-3 h-3" />
                            <span>
                              {entry.time ? (language === 'fa' ? toPersianDigits(entry.time) : entry.time) : ''}
                              {entry.time && entry.durationMinutes ? ' • ' : ''}
                              {entry.durationMinutes ? formatMinutes(entry.durationMinutes, language) : ''}
                            </span>
                          </span>
                        )}
                      </div>
                    )}

                    {hiddenSteps && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[11px] font-bold text-[#3B7E10] dark:text-[#80D141]">
                          {t('journal.microStepsDone')
                            .replace('{done}', language === 'fa' ? toPersianDigits(completedMicroStepsCount) : String(completedMicroStepsCount))
                            .replace('{total}', language === 'fa' ? toPersianDigits(microSteps.length) : String(microSteps.length))}
                        </span>
                        <div className="w-20 h-1.5 rounded-full bg-[#EDF6E8] dark:bg-[#263722] overflow-hidden">
                          <div
                            className="h-full bg-[#80D141] rounded-full"
                            style={{ width: `${(completedMicroStepsCount / microSteps.length) * 100}%` }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setUnstickEntry(entry)}
                          className="text-[11px] text-[#3B7E10] dark:text-[#80D141] font-bold hover:underline cursor-pointer"
                        >
                          {t('journal.viewSteps')}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Left: Quick Actions */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* "Unstick Me" AI button on open tasks */}
                  {isTask && !isCompleted && !isMigrated && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setUnstickEntry(entry)}
                      className="px-3 py-1.5 rounded-full bg-[#E8F8D8] dark:bg-[#1E3800] hover:bg-[#D5F7B8] text-[#1C3700] dark:text-[#A2EB68] text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                      title={t('unstick.subtitle')}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{t('journal.unstick')}</span>
                    </motion.button>
                  )}

                  {/* Send to Timer */}
                  {isTask && !isCompleted && !isMigrated && (
                    <button
                      onClick={() => onSendToFocusTimer(entry.content, entry.durationMinutes || 15)}
                      className="px-3 py-1.5 rounded-full bg-[#EDF6E8] dark:bg-[#202E1E] hover:bg-[#DDF4CD] text-[#163300] dark:text-[#A2EB68] text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                      title={`${t('focus.start')} (${formatMinutes(entry.durationMinutes || 15, language)})`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{t('journal.focus')} {entry.durationMinutes ? `(${formatMinutes(entry.durationMinutes, language)})` : ''}</span>
                    </button>
                  )}

                  {/* Migrate Task Quick Action */}
                  {isTask && !isCompleted && !isMigrated && (
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playPop();
                        setMigratingEntryId(isMigratingThisCard ? null : entry.id);
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs ${
                        isMigratingThisCard
                          ? 'bg-amber-200 dark:bg-amber-900/70 text-amber-950 dark:text-amber-100'
                          : 'bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/50'
                      }`}
                    >
                      <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                      <span>{t('journal.migrate')}</span>
                    </button>
                  )}
                </div>

                {/* Right: Entry Management Actions (Star, Edit, Delete) */}
                <div className="flex items-center gap-1 ml-auto">
                  {/* Priority Star Toggle */}
                  <button
                    onClick={() => handleTogglePriority(entry.id)}
                    className={`p-1.5 rounded-full transition-all ${
                      entry.isPriority 
                        ? 'text-amber-500 bg-[#FFF8E1] dark:bg-[#332A15]' 
                        : 'text-[#485B44] dark:text-[#9EB598] hover:bg-[#EDF6E8] dark:hover:bg-[#202E1E]'
                    }`}
                    title={t('journal.priorityStar')}
                  >
                    <Star className={`w-4 h-4 ${entry.isPriority ? 'fill-current' : ''}`} />
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => {
                      soundEngine.playPop();
                      setEditingEntry(entry);
                    }}
                    className="p-1.5 rounded-full text-[#485B44] dark:text-[#9EB598] hover:text-[#151E14] dark:hover:text-[#E8F2E4] hover:bg-[#EDF6E8] dark:hover:bg-[#202E1E] transition-colors"
                    title={t('common.edit')}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteEntry(entry.id)}
                    className="p-1.5 rounded-full text-[#B3261E] hover:bg-[#FFE9E9] dark:hover:bg-[#432125] transition-colors"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Inline Target Date Selector for Single-Task Migration */}
              {isTask && !isCompleted && !isMigrated && isMigratingThisCard && (
                <div className="mt-2.5 pt-2.5 border-t border-dashed border-[#DCEAD4] dark:border-[#263722] flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-[#485B44] dark:text-[#9EB598]">
                    {t('journal.migrateTo')}
                  </span>

                  {entry.date !== todayStr && (
                    <button
                      type="button"
                      onClick={() => handleMigrateEntries([entry.id], todayStr)}
                      className="px-3 py-1.5 rounded-xl bg-[#80D141] hover:bg-[#72BF36] text-[#0F2600] text-xs font-extrabold transition-colors cursor-pointer"
                    >
                      {t('journal.jumpToday')}
                    </button>
                  )}

                  {entry.date !== tomorrowStr && (
                    <button
                      type="button"
                      onClick={() => handleMigrateEntries([entry.id], tomorrowStr)}
                      className="px-3 py-1.5 rounded-xl bg-[#EDF6E8] dark:bg-[#202E1E] hover:bg-[#DCEAD4] text-[#151E14] dark:text-[#E8F2E4] border border-[#DCEAD4] dark:border-[#263722] text-xs font-bold transition-colors cursor-pointer"
                    >
                      {t('journal.tomorrow')}
                    </button>
                  )}

                  <MaterialExpressiveDatePicker
                    value={entry.date < todayStr ? todayStr : shiftDate(entry.date, 1)}
                    onChange={(pickedDate) => {
                      if (pickedDate && pickedDate !== entry.date) {
                        handleMigrateEntries([entry.id], pickedDate);
                      }
                    }}
                    label={t('journal.targetDate')}
                    buttonClassName="py-1.5 px-2.5 rounded-xl text-xs"
                  />
                </div>
              )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }
};
