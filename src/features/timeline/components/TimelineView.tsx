'use client';

import React, { useState, useMemo } from 'react';
import { useMemories } from '../../../hooks/useMemories';
import MemoryGallery from '../../gallery/components/MemoryGallery';
import { SnapchatMemory } from '../../../types';
import { Calendar, ChevronDown, ChevronRight, Hash } from 'lucide-react';

interface TimelineTreeItem {
  year: number;
  count: number;
  months: {
    monthVal: number;
    monthName: string;
    count: number;
  }[];
}

export default function TimelineView({ 
  onSelectMemory,
  selectedMemoryIds,
  setSelectedMemoryIds
}: { 
  onSelectMemory: (memory: SnapchatMemory) => void;
  selectedMemoryIds?: Record<string, boolean>;
  setSelectedMemoryIds?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const { memories } = useMemories();

  // Active navigation filters
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [filterMonthVal, setFilterMonthVal] = useState<number | null>(null);
  const [filterMonthName, setFilterMonthName] = useState<string | null>(null);
  
  // Expanded years in sidebar
  const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({});

  // Compute timeline tree hierarchy from memories
  const timelineTree = useMemo(() => {
    const treeMap: Record<number, Record<number, number>> = {};
    
    memories.forEach((memory) => {
      const date = new Date(memory.dateTaken);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = date.getMonth();
        
        if (!treeMap[year]) {
          treeMap[year] = {};
        }
        treeMap[year][month] = (treeMap[year][month] || 0) + 1;
      }
    });

    return Object.entries(treeMap)
      .map(([yearStr, monthsMap]) => {
        const year = parseInt(yearStr);
        const months = Object.entries(monthsMap)
          .map(([monthStr, count]) => {
            const monthVal = parseInt(monthStr);
            const monthName = new Date(year, monthVal).toLocaleString('default', { month: 'long' });
            return { monthVal, monthName, count };
          })
          .sort((a, b) => b.monthVal - a.monthVal); // Newest month first

        const count = months.reduce((sum, m) => sum + m.count, 0);

        return { year, count, months };
      })
      .sort((a, b) => b.year - a.year); // Newest year first
  }, [memories]);

  // Set default expanded years on load
  React.useEffect(() => {
    if (timelineTree.length > 0 && Object.keys(expandedYears).length === 0) {
      // Expand the first year by default
      setExpandedYears({ [timelineTree[0].year]: true });
    }
  }, [timelineTree]);

  const toggleYearExpand = (year: number) => {
    setExpandedYears((prev) => ({
      ...prev,
      [year]: !prev[year],
    }));
  };

  const handleSelectYear = (year: number) => {
    setFilterYear(year);
    setFilterMonthVal(null);
    setFilterMonthName(null);
  };

  const handleSelectMonth = (year: number, monthVal: number, monthName: string) => {
    setFilterYear(year);
    setFilterMonthVal(monthVal);
    setFilterMonthName(monthName);
  };

  const handleClearFilters = () => {
    setFilterYear(null);
    setFilterMonthVal(null);
    setFilterMonthName(null);
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 animate-fade-in h-full">
      {/* Left Column: Timeline Tree Sidebar */}
      <div className="w-full md:w-64 shrink-0 bg-neutral-900/10 border border-neutral-900 rounded-3xl p-5 self-start glass-card">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-900 mb-4">
          <h2 className="text-xs font-black uppercase text-neutral-450 tracking-wider flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-neutral-500" />
            <span>Timeline Index</span>
          </h2>
          {(filterYear !== null || filterMonthVal !== null) && (
            <button
              onClick={handleClearFilters}
              className="text-[10px] font-bold text-yellow-500 hover:text-yellow-400"
            >
              Reset
            </button>
          )}
        </div>

        {timelineTree.length === 0 ? (
          <p className="text-xs text-neutral-600 italic">No timeline data available.</p>
        ) : (
          <div className="space-y-2 max-h-[60vh] md:max-h-[75vh] overflow-y-auto pr-1">
            {/* Show All Option */}
            <button
              onClick={handleClearFilters}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                filterYear === null
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Hash className="h-3.5 w-3.5" />
              <span>Show All</span>
              <span className="ml-auto text-[10px] text-neutral-500">
                {memories.length}
              </span>
            </button>

            {/* Tree Items */}
            {timelineTree.map((node) => {
              const isExpanded = !!expandedYears[node.year];
              const isYearSelected = filterYear === node.year && filterMonthVal === null;

              return (
                <div key={node.year} className="space-y-1">
                  {/* Year Header */}
                  <div
                    className={`group flex items-center rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer transition-all ${
                      isYearSelected
                        ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                        : 'text-neutral-350 hover:bg-neutral-900/40 hover:text-neutral-100'
                    }`}
                  >
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleYearExpand(node.year);
                      }}
                      className="p-1 rounded hover:bg-neutral-800 mr-1 text-neutral-500"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </div>
                    <span 
                      onClick={() => handleSelectYear(node.year)}
                      className="flex-1 select-none"
                    >
                      {node.year}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-bold">
                      {node.count}
                    </span>
                  </div>

                  {/* Months Children */}
                  {isExpanded && (
                    <div className="pl-6 border-l border-neutral-900 space-y-0.5 ml-4">
                      {node.months.map((m) => {
                        const isMonthSelected =
                          filterYear === node.year && filterMonthVal === m.monthVal;

                        return (
                          <button
                            key={m.monthVal}
                            onClick={() => handleSelectMonth(node.year, m.monthVal, m.monthName)}
                            className={`flex w-full items-center gap-2 rounded-lg py-1.5 px-3.5 text-xs text-left transition-all ${
                              isMonthSelected
                                ? 'text-yellow-400 font-bold bg-neutral-900/50'
                                : 'text-neutral-450 hover:text-neutral-200'
                            }`}
                          >
                            <span className="text-neutral-600 mr-1">├</span>
                            <span>{m.monthName}</span>
                            <span className="ml-auto text-[10px] text-neutral-500 font-medium">
                              {m.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Column: Memories Display */}
      <div className="flex-1">
        <MemoryGallery
          onSelectMemory={onSelectMemory}
          initialYear={filterYear}
          initialMonth={filterMonthName}
          selectedMemoryIds={selectedMemoryIds}
          setSelectedMemoryIds={setSelectedMemoryIds}
        />
      </div>
    </div>
  );
}
