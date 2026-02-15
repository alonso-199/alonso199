import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { TrendingUp, TrendingDown, DollarSign, FileSpreadsheet, ChevronDown, Package, X, Tags, Hash, FileText, Check, Calendar } from 'lucide-react-native';
import Colors from '../../constants/colors';
import { useTransactions, useCurrentMonthSummary, useCurrentMonthTransactions } from '../../context/TransactionContext';
import { exportToExcel, formatMonthName, formatCurrency } from '../../utils/excelExport';
import { calculateUSDTotalFromTransactions, formatUSD } from '../../utils/exchangeRate';
import { formatDisplayDate, compareDateISO, parseDateParts, datePartsToISO } from '../../utils/dateUtils';
import { Transaction, TransactionType } from '../../types/transaction';

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
    isVisible: boolean,
    onCloseDropdown: () => void
  ) => {
    if (!isVisible || items.length === 0) return null;
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

export default function DashboardScreen() {
  const router = useRouter();
  const { selectedMonth, setSelectedMonth, availableMonths, isLoading, updateTransaction, suggestions } = useTransactions();
  const summary = useCurrentMonthSummary();
  const transactions = useCurrentMonthTransactions();

  const usdTotals = useMemo(() => {
    const entradas = transactions.filter(t => t.type === 'entrada');
    const salidas = transactions.filter(t => t.type === 'salida');
    const totalEntradasUSD = calculateUSDTotalFromTransactions(entradas);
    const totalSalidasUSD = calculateUSDTotalFromTransactions(salidas);
    return {
      entradas: totalEntradasUSD,
      salidas: totalSalidasUSD,
      margen: totalSalidasUSD - totalEntradasUSD,
    };
  }, [transactions]);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const navigateToHistory = (filter: 'entrada' | 'salida') => {
    router.push({ pathname: '/history', params: { filter } });
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
  };

  const handleSaveEdit = (id: string, updates: Partial<Transaction>) => {
    updateTransaction(id, updates);
    console.log('[Dashboard] Transaction updated:', id);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportToExcel(transactions, summary, selectedMonth);
      console.log('[Dashboard] Export completed');
    } catch (error) {
      console.error('[Dashboard] Export error:', error);
    } finally {
      setExporting(false);
    }
  };

  const recentTransactions = [...transactions]
    .sort((a, b) => -compareDateISO(a.date, b.date))
    .slice(0, 5);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.monthSelector}
          onPress={() => setShowMonthPicker(!showMonthPicker)}
          testID="month-selector"
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

      <View style={styles.summaryCards}>
        <TouchableOpacity 
          style={[styles.card, styles.entradaCard]}
          onPress={() => navigateToHistory('entrada')}
          activeOpacity={0.7}
        >
          <View style={styles.cardIconContainer}>
            <TrendingDown size={24} color={Colors.entrada} />
          </View>
          <Text style={styles.cardLabel}>Compras</Text>
          <Text style={[styles.cardValue, { color: Colors.entrada }]}>
            {formatCurrency(summary.totalEntradas)}
          </Text>
          {usdTotals.entradas > 0 && (
            <Text style={styles.cardValueUSD}>
              ({formatUSD(usdTotals.entradas)})
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.card, styles.salidaCard]}
          onPress={() => navigateToHistory('salida')}
          activeOpacity={0.7}
        >
          <View style={styles.cardIconContainer}>
            <TrendingUp size={24} color={Colors.salida} />
          </View>
          <Text style={styles.cardLabel}>Ventas</Text>
          <Text style={[styles.cardValue, { color: Colors.salida }]}>
            {formatCurrency(summary.totalSalidas)}
          </Text>
          {usdTotals.salidas > 0 && (
            <Text style={styles.cardValueUSD}>
              ({formatUSD(usdTotals.salidas)})
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={[styles.card, styles.margenCard, summary.margenBruto >= 0 ? styles.margenCardPositive : styles.margenCardNegative]}>
        <View style={styles.margenHeader}>
          <DollarSign size={28} color={Colors.textInverse} />
          <Text style={styles.margenLabel}>Margen Bruto</Text>
        </View>
        <Text style={styles.margenValue}>
          {formatCurrency(summary.margenBruto)}
        </Text>
        {(usdTotals.entradas > 0 || usdTotals.salidas > 0) && (
          <Text style={styles.margenValueUSD}>
            ({formatUSD(usdTotals.margen)})
          </Text>
        )}
        <Text style={styles.margenSubtext}>
          {summary.transactionCount} transacciones este mes
        </Text>
      </View>

      <TouchableOpacity
        style={styles.exportButton}
        onPress={handleExport}
        disabled={exporting || transactions.length === 0}
        testID="export-button"
      >
        {exporting ? (
          <ActivityIndicator size="small" color={Colors.textInverse} />
        ) : (
          <>
            <FileSpreadsheet size={20} color={Colors.textInverse} />
            <Text style={styles.exportButtonText}>Exportar a Excel</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>Últimas Transacciones</Text>
        {recentTransactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Package size={48} color={Colors.textLight} />
            <Text style={styles.emptyText}>No hay transacciones este mes</Text>
            <Text style={styles.emptySubtext}>
              Agrega tu primera transacción para comenzar
            </Text>
          </View>
        ) : (
          recentTransactions.map((transaction) => (
            <TouchableOpacity 
              key={transaction.id} 
              style={styles.transactionItem}
              onPress={() => handleEdit(transaction)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.transactionIndicator,
                  {
                    backgroundColor:
                      transaction.type === 'entrada'
                        ? Colors.entrada
                        : Colors.salida,
                  },
                ]}
              />
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionName}>
                  {transaction.productName}
                </Text>
                <Text style={styles.transactionDetails}>
                  {transaction.quantity} unidades · {formatDisplayDate(transaction.date)}
                </Text>
              </View>
              <View style={styles.transactionValueContainer}>
                <Text
                  style={[
                    styles.transactionValue,
                    {
                      color:
                        transaction.type === 'entrada'
                          ? Colors.entrada
                          : Colors.salida,
                    },
                  ]}
                >
                  {transaction.type === 'entrada' ? '-' : '+'}
                  {formatCurrency(transaction.totalValue)}
                </Text>
                {transaction.exchangeRate && (
                  <>
                    <Text style={styles.transactionValueUSD}>
                      (US${(transaction.totalValue / transaction.exchangeRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </Text>
                    <Text style={styles.exchangeRateText}>
                      1 USD = ${transaction.exchangeRate.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <EditModal
        transaction={editingTransaction}
        visible={editingTransaction !== null}
        onClose={() => setEditingTransaction(null)}
        onSave={handleSaveEdit}
        suggestions={suggestions}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
    zIndex: 10,
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
  summaryCards: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
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
  entradaCard: {
    flex: 1,
    borderLeftWidth: 4,
    borderLeftColor: Colors.entrada,
  },
  salidaCard: {
    flex: 1,
    borderLeftWidth: 4,
    borderLeftColor: Colors.salida,
  },
  cardIconContainer: {
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  cardValueUSD: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  margenCard: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 20,
  },
  margenCardPositive: {
    backgroundColor: '#22C55E',
  },
  margenCardNegative: {
    backgroundColor: '#EF4444',
  },
  margenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  margenLabel: {
    fontSize: 16,
    color: Colors.textInverse,
    opacity: 0.9,
  },
  margenValue: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.textInverse,
    marginBottom: 2,
  },
  margenValueUSD: {
    fontSize: 14,
    color: Colors.textInverse,
    opacity: 0.85,
    marginBottom: 4,
  },
  margenSubtext: {
    fontSize: 14,
    color: Colors.textInverse,
    opacity: 0.7,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.secondary,
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textInverse,
  },
  recentSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: Colors.surface,
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textLight,
    marginTop: 4,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  transactionIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionName: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  transactionDetails: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  transactionValue: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  transactionValueContainer: {
    alignItems: 'flex-end',
  },
  transactionValueUSD: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  exchangeRateText: {
    fontSize: 10,
    color: Colors.textLight,
    marginTop: 1,
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
