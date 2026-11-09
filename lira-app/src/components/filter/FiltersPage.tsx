import React from 'react';
import { useFiltersState, type FiltersPageProps } from './page/useFiltersState';
import { FiltersHeader } from './page/FiltersHeader';
import { FilterControls } from './page/FilterControls';
import { ActiveFilterChips } from './page/ActiveFilterChips';
import { ResultsTable } from './page/ResultsTable';

/** Cross-space ticket search with filters, presets, sorting and CSV / JSON export. */
export const FiltersPage: React.FC<FiltersPageProps> = (props) => {
  const s = useFiltersState(props);
  const { dropdownRef } = s;
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">
      <FiltersHeader {...s} />
      <div className="px-6 pt-4 pb-2 flex-shrink-0" ref={dropdownRef}>
        <FilterControls {...s} />
        <ActiveFilterChips {...s} />
      </div>
      <ResultsTable {...s} />
    </div>
  );
};
