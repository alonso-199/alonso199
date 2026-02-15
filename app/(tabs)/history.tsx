import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Trash2, Package, ChevronDown, X, Tags, Hash, DollarSign, FileText, Check, Search, ArrowUpDown, ArrowUp, ArrowDown, Calendar } from 'lucide-react-native';
import Colors from '../../constants/colors';
import { useTransactions, useCurrentMonthTransactions } from '../../context/TransactionContext';
import { formatMonthName, formatCurrency } from '../../utils/excelExport';
import { calculateUSDTotalFromTransactions, formatUSD } from '../../utils/exchangeRate';
import { formatDisplayDate, compareDateISO, parseDateParts, datePartsToISO } from '../../utils/dateUtils';
import { Transaction, TransactionType } from '../../types/transaction';

type FilterType = 'all' | 'entrada' | 'salida';
type SortType = 'date_desc' | 'date_asc' | 'value_desc' | 'value_asc';

interface EditModalProps {
  transaction: Transaction | null;
  visible: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Transaction>) => void;
  suggestions: { productTypes: string[]; productNames: string[]; notes: string[] };
}

function EditModal({ transaction, visible, onClose, onSave, suggestions }: EditModalProps) {
  const [type, setType] = useState<TransactionType>('entrada');
  const [productType, setProductType] = useState('');
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [dayInput, setDayInput] = useState('');
  const [monthInput, setMonthInput] = useState('');
  const [yearInput, setYearInput] = useState('');
  const [showProductTypeSuggestions, setShowProductTypeSuggestions] = useState(false);
  const [showProductNameSuggestions, setShowProductNameSuggestions] = useState(false);
  const [showNotesSuggestions, setShowNotesSuggestions] = useState(false);

  React.useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setProductType(transaction.productType || '');
      setProductName(transaction.productName);
      setQuantity(transaction.quantity.toString());
      setUnitPrice(transaction.unitPrice?.toString() ?? '');
      setNotes(transaction.notes || '');
      setDateStr(transaction.date);
      const parts = parseDateParts(transaction.date);
      setDayInput(parts.day);
      setMonthInput(parts.month);
      setYearInput(parts.year);
    }
  }, [transaction]);

  const filteredProductTypes = useMemo(() => {
    if (!productType) return suggestions.productTypes;
    return suggestions.productTypes.filter(s => 
      s.toLowerCase().includes(productType.toLowerCase())
    );
  }, [suggestions.productTypes, productType]);

  const filteredProductNames = useMemo(() => {
    if (!productName) return suggestions.productNames;
    return suggestions.productNames.filter(s => 
      s.toLowerCase().includes(productName.toLowerCase())
    );
  }, [suggestions.productNames, productName]);

  const filteredNotes = useMemo(() => {
    if (!notes) return suggestions.notes;
    return suggestions.notes.filter(s => 
      s.toLowerCase().includes(notes.toLowerCase())
    );
  }, [suggestions.notes, notes]);

  const totalValue = (parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0);

  const handleSave = () => {
    if (!productName.trim()) {
      Alert.alert('Error', 'Por favor ingresa el nombre del producto');
      return;
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      Alert.alert('Error', 'Por favor ingresa una cantidad válida');
      return;
    }
    if (!unitPrice || parseFloat(unitPrice) <= 0) {
      Alert.alert('Error', 'Por favor ingresa un precio válido');
      return;
    }
    const dateToUse = datePartsToISO(dayInput, monthInput, yearInput) ?? dateStr;
    if (!dateToUse) {
      Alert.alert('Error', 'Por favor ingresa una fecha válida (día, mes y año).');
      return;
    }

    if (transaction) {
      onSave(transaction.id, {
        type,
        productType: productType.trim() || undefined,
        productName: productName.trim(),
        quantity: parseFloat(quantity),
        unitPrice: parseFloat(unitPrice),
        notes: notes.trim() || undefined,
        date: dateToUse,
      });
      onClose();
    }
  };

  const renderSuggestionDropdown = (
    items: string[],
    onSelect: (value: string) => void,
    visible: boolean,
    onCloseDropdown: () => void
  ) => {
    if (!visible || items.length === 0) return null;
    return (
      <View style={styles.suggestionDropdown}>
        <View style={styles.suggestionHeader}>
          <Text style={styles.suggestionTitle}>Valores recientes</Text>
          <TouchableOpacity onPress={onCloseDropdown}>
            <X size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.suggestionList} nestedScrollEnabled>
          {items.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionItem}
              onPress={() => {
                onSelect(item);
                onCloseDropdown();
              }}
            >
              <Text style={styles.suggestionText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Transacción</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalScroll} 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeOption,
                    type === 'entrada' && styles.typeOptionEntrada,
                  ]}
                  onPress={() => setType('entrada')}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      type === 'entrada' && styles.typeOptionTextActive,
                    ]}
                  >
                    Compra
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeOption,
                    type === 'salida' && styles.typeOptionSalida,
                  ]}
                  onPress={() => setType('salida')}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      type === 'salida' && styles.typeOptionTextActive,
                    ]}
                  >
                    Venta
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Calendar size={16} color={Colors.textSecondary} />
                  <Text style={styles.labelText}>Fecha</Text>
                </View>
                <View style={styles.datePartsRow}>
                  <TextInput
                    style={[styles.input, styles.datePartInput]}
                    value={dayInput}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/\D/g, '').slice(0, 2);
                      setDayInput(cleaned);
                      const iso = datePartsToISO(cleaned, monthInput, yearInput);
                      if (iso) setDateStr(iso);
                    }}
                    placeholder="DD"
                    placeholderTextColor={Colors.textLight}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                  <Text style={styles.dateSeparator}>/</Text>
                  <TextInput
                    style={[styles.input, styles.datePartInput]}
                    value={monthInput}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/\D/g, '').slice(0, 2);
                      setMonthInput(cleaned);
                      const iso = datePartsToISO(dayInput, cleaned, yearInput);
                      if (iso) setDateStr(iso);
                    }}
                    placeholder="MM"
                    placeholderTextColor={Colors.textLight}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                  <Text style={styles.dateSeparator}>/</Text>
                  <TextInput
                    style={[styles.input, styles.datePartInput]}
                    value={yearInput}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/\D/g, '').slice(0, 4);
                      setYearInput(cleaned);
                      const iso = datePartsToISO(dayInput, monthInput, cleaned);
                      if (iso) setDateStr(iso);
                    }}
                    placeholder="AAAA"
                    placeholderTextColor={Colors.textLight}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Tags size={16} color={Colors.textSecondary} />
                  <Text style={styles.labelText}>Tipo de Producto</Text>
                </View>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Tipo de producto"
                    placeholderTextColor={Colors.textLight}
                    value={productType}
                    onChangeText={setProductType}
                    onFocus={() => setShowProductTypeSuggestions(true)}
                  />
                  {suggestions.productTypes.length > 0 && (
                    <TouchableOpacity 
                      style={styles.dropdownButton}
                      onPress={() => setShowProductTypeSuggestions(!showProductTypeSuggestions)}
                    >
                      <ChevronDown size={18} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
                {renderSuggestionDropdown(
                  filteredProductTypes,
                  setProductType,
                  showProductTypeSuggestions,
                  () => setShowProductTypeSuggestions(false)
                )}
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Package size={16} color={Colors.textSecondary} />
                  <Text style={styles.labelText}>Producto</Text>
                </View>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Nombre del producto"
                    placeholderTextColor={Colors.textLight}
                    value={productName}
                    onChangeText={setProductName}
                    onFocus={() => setShowProductNameSuggestions(true)}
                  />
                  {suggestions.productNames.length > 0 && (
                    <TouchableOpacity 
                      style={styles.dropdownButton}
                      onPress={() => setShowProductNameSuggestions(!showProductNameSuggestions)}
                    >
                      <ChevronDown size={18} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
                {renderSuggestionDropdown(
                  filteredProductNames,
                  setProductName,
                  showProductNameSuggestions,
                  () => setShowProductNameSuggestions(false)
                )}
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <View style={styles.inputLabel}>
                    <Hash size={16} color={Colors.textSecondary} />
                    <Text style={styles.labelText}>Cantidad</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={Colors.textLight}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <View style={styles.inputLabel}>
                    <DollarSign size={16} color={Colors.textSecondary} />
                    <Text style={styles.labelText}>Precio Unit.</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    placeholderTextColor={Colors.textLight}
                    value={unitPrice}
                    onChangeText={setUnitPrice}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <FileText size={16} color={Colors.textSecondary} />
                  <Text style={styles.labelText}>Notas</Text>
                </View>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={[styles.input, styles.notesInput]}
                    placeholder="Notas adicionales..."
                    placeholderTextColor={Colors.textLight}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={2}
                    onFocus={() => setShowNotesSuggestions(true)}
                  />
                  {suggestions.notes.length > 0 && (
                    <TouchableOpacity 
                      style={[styles.dropdownButton, { top: 10 }]}
                      onPress={() => setShowNotesSuggestions(!showNotesSuggestions)}
                    >
                      <ChevronDown size={18} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
                {renderSuggestionDropdown(
                  filteredNotes,
                  setNotes,
                  showNotesSuggestions,
                  () => setShowNotesSuggestions(false)
                )}
              </View>

              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Valor Total</Text>
                <Text
                  style={[
                    styles.totalValue,
                    { color: type === 'entrada' ? Colors.entrada : Colors.salida },
                  ]}
                >
                  ${totalValue.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { backgroundColor: type === 'entrada' ? Colors.entrada : Colors.salida },
                ]}
                onPress={handleSave}
              >
                <Check size={20} color={Colors.textInverse} />
                <Text style={styles.saveButtonText}>Guardar Cambios</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default function HistoryScreen() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const { selectedMonth, setSelectedMonth, availableMonths, deleteTransaction, updateTransaction, suggestions } = useTransactions();
  const transactions = useCurrentMonthTransactions();
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortType, setSortType] = useState<SortType>('date_desc');
  const [showSortPicker, setShowSortPicker] = useState(false);

  useEffect(() => {
    if (params.filter === 'entrada' || params.filter === 'salida') {
      setFilterType(params.filter);
    }
  }, [params.filter]);

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];
    
    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.type === filterType);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(t => 
        t.productName.toLowerCase().includes(query) ||
        (t.productType && t.productType.toLowerCase().includes(query)) ||
        (t.notes && t.notes.toLowerCase().includes(query)) ||
        t.totalValue.toString().includes(query) ||
        (t.unitPrice?.toString() ?? '').includes(query) ||
        t.quantity.toString().includes(query)
      );
    }
    
    switch (sortType) {
      case 'date_desc':
        return filtered.sort((a, b) => -compareDateISO(a.date, b.date));
      case 'date_asc':
        return filtered.sort((a, b) => compareDateISO(a.date, b.date));
      case 'value_desc':
        return filtered.sort((a, b) => b.totalValue - a.totalValue);
      case 'value_asc':
        return filtered.sort((a, b) => a.totalValue - b.totalValue);
      default:
        return filtered;
    }
  }, [transactions, filterType, searchQuery, sortType]);

  const sortOptions = [
    { value: 'date_desc' as SortType, label: 'Fecha (más reciente)', icon: ArrowDown },
    { value: 'date_asc' as SortType, label: 'Fecha (más antigua)', icon: ArrowUp },
    { value: 'value_desc' as SortType, label: 'Mayor valor', icon: ArrowDown },
    { value: 'value_asc' as SortType, label: 'Menor valor', icon: ArrowUp },
  ];

  const currentSortLabel = sortOptions.find(o => o.value === sortType)?.label || 'Ordenar';

  const filteredTotalUSD = useMemo(() => {
    return calculateUSDTotalFromTransactions(filteredTransactions);
  }, [filteredTransactions]);

  const handleDelete = (transaction: Transaction) => {
    Alert.alert(
      'Eliminar Transacción',
      `¿Estás seguro de eliminar "${transaction.productName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            deleteTransaction(transaction.id);
            console.log('[History] Transaction deleted:', transaction.id);
          },
        },
      ]
    );
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
  };

  const handleSaveEdit = (id: string, updates: Partial<Transaction>) => {
    updateTransaction(id, updates);
    console.log('[History] Transaction updated:', id);
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <TouchableOpacity 
      style={styles.transactionCard}
      onPress={() => handleEdit(item)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.typeIndicator,
          { backgroundColor: item.type === 'entrada' ? Colors.entrada : Colors.salida },
        ]}
      />
      <View style={styles.transactionContent}>
        <View style={styles.transactionHeader}>
          <View style={styles.productInfo}>
            {item.productType && (
              <Text style={styles.productType}>{item.productType}</Text>
            )}
            <Text style={styles.productName}>{item.productName}</Text>
          </View>
          <View style={styles.valueContainer}>
            <Text
              style={[
                styles.totalValueText,
                { color: item.type === 'entrada' ? Colors.entrada : Colors.salida },
              ]}
            >
              {item.type === 'entrada' ? '-' : '+'}
              {formatCurrency(item.totalValue)}
            </Text>
            {item.exchangeRate && (
              <>
                <Text style={styles.usdValueText}>
                  (US${(item.totalValue / item.exchangeRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                </Text>
                <Text style={styles.exchangeRateText}>
                  1 USD = ${item.exchangeRate.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </>
            )}
          </View>
        </View>
        
        <View style={styles.transactionDetails}>
          <Text style={styles.detailText}>
            {item.quantity} × ${(item.unitPrice ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </Text>
          <Text style={styles.dateText}>
            {formatDisplayDate(item.date)}
          </Text>
        </View>
        
        {item.notes && (
          <Text style={styles.notes}>{item.notes}</Text>
        )}

        <View style={styles.transactionActions}>
          <View
            style={[
              styles.typeBadge,
              { backgroundColor: item.type === 'entrada' ? Colors.entrada + '20' : Colors.salida + '20' },
            ]}
          >
            <Text
              style={[
                styles.typeBadgeText,
                { color: item.type === 'entrada' ? Colors.entrada : Colors.salida },
              ]}
            >
              {item.type === 'entrada' ? 'COMPRA' : 'VENTA'}
            </Text>
          </View>
          
          <View style={styles.actionButtons}>
            <Text style={styles.editHint}>Toca para editar</Text>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDelete(item)}
              testID={`delete-${item.id}`}
            >
              <Trash2 size={18} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.monthSelector}
          onPress={() => setShowMonthPicker(!showMonthPicker)}
        >
          <Text style={styles.monthText}>{formatMonthName(selectedMonth)}</Text>
          <ChevronDown size={20} color={Colors.text} />
        </TouchableOpacity>

        {showMonthPicker && (
          <View style={styles.monthDropdown}>
            {availableMonths.map((month) => (
              <TouchableOpacity
                key={month}
                style={[
                  styles.monthOption,
                  month === selectedMonth && styles.monthOptionSelected,
                ]}
                onPress={() => {
                  setSelectedMonth(month);
                  setShowMonthPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.monthOptionText,
                    month === selectedMonth && styles.monthOptionTextSelected,
                  ]}
                >
                  {formatMonthName(month)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search size={18} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar producto, tipo, valor..."
            placeholderTextColor={Colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            testID="search-input"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.filters}>
        <TouchableOpacity
          style={[styles.filterButton, filterType === 'all' && styles.filterButtonActive]}
          onPress={() => setFilterType('all')}
        >
          <Text style={[styles.filterText, filterType === 'all' && styles.filterTextActive]}>
            Todos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filterType === 'entrada' && styles.filterButtonEntrada,
          ]}
          onPress={() => setFilterType('entrada')}
        >
          <Text
            style={[
              styles.filterText,
              filterType === 'entrada' && styles.filterTextActive,
            ]}
          >
            Compras
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filterType === 'salida' && styles.filterButtonSalida,
          ]}
          onPress={() => setFilterType('salida')}
        >
          <Text
            style={[
              styles.filterText,
              filterType === 'salida' && styles.filterTextActive,
            ]}
          >
            Ventas
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sortContainer}>
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setShowSortPicker(!showSortPicker)}
        >
          <ArrowUpDown size={16} color={Colors.primary} />
          <Text style={styles.sortButtonText}>{currentSortLabel}</Text>
          <ChevronDown size={16} color={Colors.primary} />
        </TouchableOpacity>

        {showSortPicker && (
          <View style={styles.sortDropdown}>
            {sortOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.sortOption,
                  sortType === option.value && styles.sortOptionSelected,
                ]}
                onPress={() => {
                  setSortType(option.value);
                  setShowSortPicker(false);
                }}
              >
                <option.icon size={16} color={sortType === option.value ? Colors.primary : Colors.textSecondary} />
                <Text
                  style={[
                    styles.sortOptionText,
                    sortType === option.value && styles.sortOptionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          {filteredTransactions.length} transacciones
        </Text>
        <View style={styles.statsValueContainer}>
          <Text style={styles.statsText}>
            Total: {formatCurrency(
              filteredTransactions.reduce((sum, t) => sum + t.totalValue, 0)
            )}
          </Text>
          {filteredTotalUSD > 0 && (
            <Text style={styles.statsTextUSD}>({formatUSD(filteredTotalUSD)})</Text>
          )}
        </View>
      </View>

      <FlatList
        data={filteredTransactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Package size={64} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>Sin transacciones</Text>
            <Text style={styles.emptySubtitle}>
              No hay {filterType !== 'all' ? filterType + 's' : 'transacciones'} registradas para este mes
            </Text>
          </View>
        }
      />

      <EditModal
        transaction={editingTransaction}
        visible={editingTransaction !== null}
        onClose={() => setEditingTransaction(null)}
        onSave={handleSaveEdit}
        suggestions={suggestions}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 0,
  },
  sortContainer: {
    paddingHorizontal: 20,
    marginBottom: 12,
    zIndex: 15,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight + '20',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    alignSelf: 'flex-start',
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  sortDropdown: {
    position: 'absolute',
    top: 45,
    left: 20,
    right: 20,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      },
    }),
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sortOptionSelected: {
    backgroundColor: Colors.primaryLight + '15',
  },
  sortOptionText: {
    fontSize: 15,
    color: Colors.text,
  },
  sortOptionTextSelected: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  header: {
    padding: 20,
    paddingBottom: 12,
    zIndex: 20,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      },
    }),
  },
  monthText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  monthDropdown: {
    position: 'absolute',
    top: 70,
    left: 20,
    right: 20,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      },
    }),
  },
  monthOption: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  monthOptionSelected: {
    backgroundColor: Colors.primaryLight + '15',
  },
  monthOptionText: {
    fontSize: 16,
    color: Colors.text,
  },
  monthOptionTextSelected: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterButtonEntrada: {
    backgroundColor: Colors.entrada,
    borderColor: Colors.entrada,
  },
  filterButtonSalida: {
    backgroundColor: Colors.salida,
    borderColor: Colors.salida,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.textInverse,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceAlt,
  },
  statsText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  statsValueContainer: {
    alignItems: 'flex-end',
  },
  statsTextUSD: {
    fontSize: 11,
    color: Colors.textLight,
  },
  listContent: {
    padding: 20,
    paddingTop: 12,
  },
  transactionCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      },
    }),
  },
  typeIndicator: {
    width: 5,
  },
  transactionContent: {
    flex: 1,
    padding: 16,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productType: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  totalValueText: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  valueContainer: {
    alignItems: 'flex-end',
  },
  usdValueText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  exchangeRateText: {
    fontSize: 9,
    color: Colors.textLight,
    marginTop: 1,
  },

  transactionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  dateText: {
    fontSize: 14,
    color: Colors.textLight,
  },
  notes: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  transactionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editHint: {
    fontSize: 11,
    color: Colors.textLight,
    fontStyle: 'italic',
  },
  deleteButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textLight,
    marginTop: 4,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: '90%',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  modalScroll: {
    padding: 20,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  typeOption: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  typeOptionEntrada: {
    borderColor: Colors.entrada,
    backgroundColor: Colors.entrada + '10',
  },
  typeOptionSalida: {
    borderColor: Colors.salida,
    backgroundColor: Colors.salida + '10',
  },
  typeOptionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  typeOptionTextActive: {
    color: Colors.text,
  },
  inputGroup: {
    gap: 6,
    marginBottom: 16,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingRight: 40,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notesInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  dropdownButton: {
    position: 'absolute',
    right: 10,
    top: '50%',
    marginTop: -9,
  },
  suggestionDropdown: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
    maxHeight: 140,
    overflow: 'hidden',
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  suggestionTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  suggestionList: {
    maxHeight: 100,
  },
  suggestionItem: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  suggestionText: {
    fontSize: 14,
    color: Colors.text,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  datePartsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  datePartInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    fontSize: 15,
    minWidth: 0,
  },
  dateSeparator: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginHorizontal: 2,
  },
  totalContainer: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 28,
    fontWeight: '700' as const,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginBottom: 40,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textInverse,
  },
});
