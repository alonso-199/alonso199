import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Transaction, MonthlySummary } from '@/types/transaction';
import { fetchBNAExchangeRateForDate, clearExchangeRateCache } from '@/utils/exchangeRate';

const STORAGE_KEY = 'inventory_transactions';
const SUGGESTIONS_KEY = 'inventory_suggestions';

interface Suggestions {
  productTypes: string[];
  productNames: string[];
  notes: string[];
}

const DEFAULT_SUGGESTIONS: Suggestions = {
  productTypes: [],
  productNames: [],
  notes: [],
};

export const [TransactionProvider, useTransactions] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestions>(DEFAULT_SUGGESTIONS);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const transactionsQuery = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      console.log('[TransactionContext] Loading transactions from storage');
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const data = stored ? JSON.parse(stored) : [];
      console.log('[TransactionContext] Loaded', data.length, 'transactions');
      return data as Transaction[];
    },
  });

  const suggestionsQuery = useQuery({
    queryKey: ['suggestions'],
    queryFn: async () => {
      console.log('[TransactionContext] Loading suggestions from storage');
      const stored = await AsyncStorage.getItem(SUGGESTIONS_KEY);
      return stored ? JSON.parse(stored) as Suggestions : DEFAULT_SUGGESTIONS;
    },
  });

  useEffect(() => {
    if (suggestionsQuery.data) {
      setSuggestions(suggestionsQuery.data);
    }
  }, [suggestionsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (newTransactions: Transaction[]) => {
      console.log('[TransactionContext] Saving', newTransactions.length, 'transactions');
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newTransactions));
      return newTransactions;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const saveSuggestionsMutation = useMutation({
    mutationFn: async (newSuggestions: Suggestions) => {
      console.log('[TransactionContext] Saving suggestions');
      await AsyncStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(newSuggestions));
      return newSuggestions;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
    },
  });

  const { mutate: saveTransactions } = saveMutation;
  const { mutate: saveSuggestions } = saveSuggestionsMutation;

  useEffect(() => {
    if (transactionsQuery.data) {
      setTransactions(transactionsQuery.data);
    }
  }, [transactionsQuery.data]);

  const updateSuggestions = useCallback((transaction: { productType?: string; productName: string; notes?: string }) => {
    const newSuggestions = { ...suggestions };
    
    if (transaction.productType && !newSuggestions.productTypes.includes(transaction.productType)) {
      newSuggestions.productTypes = [transaction.productType, ...newSuggestions.productTypes].slice(0, 20);
    }
    if (transaction.productName && !newSuggestions.productNames.includes(transaction.productName)) {
      newSuggestions.productNames = [transaction.productName, ...newSuggestions.productNames].slice(0, 20);
    }
    if (transaction.notes && !newSuggestions.notes.includes(transaction.notes)) {
      newSuggestions.notes = [transaction.notes, ...newSuggestions.notes].slice(0, 20);
    }
    
    setSuggestions(newSuggestions);
    saveSuggestions(newSuggestions);
  }, [suggestions, saveSuggestions]);

  const deleteSuggestion = useCallback((type: 'productTypes' | 'productNames' | 'notes', value: string) => {
    console.log('[TransactionContext] Deleting suggestion:', type, value);
    const newSuggestions = { ...suggestions };
    newSuggestions[type] = newSuggestions[type].filter(item => item !== value);
    setSuggestions(newSuggestions);
    saveSuggestions(newSuggestions);
  }, [suggestions, saveSuggestions]);

  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id' | 'totalValue'>) => {
    const dateStr = transaction.date || new Date().toISOString().split('T')[0];
    let exchangeRate: number | undefined;
    try {
      exchangeRate = await fetchBNAExchangeRateForDate(dateStr);
      console.log('[TransactionContext] Fetched exchange rate for', dateStr, ':', exchangeRate);
      
      if (exchangeRate && exchangeRate < 500) {
        console.log('[TransactionContext] Exchange rate too low, clearing cache and refetching');
        await clearExchangeRateCache();
        exchangeRate = await fetchBNAExchangeRateForDate(dateStr);
        console.log('[TransactionContext] Refetched exchange rate:', exchangeRate);
      }
    } catch (error) {
      console.error('[TransactionContext] Error fetching exchange rate:', error);
    }

    const newTransaction: Transaction = {
      ...transaction,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      totalValue: transaction.quantity * (transaction.unitPrice ?? 0),
      exchangeRate,
    };
    console.log('[TransactionContext] Adding transaction:', newTransaction.productName);
    const updated = [...transactions, newTransaction];
    setTransactions(updated);
    saveTransactions(updated);
    updateSuggestions(transaction);
    return newTransaction;
  }, [transactions, saveTransactions, updateSuggestions]);

  const updateTransaction = useCallback((id: string, updates: Partial<Omit<Transaction, 'id' | 'totalValue'>>) => {
    console.log('[TransactionContext] Updating transaction:', id);
    const updated = transactions.map(t => {
      if (t.id === id) {
        const quantity = updates.quantity ?? t.quantity;
        const unitPrice = updates.unitPrice ?? t.unitPrice;
        return {
          ...t,
          ...updates,
          totalValue: quantity * (unitPrice ?? 0),
        };
      }
      return t;
    });
    setTransactions(updated);
    saveTransactions(updated);
    
    const updatedTransaction = updated.find(t => t.id === id);
    if (updatedTransaction) {
      updateSuggestions(updatedTransaction);
    }
  }, [transactions, saveTransactions, updateSuggestions]);

  const deleteTransaction = useCallback((id: string) => {
    console.log('[TransactionContext] Deleting transaction:', id);
    const updated = transactions.filter(t => t.id !== id);
    setTransactions(updated);
    saveTransactions(updated);
  }, [transactions, saveTransactions]);

  const getMonthlyTransactions = useCallback((month: string) => {
    return transactions.filter(t => t.date.startsWith(month));
  }, [transactions]);

  const getMonthlySummary = useCallback((month: string): MonthlySummary => {
    const monthTransactions = getMonthlyTransactions(month);
    const [year, monthNum] = month.split('-');
    
    const totalEntradas = monthTransactions
      .filter(t => t.type === 'entrada')
      .reduce((sum, t) => sum + t.totalValue, 0);
    
    const totalSalidas = monthTransactions
      .filter(t => t.type === 'salida')
      .reduce((sum, t) => sum + t.totalValue, 0);

    return {
      month: monthNum,
      year: parseInt(year),
      totalEntradas,
      totalSalidas,
      margenBruto: totalSalidas - totalEntradas,
      transactionCount: monthTransactions.length,
    };
  }, [getMonthlyTransactions]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    const now = new Date();
    months.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    
    transactions.forEach(t => {
      const month = t.date.substring(0, 7);
      months.add(month);
    });
    
    return Array.from(months).sort().reverse();
  }, [transactions]);

  return {
    transactions,
    selectedMonth,
    setSelectedMonth,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getMonthlyTransactions,
    getMonthlySummary,
    availableMonths,
    suggestions,
    deleteSuggestion,
    isLoading: transactionsQuery.isLoading,
    isSaving: saveMutation.isPending,
  };
});

export function useCurrentMonthSummary() {
  const { selectedMonth, getMonthlySummary } = useTransactions();
  return useMemo(() => getMonthlySummary(selectedMonth), [selectedMonth, getMonthlySummary]);
}

export function useCurrentMonthTransactions() {
  const { selectedMonth, getMonthlyTransactions } = useTransactions();
  return useMemo(() => getMonthlyTransactions(selectedMonth), [selectedMonth, getMonthlyTransactions]);
}
