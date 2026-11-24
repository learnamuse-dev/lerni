import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Briefcase,
  GraduationCap,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  ArrowLeft,
  Check,
  BookOpenText,
} from 'lucide-react';
import { SpaceItem, WorkStudySpace, BujoEntry } from '../../types';
import { soundEngine } from '../../utils/audioSynth';
import { useI18n, toPersianDigits } from '../../utils/i18n';

interface SpaceItemsViewProps {
  space: WorkStudySpace;
  items: SpaceItem[];
  bujoEntries: BujoEntry[];
  onAddItem: (item: SpaceItem) => void;
  onUpdateItem: (item: SpaceItem) => void;
  onDeleteItem: (id: string) => void;
}

const COLOR_SWATCHES = [
  '#80D141', // Lerni Green
  '#3B82F6', // Cobalt
  '#8B5CF6', // Violet
  '#F59E0B', // Amber
  '#EC4899', // Rose
  '#14B8A6', // Teal
  '#F97316', // Coral
  '#64748B', // Slate
];

const KIND_PRESETS: Record<WorkStudySpace, Array<{ en: string; fa: string }>> = {
  study: [
    { en: 'Course', fa: 'درس' },
    { en: 'Lecture', fa: 'جلسه / ارائه' },
    { en: 'Seminar', fa: 'سمینار' },
    { en: 'Lab', fa: 'آزمایشگاه' },
    { en: 'Thesis', fa: 'پایان‌نامه' },
    { en: 'Exam', fa: 'امتحان' },
  ],
  work: [
    { en: 'Job', fa: 'شغل' },
    { en: 'Project', fa: 'پروژه' },
    { en: 'Client', fa: 'مشتری' },
    { en: 'Freelance', fa: 'فریلنس' },
    { en: 'Team', fa: 'تیم' },
    { en: 'Research', fa: 'پژوهش' },
  ],
};

export const SpaceItemsView: React.FC<SpaceItemsViewProps> = ({
  space,
  items,
  bujoEntries,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
}) => {
  const { t, language, isRtl } = useI18n();
  const isFa = language === 'fa';
  const isWork = space === 'work';

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SpaceItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Modal form state
  const [titleInput, setTitleInput] = useState('');
  const [kindInput, setKindInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [colorInput, setColorInput] = useState(isWork ? '#80D141' : '#3B82F6');
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const spaceItems = useMemo(
    () =>
      items
        .filter((item) => item.space === space)
        .sort((a, b) => b.createdAt - a.createdAt),
    [items, space]
  );

  // Read-only counts of Journal entries linked to each item
  const linkedCountsByItemId = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of bujoEntries) {
      if (entry.linkedItemId) {
        counts[entry.linkedItemId] = (counts[entry.linkedItemId] || 0) + 1;
      }
    }
    return counts;
  }, [bujoEntries]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return spaceItems;
    return spaceItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.kind && item.kind.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q))
    );
  }, [spaceItems, searchQuery]);

  // Open modal when FAB is clicked on this section
  useEffect(() => {
    const handleFabClick = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.section === space) {
        openCreateModal();
      }
    };
    window.addEventListener('app:fab-clicked', handleFabClick);
    return () => window.removeEventListener('app:fab-clicked', handleFabClick);
  }, [space]);

  // Hide FAB & lock background scroll when full-screen modal is open
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('app:modal-state-change', { detail: { isOpen: isModalOpen } })
    );
    if (!isModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundEngine.playPop();
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [isModalOpen]);

  const openCreateModal = () => {
    setEditingItem(null);
    setTitleInput('');
    setKindInput('');
    setNotesInput('');
    setColorInput(isWork ? '#80D141' : '#3B82F6');
    setIsModalOpen(true);
    setTimeout(() => titleInputRef.current?.focus(), 80);
  };

  const openEditModal = (item: SpaceItem) => {
    soundEngine.playPop();
    setEditingItem(item);
    setTitleInput(item.title);
    setKindInput(item.kind || '');
    setNotesInput(item.notes || '');
    setColorInput(item.color || (isWork ? '#80D141' : '#3B82F6'));
    setIsModalOpen(true);
    setTimeout(() => titleInputRef.current?.focus(), 80);
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanTitle = titleInput.trim();
    if (!cleanTitle) return;

    if (editingItem) {
      onUpdateItem({
        ...editingItem,
        title: cleanTitle,
        kind: kindInput.trim() || undefined,
        notes: notesInput.trim() || undefined,
        color: colorInput,
      });
    } else {
      const newItem: SpaceItem = {
        id: `space-${space}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        space,
        title: cleanTitle,
        kind: kindInput.trim() || undefined,
        notes: notesInput.trim() || undefined,
        color: colorInput,
        createdAt: Date.now(),
      };
      onAddItem(newItem);
    }

    soundEngine.playGentleChime();
    setIsModalOpen(false);
  };

  const formatNum = (n: number) => (isFa ? toPersianDigits(n) : String(n));

  const countLabel =
    spaceItems.length === 1
      ? t('spaces.itemCountSingle', '1 item')
      : t('spaces.itemCountPlural', '{count} items').replace(
          '{count}',
          formatNum(spaceItems.length)
        );

  const SpaceIcon = isWork ? Briefcase : GraduationCap;

  return (
    <div id={`space-view-${space}`} className="w-full max-w-5xl mx-auto px-4 pb-24 space-y-5">
      {/* Header Summary & Search Bar */}
      <div className="bg-white dark:bg-[#182316] p-4 sm:p-5 rounded-[28px] border border-[#DCEAD4] dark:border-[#263722] shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#EDF6E8] dark:bg-[#1E2E1B] text-[#3B7E10] dark:text-[#80D141] flex items-center justify-center border border-[#DCEAD4] dark:border-[#263722] shrink-0">
              <SpaceIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-base sm:text-lg font-extrabold text-[#151E14] dark:text-[#E8F2E4] leading-tight">
                  {isWork ? t('spaces.workTitle', 'Work Items') : t('spaces.studyTitle', 'Study Items')}
                </h1>
                <span className="text-xs font-semibold text-[#485B44] dark:text-[#9EB598] tabular-nums">
                  · {countLabel}
                </span>
              </div>
              <p className="text-xs text-[#485B44] dark:text-[#9EB598] mt-0.5 leading-relaxed">
                {isWork
                  ? t('spaces.workSubtitle')
                  : t('spaces.studySubtitle')}
              </p>
            </div>
          </div>

          <button
            id={`btn-add-space-item-${space}`}
            type="button"
            onClick={() => {
              soundEngine.playPop();
              openCreateModal();
            }}
            className="min-h-[40px] px-4 py-2 rounded-full bg-[#80D141] hover:bg-[#72BF36] text-[#0F2600] text-xs font-extrabold shadow-xs flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>
              {isWork ? t('spaces.addWorkItem', 'New Work Item') : t('spaces.addStudyItem', 'New Study Item')}
            </span>
          </button>
        </div>

        {/* Search Input */}
        {spaceItems.length > 0 && (
          <div className="relative">
            <Search className="w-4 h-4 absolute start-3.5 top-1/2 -translate-y-1/2 text-[#677C62] dark:text-[#889E84] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('spaces.searchPlaceholder', 'Search items...')}
              className="w-full ps-9 pe-9 py-2.5 rounded-2xl bg-[#F6FBF3] dark:bg-[#131C12] border border-[#DCEAD4] dark:border-[#263722] text-xs sm:text-sm text-[#151E14] dark:text-[#E8F2E4] placeholder-[#677C62] dark:placeholder-[#889E84] focus:outline-none focus:ring-2 focus:ring-[#80D141]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label={t('common.close', 'Clear')}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 text-[#677C62] hover:text-[#151E14] dark:hover:text-[#E8F2E4] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Items List / Empty State */}
      {filteredItems.length === 0 ? (
        <div
          id={`space-empty-${space}`}
          className="text-center py-12 px-5 rounded-[28px] bg-white/80 dark:bg-[#182316]/60 border border-dashed border-[#DCEAD4] dark:border-[#263722] space-y-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#EDF6E8] dark:bg-[#202E1E] text-[#3B7E10] dark:text-[#80D141] flex items-center justify-center mx-auto">
            <SpaceIcon className="w-6 h-6" />
          </div>
          <h3 className="font-display text-base font-bold text-[#151E14] dark:text-[#E8F2E4]">
            {searchQuery
              ? t('spaces.noSearchResults', 'No matching items found')
              : isWork
              ? t('spaces.emptyWorkTitle', 'No work items yet')
              : t('spaces.emptyStudyTitle', 'No study items yet')}
          </h3>
          <p className="text-xs text-[#485B44] dark:text-[#9EB598] max-w-md mx-auto leading-relaxed">
            {searchQuery
              ? t('braindump.clearSearchFilter', 'Try clearing the search filter.')
              : isWork
              ? t('spaces.emptyWorkSub')
              : t('spaces.emptyStudySub')}
          </p>
          {!searchQuery && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playPop();
                openCreateModal();
              }}
              className="min-h-[40px] px-5 py-2 rounded-full bg-[#80D141] hover:bg-[#72BF36] text-[#0F2600] text-xs font-extrabold shadow-xs inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>
                {isWork ? t('spaces.addWorkItem', 'New Work Item') : t('spaces.addStudyItem', 'New Study Item')}
              </span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <AnimatePresence>
            {filteredItems.map((item) => {
              const linkedCount = linkedCountsByItemId[item.id] || 0;
              const isConfirmingDelete = confirmDeleteId === item.id;
              const accent = item.color || (isWork ? '#80D141' : '#3B82F6');

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="bg-white dark:bg-[#182316] p-4 sm:p-5 rounded-[24px] border border-[#DCEAD4] dark:border-[#263722] shadow-xs flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 mt-1.5"
                        style={{ backgroundColor: accent }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-sm sm:text-base font-bold text-[#151E14] dark:text-[#E8F2E4] break-words leading-snug">
                          {item.title}
                        </h3>

                        <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-[#485B44] dark:text-[#9EB598] font-medium">
                          {item.kind && (
                            <span className="font-semibold text-[#3B7E10] dark:text-[#80D141]">
                              {item.kind}
                            </span>
                          )}
                          {item.kind && (
                            <span className="opacity-45" aria-hidden="true">·</span>
                          )}
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <BookOpenText className="w-3.5 h-3.5 opacity-75" />
                            <span>
                              {linkedCount === 0
                                ? t('spaces.noLinkedJournal', 'No journal entries linked yet')
                                : linkedCount === 1
                                ? t('spaces.linkedJournalSingle', '1 journal entry')
                                : t('spaces.linkedJournalPlural', '{count} journal entries').replace(
                                    '{count}',
                                    formatNum(linkedCount)
                                  )}
                            </span>
                          </span>
                        </div>

                        {item.notes && (
                          <p className="mt-2 text-xs text-[#485B44] dark:text-[#9EB598] leading-relaxed break-words">
                            {item.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        aria-label={t('common.edit', 'Edit')}
                        title={t('common.edit', 'Edit')}
                        className="min-w-[40px] min-h-[40px] rounded-xl text-[#485B44] dark:text-[#9EB598] hover:text-[#151E14] dark:hover:text-[#E8F2E4] hover:bg-[#EDF6E8] dark:hover:bg-[#202E1E] flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playPop();
                          setConfirmDeleteId(isConfirmingDelete ? null : item.id);
                        }}
                        aria-label={t('common.delete', 'Delete')}
                        title={t('common.delete', 'Delete')}
                        className="min-w-[40px] min-h-[40px] rounded-xl text-[#B3261E] hover:bg-[#FFE9E9] dark:hover:bg-[#432125] flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Inline 2-step delete confirmation */}
                  <AnimatePresence>
                    {isConfirmingDelete && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-2.5 border-t border-[#DCEAD4] dark:border-[#263722] flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-medium text-[#B3261E] dark:text-[#F2B8B5]">
                            {t('spaces.deleteConfirm', 'Delete "{title}"?').replace('{title}', item.title)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="min-h-[36px] px-3 py-1 rounded-xl bg-[#EDF6E8] dark:bg-[#202E1E] text-xs font-bold text-[#485B44] dark:text-[#9EB598] cursor-pointer"
                            >
                              {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                soundEngine.playPop();
                                setConfirmDeleteId(null);
                                onDeleteItem(item.id);
                              }}
                              className="min-h-[36px] px-3 py-1 rounded-xl bg-[#B3261E] text-white text-xs font-bold cursor-pointer"
                            >
                              {t('common.delete', 'Delete')}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Full-Screen Add / Edit Space Item Modal */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isModalOpen && (
              <motion.div
                id={`space-item-modal-${space}`}
                dir={isRtl ? 'rtl' : 'ltr'}
                initial={{ opacity: 0, y: '100%' }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                className="fixed inset-0 z-50 w-full h-full bg-[#F7FAF4] dark:bg-[#121B11] text-[#151E14] dark:text-[#E8F2E4] flex flex-col overflow-hidden text-start"
                role="dialog"
                aria-modal="true"
                aria-label={
                  editingItem
                    ? isWork
                      ? t('spaces.editWorkItem')
                      : t('spaces.editStudyItem')
                    : isWork
                    ? t('spaces.addWorkItem')
                    : t('spaces.addStudyItem')
                }
              >
                {/* Sticky Header */}
                <div className="shrink-0 sticky top-0 z-20 bg-[#F7FAF4]/95 dark:bg-[#121B11]/95 backdrop-blur-md px-4 sm:px-8 py-3.5 border-b border-[#DCEAD4] dark:border-[#22301F] flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playPop();
                        setIsModalOpen(false);
                      }}
                      className="min-w-[44px] min-h-[44px] px-2 -ms-2 rounded-xl text-[#485B44] dark:text-[#9EB598] hover:bg-[#EAEFE6] dark:hover:bg-[#1C281A] transition-colors flex items-center justify-center gap-1.5 font-medium text-sm cursor-pointer"
                      aria-label={t('common.back', 'Back')}
                    >
                      <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
                      <span className="hidden sm:inline">{t('common.back', 'Back')}</span>
                    </button>

                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[#E8F8D8] dark:bg-[#1E3800] text-[#1C3700] dark:text-[#80D141] flex items-center justify-center shrink-0">
                        <SpaceIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-display text-base sm:text-lg font-bold text-[#151E14] dark:text-[#E8F2E4] leading-tight truncate">
                          {editingItem
                            ? isWork
                              ? t('spaces.editWorkItem')
                              : t('spaces.editStudyItem')
                            : isWork
                            ? t('spaces.addWorkItem')
                            : t('spaces.addStudyItem')}
                        </h2>
                        <p className="text-xs text-[#485B44] dark:text-[#9EB598] font-medium hidden sm:block truncate">
                          {t('spaces.modalSub')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form Content */}
                <form
                  onSubmit={handleSave}
                  className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-8 py-6"
                >
                  <div className="max-w-xl mx-auto space-y-5">
                    {/* Title */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`space-title-input-${space}`}
                        className="text-xs font-bold text-[#151E14] dark:text-[#E8F2E4] block"
                      >
                        {t('spaces.itemTitleLabel', 'Item Name')}
                      </label>
                      <input
                        ref={titleInputRef}
                        id={`space-title-input-${space}`}
                        type="text"
                        value={titleInput}
                        onChange={(e) => setTitleInput(e.target.value)}
                        placeholder={
                          isWork
                            ? t('spaces.workTitlePlaceholder')
                            : t('spaces.studyTitlePlaceholder')
                        }
                        className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-[#182316] border border-[#DCEAD4] dark:border-[#263722] text-sm text-[#151E14] dark:text-[#E8F2E4] focus:outline-none focus:ring-2 focus:ring-[#80D141]"
                        required
                      />
                    </div>

                    {/* Type / Kind Presets + Custom */}
                    <div className="space-y-2">
                      <label
                        htmlFor={`space-kind-input-${space}`}
                        className="text-xs font-bold text-[#151E14] dark:text-[#E8F2E4] block"
                      >
                        {t('spaces.itemKindLabel', 'Type / Label (Optional)')}
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {KIND_PRESETS[space].map((preset) => {
                          const label = isFa ? preset.fa : preset.en;
                          const isSelected = kindInput.trim().toLowerCase() === label.toLowerCase();
                          return (
                            <button
                              key={preset.en}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => {
                                soundEngine.playPop();
                                setKindInput(isSelected ? '' : label);
                              }}
                              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#80D141] text-[#0F2600] shadow-xs'
                                  : 'bg-white dark:bg-[#182316] text-[#485B44] dark:text-[#9EB598] border border-[#DCEAD4] dark:border-[#263722] hover:bg-[#EDF6E8]'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      <input
                        id={`space-kind-input-${space}`}
                        type="text"
                        value={kindInput}
                        onChange={(e) => setKindInput(e.target.value)}
                        placeholder={t('spaces.itemKindPlaceholder')}
                        className="w-full px-4 py-2.5 rounded-2xl bg-white dark:bg-[#182316] border border-[#DCEAD4] dark:border-[#263722] text-xs sm:text-sm text-[#151E14] dark:text-[#E8F2E4] focus:outline-none focus:ring-2 focus:ring-[#80D141]"
                      />
                    </div>

                    {/* Color Swatch Picker */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-[#151E14] dark:text-[#E8F2E4] block">
                        {t('spaces.itemColorLabel', 'Color Marker')}
                      </span>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {COLOR_SWATCHES.map((swatch) => {
                          const isSelected = colorInput === swatch;
                          return (
                            <button
                              key={swatch}
                              type="button"
                              aria-label={swatch}
                              aria-pressed={isSelected}
                              onClick={() => {
                                soundEngine.playPop();
                                setColorInput(swatch);
                              }}
                              className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform cursor-pointer ${
                                isSelected
                                  ? 'ring-2 ring-offset-2 ring-[#151E14] dark:ring-[#E8F2E4] ring-offset-[#F7FAF4] dark:ring-offset-[#121B11] scale-110'
                                  : 'hover:scale-105'
                              }`}
                              style={{ backgroundColor: swatch }}
                            >
                              {isSelected && <Check className="w-4 h-4 text-white drop-shadow-xs stroke-[3]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`space-notes-input-${space}`}
                        className="text-xs font-bold text-[#151E14] dark:text-[#E8F2E4] block"
                      >
                        {t('spaces.itemNotesLabel', 'Notes / Context (Optional)')}
                      </label>
                      <textarea
                        id={`space-notes-input-${space}`}
                        rows={3}
                        value={notesInput}
                        onChange={(e) => setNotesInput(e.target.value)}
                        placeholder={
                          isWork
                            ? t('spaces.workNotesPlaceholder')
                            : t('spaces.studyNotesPlaceholder')
                        }
                        className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-[#182316] border border-[#DCEAD4] dark:border-[#263722] text-xs sm:text-sm text-[#151E14] dark:text-[#E8F2E4] focus:outline-none focus:ring-2 focus:ring-[#80D141] resize-y"
                      />
                    </div>
                  </div>
                </form>

                {/* Sticky Footer */}
                <div className="shrink-0 sticky bottom-0 z-20 bg-[#F7FAF4]/95 dark:bg-[#121B11]/95 backdrop-blur-md px-4 sm:px-8 py-3.5 border-t border-[#DCEAD4] dark:border-[#22301F] flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playPop();
                      setIsModalOpen(false);
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-[#485B44] dark:text-[#9EB598] hover:bg-[#EDF6E8] dark:hover:bg-[#1C281A] transition-colors cursor-pointer"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    id={`btn-save-space-item-${space}`}
                    type="button"
                    onClick={() => handleSave()}
                    disabled={!titleInput.trim()}
                    className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#80D141] hover:bg-[#72BF36] disabled:opacity-40 text-[#0F2600] font-bold text-xs sm:text-sm shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      {editingItem
                        ? t('spaces.saveItem', 'Save Item')
                        : t('spaces.createItem', 'Add Item')}
                    </span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};
