import React from 'react';
import { useActionBarState, type BoardActionBarProps } from './actionbar/useActionBarState';
import { SpaceHeader } from './actionbar/SpaceHeader';
import { SubViewTabs } from './actionbar/SubViewTabs';
import { SearchAndFilterBar } from './actionbar/SearchAndFilterBar';
import { ShareModal } from './actionbar/ShareModal';
import { OverflowModals } from './actionbar/OverflowModals';


/** The header of a space: title, tabs (Summary, Board, List...), search, filters, grouping and the ... menu. */
export const BoardActionBar: React.FC<BoardActionBarProps> = (props) => {
  const s = useActionBarState(props);
  return (
    <div className="flex-shrink-0 border-b border-lira-border bg-white">
      <SpaceHeader {...s} />
      <SubViewTabs {...s} />
      <SearchAndFilterBar {...s} />
      <ShareModal {...s} />
      <OverflowModals {...s} />
    </div>
  );
};
