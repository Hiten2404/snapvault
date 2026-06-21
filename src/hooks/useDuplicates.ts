import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDuplicateGroups, deleteMemory } from '../services/indexedDB';
import { DuplicateGroup } from '../types';

export function useDuplicates() {
  const queryClient = useQueryClient();

  const query = useQuery<DuplicateGroup[]>({
    queryKey: ['duplicates'],
    queryFn: getDuplicateGroups,
  });

  const deleteDuplicatesMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // Delete all specified duplicate IDs
      for (const id of ids) {
        await deleteMemory(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  // Calculate space savings
  const calculatePotentialSavings = () => {
    const groups = query.data || [];
    let savingsBytes = 0;

    groups.forEach((group) => {
      // We keep 1 and delete the rest (len - 1 files deleted)
      if (group.memories.length > 1) {
        const sizePerFile = group.memories[0].size;
        savingsBytes += sizePerFile * (group.memories.length - 1);
      }
    });

    return savingsBytes;
  };

  return {
    duplicateGroups: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    deleteDuplicates: deleteDuplicatesMutation.mutateAsync,
    isDeleting: deleteDuplicatesMutation.isPending,
    potentialSavings: calculatePotentialSavings(),
  };
}
