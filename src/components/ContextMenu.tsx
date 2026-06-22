import React, { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
  onClick: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const menuX = Math.min(x, window.innerWidth - 220);
  const menuY = Math.min(y, window.innerHeight - items.length * 32 - 16);

  return (
    <div
      ref={ref}
      className="fixed z-[9999] min-w-[180px] bg-[#22232A] border border-[#3A3B44] rounded-lg shadow-2xl py-1 overflow-hidden"
      style={{ left: menuX, top: menuY }}
    >
      {items.map((item) => (
        item.divider ? (
          <div key={item.id} className="h-[1px] bg-[#3A3B44] my-1 mx-2" />
        ) : (
          <button
            key={item.id}
            disabled={item.disabled}
            onClick={() => { if (!item.disabled) { item.onClick(); onClose(); } }}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left transition-all ${
              item.disabled
                ? 'text-[#555] cursor-not-allowed'
                : item.danger
                  ? 'text-[#FF6B6B] hover:bg-[#3A1A1A] cursor-pointer'
                  : 'text-[#C0C0C0] hover:bg-[#3A3B44] cursor-pointer'
            }`}
          >
            {item.icon && <span className="w-4 h-4 flex items-center justify-center">{item.icon}</span>}
            <span className="flex-1">{item.label}</span>
            {item.shortcut && <span className="text-[8px] text-[#666] ml-auto">{item.shortcut}</span>}
          </button>
        )
      ))}
    </div>
  );
}
