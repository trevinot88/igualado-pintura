"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

interface IgualacionLine {
  id: string;
  code: string;
  name: string;
  description?: string;
}

interface IgualacionLineComboboxProps {
  lines: IgualacionLine[];
  value: string;
  onChange: (lineId: string) => void;
  placeholder?: string;
}

export function IgualacionLineCombobox({
  lines,
  value,
  onChange,
  placeholder = "Buscar por código o descripción...",
}: IgualacionLineComboboxProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLine = lines.find((line) => line.id === value);

  // Filter lines based on search
  const filteredLines = search
    ? lines.filter((line) => {
        const searchLower = search.toLowerCase();
        return (
          line.code.toLowerCase().includes(searchLower) ||
          line.name.toLowerCase().includes(searchLower)
        );
      })
    : lines;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(lineId: string) {
    onChange(lineId);
    setSearch("");
    setIsOpen(false);
  }

  function handleClear() {
    onChange("");
    setSearch("");
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Display selected value or search input */}
      {selectedLine && !isOpen ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
            <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {selectedLine.code}
            </span>
            <span className="mx-2 text-slate-400">—</span>
            <span className="text-slate-600 dark:text-slate-400 truncate">
              {selectedLine.name}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            ✕
          </button>
        </div>
      ) : (
        <Input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full"
        />
      )}

      {/* Dropdown list */}
      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-950">
          {filteredLines.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No se encontraron líneas de igualación
            </div>
          ) : (
            <div className="py-1">
              {filteredLines.map((line) => (
                <button
                  key={line.id}
                  type="button"
                  onClick={() => handleSelect(line.id)}
                  className="w-full px-4 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-baseline gap-2"
                >
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                    {line.code}
                  </span>
                  <span className="text-slate-400 shrink-0">—</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {line.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
