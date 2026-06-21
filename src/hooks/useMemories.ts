import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMemories, getMemory, getMediaBlob, deleteMemory, toggleFavorite, updateMemoryMetadata, getStats, clearDatabase } from '../services/indexedDB';
import { SnapchatMemory, ArchiveStats } from '../types';

export function useMemories() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['memories'],
    queryFn: getMemories,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMemory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
    },
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: toggleFavorite,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      queryClient.invalidateQueries({ queryKey: ['memory', id] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const updateMetadataMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<SnapchatMemory> }) =>
      updateMemoryMetadata(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      queryClient.invalidateQueries({ queryKey: ['memory', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const clearDatabaseMutation = useMutation({
    mutationFn: clearDatabase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
    },
  });

  // Client-side search and filtering
  const getFilteredMemories = (filters: {
    searchQuery: string;
    favoriteOnly: boolean;
    typeFilter: 'all' | 'photo' | 'video';
  }) => {
    const list = query.data || [];
    return list.filter((memory) => {
      // 1. Favorite filter
      if (filters.favoriteOnly && !memory.isFavorite) return false;

      // 2. Type filter
      if (filters.typeFilter !== 'all' && memory.type !== filters.typeFilter) return false;

      // 3. Search query
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const date = new Date(memory.dateTaken);
        
        // Match details
        const matchesFilename = memory.filename.toLowerCase().includes(q);
        const matchesType = memory.type.toLowerCase().includes(q);
        
        let matchesDate = false;
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear().toString();
          const monthName = date.toLocaleString('default', { month: 'long' }).toLowerCase();
          const monthShort = date.toLocaleString('default', { month: 'short' }).toLowerCase();
          const dateString = date.toLocaleDateString().toLowerCase();
          
          matchesDate = 
            year.includes(q) || 
            monthName.includes(q) || 
            monthShort.includes(q) || 
            dateString.includes(q);
        }

        return matchesFilename || matchesType || matchesDate;
      }

      return true;
    });
  };

  return {
    memories: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    getFilteredMemories,
    deleteMemory: deleteMutation.mutateAsync,
    toggleFavorite: toggleFavoriteMutation.mutateAsync,
    updateMetadata: updateMetadataMutation.mutateAsync,
    clearDatabase: clearDatabaseMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}

export function useMemoryDetail(id: string) {
  return useQuery({
    queryKey: ['memory', id],
    queryFn: () => getMemory(id),
    enabled: !!id,
  });
}

export function useMediaBlob(id: string) {
  return useQuery({
    queryKey: ['mediaBlob', id],
    queryFn: () => getMediaBlob(id),
    enabled: !!id,
    staleTime: Infinity, // Media blobs are static, cache forever
  });
}

export function useArchiveStats() {
  return useQuery<ArchiveStats>({
    queryKey: ['stats'],
    queryFn: getStats,
  });
}
