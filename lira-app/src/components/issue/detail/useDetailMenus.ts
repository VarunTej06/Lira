import { useEffect, useRef, useState } from 'react';

/** The open/closed state of the ticket popup's menus and collapsible sections; an open menu closes on a click outside it. */
export function useDetailMenus() {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [descCollapsed, setDescCollapsed] = useState(false);
  const [attCollapsed, setAttCollapsed] = useState(false);
  const [childCollapsed, setChildCollapsed] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      const target = e.target as Node;
      if (statusMenuRef.current && !statusMenuRef.current.contains(target)) setShowStatusMenu(false);
      if (typeMenuRef.current && !typeMenuRef.current.contains(target)) setShowTypeMenu(false);
      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) setShowMoreMenu(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  return {
    showStatusMenu, setShowStatusMenu, showTypeMenu, setShowTypeMenu, showMoreMenu, setShowMoreMenu, showDeleteConfirm, setShowDeleteConfirm,
    descCollapsed, setDescCollapsed, attCollapsed, setAttCollapsed, childCollapsed, setChildCollapsed, savedToast, setSavedToast,
    statusMenuRef, typeMenuRef, moreMenuRef,
  };
}
