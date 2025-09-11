import { useState, useMemo } from 'react';

export interface UsePaginationProps<T> {
  data: T[];
  initialItemsPerPage?: number;
  initialPage?: number;
}

export interface UsePaginationReturn<T> {
  currentPage: number;
  itemsPerPage: number;
  totalPages: number;
  totalItems: number;
  paginatedData: T[];
  setCurrentPage: (page: number) => void;
  setItemsPerPage: (itemsPerPage: number) => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
}

export function usePagination<T>({
  data,
  initialItemsPerPage = 10,
  initialPage = 1
}: UsePaginationProps<T>): UsePaginationReturn<T> {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Ajustar página atual se necessário
  const adjustedCurrentPage = useMemo(() => {
    if (totalPages === 0) return 1;
    if (currentPage > totalPages) return totalPages;
    if (currentPage < 1) return 1;
    return currentPage;
  }, [currentPage, totalPages]);

  // Dados paginados
  const paginatedData = useMemo(() => {
    const startIndex = (adjustedCurrentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  }, [data, adjustedCurrentPage, itemsPerPage]);

  // Funções de navegação
  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToNextPage = () => {
    if (adjustedCurrentPage < totalPages) {
      setCurrentPage(adjustedCurrentPage + 1);
    }
  };
  const goToPreviousPage = () => {
    if (adjustedCurrentPage > 1) {
      setCurrentPage(adjustedCurrentPage - 1);
    }
  };

  // Função para alterar itens por página
  const handleSetItemsPerPage = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    // Recalcular página atual para manter o primeiro item visível
    const currentFirstItem = (adjustedCurrentPage - 1) * itemsPerPage + 1;
    const newPage = Math.ceil(currentFirstItem / newItemsPerPage);
    setCurrentPage(newPage);
  };

  // Função para alterar página atual
  const handleSetCurrentPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return {
    currentPage: adjustedCurrentPage,
    itemsPerPage,
    totalPages,
    totalItems,
    paginatedData,
    setCurrentPage: handleSetCurrentPage,
    setItemsPerPage: handleSetItemsPerPage,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPreviousPage
  };
}

export default usePagination;