import React, { useMemo, useState, useEffect } from 'react';
import { Briefcase, GraduationCap } from 'lucide-react';
import { SpaceItem, WorkStudySpace } from '../../types';
import { soundEngine } from '../../utils/audioSynth';
import { useI18n } from '../../utils/i18n';

interface SpaceItemPickerProps {
  spaceItems: SpaceItem[];
  selectedItemId?: string;
  onChange: (itemId: string | undefined) => void;
}

export const SpaceItemPicker: React.FC<SpaceItemPickerProps> = ({
  spaceItems,
  selectedItemId,
  onChange,
}) => {
  const { t } = useI18n();

  const workItems = useMemo(
    () => spaceItems.filter((item) => item.space === 'work'),
    [spaceItems]
  );
  const studyItems = useMemo(
    () => spaceItems.filter((item) => item.space === 'study'),
    [spaceItems]
  );

  const selectedItem = useMemo(
    () => spaceItems.find((item) => item.id === selectedItemId),
    [spaceItems, selectedItemId]
  );

  const [spaceFilter, setSpaceFilter] = useState<'all' | WorkStudySpace>(() => {
    if (selectedItem) return selectedItem.space;
    return 'all';
  });

  useEffect(() => {
    if (selectedItem) {
      setSpaceFilter((prev) => (prev === 'all' ? 'all' : selectedItem.space));
    }
  }, [selectedItem]);

  const visibleItems = useMemo(() => {
    if (spaceFilter === 'work') return workItems;
    if (spaceFilter === 'study') return studyItems;
    return spaceItems;
  }, [spaceItems, workItems, studyItems, spaceFilter]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="text-xs font-bold text-[#151E14] dark:text-[#E8F2E4] flex items-center gap-1.5">
          <Briefcase className="w-3.5 h-3.5 text-[#3B7E10] dark:text-[#80D141]" />
          <span>{t('journal.linkedItemOptional', 'Link to Work or Study (Optional)')}</span>
        </label>

        {spaceItems.length > 0 && (workItems.length > 0 || studyItems.length > 0) && (
          <div className="flex items-center gap-1 rounded-xl bg-[#EDF6E8] dark:bg-[#1E291C] p-0.5 border border-[#DCEAD4] dark:border-[#263722]">
            {(
              [
                { id: 'all', label: t('common.all', 'All') },
                { id: 'work', label: t('nav.work', 'Work') },
                { id: 'study', label: t('nav.study', 'Study') },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={spaceFilter === tab.id}
                onClick={() => {
                  soundEngine.playPop();
                  setSpaceFilter(tab.id);
                }}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  spaceFilter === tab.id
                    ? 'bg-[#80D141] text-[#0F2600]'
                    : 'text-[#485B44] dark:text-[#9EB598] hover:text-[#151E14] dark:hover:text-[#E8F2E4]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {spaceItems.length === 0 ? (
        <p className="text-xs text-[#485B44] dark:text-[#9EB598] px-3 py-2.5 rounded-2xl bg-[#F6FBF3] dark:bg-[#1E291C] border border-dashed border-[#DCEAD4] dark:border-[#263722]">
          {t(
            'journal.noSpaceItemsHint',
            'Add courses, lectures, jobs, or projects in Study or Work views to link entries here.'
          )}
        </p>
      ) : (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap py-1 w-full">
          <button
            type="button"
            aria-pressed={!selectedItemId}
            onClick={() => {
              soundEngine.playPop();
              onChange(undefined);
            }}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              !selectedItemId
                ? 'bg-[#80D141] text-[#0F2600] shadow-xs'
                : 'bg-white dark:bg-[#202E1E] text-[#485B44] dark:text-[#9EB598] border border-[#DCEAD4] dark:border-[#263722] hover:bg-[#EDF6E8]'
            }`}
          >
            {t('journal.noLinkedItem', 'None')}
          </button>

          {visibleItems.map((item) => {
            const isSelected = selectedItemId === item.id;
            const ItemIcon = item.space === 'work' ? Briefcase : GraduationCap;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  soundEngine.playPop();
                  onChange(isSelected ? undefined : item.id);
                }}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-[#80D141] text-[#0F2600] shadow-xs'
                    : 'bg-white dark:bg-[#202E1E] text-[#151E14] dark:text-[#E8F2E4] border border-[#DCEAD4] dark:border-[#263722] hover:bg-[#EDF6E8]'
                }`}
                title={item.kind ? `${item.title} (${item.kind})` : item.title}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: isSelected
                      ? '#0F2600'
                      : item.color || (item.space === 'work' ? '#80D141' : '#3B82F6'),
                  }}
                />
                <ItemIcon className="w-3.5 h-3.5 shrink-0 opacity-80" />
                <span>{item.title}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
